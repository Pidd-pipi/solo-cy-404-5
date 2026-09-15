// 岗位匹配中心领域模型

/** 可被绑定为证据的四类简历条目（summary 没有独立条目 id，不可绑定） */
export type EvidenceSection = 'work' | 'project' | 'skill' | 'education';

export type CheckItemStatus = 'pending' | 'done';

/**
 * 证据绑定。
 * 身份键 = requirement 内的 (resumeId, section, entryId) 三元组，重复绑定只保留一条。
 * 追踪只依赖稳定 id，与条目名字 / 数组顺序无关：
 * - 改名后靠 id 实时查到新名字；
 * - 条目换序不产生新记录；
 * - 删除后派生出失联状态（不持久化任何 orphan 标志）；
 * - 同名新条目不回顶旧绑定。
 * 两个 snapshot 字段记录绑定瞬间的名字，任何路径都不用实时名覆写，失联时展示。
 */
export interface EvidenceBinding {
  id: string;
  resumeId: string;
  section: EvidenceSection;
  entryId: string;
  boundAt: string;
  resumeNameSnapshot: string;
  entryNameSnapshot: string;
}

export interface JobRequirement {
  id: string;
  text: string;
  /** 硬性要求 / 加分项；覆盖率分母两者都计入 */
  required: boolean;
  createdAt: string;
  bindings: EvidenceBinding[];
}

export interface PreDeliveryCheck {
  id: string;
  label: string;
  status: CheckItemStatus;
  createdAt: string;
}

export interface TargetJob {
  id: string;
  title: string;
  company: string;
  description: string;
  /** 主投简历；悬空仅派生告警，不级联删除 */
  targetResumeId: string | null;
  requirements: JobRequirement[];
  checklist: PreDeliveryCheck[];
  createdAt: string;
  updatedAt: string;
}

export type JobCollection = TargetJob[];

/** 绑定的实时状态（派生，不持久化） */
export type BindingState =
  | { kind: 'live'; currentResumeName: string; currentEntryName: string }
  | { kind: 'resume-missing' }
  | { kind: 'entry-missing' };
