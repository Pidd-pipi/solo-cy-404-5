import { Profile } from '../types/profile';
import { TargetJob } from '../types/job';
import { Resume } from '../types/resume';
import { normalizeJobs } from '../utils/job-match';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';

export interface WorkspaceSnapshot {
  exportedAt: string;
  resumes: Resume[];
  activeResumeId: string | null;
  profile: Profile;
  selectedTemplateId: string;
  theme: 'light' | 'dark';
  /** 旧备份可能缺少该字段，读取时归一化为空数组 */
  jobs?: TargetJob[];
}

export function readWorkspaceSnapshot(fallbackProfile: Profile): WorkspaceSnapshot {
  return {
    exportedAt: new Date().toISOString(),
    resumes: readStorage<Resume[]>(storageKeys.resumes, []),
    activeResumeId: readStorage<string | null>(storageKeys.activeResumeId, null),
    profile: readStorage<Profile>(storageKeys.profile, fallbackProfile),
    selectedTemplateId: readStorage<string>(storageKeys.template, 'atelier'),
    theme: readStorage<'light' | 'dark'>(storageKeys.theme, 'light'),
    jobs: normalizeJobs(readStorage<unknown>(storageKeys.jobs, [])),
  };
}

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  writeStorage(storageKeys.resumes, snapshot.resumes);
  writeStorage(storageKeys.activeResumeId, snapshot.activeResumeId);
  writeStorage(storageKeys.profile, snapshot.profile);
  writeStorage(storageKeys.template, snapshot.selectedTemplateId);
  writeStorage(storageKeys.theme, snapshot.theme);
  // 旧备份没有 jobs 字段 → 写入空数组，保证恢复后岗位匹配中心可正常打开
  writeStorage(storageKeys.jobs, normalizeJobs(snapshot.jobs ?? []));
}
