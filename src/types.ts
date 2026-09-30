export type ClaimStatus = '核查中' | '待编辑复核' | '已发布' | '已撤回'
export type FactConclusion = '已证实' | '部分属实' | '证据不足' | '不实'
export type EvidenceKind = '原始证据' | '二次来源' | '待证信息'
export type SourceStatus = '在档' | '已撤下' | '已换版'
export type SourceRole = 'support' | 'counter'
export type FactValidity = '有效' | '等待重新确认'

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
  /** 来源生命周期：在档 / 已撤下 / 已换版 */
  status: SourceStatus
  /** 换版后指向的新来源记录 */
  supersededBy?: string
  /** 新来源记录上反向指向被替换的旧版 */
  supersedes?: string
  removedAt?: string
  changeNote?: string
}

export type SourceDraft = Omit<SourceRecord, 'id' | 'capturedAt' | 'version' | 'status' | 'supersededBy' | 'supersedes' | 'removedAt' | 'changeNote'>

export interface ClaimAnnotation {
  id: string
  author: string
  role: '记者' | '编辑' | '事实核查员'
  content: string
  createdAt: string
  resolved: boolean
}

/**
 * 来源依赖事件：来源撤下/换版后追加到引用它的事实上。
 * 未追加 revalidatedAt 前，该事实结论处于「等待重新确认」状态。
 */
export interface FactDependencyEvent {
  id: string
  sourceId: string
  sourceTitle: string
  sourceRole: SourceRole
  status: SourceStatus
  changedAt: string
  note: string
  previousConclusion: FactConclusion
  revalidatedAt?: string
  revalidatedBy?: string
  revalidationNote?: string
  renewedConclusion?: FactConclusion
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
  /** 来源变动留痕，只追加；是否有效由其中是否存在未重新确认项派生 */
  dependencyEvents: FactDependencyEvent[]
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

/**
 * 发布版本：另存发布当时的完整快照（含来源与哈希），不可修改、只追加。
 * 发布后来源再变动，不影响该快照，只在页面标注并阻止再次发布/导出。
 */
export interface PublicationRecord {
  id: string
  claimId: string
  publicationNo: number
  claimVersion: number
  editor: string
  note: string
  publishedAt: string
  snapshot: Claim
}

export type WriteStepStatus = '待执行' | '已完成' | '已中断'

export interface WriteStep {
  key: string
  label: string
  status: WriteStepStatus
  error?: string
  finishedAt?: string
}

export interface SourceChangeParams {
  factId: string
  sourceId: string
  mode: '已撤下' | '已换版'
  reason: string
  replacement?: SourceDraft
}

export interface ReconfirmParams {
  factId: string
  editor: string
  note: string
  conclusion: FactConclusion
  confidence: number
}

export interface PublishParams {
  editor: string
  note: string
}

export type WriteOpKind = 'source-change' | 'reconfirm' | 'publish'

/**
 * 多步写入任务：每步幂等，中断后保留已完成步骤，重试从未完成步骤续跑。
 */
export interface PendingWrite {
  id: string
  kind: WriteOpKind
  claimId: string
  title: string
  startedAt: string
  params: SourceChangeParams | ReconfirmParams | PublishParams
  steps: WriteStep[]
}

export interface WriteResult {
  ok: boolean
  message: string
  opId?: string
}
