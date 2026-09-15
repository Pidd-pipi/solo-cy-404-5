import { Unlink } from 'lucide-react';
import { JobCoverage } from '../../utils/job-match';

interface CoverageBarProps {
  coverage: Pick<JobCoverage, 'covered' | 'total' | 'percent' | 'orphanBindingCount'>;
  size?: 'sm' | 'lg';
}

export function CoverageBar({ coverage, size = 'sm' }: CoverageBarProps) {
  const { covered, total, percent, orphanBindingCount } = coverage;
  const hasRequirements = total > 0;

  return (
    <div data-testid="coverage-bar">
      <div className={`flex items-center justify-between ${size === 'lg' ? 'text-sm' : 'text-xs'} text-[var(--muted)]`}>
        <span data-testid="coverage-summary">
          {hasRequirements ? (
            <>
              覆盖 <span className="font-semibold text-[var(--ink)]">{covered}</span> / {total} 条要求
            </>
          ) : (
            '暂无要求'
          )}
        </span>
        <span className="flex items-center gap-2">
          {orphanBindingCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[var(--danger)]" data-testid="coverage-orphan-count">
              <Unlink size={12} aria-hidden /> {orphanBindingCount} 条失联
            </span>
          ) : null}
          {hasRequirements ? <span className="font-semibold text-[var(--accent-strong)]" data-testid="coverage-percent">{percent}%</span> : null}
        </span>
      </div>
      <div className={`mt-2 w-full overflow-hidden rounded-full bg-[var(--surface-alt)] ${size === 'lg' ? 'h-2.5' : 'h-1.5'}`}>
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${hasRequirements ? percent : 0}%` }}
        />
      </div>
    </div>
  );
}
