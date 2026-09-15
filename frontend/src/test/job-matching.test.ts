import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultProfile } from '../stores/profile';
import { EvidenceRef } from '../stores/job';
import { Resume } from '../types/resume';
import { EvidenceSection, TargetJob } from '../types/job';
import { createId } from '../utils/format';
import { parseWorkspaceBackup, BackupParseError } from '../utils/backup';
import {
  getBindingDisplay,
  getChecklistProgress,
  getEntryDisplayName,
  getJobCoverage,
  resolveBinding,
} from '../utils/job-match';

const JOBS_KEY = 'smart-resume:jobs';
const RESUMES_KEY = 'smart-resume:resumes';

interface Booted {
  jobs: typeof import('../stores/job').useJobStore;
  resumes: typeof import('../stores/resume').useResumeStore;
  snapshot: typeof import('../api/storage');
}

/**
 * 真实模拟一次「打开应用」：清空模块注册表后重新导入 store。
 * store 单例在模块加载时从 window.localStorage 读取初值，
 * 因此每次 boot() 等同于刷新页面 / 重开标签页后重新水合。
 */
async function boot(): Promise<Booted> {
  vi.resetModules();
  const [jobModule, resumeModule, snapshotModule] = await Promise.all([
    import('../stores/job'),
    import('../stores/resume'),
    import('../api/storage'),
  ]);
  return {
    jobs: jobModule.useJobStore,
    resumes: resumeModule.useResumeStore,
    snapshot: snapshotModule,
  };
}

/** 模拟 UI 选择证据时现算快照名，构造 store 需要的 EvidenceRef */
function evidenceRef(resume: Resume, section: EvidenceSection, entryId: string): EvidenceRef {
  return {
    resumeId: resume.id,
    section,
    entryId,
    resumeNameSnapshot: resume.title,
    entryNameSnapshot: getEntryDisplayName(resume, section, entryId) ?? '未知条目',
  };
}

