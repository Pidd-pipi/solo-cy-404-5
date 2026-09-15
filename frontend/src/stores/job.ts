import { create } from 'zustand';
import {
  CheckItemStatus,
  EvidenceBinding,
  EvidenceSection,
  JobRequirement,
  PreDeliveryCheck,
  TargetJob,
} from '../types/job';
import { Resume } from '../types/resume';
import { createId } from '../utils/format';
import {
  getEntryDisplayName,
  normalizeJobs,
} from '../utils/job-match';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';

const defaultChecklistLabels = [
  '核对联系方式与投递渠道',
  '按岗位要求调整简历摘要',
  '导出 PDF 并检查排版',
  '准备匹配要点（面试用）',
  '记录投递渠道与日期',
];

export interface CreateJobInput {
  title: string;
  company?: string;
  description?: string;
  targetResumeId: string | null;
}

export interface EvidenceRef {
  resumeId: string;
  section: EvidenceSection;
  entryId: string;
  resumeNameSnapshot: string;
  entryNameSnapshot: string;
}

interface JobState {
  jobs: TargetJob[];

  createJob: (input: CreateJobInput) => string;
  updateJob: (
    jobId: string,
    patch: Partial<Pick<TargetJob, 'title' | 'company' | 'description' | 'targetResumeId'>>,
  ) => void;
  deleteJob: (jobId: string) => void;

  addRequirement: (jobId: string, text: string, required?: boolean) => void;
  updateRequirement: (
    jobId: string,
    requirementId: string,
    patch: Partial<Pick<JobRequirement, 'text' | 'required'>>,
  ) => void;
  removeRequirement: (jobId: string, requirementId: string) => void;

  addBinding: (jobId: string, requirementId: string, ref: EvidenceRef) => void;
  removeBinding: (jobId: string, requirementId: string, bindingId: string) => void;

  addCheck: (jobId: string, label: string) => void;
  updateCheck: (
    jobId: string,
    checkId: string,
    patch: Partial<Pick<PreDeliveryCheck, 'label' | 'status'>>,
  ) => void;
  removeCheck: (jobId: string, checkId: string) => void;
  toggleCheck: (jobId: string, checkId: string) => void;

  /** 复制简历时把指向源简历的绑定按位置映射复制一份到副本（由 resume store 单向调用） */
  duplicateBindingsForResume: (source: Resume, clone: Resume) => void;

  replaceJobs: (raw: unknown) => void;
}

const initialJobs = normalizeJobs(readStorage<unknown>(storageKeys.jobs, []));

function persist(jobs: TargetJob[]): void {
  writeStorage(storageKeys.jobs, jobs);
}

function touch(job: TargetJob): TargetJob {
  return { ...job, updatedAt: new Date().toISOString() };
}

