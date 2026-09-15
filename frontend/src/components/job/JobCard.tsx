import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Building2, CheckSquare, MoreVertical, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TargetJob } from '../../types/job';
import { Resume } from '../../types/resume';
import { formatDateTime } from '../../utils/format';
import { ChecklistProgress, JobCoverage } from '../../utils/job-match';
import { CoverageBar } from './CoverageBar';

interface JobCardProps {
  job: TargetJob;
  coverage: JobCoverage;
  checklistProgress: ChecklistProgress;
  targetResume: Resume | undefined;
  onDelete: (jobId: string) => void;
}

export function JobCard({ job, coverage, checklistProgress, targetResume, onDelete }: JobCardProps) {
  return (
    <article className="group flex min-h-[240px] flex-col justify-between border border-[var(--border)] bg-[var(--surface)] p-5 shadow-panel transition hover:-translate-y-0.5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Target size={18} aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-2xl font-semibold leading-7 text-[var(--ink)]">{job.title}</h3>
              {job.company ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                  <Building2 size={12} aria-hidden /> {job.company}
                </p>
              ) : null}
            </div>
          </div>
          <Menu as="div" className="relative">
            <MenuButton className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)]">
              <MoreVertical size={18} aria-hidden />
            </MenuButton>
            <MenuItems className="absolute right-0 z-20 mt-2 w-44 border border-[var(--border)] bg-[var(--surface)] p-1 shadow-panel">
              <MenuItem>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-[var(--danger)] data-[focus]:bg-[var(--surface-alt)]"
                  type="button"
                  onClick={() => onDelete(job.id)}
                >
                  <Trash2 size={15} aria-hidden /> 删除岗位
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>

        <div className="mt-4">
          <CoverageBar coverage={coverage} />
        </div>

        <div className="mt-4 space-y-1 text-xs text-[var(--muted)]">
          <p>
            主投简历：
            {job.targetResumeId === null ? (
              <span>未指定</span>
            ) : targetResume ? (
              <span className="text-[var(--ink)]">{targetResume.title}</span>
            ) : (
              <span className="text-[var(--danger)]">主投简历已删除</span>
            )}
          </p>
          <p className="flex items-center gap-1">
            <CheckSquare size={12} aria-hidden /> 投递前检查 {checklistProgress.done}/{checklistProgress.total}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">更新 {formatDateTime(job.updatedAt)}</span>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink-invert)] hover:bg-[var(--accent-strong)]"
          to={`/jobs/${job.id}`}
        >
          查看匹配
        </Link>
      </div>
    </article>
  );
}