function findJob(jobs: Booted['jobs'], jobId: string): TargetJob {
  return jobs.getState().jobs.find((job) => job.id === jobId)!;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('岗位匹配中心：真实工作区持久化', () => {
  it('场景：首次写入 → 刷新 → 重开，岗位、要求、绑定与覆盖率全部保持', async () => {
    // 首次打开：创建简历 + 岗位 + 3 条要求，给前 2 条绑定证据
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const workId = resume.workExperiences[0].id;

    const jobId = boot1.jobs.getState().createJob({ title: '高级产品经理', targetResumeId: resumeId });
    const jobActions = boot1.jobs.getState();
    jobActions.addRequirement(jobId, '要求一');
    jobActions.addRequirement(jobId, '要求二');
    jobActions.addRequirement(jobId, '要求三');
    const reqs = findJob(boot1.jobs, jobId).requirements;
    const ref = evidenceRef(resume, 'work', workId);
    jobActions.addBinding(jobId, reqs[0].id, ref);
    jobActions.addBinding(jobId, reqs[1].id, ref);

    // 数据确实落到了真实 localStorage（不是只在内存里）
    const rawJobs = JSON.parse(window.localStorage.getItem(JOBS_KEY)!);
    const rawResumes = JSON.parse(window.localStorage.getItem(RESUMES_KEY)!);
    expect(rawJobs).toHaveLength(1);
    expect(rawJobs[0].requirements).toHaveLength(3);
    expect(rawResumes.some((r: Resume) => r.id === resumeId)).toBe(true);

    const coverageBefore = getJobCoverage(boot1.resumes.getState().resumes, findJob(boot1.jobs, jobId));
    expect(coverageBefore).toMatchObject({ covered: 2, total: 3, percent: 67 });

    // 刷新页面：全新模块实例，从 localStorage 重新水合
    const boot2 = await boot();
    const jobAfterRefresh = boot2.jobs.getState().jobs.find((job) => job.id === jobId);
    expect(jobAfterRefresh).toBeDefined();
    expect(jobAfterRefresh!.requirements).toHaveLength(3);
    expect(jobAfterRefresh!.requirements[0].bindings).toHaveLength(1);
    expect(jobAfterRefresh!.requirements[0].bindings[0].entryId).toBe(workId);
    const coverageAfterRefresh = getJobCoverage(
      boot2.resumes.getState().resumes,
      jobAfterRefresh!,
    );
    expect(coverageAfterRefresh.covered).toBe(2);

    // 再重开一次（模拟关闭标签页后重开），状态依旧
    const boot3 = await boot();
    const jobAfterReopen = boot3.jobs.getState().jobs.find((job) => job.id === jobId)!;
    expect(jobAfterReopen.title).toBe('高级产品经理');
    expect(jobAfterReopen.requirements[1].bindings[0].resumeId).toBe(resumeId);
    expect(getJobCoverage(boot3.resumes.getState().resumes, jobAfterReopen).percent).toBe(67);
  });

  it('场景：完整备份往返（导出 → 清空 → 导入 → 重开），岗位、绑定、失联状态与检查进度一致', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    let resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const work1 = resume.workExperiences[0].id;
    const work2 = resume.workExperiences[1].id;

    const jobId = boot1.jobs.getState().createJob({ title: '备份测试岗位', targetResumeId: resumeId });
    const jobActions = boot1.jobs.getState();
    jobActions.addRequirement(jobId, '仍有证据的要求');
    jobActions.addRequirement(jobId, '证据将被删除的要求');
    const [liveReq, orphanReq] = findJob(boot1.jobs, jobId).requirements;
    jobActions.addBinding(jobId, liveReq.id, evidenceRef(resume, 'work', work1));
    jobActions.addBinding(jobId, orphanReq.id, evidenceRef(resume, 'work', work2));
    // 勾选两项投递前检查
    const checks = findJob(boot1.jobs, jobId).checklist;
    jobActions.toggleCheck(jobId, checks[0].id);
    jobActions.toggleCheck(jobId, checks[1].id);

    // 删除 work2 对应条目 → 该绑定在导出前已是失联态
    resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    boot1.resumes.getState().updateResume(resumeId, {
      workExperiences: resume.workExperiences.filter((work) => work.id !== work2),
    });
    expect(
      resolveBinding(
        boot1.resumes.getState().resumes,
        findJob(boot1.jobs, jobId).requirements[1].bindings[0],
      ).kind,
    ).toBe('entry-missing');

    // 导出工作区快照并经过一次真实的 JSON 序列化（等价 downloadJson/readJsonFile）
    const exported = boot1.snapshot.readWorkspaceSnapshot(defaultProfile);
    expect(exported.jobs).toHaveLength(1);
    const backupFile = JSON.parse(JSON.stringify(exported));

    // 模拟换机器 / 清空浏览器数据
    window.localStorage.clear();
    const cleared = await boot();
    expect(cleared.jobs.getState().jobs).toHaveLength(0);

    // 导入备份（走页面同款解析 + 写入路径）
    const parsed = parseWorkspaceBackup(backupFile);
    cleared.snapshot.writeWorkspaceSnapshot(parsed);

    // 重开应用：简历与岗位都在
    const boot2 = await boot();
    const restoredResumes = boot2.resumes.getState().resumes;
    const restoredJob = boot2.jobs.getState().jobs.find((job) => job.id === jobId)!;
    expect(restoredResumes.some((r) => r.id === resumeId)).toBe(true);
    expect(restoredJob.title).toBe('备份测试岗位');
    expect(restoredJob.requirements).toHaveLength(2);

    // 失联状态跨备份保持一致：live 仍 live，失联仍失联（派生自恢复后的 resumes）
    const restoredLive = restoredJob.requirements[0].bindings[0];
    const restoredOrphan = restoredJob.requirements[1].bindings[0];
    expect(resolveBinding(restoredResumes, restoredLive).kind).toBe('live');
    expect(resolveBinding(restoredResumes, restoredOrphan).kind).toBe('entry-missing');
    // 失联绑定仍保留绑定时的名称快照
    expect(getBindingDisplay(restoredResumes, restoredOrphan).entryName).toBe(
      evidenceRef(resume, 'work', work2).entryNameSnapshot,
    );
    // 覆盖率一致：1 条要求被覆盖
    expect(getJobCoverage(restoredResumes, restoredJob)).toMatchObject({
      covered: 1,
      total: 2,
      orphanBindingCount: 1,
    });
    // 投递前检查进度一致
    expect(getChecklistProgress(restoredJob.checklist).done).toBe(2);
  });
});

