import { FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { Button } from '../common/Button';
import { ResumeSelect } from './ResumeSelect';
import { CreateJobInput } from '../../stores/job';
import { Resume } from '../../types/resume';

interface CreateJobDialogProps {
  open: boolean;
  resumes: Resume[];
  defaultResumeId: string | null;
  onClose: () => void;
  onSubmit: (input: CreateJobInput) => void;
}

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]';

export function CreateJobDialog({ open, resumes, defaultResumeId, onClose, onSubmit }: CreateJobDialogProps) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [targetResumeId, setTargetResumeId] = useState<string | null>(defaultResumeId);

  useEffect(() => {
    if (open) {
      setTitle('');
      setCompany('');
      setDescription('');
      setTargetResumeId(defaultResumeId);
    }
  }, [open, defaultResumeId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, company, description, targetResumeId });
  };

  return (
    <Dialog className="relative z-50" open={open} onClose={onClose}>
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="font-display text-2xl font-semibold text-[var(--ink)]">新建目标岗位</DialogTitle>
            <button
              type="button"
              aria-label="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)]"
              onClick={onClose}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1 text-sm font-medium text-[var(--ink)]">
              <span>岗位名称 *</span>
              <input
                className={inputClass}
                value={title}
                placeholder="例如：高级产品经理"
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-[var(--ink)]">
              <span>公司</span>
              <input
                className={inputClass}
                value={company}
                placeholder="例如：青松科技"
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-[var(--ink)]">
              <span>主投简历</span>
              <ResumeSelect
                resumes={resumes}
                value={targetResumeId}
                onChange={setTargetResumeId}
                allowNull
                nullLabel="暂不指定"
                className="w-full"
                ariaLabel="主投简历"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-[var(--ink)]">
              <span>JD 备注</span>
              <textarea
                className={`${inputClass} min-h-28 resize-y leading-6`}
                value={description}
                placeholder="粘贴岗位描述或记录投递备注"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={onClose}>取消</Button>
              <Button type="submit" variant="primary" disabled={!title.trim()}>
                创建岗位
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
