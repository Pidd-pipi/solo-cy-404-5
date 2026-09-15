import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { CreateJobDialog } from '../components/job/CreateJobDialog';
import { JobCard } from '../components/job/JobCard';
import { useJobStore } from '../stores/job';
import { useResumeStore } from '../stores/resume';
import { getChecklistProgress, getJobCoverage } from '../utils/job-match';

export function Jobs() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const jobs = useJobStore((state) => state.jobs);
  const createJob = useJobStore((state) => state.createJob);
  const deleteJob = useJobStore((state) => state.deleteJob);
  const resumes = useResumeStore((state) => state.resumes);
  const activeResumeId = useResumeStore((state) => state.activeResumeId);

  const handleDelete = (jobId: string) => {
    if (window.confirm('确定删除该岗位及其全部要求与绑定吗？')) {
      deleteJob(jobId);
    }
  };

  const cards = useMemo(
    () =>
      jobs.map((job) => ({
        job,
        coverage: getJobCoverage(resumes, job),
        checklistProgress: getChecklistProgress(job.checklist),
        targetResume: resumes.find((resume) => resume.id === job.targetResumeId),
      })),
    [jobs, resumes],
  );

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--accent-strong)]">Job matching</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">岗位匹配中心</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            把目标岗位要求逐条绑定到简历里的工作、项目、技能或教育证据，跟踪覆盖完成度并完成投递前检查。
          </p>
        </div>
        <Button icon={<Target size={16} aria-hidden />} variant="primary" onClick={() => setDialogOpen(true)} data-testid="create-job-button">
          新建岗位
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            actionLabel="新建第一个岗位"
            description="创建目标岗位后，可以把每条岗位要求绑定到简历证据，并在投递前逐项检查。"
            icon={<Target size={24} aria-hidden />}
            onAction={() => setDialogOpen(true)}
            title="还没有目标岗位"
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ job, coverage, checklistProgress, targetResume }) => (
            <JobCard
              key={job.id}
              job={job}
              coverage={coverage}
              checklistProgress={checklistProgress}
              targetResume={targetResume}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateJobDialog
        open={dialogOpen}
        resumes={resumes}
        defaultResumeId={activeResumeId}
        onClose={() => setDialogOpen(false)}
        onSubmit={(input) => {
          createJob(input);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