/** 按数组位置建立 旧条目 id → 新条目 id 的映射（resume store 按数组顺序逐条重生成 id） */
function buildIdMap(entries: { id: string }[], clones: { id: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  const length = Math.min(entries.length, clones.length);
  for (let index = 0; index < length; index += 1) {
    map.set(entries[index].id, clones[index].id);
  }
  return map;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: initialJobs,

  createJob: (input) => {
    const now = new Date().toISOString();
    const job: TargetJob = {
      id: createId('job'),
      title: input.title.trim() || '未命名岗位',
      company: input.company?.trim() ?? '',
      description: input.description?.trim() ?? '',
      targetResumeId: input.targetResumeId,
      requirements: [],
      checklist: defaultChecklistLabels.map((label) => ({
        id: createId('check'),
        label,
        status: 'pending' satisfies CheckItemStatus,
        createdAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ jobs: [job, ...state.jobs] }));
    persist(get().jobs);
    return job.id;
  },

  updateJob: (jobId, patch) => {
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId ? touch({ ...job, ...patch }) : job)),
    }));
    persist(get().jobs);
  },

  deleteJob: (jobId) => {
    set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) }));
    persist(get().jobs);
  },

  addRequirement: (jobId, text, required = true) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const requirement: JobRequirement = {
      id: createId('req'),
      text: trimmed,
      required,
      createdAt: new Date().toISOString(),
      bindings: [],
    };
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({ ...job, requirements: [...job.requirements, requirement] })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  updateRequirement: (jobId, requirementId, patch) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({
              ...job,
              requirements: job.requirements.map((requirement) =>
                requirement.id === requirementId ? { ...requirement, ...patch } : requirement,
              ),
            })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  removeRequirement: (jobId, requirementId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({
              ...job,
              requirements: job.requirements.filter((item) => item.id !== requirementId),
            })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  addBinding: (jobId, requirementId, ref) => {
    let changed = false;
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id !== jobId) return job;
        return {
          ...job,
          requirements: job.requirements.map((requirement) => {
            if (requirement.id !== requirementId) return requirement;
            // 三元身份键去重：同一证据重复绑定只保留一条，幂等不报错
            const duplicated = requirement.bindings.some(
              (binding) =>
                binding.resumeId === ref.resumeId &&
                binding.section === ref.section &&
                binding.entryId === ref.entryId,
            );
            if (duplicated) return requirement;
            changed = true;
            const binding: EvidenceBinding = {
              id: createId('binding'),
              resumeId: ref.resumeId,
              section: ref.section,
              entryId: ref.entryId,
              boundAt: new Date().toISOString(),
              resumeNameSnapshot: ref.resumeNameSnapshot,
              entryNameSnapshot: ref.entryNameSnapshot,
            };
            return { ...requirement, bindings: [...requirement.bindings, binding] };
          }),
        };
      }),
    }));
    if (changed) persist(get().jobs);
  },

  removeBinding: (jobId, requirementId, bindingId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({
              ...job,
              requirements: job.requirements.map((requirement) =>
                requirement.id === requirementId
                  ? {
                      ...requirement,
                      bindings: requirement.bindings.filter((binding) => binding.id !== bindingId),
                    }
                  : requirement,
              ),
            })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  addCheck: (jobId, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const check: PreDeliveryCheck = {
      id: createId('check'),
      label: trimmed,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId ? touch({ ...job, checklist: [...job.checklist, check] }) : job,
      ),
    }));
    persist(get().jobs);
  },

  updateCheck: (jobId, checkId, patch) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({
              ...job,
              checklist: job.checklist.map((check) =>
                check.id === checkId ? { ...check, ...patch } : check,
              ),
            })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  removeCheck: (jobId, checkId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({ ...job, checklist: job.checklist.filter((check) => check.id !== checkId) })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  toggleCheck: (jobId, checkId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? touch({
              ...job,
              checklist: job.checklist.map((check) =>
                check.id === checkId
                  ? { ...check, status: check.status === 'done' ? 'pending' : 'done' }
                  : check,
              ),
            })
          : job,
      ),
    }));
    persist(get().jobs);
  },

  duplicateBindingsForResume: (source, clone) => {
    const idMaps: Record<EvidenceSection, Map<string, string>> = {
      work: buildIdMap(source.workExperiences, clone.workExperiences),
      project: buildIdMap(source.projects, clone.projects),
      skill: buildIdMap(source.skills, clone.skills),
      education: buildIdMap(source.educations, clone.educations),
    };

    let changed = false;
    set((state) => ({
      jobs: state.jobs.map((job) => ({
        ...job,
        requirements: job.requirements.map((requirement) => {
          const sourceBindings = requirement.bindings.filter(
            (binding) => binding.resumeId === source.id,
          );
          if (sourceBindings.length === 0) return requirement;

          // 原绑定（指向源简历）全部保留，仅向副本追加独立的新绑定
          const seenKeys = new Set(
            requirement.bindings.map(
              (binding) => `${binding.resumeId}::${binding.section}::${binding.entryId}`,
            ),
          );
          const copies: EvidenceBinding[] = [];

          for (const binding of sourceBindings) {
            const newEntryId = idMaps[binding.section].get(binding.entryId);
            // 源绑定已失联（源条目已不存在）→ 跳过，不复制成永久失联副本
            if (!newEntryId) continue;
            const key = `${clone.id}::${binding.section}::${newEntryId}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            copies.push({
              id: createId('binding'),
              resumeId: clone.id,
              section: binding.section,
              entryId: newEntryId,
              boundAt: new Date().toISOString(),
              resumeNameSnapshot: clone.title,
              entryNameSnapshot:
                getEntryDisplayName(clone, binding.section, newEntryId) ??
                binding.entryNameSnapshot,
            });
          }

          if (copies.length === 0) return requirement;
          changed = true;
          return { ...requirement, bindings: [...requirement.bindings, ...copies] };
        }),
      })),
    }));
    if (changed) persist(get().jobs);
  },

  replaceJobs: (raw) => {
    const jobs = normalizeJobs(raw);
    set({ jobs });
    persist(jobs);
  },
}));
