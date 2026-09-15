import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Check, FileQuestion, Link2, X } from 'lucide-react';
import { EvidenceRef } from '../../stores/job';
import { EvidenceSection, JobRequirement } from '../../types/job';
import { Resume } from '../../types/resume';
import { formatDateRange } from '../../utils/format';
import {
  evidenceSections,
  getEntryDisplayName,
  getSectionEntries,
} from '../../utils/job-match';
import { Education } from '../../types/education';
import { skillCategoryLabels } from '../../types/enums';
import { Project } from '../../types/project';
import { Skill } from '../../types/skill';
import { WorkExperience } from '../../types/work-experience';
import { ResumeSelect } from './ResumeSelect';

interface EvidencePickerDialogProps {
  open: boolean;
  resumes: Resume[];
  requirement: JobRequirement;
  initialResumeId: string | null;
  onClose: () => void;
  onBind: (ref: EvidenceRef) => void;
}

function entryMeta(resume: Resume, section: EvidenceSection, entryId: string): string {
  const entry = getSectionEntries(resume, section).find((item) => item.id === entryId);
  if (!entry) return '';
  switch (section) {
    case 'work': {
      const work = entry as WorkExperience;
      return formatDateRange(work.startDate, work.endDate);
    }
    case 'project': {
      const project = entry as Project;
      return formatDateRange(project.startDate, project.endDate);
    }
    case 'skill': {
      const skill = entry as Skill;
      return skillCategoryLabels[skill.category];
    }
    case 'education': {
      const education = entry as Education;
      return formatDateRange(education.startDate, education.endDate);
    }
    default:
      return '';
  }
}

export function EvidencePickerDialog({
  open,
  resumes,
  requirement,
  initialResumeId,
  onClose,
  onBind,
}: EvidencePickerDialogProps) {
  const [resumeId, setResumeId] = useState<string | null>(initialResumeId);
  const [section, setSection] = useState(evidenceSections[0].id);

  useEffect(() => {
    if (open) {
      setResumeId(initialResumeId);
      setSection(evidenceSections[0].id);
    }
  }, [open, initialResumeId]);

  const resume = useMemo(
    () => resumes.find((item) => item.id === resumeId),
    [resumes, resumeId],
  );

  // 已绑判定只看三元身份键：即使绑定已失联，同 id 行仍禁用，杜绝重复键
  const boundKeys = useMemo(
    () =>
      new Set(
        requirement.bindings.map(
          (binding) => `${binding.resumeId}::${binding.section}::${binding.entryId}`,
        ),
      ),
    [requirement.bindings],
  );

  const entries = resume ? getSectionEntries(resume, section) : [];

  const handleSelect = (entryId: string) => {
    if (!resume) return;
    const entryName = getEntryDisplayName(resume, section, entryId);
    if (entryName === null) return;
    onBind({
      resumeId: resume.id,
      section,
      entryId,
      resumeNameSnapshot: resume.title,
      entryNameSnapshot: entryName,
    });
    onClose();
  };

  return (
    <Dialog className="relative z-50" open={open} onClose={onClose}>
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[85vh] w-full max-w-xl flex-col border border-[var(--border)] bg-[var(--surface)] p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-2xl font-semibold text-[var(--ink)]">
                绑定简历证据
              </DialogTitle>
              <p className="mt-1 text-xs text-[var(--muted)]">为要求「{requirement.text}」选择工作、项目、技能或教育条目</p>
            </div>
            <button
              type="button"
              aria-label="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)]"
              onClick={onClose}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-1.5 text-xs font-semibold uppercase text-[var(--muted)]">来源简历</p>
            {resumes.length === 0 ? (
              <p className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--muted)]">
                <FileQuestion size={15} aria-hidden /> 还没有简历，请先创建简历后再绑定证据。
              </p>
            ) : (
              <ResumeSelect
                resumes={resumes}
                value={resumeId}
                onChange={setResumeId}
                className="w-full"
                ariaLabel="选择来源简历"
              />
            )}
          </div>

          {resume ? (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="证据分类">
                {evidenceSections.map((item) => {
                  const count = getSectionEntries(resume, item.id).length;
                  const active = item.id === section;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid="picker-section-tab"
                      data-section={item.id}
                      onClick={() => setSection(item.id)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-alt)]'
                      }`}
                    >
                      {item.label}（{count}）
                    </button>
                  );
                })}
              </div>

              <ul className="mt-4 min-h-[120px] flex-1 space-y-2 overflow-auto pr-1">
                {entries.length === 0 ? (
                  <li className="flex h-[120px] items-center justify-center rounded-md border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
                    该简历暂无{evidenceSections.find((item) => item.id === section)?.label}条目
                  </li>
                ) : (
                  entries.map((entry) => {
                    const key = `${resume.id}::${section}::${entry.id}`;
                    const bound = boundKeys.has(key);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          disabled={bound}
                          data-testid="picker-entry"
                          data-entry-id={entry.id}
                          data-bound={bound ? 'true' : 'false'}
                          onClick={() => handleSelect(entry.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                            bound
                              ? 'cursor-not-allowed border-[var(--border)] opacity-50'
                              : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-[var(--ink)]">
                              {getEntryDisplayName(resume, section, entry.id)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                              {entryMeta(resume, section, entry.id)}
                            </span>
                          </span>
                          {bound ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]">
                              <Check size={13} aria-hidden /> 已绑定
                            </span>
                          ) : (
                            <Link2 size={15} className="shrink-0 text-[var(--muted)]" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
