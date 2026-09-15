import { WorkspaceSnapshot } from '../api/storage';
import { defaultProfile } from '../stores/profile';

export class BackupParseError extends Error {}

/**
 * 解析并校验工作区备份文件内容。
 * - 非 JSON 对象 / 缺少 resumes 数组 → 抛 BackupParseError（调用方提示且不写库）
 * - 旧备份缺少 jobs / profile / 偏好字段 → 回退默认值（jobs 缺省为空，原 resumes 原样保留）
 * 仅做解析与保守回填，不重新生成任何 id；jobs 的结构归一化由 writeWorkspaceSnapshot 负责。
 */
export function parseWorkspaceBackup(raw: unknown): WorkspaceSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BackupParseError('备份文件格式不正确：根节点不是对象。');
  }
  const value = raw as Partial<WorkspaceSnapshot>;
  if (!Array.isArray(value.resumes)) {
    throw new BackupParseError('备份文件格式不正确：缺少简历数据（resumes）。');
  }

  return {
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    resumes: value.resumes,
    activeResumeId: typeof value.activeResumeId === 'string' ? value.activeResumeId : null,
    profile: value.profile ?? defaultProfile,
    selectedTemplateId:
      typeof value.selectedTemplateId === 'string' ? value.selectedTemplateId : 'atelier',
    theme: value.theme === 'dark' ? 'dark' : 'light',
    // 旧备份没有岗位匹配数据：恢复为空岗位列表，简历不受影响
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
  };
}
