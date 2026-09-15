import { useState } from 'react';
import { CheckCircle2, CircleDashed, Link2, Pencil, Trash2 } from 'lucide-react';
import { JobRequirement } from '../../types/job';
import { Resume } from '../../types/resume';
import { isRequirementCovered } from '../../utils/job-match';
import { Button } from '../common/Button';
import { EvidenceBindingChip } from './EvidenceBindingChip';

interface RequirementItemProps {
  requirement: JobRequirement;
  resumes: Resume[];
  onBindEvidence: (requirement: JobRequirement) => void;
  onUpdateText: (text: string) => void;
  onToggleRequired: () => void;
  onRemove: () => void;
  onUnbind: (bindingId: string) => void;
}

export function RequirementItem({
  requirement,
  resumes,
  onBindEvidence,
  onUpdateText,
  onToggleRequired,
  onRemove,
  onUnbind,
}: RequirementItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(requirement.text);
  const covered = isRequirementCovered(resumes, requirement);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== requirement.text) {
      onUpdateText(trimmed);
    }
    setEditing(false);
  };

  return (
    <li className="border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3">
        <span className={covered ? 'mt-0.5 text-[var(--accent)]' : 'mt-0.5 text-[var(--muted)]'}>
          {covered ? <CheckCircle2 size={18} aria-hidden /> : <CircleDashed size={18} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)]"
                value={draft}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitEdit();
                  if (event.key === 'Escape') setEditing(false);
                }}
              />
              <Button
                className="px-3 py-1.5"
                onClick={commitEdit}
                variant="primary"
              >
                保存
              </Button>
              <Button
                className="px-3 py-1.5"
                onClick={() => setEditing(false)}
              >
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">{requirement.text}</p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="编辑要求"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                  onClick={() => {
                    setDraft(requirement.text);
                    setEditing(true);
                  }}
                >
                  <Pencil size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="删除要求"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--danger)]"
                  onClick={onRemove}
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleRequired}
              className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                requirement.required
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'bg-[var(--surface-alt)] text-[var(--muted)]'
              }`}
            >
              {requirement.required ? '硬性要求' : '加分项'}
            </button>
            <span className="text-xs text-[var(--muted)]">
              {covered ? '已有简历证据覆盖' : '尚未绑定证据'}
            </span>
          </div>

          {requirement.bindings.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {requirement.bindings.map((binding) => (
                <EvidenceBindingChip
                  key={binding.id}
                  binding={binding}
                  resumes={resumes}
                  onUnbind={() => onUnbind(binding.id)}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            <Button
              className="px-3 py-1.5 text-xs"
              icon={<Link2 size={13} aria-hidden />}
              onClick={() => onBindEvidence(requirement)}
            >
              绑定证据
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
