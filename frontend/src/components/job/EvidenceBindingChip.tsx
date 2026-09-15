import { AlertTriangle, X } from 'lucide-react';
import { EvidenceBinding } from '../../types/job';
import { Resume } from '../../types/resume';
import { getBindingDisplay, sectionLabel } from '../../utils/job-match';

interface EvidenceBindingChipProps {
  binding: EvidenceBinding;
  resumes: Resume[];
  onUnbind: () => void;
}

export function EvidenceBindingChip({ binding, resumes, onUnbind }: EvidenceBindingChipProps) {
  const display = getBindingDisplay(resumes, binding);
  const orphan = display.state.kind !== 'live';

  return (
    <span
      data-testid="binding-chip"
      data-orphan={orphan ? 'true' : 'false'}
      className={`inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
        orphan
          ? 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]'
          : 'border-[var(--border)] bg-[var(--surface-alt)] text-[var(--ink)]'
      }`}
      title={display.state.kind === 'resume-missing' ? '来源简历已删除' : display.state.kind === 'entry-missing' ? '简历中的该条目已删除' : ''}
    >
      <span className="shrink-0 rounded-sm bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
        {sectionLabel[binding.section]}
      </span>
      {orphan ? <AlertTriangle size={12} className="shrink-0" aria-hidden /> : null}
      <span className="min-w-0 truncate">
        <span className={orphan ? 'line-through opacity-80' : 'font-semibold'}>{display.entryName}</span>
        <span className="opacity-70"> · {display.resumeName}</span>
      </span>
      {orphan ? (
        <span className="shrink-0 font-semibold">
          {display.state.kind === 'resume-missing' ? '来源简历已删除' : '条目已删除'}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="解绑该证据"
        data-testid="binding-unbind"
        onClick={onUnbind}
        className="shrink-0 rounded-sm opacity-60 hover:opacity-100"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}
