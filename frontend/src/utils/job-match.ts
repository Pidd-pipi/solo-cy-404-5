import {
  BindingState,
  CheckItemStatus,
  EvidenceBinding,
  EvidenceSection,
  JobRequirement,
  PreDeliveryCheck,
  TargetJob,
} from '../types/job';
import { Education } from '../types/education';
import { Project } from '../types/project';
import { Resume } from '../types/resume';
import { Skill } from '../types/skill';
import { WorkExperience } from '../types/work-experience';
import { createId } from './format';

/** 证据分类元数据（顺序即选择器 tab 顺序） */
export const evidenceSections: { id: EvidenceSection; label: string }[] = [
  { id: 'work', label: '工作经历' },
  { id: 'project', label: '项目经历' },
  { id: 'skill', label: '技能' },
  { id: 'education', label: '教育经历' },
];

export const sectionLabel: Record<EvidenceSection, string> = {
  work: '工作',
  project: '项目',
  skill: '技能',
  education: '教育',
};

const sectionSet: ReadonlySet<string> = new Set(evidenceSections.map((item) => item.id));

export function isEvidenceSection(value: unknown): value is EvidenceSection {
  return typeof value === 'string' && sectionSet.has(value);
}

type SectionEntry = WorkExperience | Project | Skill | Education;

/** 按简历数组顺序取某分类下的条目 */
export function getSectionEntries(resume: Resume, section: EvidenceSection): SectionEntry[] {
  switch (section) {
    case 'work':
      return resume.workExperiences;
    case 'project':
      return resume.projects;
    case 'skill':
      return resume.skills;
    case 'education':
      return resume.educations;
  }
}

function joinParts(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(' · ');
}

/** 条目的统一显示名（绑定快照与实时展示共用同一口径） */
export function getEntryDisplayName(resume: Resume, section: EvidenceSection, entryId: string): string | null {
  const entry = getSectionEntries(resume, section).find((item) => item.id === entryId);
  if (!entry) {
    return null;
  }
  switch (section) {
    case 'work': {
      const work = entry as WorkExperience;
      return joinParts([work.companyName, work.position]) || '未命名工作经历';
    }
    case 'project': {
      const project = entry as Project;
      const name = project.name.trim();
      if (!name) return '未命名项目';
      return project.role.trim() ? `${name}（${project.role.trim()}）` : name;
    }
    case 'skill':
      return (entry as Skill).name.trim() || '未命名技能';
    case 'education': {
      const education = entry as Education;
      return joinParts([education.school, education.major]) || '未命名教育经历';
    }
  }
}

export function findResume(resumes: Resume[], resumeId: string): Resume | undefined {
  return resumes.find((resume) => resume.id === resumeId);
}

export function findEntry(
  resume: Resume,
  section: EvidenceSection,
  entryId: string,
): SectionEntry | undefined {
  return getSectionEntries(resume, section).find((item) => item.id === entryId);
}

/**
 * 派生绑定的实时状态：
 * - 来源简历不在 → resume-missing
 * - 简历在但条目不在（删除/换了同名条目）→ entry-missing
 * - 都在 → live，带实时名字
 */
export function resolveBinding(resumes: Resume[], binding: EvidenceBinding): BindingState {
  const resume = findResume(resumes, binding.resumeId);
  if (!resume) {
    return { kind: 'resume-missing' };
  }
  const currentEntryName = getEntryDisplayName(resume, binding.section, binding.entryId);
  if (currentEntryName === null) {
    return { kind: 'entry-missing' };
  }
  return { kind: 'live', currentResumeName: resume.title, currentEntryName };
}

export interface BindingDisplay {
  resumeName: string;
  entryName: string;
  state: BindingState;
}

/** 展示名：live 用实时名（改名可追踪）；失联用绑定瞬间的快照名 */
export function getBindingDisplay(resumes: Resume[], binding: EvidenceBinding): BindingDisplay {
  const state = resolveBinding(resumes, binding);
  if (state.kind === 'live') {
    return { resumeName: state.currentResumeName, entryName: state.currentEntryName, state };
  }
  return {
    resumeName: binding.resumeNameSnapshot,
    entryName: binding.entryNameSnapshot,
    state,
  };
}