describe('岗位匹配中心：证据追踪完整性', () => {
  it('场景：证据条目改名后仍被追踪，显示新名字，且不覆写绑定快照', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const workId = resume.workExperiences[0].id;

    const jobId = boot1.jobs.getState().createJob({ title: '改名追踪', targetResumeId: resumeId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(resume, 'work', workId));

    // 在简历编辑器里给公司改名（走 updateResume，id 不变）
    const current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    boot1.resumes.getState().updateResume(resumeId, {
      workExperiences: current.workExperiences.map((work) =>
        work.id === workId ? { ...work, companyName: '改名后的新公司' } : work,
      ),
    });

    const binding = findJob(boot1.jobs, jobId).requirements[0].bindings[0];
    const resolved = resolveBinding(boot1.resumes.getState().resumes, binding);
    expect(resolved.kind).toBe('live');
    if (resolved.kind === 'live') {
      expect(resolved.currentEntryName).toContain('改名后的新公司');
    }
    // 绑定瞬间的名称快照保持原值，未被覆写
    expect(binding.entryNameSnapshot).toBe(evidenceRef(resume, 'work', workId).entryNameSnapshot);

    // 刷新后追踪依旧
    const boot2 = await boot();
    const afterRefresh = boot2.jobs.getState().jobs.find((job) => job.id === jobId)!.requirements[0].bindings[0];
    const resolvedAfterRefresh = resolveBinding(boot2.resumes.getState().resumes, afterRefresh);
    expect(resolvedAfterRefresh.kind).toBe('live');
    if (resolvedAfterRefresh.kind === 'live') {
      expect(resolvedAfterRefresh.currentEntryName).toContain('改名后的新公司');
    }
  });

  it('场景：条目被移除后绑定显示失联并保留快照名，覆盖率不再计入；刷新后仍失联', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const workId = resume.workExperiences[0].id;
    const snapshotName = getEntryDisplayName(resume, 'work', workId);

    const jobId = boot1.jobs.getState().createJob({ title: '条目移除', targetResumeId: resumeId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(resume, 'work', workId));

    // 在简历编辑器中删除该工作条目
    const current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    boot1.resumes.getState().updateResume(resumeId, {
      workExperiences: current.workExperiences.filter((work) => work.id !== workId),
    });

    const binding = findJob(boot1.jobs, jobId).requirements[0].bindings[0];
    expect(resolveBinding(boot1.resumes.getState().resumes, binding).kind).toBe('entry-missing');
    const display = getBindingDisplay(boot1.resumes.getState().resumes, binding);
    expect(display.entryName).toBe(snapshotName);
    const coverage = getJobCoverage(boot1.resumes.getState().resumes, findJob(boot1.jobs, jobId));
    expect(coverage.covered).toBe(0);
    expect(coverage.orphanBindingCount).toBe(1);

    // 刷新：绑定没有被静默清理，仍然是失联
    const boot2 = await boot();
    const bindingAfterRefresh = boot2.jobs
      .getState()
      .jobs.find((job) => job.id === jobId)!.requirements[0].bindings[0];
    expect(resolveBinding(boot2.resumes.getState().resumes, bindingAfterRefresh).kind).toBe(
      'entry-missing',
    );
  });

  it('场景：来源简历被移除后绑定显示「来源简历已删除」，岗位与其他简历证据不受影响', async () => {
    const boot1 = await boot();
    const resumeAId = boot1.resumes.getState().createResume();
    const resumeBId = boot1.resumes.getState().createResume();
    const resumeA = boot1.resumes.getState().resumes.find((r) => r.id === resumeAId)!;
    const resumeB = boot1.resumes.getState().resumes.find((r) => r.id === resumeBId)!;

    const jobId = boot1.jobs.getState().createJob({ title: '多简历证据', targetResumeId: resumeAId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(resumeA, 'work', resumeA.workExperiences[0].id));
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(resumeB, 'work', resumeB.workExperiences[0].id));

    // 删除简历 B
    boot1.resumes.getState().deleteResume(resumeBId);

    const bindings = findJob(boot1.jobs, jobId).requirements[0].bindings;
    const bindingA = bindings.find((b) => b.resumeId === resumeAId)!;
    const bindingB = bindings.find((b) => b.resumeId === resumeBId)!;
    // 岗位与两条绑定都还在，没有被级联破坏
    expect(bindings).toHaveLength(2);
    expect(resolveBinding(boot1.resumes.getState().resumes, bindingA).kind).toBe('live');
    expect(resolveBinding(boot1.resumes.getState().resumes, bindingB).kind).toBe('resume-missing');
    // 要求仍被简历 A 的证据覆盖
    expect(getJobCoverage(boot1.resumes.getState().resumes, findJob(boot1.jobs, jobId)).covered).toBe(1);

    // 失联绑定可以手动解绑
    boot1.jobs.getState().removeBinding(jobId, reqId, bindingB.id);
    expect(findJob(boot1.jobs, jobId).requirements[0].bindings).toHaveLength(1);
  });

  it('场景：删除后新建同名条目不自动接管旧绑定，新条目是独立的可绑证据', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const original = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const oldWorkId = original.workExperiences[0].id;
    const oldCompany = original.workExperiences[0].companyName;

    const jobId = boot1.jobs.getState().createJob({ title: '同名不接管', targetResumeId: resumeId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(original, 'work', oldWorkId));

    // 删旧条目，再新建一个同名（同公司名）但新 id 的条目——模拟 UI 真实路径
    let current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const remaining = current.workExperiences.find((work) => work.id !== oldWorkId)!;
    const newWorkId = createId('work');
    boot1.resumes.getState().updateResume(resumeId, {
      workExperiences: [
        remaining,
        {
          id: newWorkId,
          companyName: oldCompany,
          position: '增长产品经理',
          startDate: '2024',
          endDate: '至今',
          responsibilities: [],
          achievements: [],
        },
      ],
    });

    const oldBinding = findJob(boot1.jobs, jobId).requirements[0].bindings[0];
    // 旧绑定依旧失联，没有被同名新条目静默接管
    expect(oldBinding.entryId).toBe(oldWorkId);
    expect(resolveBinding(boot1.resumes.getState().resumes, oldBinding).kind).toBe('entry-missing');

    // 新同名条目可以作为独立证据再绑定一次，与失联旧绑定并存
    current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(current, 'work', newWorkId));
    const bindings = findJob(boot1.jobs, jobId).requirements[0].bindings;
    expect(bindings).toHaveLength(2);
    expect(resolveBinding(boot1.resumes.getState().resumes, bindings.find((b) => b.entryId === newWorkId)!).kind).toBe(
      'live',
    );
  });
});

