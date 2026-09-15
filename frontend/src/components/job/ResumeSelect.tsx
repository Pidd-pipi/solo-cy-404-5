import { Resume } from '../../types/resume';

interface ResumeSelectProps {
  resumes: Resume[];
  value: string | null;
  onChange: (resumeId: string | null) => void;
  allowNull?: boolean;
  nullLabel?: string;
  ariaLabel?: string;
  className?: string;
}

export function ResumeSelect({
  resumes,
  value,
  onChange,
  allowNull = false,
  nullLabel = '暂不指定',
  ariaLabel = '选择简历',
  className = '',
}: ResumeSelectProps) {
  const targetMissing = value !== null && !resumes.some((resume) => resume.id === value);

  return (
    <select
      className={`min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] ${className}`}
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value || null)}
    >
      {allowNull ? <option value="">{nullLabel}</option> : null}
      {targetMissing && value ? <option value={value}>主投简历已删除</option> : null}
      {resumes.map((resume) => (
        <option key={resume.id} value={resume.id}>
          {resume.title}
        </option>
      ))}
    </select>
  );
}
