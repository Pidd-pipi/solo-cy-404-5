import { FormEvent, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { PreDeliveryCheck } from '../../types/job';
import { useJobStore } from '../../stores/job';
import { getChecklistProgress } from '../../utils/job-match';

interface ChecklistPanelProps {
  jobId: string;
  checklist: PreDeliveryCheck[];
}

export function ChecklistPanel({ jobId, checklist }: ChecklistPanelProps) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const addCheck = useJobStore((state) => state.addCheck);
  const updateCheck = useJobStore((state) => state.updateCheck);
  const removeCheck = useJobStore((state) => state.removeCheck);
  const toggleCheck = useJobStore((state) => state.toggleCheck);
  const progress = getChecklistProgress(checklist);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    addCheck(jobId, draft);
    setDraft('');
  };

  const commitEdit = (checkId: string) => {
    const trimmed = editingText.trim();
    if (trimmed) {
      updateCheck(jobId, checkId, { label: trimmed });
    }
    setEditingId(null);
  };

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[var(--ink)]">投递前检查</h2>
        <span className="text-sm font-semibold text-[var(--accent-strong)]">
          {progress.done}/{progress.total}
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress.percent}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {checklist.map((check) => (
          <li
            key={check.id}
            className="group flex items-center gap-2.5 rounded-md border border-[var(--border)] px-3 py-2"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={check.status === 'done'}
              aria-label={check.status === 'done' ? '标记为未完成' : '标记为完成'}
              onClick={() => toggleCheck(jobId, check.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                check.status === 'done'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink-invert)]'
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]'
              }`}
            >
              {check.status === 'done' ? <Check size={13} aria-hidden /> : null}
            </button>

            {editingId === check.id ? (
              <input
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--ink)]"
                value={editingText}
                autoFocus
                onChange={(event) => setEditingText(event.target.value)}
                onBlur={() => commitEdit(check.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitEdit(check.id);
                  if (event.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  check.status === 'done' ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'
                }`}
                title={check.label}
              >
                {check.label}
              </span>
            )}

            <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
              <button
                type="button"
                aria-label="编辑检查项"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                onClick={() => {
                  setEditingId(check.id);
                  setEditingText(check.label);
                }}
              >
                <Pencil size={13} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="删除检查项"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--danger)]"
                onClick={() => removeCheck(jobId, check.id)}
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="mt-3 flex items-center gap-2" onSubmit={handleAdd}>
        <input
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
          value={draft}
          placeholder="添加检查项，回车确认"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="添加检查项"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} aria-hidden />
        </button>
      </form>
    </section>
  );
}