describe('岗位匹配中心：复制简历 / 去重 / 换序', () => {
  it('场景：复制简历后绑定随副本独立，原件与副本解绑/失联互不影响，刷新保持', async () => {
    const boot1 = await boot();
    const resumeAId = boot1.resumes.getState().createResume();
    const resumeA = boot1.resumes.getState().resumes.find((item) => item.id === resumeAId)!;
    const workA = resumeA.workExperiences[0].id;

    const jobId = boot1.jobs.getState().createJob({ title: '复制独立性', targetResumeId: resumeAId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    boot1.jobs.getState().addBinding(jobId, reqId, evidenceRef(resumeA, 'work', workA));

    // 走真实的复制简历 action（resume store 内部会回调 job store 复制绑定）
    const cloneId = boot1.resumes.getState().duplicateResume(resumeAId)!;
    const clone = boot1.resumes.getState().resumes.find((item) => item.id === cloneId)!;
    const cloneWork = clone.workExperiences[0].id;

    const bindings = findJob(boot1.jobs, jobId).requirements[0].bindings;
    expect(bindings).toHaveLength(2);
    const originalBinding = bindings.find((b) => b.resumeId === resumeAId)!;
    const copiedBinding = bindings.find((b) => b.resumeId === cloneId)!;
    expect(copiedBinding).toBeDefined();
    // 副本绑定指向副本的新条目 id，且 binding 自身 id 独立
    expect(copiedBinding.entryId).toBe(cloneWork);
    expect(copiedBinding.entryId).not.toBe(workA);
    expect(copiedBinding.id).not.toBe(originalBinding.id);
    // 快照名记录的是副本
    expect(copiedBinding.resumeNameSnapshot).toBe(clone.title);

    // 解绑原件，副本绑定仍在
    boot1.jobs.getState().removeBinding(jobId, reqId, originalBinding.id);
    expect(findJob(boot1.jobs, jobId).requirements[0].bindings.map((b) => b.id)).toEqual([
      copiedBinding.id,
    ]);

    // 副本删除该条目 → 只有副本绑定失联；原件绑定已解绑，简历 A 本身不受影响
    const cloneUpdated = boot1.resumes.getState().resumes.find((item) => item.id === cloneId)!;
    boot1.resumes.getState().updateResume(cloneId, {
      workExperiences: cloneUpdated.workExperiences.filter((work) => work.id !== cloneWork),
    });
    expect(
      resolveBinding(boot1.resumes.getState().resumes, copiedBinding).kind,
    ).toBe('entry-missing');
    // 简历 A 仍然完整存在
    expect(boot1.resumes.getState().resumes.find((r) => r.id === resumeAId)).toBeDefined();

    // 刷新后副本绑定依然存在且保持失联
    const boot2 = await boot();
    const afterRefresh = boot2.jobs
      .getState()
      .jobs.find((job) => job.id === jobId)!.requirements[0].bindings[0];
    expect(afterRefresh.resumeId).toBe(cloneId);
    expect(resolveBinding(boot2.resumes.getState().resumes, afterRefresh).kind).toBe('entry-missing');
  });

  it('场景：同一证据对同一要求重复绑定只保留一条，重开后仍只有一条', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const workId = resume.workExperiences[0].id;

    const jobId = boot1.jobs.getState().createJob({ title: '去重', targetResumeId: resumeId });
    boot1.jobs.getState().addRequirement(jobId, '要求');
    const reqId = findJob(boot1.jobs, jobId).requirements[0].id;
    const ref = evidenceRef(resume, 'work', workId);

    boot1.jobs.getState().addBinding(jobId, reqId, ref);
    boot1.jobs.getState().addBinding(jobId, reqId, { ...ref });
    boot1.jobs.getState().addBinding(jobId, reqId, { ...ref, entryNameSnapshot: '故意不同的快照名' });
    expect(findJob(boot1.jobs, jobId).requirements[0].bindings).toHaveLength(1);

    // 换序无关：同一条目即使在数组中移动位置，三元键不变也不会产生新绑定
    const current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const reordered = {
      workExperiences: [...current.workExperiences.slice(1), ...current.workExperiences.slice(0, 1)],
    };
    boot1.resumes.getState().updateResume(resumeId, reordered);
    boot1.jobs.getState().addBinding(jobId, reqId, {
      ...ref,
      entryNameSnapshot: getEntryDisplayName(
        boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!,
        'work',
        workId,
      )!,
    });
    expect(findJob(boot1.jobs, jobId).requirements[0].bindings).toHaveLength(1);

    // 重开后仍是一条，绑定仍 live（换序不导致失联）
    const boot2 = await boot();
    const requirement = boot2.jobs.getState().jobs.find((job) => job.id === jobId)!.requirements[0];
    expect(requirement.bindings).toHaveLength(1);
    expect(resolveBinding(boot2.resumes.getState().resumes, requirement.bindings[0]).kind).toBe('live');
  });

  it('场景：条目整体换序后两条绑定均保持，不新增记录、覆盖率不变', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();
    const resume = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    const work1 = resume.workExperiences[0].id;
    const work2 = resume.workExperiences[1].id;

    const jobId = boot1.jobs.getState().createJob({ title: '换序', targetResumeId: resumeId });
    boot1.jobs.getState().addRequirement(jobId, '要求一');
    boot1.jobs.getState().addRequirement(jobId, '要求二');
    const reqs = findJob(boot1.jobs, jobId).requirements;
    boot1.jobs.getState().addBinding(jobId, reqs[0].id, evidenceRef(resume, 'work', work1));
    boot1.jobs.getState().addBinding(jobId, reqs[1].id, evidenceRef(resume, 'work', work2));

    // 两条工作经历整体倒序（id 不变）
    const current = boot1.resumes.getState().resumes.find((item) => item.id === resumeId)!;
    boot1.resumes.getState().updateResume(resumeId, {
      workExperiences: [...current.workExperiences].reverse(),
    });

    const job = findJob(boot1.jobs, jobId);
    const totalBindings = job.requirements.reduce((sum, req) => sum + req.bindings.length, 0);
    expect(totalBindings).toBe(2);
    expect(getJobCoverage(boot1.resumes.getState().resumes, job)).toMatchObject({
      covered: 2,
      total: 2,
      percent: 100,
      orphanBindingCount: 0,
    });
  });
});