/** 要求下至少有一个 live 绑定即视为已覆盖（失联不计） */
export function isRequirementCovered(resumes: Resume[], requirement: JobRequirement): boolean {
  return requirement.bindings.some((binding) => resolveBinding(resumes, binding).kind === 'live');
}

export interface JobCoverage {
  total: number;
  covered: number;
  percent: number;
  liveBindingCount: number;
  orphanBindingCount: number;
}

export function getJobCoverage(resumes: Resume[], job: TargetJob): JobCoverage {
  const total = job.requirements.length;
  let covered = 0;
  let liveBindingCount = 0;
  let orphanBindingCount = 0;

  for (const requirement of job.requirements) {
    let requirementCovered = false;
    for (const binding of requirement.bindings) {
      if (resolveBinding(resumes, binding).kind === 'live') {
        liveBindingCount += 1;
        requirementCovered = true;
      } else {
        orphanBindingCount += 1;
      }
    }
    if (requirementCovered) {
      covered += 1;
    }
  }

  return {
    total,
    covered,
    percent: total === 0 ? 0 : Math.round((covered / total) * 100),
    liveBindingCount,
    orphanBindingCount,
  };
}

export interface ChecklistProgress {
  done: number;
  total: number;
  percent: number;
}

export function getChecklistProgress(checklist: PreDeliveryCheck[]): ChecklistProgress {
  const total = checklist.length;
  const done = checklist.filter((item) => item.status === 'done').length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ---------------------------------------------------------------------------
// 归一化：旧备份 / 损坏数据兜底。保守修复，不做跨 store 的 id 校正。
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeBinding(raw: unknown, now: string): EvidenceBinding | null {
  if (!isObject(raw)) return null;
  const section = raw.section;
  if (!isEvidenceSection(section)) return null;
  const resumeId = asString(raw.resumeId);
  const entryId = asString(raw.entryId);
  if (!resumeId || !entryId) return null;

  return {
    id: asString(raw.id) || createId('binding'),
    resumeId,
    section,
    entryId,
    boundAt: asString(raw.boundAt) || now,
    resumeNameSnapshot: asString(raw.resumeNameSnapshot),
    entryNameSnapshot: asString(raw.entryNameSnapshot),
  };
}

function normalizeRequirement(raw: unknown, now: string): JobRequirement | null {
  if (!isObject(raw)) return null;
  // 同一要求内按三元键去重，兜底历史/备份中的重复绑定
  const bindings: EvidenceBinding[] = [];
  const seen = new Set<string>();
  for (const item of asArray(raw.bindings)) {
    const binding = normalizeBinding(item, now);
    if (!binding) continue;
    const key = `${binding.resumeId}::${binding.section}::${binding.entryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bindings.push(binding);
  }

  return {
    id: asString(raw.id) || createId('req'),
    text: asString(raw.text),
    required: typeof raw.required === 'boolean' ? raw.required : true,
    createdAt: asString(raw.createdAt) || now,
    bindings,
  };
}

function normalizeCheck(raw: unknown, now: string): PreDeliveryCheck | null {
  if (!isObject(raw)) return null;
  const status: CheckItemStatus = raw.status === 'done' ? 'done' : 'pending';
  return {
    id: asString(raw.id) || createId('check'),
    label: asString(raw.label),
    status,
    createdAt: asString(raw.createdAt) || now,
  };
}

/** 把任意来源（localStorage / 备份文件）的数据归一化为合法的岗位集合 */
export function normalizeJobs(raw: unknown): TargetJob[] {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();

  const jobs: TargetJob[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const requirements = asArray(item.requirements)
      .map((req) => normalizeRequirement(req, now))
      .filter((req): req is JobRequirement => req !== null);
    const checklist = asArray(item.checklist)
      .map((check) => normalizeCheck(check, now))
      .filter((check): check is PreDeliveryCheck => check !== null);

    const targetResumeIdRaw = item.targetResumeId;
    jobs.push({
      id: asString(item.id) || createId('job'),
      title: asString(item.title) || '未命名岗位',
      company: asString(item.company),
      description: asString(item.description),
      targetResumeId:
        typeof targetResumeIdRaw === 'string' && targetResumeIdRaw ? targetResumeIdRaw : null,
      requirements,
      checklist,
      createdAt: asString(item.createdAt) || now,
      updatedAt: asString(item.updatedAt) || now,
    });
  }
  return jobs;
}
