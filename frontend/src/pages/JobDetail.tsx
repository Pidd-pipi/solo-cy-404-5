import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ChecklistPanel } from '../components/job/ChecklistPanel';
import { CoverageBar } from '../components/job/CoverageBar';
import { EvidencePickerDialog } from '../components/job/EvidencePickerDialog';
import { RequirementItem } from '../components/job/RequirementItem';
import { ResumeSelect } from '../components/job/ResumeSelect';
import { useJobStore } from '../stores/job';
import { useResumeStore } from '../stores/resume';
import { JobRequirement } from '../types/job';
import { getJobCoverage } from '../utils/job-match';

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requirementDraft, setRequirementDraft] = useState('');
  const [pickingRequirement, setPickingRequirement] = useState<JobRequirement | null>(null);

  const jobs = useJobStore((state) => state.jobs);
  const updateJob = useJobStore((state) => state.updateJob);
  const deleteJob = useJobStore((state) => state.deleteJob);
  const addRequirement = useJobStore((state) => state.addRequirement);
  const updateRequirement = useJobStore((state) => state.updateRequirement);
  const removeRequirement = useJobStore((state) => state.removeRequirement);
  const addBinding = useJobStore((state) => state.addBinding);
  const removeBinding = useJobStore((state) => state.removeBinding);
  const resumes = useResumeStore((state) => state.resumes);

  const job = useMemo(() => jobs.find((item) => item.id === id), [jobs, id]);

  if (!job) {
    return (
      <EmptyState
        actionLabel="回到岗位列表"
        description="该岗位可能已经被删除，返回列表后可以创建新的目标岗位。"
        onAction={() => navigate('/jobs')}
        title="没有找到这个岗位"
      />
    );
  }

  const coverage = getJobCoverage(resumes, job);
  const targetResumeExists = job.targetResumeId !== null && resumes.some((r) => r.id === job.targetResumeId);
  const pickerInitialResumeId =
    job.targetResumeId && targetResumeExists ? job.targetResumeId : resumes[0]?.id ?? null;

  const handleAddRequirement = (event: FormEvent) => {
    event.preventDefault();
    if (!requirementDraft.trim()) return;
    addRequirement(job.id, requirementDraft);
    setRequirementDraft('');
  };

  const handleDeleteJob = () => {
    if (window.confirm('确定删除该岗位及其全部要求与绑定吗？')) {
      deleteJob(job.id);
      navigate('/jobs');
    }
  };

  return (
    <div>
      <div className="border-b border-[var(--border)] pb-6">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ChevronLeft size={15} aria-hidden /> 岗位列表
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <input
              className="w-full bg-transparent font-display text-4xl font-semibold text-[var(--ink)] outline-none"
              value={job.title}
              aria-label="岗位名称"
              onChange={(event) => updateJob(job.id, { title: event.target.value })}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                className="min-h-9 w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                value={job.company}
                placeholder="公司名称（选填）"
                aria-label="公司名称"
                onChange={(event) => updateJob(job.id, { company: event.target.value })}
              />
              <ResumeSelect
                resumes={resumes}
                value={job.targetResumeId}
                onChange={(resumeId) => updateJob(job.id, { targetResumeId: resumeId })}
                allowNull
                nullLabel="未指定主投简历"
                ariaLabel="主投简历"
              />
              {job.targetResumeId !== null && !targetResumeExists ? (
                <span className="text-sm font-semibold text-[var(--danger)]">主投简历已删除</span>
              ) : null}
            </div>
          </div>
          <Button variant="danger" icon={<Trash2 size={16} aria-hidden />} onClick={handleDeleteJob}>
            删除岗位
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-xl font-semibold text-[var(--ink)]">要求覆盖度</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              已绑定 {coverage.liveBindingCount} 条有效证据，覆盖 {coverage.covered}/{coverage.total} 条要求。
              证据来自任意简历；改名自动追踪，条目或简历被删除后会标记为失联。
            </p>
            <div className="mt-4">
              <CoverageBar coverage={coverage} size="lg" />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-[var(--ink)]">岗位要求</h2>
              <span className="text-xs text-[var(--muted)]">{job.requirements.length} 条</span>
            </div>

            {job.requirements.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--muted)]">
                暂无要求，先在下方添加一条岗位要求，再为它绑定简历证据。
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {job.requirements.map((requirement) => (
                  <RequirementItem
                    key={requirement.id}
                    requirement={requirement}
                    resumes={resumes}
                    onBindEvidence={setPickingRequirement}
                    onUpdateText={(text) => updateRequirement(job.id, requirement.id, { text })}
                    onToggleRequired={() =>
                      updateRequirement(job.id, requirement.id, { required: !requirement.required })
                    }
                    onRemove={() => removeRequirement(job.id, requirement.id)}
                    onUnbind={(bindingId) => removeBinding(job.id, requirement.id, bindingId)}
                  />
                ))}
              </ul>
            )}

            <form className="mt-3 flex items-center gap-2" onSubmit={handleAddRequirement}>
              <input
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                value={requirementDraft}
                placeholder="添加岗位要求，例如：5 年以上 B 端产品经验，回车确认"
                onChange={(event) => setRequirementDraft(event.target.value)}
              />
              <Button type="submit" variant="primary" icon={<Plus size={15} aria-hidden />} disabled={!requirementDraft.trim()}>
                添加要求
              </Button>
            </form>
          </section>

          <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-xl font-semibold text-[var(--ink)]">JD 备注</h2>
              <textarea
                className="mt-3 min-h-28 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--ink)] placeholder:text-[var(--muted)]"
                value={job.description}
                placeholder="粘贴岗位描述或投递备注"
                onChange={(event) => updateJob(job.id, { description: event.target.value })}
              />
            </section>
        </div>

        <aside className="space-y-5">
          <ChecklistPanel jobId={job.id} checklist={job.checklist} />
        </aside>
      </div>

      {pickingRequirement ? (
        <EvidencePickerDialog
          open={Boolean(pickingRequirement)}
          resumes={resumes}
          requirement={pickingRequirement}
          initialResumeId={pickerInitialResumeId}
          onClose={() => setPickingRequirement(null)}
          onBind={(ref) => addBinding(job.id, pickingRequirement.id, ref)}
        />
      ) : null}
    </div>
  );
}