describe('岗位匹配中心：投递前检查', () => {
  it('场景：创建岗位播种默认检查项，可增删改与勾选，进度持久化', async () => {
    const boot1 = await boot();
    const jobId = boot1.jobs.getState().createJob({ title: '检查清单', targetResumeId: null });
    const jobActions = () => boot1.jobs.getState();
    const checklist = () => jobActions().jobs[0].checklist;

    expect(getChecklistProgress(checklist()).total).toBe(5);
    const firstCheck = checklist()[0];
    jobActions().toggleCheck(jobId, firstCheck.id);
    expect(getChecklistProgress(checklist()).done).toBe(1);

    jobActions().addCheck(jobId, '自定义检查项');
    const added = checklist().find((c) => c.label === '自定义检查项')!;
    expect(added).toBeDefined();
    jobActions().updateCheck(jobId, added.id, { label: '改名后的检查项', status: 'done' });
    expect(getChecklistProgress(checklist())).toMatchObject({ done: 2, total: 6 });

    jobActions().removeCheck(jobId, firstCheck.id);
    expect(getChecklistProgress(checklist()).total).toBe(5);

    // 刷新后进度保持
    const boot2 = await boot();
    const restored = boot2.jobs.getState().jobs.find((job) => job.id === jobId)!;
    expect(getChecklistProgress(restored.checklist)).toMatchObject({ done: 1, total: 5 });
    expect(restored.checklist.some((c) => c.label === '改名后的检查项' && c.status === 'done')).toBe(true);
  });
});

