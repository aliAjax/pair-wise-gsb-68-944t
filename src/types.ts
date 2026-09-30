export type ClaimStatus = '核查中' | '待编辑复核' | '已发布' | '已撤回'
export type FactConclusion = '已证实' | '部分属实' | '证据不足' | '不实'
export type EvidenceKind = '原始证据' | '二次来源' | '待证信息'
export type SourceStatus = '有效' | '已撤下' | '已换版'
export type FactVerifyState = '有效' | '失效待确认' | '已重新确认'
export type SourceChangeAction = '撤下' | '换版'

/** 来源留档修订记录，只追加：每次撤下/换版都追加一条，旧内容不覆盖 */
export interface SourceRevision {
  version: number
  contentHash: string
  status: SourceStatus
  changedAt: string
  reason: string
}

export interface SourceRecord {
  id: string
  title: string
  url: string
  publisher: string
  publishedAt: string
  capturedAt: string
  kind: EvidenceKind
  chainOfCustody: string
  contentHash: string
  version: number
  status: SourceStatus
  supersededBy?: string
  revisions: SourceRevision[]
}

export interface ClaimAnnotation {
  id: string
  author: string
  role: '记者' | '编辑' | '事实核查员'
  content: string
  createdAt: string
  resolved: boolean
}

/** 事实结论被来源改动击穿的记录 */
export interface FactInvalidation {
  id: string
  sourceId: string
  sourceTitle: string
  sourceVersion: number
  change: SourceChangeAction
  at: string
}

/** 编辑重新确认记录，只追加，保留确认当时的来源快照 */
export interface ReconfirmRecord {
  id: string
  editor: string
  note: string
  at: string
  conclusion: FactConclusion
  confidence: number
  sourceSnapshots: FrozenSource[]
}

export interface ClaimFact {
  id: string
  text: string
  conclusion: FactConclusion
  confidence: number
  unresolved: string[]
  sources: SourceRecord[]
  counterSources: SourceRecord[]
  annotations: ClaimAnnotation[]
  verifyState: FactVerifyState
  invalidations: FactInvalidation[]
  reconfirms: ReconfirmRecord[]
}

export interface Claim {
  id: string
  title: string
  summary: string
  reporter: string
  editor: string
  status: ClaimStatus
  priority: '低' | '中' | '高'
  createdAt: string
  updatedAt: string
  version: number
  facts: ClaimFact[]
}

export interface VersionRecord {
  id: string
  claimId: string
  version: number
  editor: string
  summary: string
  changedFactIds: string[]
  removedEvidence: string[]
  createdAt: string
}

export interface AuditEntry {
  id: string
  claimId: string
  action: string
  operator: string
  detail: string
  createdAt: string
}

/** 发布版本中冻结的来源快照，发布后来源再撤下/换版也不改变这里 */
export interface FrozenSource {
  sourceId: string
  title: string
  publisher: string
  url: string
  kind: EvidenceKind
  version: number
  contentHash: string
  status: SourceStatus
  capturedAt: string
}

export interface FrozenFact {
  factId: string
  text: string
  conclusion: FactConclusion
  confidence: number
  sources: FrozenSource[]
  counterSources: FrozenSource[]
}

/** 已发布版本：只追加，不可修改，完整保留发布当时的事实结论与来源快照 */
export interface PublishedVersion {
  id: string
  claimId: string
  version: number
  editor: string
  note: string
  createdAt: string
  claimWorkingVersion: number
  facts: FrozenFact[]
}

/** 分批写入任务：每步独立落库，失败后已完成步骤保留，重试仅补未完成步骤 */
export type WriteStepState = 'pending' | 'done' | 'failed'
export type JobKind = '来源改动传播' | '发布版本固化'

export interface WriteStep {
  key: string
  label: string
  state: WriteStepState
  error?: string
}

export interface WriteJob {
  id: string
  claimId: string
  kind: JobKind
  title: string
  status: '进行中' | '已完成'
  steps: WriteStep[]
  createdAt: string
  updatedAt: string
  /** 重试时用于幂等恢复的上下文（新来源ID、计划写入的发布版本ID等） */
  context: Record<string, string>
}