describe('岗位匹配中心：旧备份与损坏数据兼容', () => {
  it('场景：旧备份缺少岗位数据时恢复为空岗位列表，原简历一条不丢', async () => {
    const boot1 = await boot();
    // 应用首次启动会预置一份示例简历，再新建两份；记录当时全部简历 id
    const resumeA = boot1.resumes.getState().createResume();
    const resumeB = boot1.resumes.getState().createResume();
    const resumeIdsBefore = boot1.resumes.getState().resumes.map((r) => r.id);
    expect(resumeIdsBefore).toEqual(expect.arrayContaining([resumeA, resumeB]));
    boot1.jobs.getState().createJob({ title: '新功能岗位', targetResumeId: resumeA });

    // 导出后手工删掉 jobs 字段，模拟旧版本应用产出的备份文件
    const exported = boot1.snapshot.readWorkspaceSnapshot(defaultProfile);
    const oldBackup = JSON.parse(JSON.stringify(exported)) as Record<string, unknown>;
    delete oldBackup.jobs;
    expect('jobs' in oldBackup).toBe(false);

    // 清空数据后用旧备份恢复
    window.localStorage.clear();
    const parsed = parseWorkspaceBackup(oldBackup);
    expect(parsed.jobs).toEqual([]);
    expect(parsed.resumes).toHaveLength(resumeIdsBefore.length);

    const boot2 = await boot();
    boot2.snapshot.writeWorkspaceSnapshot(parsed);
    // 重开应用：水合后的 store 与直接读快照结果一致
    const boot3 = await boot();

    // 简历一条不丢
    const restoredResumeIds = boot3.resumes.getState().resumes.map((r) => r.id);
    expect(restoredResumeIds).toEqual(expect.arrayContaining(resumeIdsBefore));
    expect(restoredResumeIds).toHaveLength(resumeIdsBefore.length);
    // 岗位匹配中心正常打开，只是空列表，且不报错
    expect(boot3.jobs.getState().jobs).toEqual([]);
  });

  it('场景：本地岗位数据损坏时静默回退为空，不影响简历', async () => {
    const boot1 = await boot();
    const resumeId = boot1.resumes.getState().createResume();

    window.localStorage.setItem(JOBS_KEY, '{损坏的 JSON');
    const boot2 = await boot();
    expect(boot2.jobs.getState().jobs).toEqual([]);
    expect(boot2.resumes.getState().resumes.some((r) => r.id === resumeId)).toBe(true);

    window.localStorage.setItem(JOBS_KEY, JSON.stringify({ unexpected: true }));
    const boot3 = await boot();
    expect(boot3.jobs.getState().jobs).toEqual([]);
  });

  it('场景：结构非法 / 损坏的备份文件被拒绝，且不写入任何数据', async () => {
    expect(() => parseWorkspaceBackup('不是 JSON 对象')).toThrow(BackupParseError);
    expect(() => parseWorkspaceBackup(null)).toThrow(BackupParseError);
    expect(() => parseWorkspaceBackup({})).toThrow(BackupParseError);
    expect(() => parseWorkspaceBackup({ resumes: '不是数组' })).toThrow(BackupParseError);

    // 合法备份：缺省字段被回填，不抛错
    const parsed = parseWorkspaceBackup({ resumes: [] });
    expect(parsed.jobs).toEqual([]);
    expect(parsed.profile).toEqual(defaultProfile);
    expect(parsed.theme).toBe('light');
  });
});
