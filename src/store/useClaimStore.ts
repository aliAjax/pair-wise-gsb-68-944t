import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { seedAudit, seedClaims, seedPublishedVersions, seedVersions } from '../data/seed'
import type { AuditEntry, Claim, ClaimAnnotation, ClaimFact, FactConclusion, FrozenFact, FrozenSource, PublishedVersion, ReconfirmRecord, SourceChangeAction, SourceRecord, SourceRevision, SourceStatus, VersionRecord, WriteJob, WriteStep, WriteStepState } from '../types'

const safeStorage = createJSONStorage(() => {
  if (typeof localStorage !== 'undefined') return localStorage
  // 测试 / 无本地存储环境的内存兜底
  const memory = new Map<string, string>()
  return { getItem: (key: string) => memory.has(key) ? memory.get(key)! : null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) }
})

interface ReportSourceChangeInput {
  claimId: string
  factId: string
  sourceId: string
  action: SourceChangeAction
  reason: string
  editor: string
  newContentHash?: string
  newCustody?: string
}

interface ReconfirmInput {
  editor: string
  note: string
  conclusion: FactConclusion
  confidence: number
}

interface ClaimState {
  claims: Claim[]
  versions: VersionRecord[]
  publishedVersions: PublishedVersion[]
  audit: AuditEntry[]
  jobs: WriteJob[]
  simulateNextWriteFail: boolean
  simulateFailOffset: number
  keyword: string
  status: Claim['status'] | '全部'
  setKeyword: (value: string) => void
  setStatus: (value: Claim['status'] | '全部') => void
  toggleSimulateFail: () => void
  /** value 开启后下一个待执行步骤失败；skipSteps 可让前若干步先成功，用于演示断点保留 */
  setSimulateFail: (value: boolean, skipSteps?: number) => void
  addClaim: (input: { title: string; summary: string; reporter: string; priority: Claim['priority'] }) => Claim
  updateFact: (claimId: string, factId: string, patch: Partial<ClaimFact>) => void
  addFact: (claimId: string, text: string) => void
  addAnnotation: (claimId: string, factId: string, annotation: Omit<ClaimAnnotation, 'id' | 'createdAt' | 'resolved'>) => void
  resolveAnnotation: (claimId: string, factId: string, annotationId: string) => void
  addSource: (claimId: string, factId: string, source: Omit<SourceRecord, 'id' | 'capturedAt' | 'version' | 'status' | 'revisions'>, counter: boolean) => void
  transitionClaim: (claimId: string, status: Claim['status'], note: string) => { ok: boolean; message: string }
  reportSourceChange: (input: ReportSourceChangeInput) => { ok: boolean; message: string; jobId?: string }
  reconfirmFact: (claimId: string, factId: string, input: ReconfirmInput) => { ok: boolean; message: string }
  savePublishedVersion: (claimId: string, editor: string, note: string) => { ok: boolean; message: string; jobId?: string }
  retryJob: (jobId: string) => void
  dismissJob: (jobId: string) => void
  reset: () => void
}

let idSeed = 100
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeed++}`

export function normalizeClaim(claim: Claim): Claim {
  claim.facts.forEach((fact) => {
    const all = [...fact.sources, ...fact.counterSources]
    all.forEach((source) => {
      if (!source.status) source.status = '有效'
      if (!source.revisions) source.revisions = []
    })
    if (!fact.verifyState) fact.verifyState = '有效'
    if (!fact.invalidations) fact.invalidations = []
    if (!fact.reconfirms) fact.reconfirms = []
  })
  return claim
}

export const isStaleFact = (fact: ClaimFact) => fact.verifyState === '失效待确认'
export const staleFacts = (claim: Claim) => claim.facts.filter(isStaleFact)

export interface Blocker {
  type: '失效事实' | '写入任务'
  label: string
}

/** 发布/导出前的阻断点：失效待确认事实一律阻断；未完成写入任务也阻断导出 */
export function claimBlockers(claim: Claim, jobs: WriteJob[]): Blocker[] {
  const blockers: Blocker[] = staleFacts(claim).map((fact) => ({ type: '失效事实', label: `${fact.id} ${fact.text}：依赖来源${fact.invalidations.at(-1)?.change ?? ''}（${fact.invalidations.at(-1)?.sourceTitle ?? '来源'}），结论失效待重新确认` }))
  jobs.filter((job) => job.claimId === claim.id && job.status === '进行中').forEach((job) => {
    const step = job.steps.find((item) => item.state !== 'done')
    blockers.push({ type: '写入任务', label: `写入任务「${job.title}」停在：${step?.label ?? '未知步骤'}${step?.error ? `（${step.error}）` : ''}` })
  })
  return blockers
}

function findSource(claims: Claim[], sourceId: string): { claim: Claim; fact: ClaimFact; source: SourceRecord; counter: boolean } | undefined {
  for (const claim of claims) {
    for (const fact of claim.facts) {
      const inSupport = fact.sources.find((item) => item.id === sourceId)
      if (inSupport) return { claim, fact, source: inSupport, counter: false }
      const inCounter = fact.counterSources.find((item) => item.id === sourceId)
      if (inCounter) return { claim, fact, source: inCounter, counter: true }
    }
  }
  return undefined
}

/** 找出全部依赖某来源的事实（支持证据与相反证据都算），来源撤下/换版时统一传播失效 */
function findDependentFacts(claims: Claim[], sourceId: string) {
  const dependents: { claimId: string; factId: string }[] = []
  claims.forEach((claim) => claim.facts.forEach((fact) => {
    if ([...fact.sources, ...fact.counterSources].some((source) => source.id === sourceId)) dependents.push({ claimId: claim.id, factId: fact.id })
  }))
  return dependents
}

function freezeSources(sources: SourceRecord[]): FrozenSource[] {
  return sources.map((source) => ({ sourceId: source.id, title: source.title, publisher: source.publisher, url: source.url, kind: source.kind, version: source.version, contentHash: source.contentHash, status: source.status, capturedAt: source.capturedAt }))
}

function freezeClaim(claim: Claim): FrozenFact[] {
  return claim.facts.map((fact) => ({ factId: fact.id, text: fact.text, conclusion: fact.conclusion, confidence: fact.confidence, sources: freezeSources(fact.sources), counterSources: freezeSources(fact.counterSources) }))
}

export const useClaimStore = create<ClaimState>()(persist((set, get) => ({
  claims: structuredClone(seedClaims).map(normalizeClaim),
  versions: structuredClone(seedVersions),
  publishedVersions: structuredClone(seedPublishedVersions),
  audit: structuredClone(seedAudit),
  jobs: [],
  simulateNextWriteFail: false,
  simulateFailOffset: 0,
  keyword: '',
  status: '全部',
  setKeyword: (keyword) => set({ keyword }),
  setStatus: (status) => set({ status }),
  toggleSimulateFail: () => set((state) => ({ simulateNextWriteFail: !state.simulateNextWriteFail })),
  setSimulateFail: (value, skipSteps = 0) => set({ simulateNextWriteFail: value, simulateFailOffset: skipSteps }),
  addClaim: (input) => {
    const now = new Date().toISOString()
    const claim: Claim = { id: nextId('FC'), ...input, editor: '宋卓', status: '核查中', createdAt: now, updatedAt: now, version: 1, facts: [] }
    set((state) => ({ claims: [claim, ...state.claims], audit: [audit(claim.id, '建立核查主张', input.reporter, input.summary), ...state.audit] }))
    return claim
  },
  addFact: (claimId, text) => set((state) => {
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim || !text.trim()) return state
    claim.facts.push({ id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sources: [], counterSources: [], annotations: [], verifyState: '有效', invalidations: [], reconfirms: [] })
    claim.version += 1
    claim.updatedAt = new Date().toISOString()
    return { claims: [...state.claims], audit: [audit(claimId, '拆分可验证事实', claim.reporter, text), ...state.audit] }
  }),
  updateFact: (claimId, factId, patch) => set((state) => {
    const claim = state.claims.find((item) => item.id === claimId)
    const fact = claim?.facts.find((item) => item.id === factId)
    if (!claim || !fact) return state
    if (isStaleFact(fact)) return state // 结论失效后锁定编辑，必须先由编辑重新确认
    if (patch.conclusion && patch.conclusion !== '证据不足' && fact.unresolved.length) {
      patch.confidence = Math.min(patch.confidence ?? fact.confidence, 75)
    }
    Object.assign(fact, patch)
    claim.version += 1
    claim.updatedAt = new Date().toISOString()
    return { claims: [...state.claims], audit: [audit(claimId, '更新事实结论', '当前用户', `${fact.text}：${fact.conclusion}`), ...state.audit] }
  }),
  addAnnotation: (claimId, factId, input) => set((state) => {
    const claim = state.claims.find((item) => item.id === claimId)
    const fact = claim?.facts.find((item) => item.id === factId)
    if (!claim || !fact) return state
    fact.annotations.unshift({ ...input, id: nextId('N'), createdAt: new Date().toISOString(), resolved: false })
    return { claims: [...state.claims], audit: [audit(claimId, '添加批注', input.author, input.content), ...state.audit] }
  }),
  resolveAnnotation: (claimId, factId, annotationId) => set((state) => {
    const claim = state.claims.find((item) => item.id === claimId)
    const annotation = claim?.facts.find((item) => item.id === factId)?.annotations.find((item) => item.id === annotationId)
    if (!claim || !annotation) return state
    annotation.resolved = true
    return { claims: [...state.claims], audit: [audit(claimId, '解决批注', '当前用户', annotation.content), ...state.audit] }
  }),
  addSource: (claimId, factId, input, counter) => set((state) => {
    const claim = state.claims.find((item) => item.id === claimId)
    const fact = claim?.facts.find((item) => item.id === factId)
    if (!claim || !fact) return state
    const list = counter ? fact.counterSources : fact.sources
    const sameTitle = list.filter((item) => item.title === input.title).length
    const source: SourceRecord = { ...input, id: nextId(counter ? 'C' : 'S'), capturedAt: new Date().toISOString(), version: sameTitle + 1, status: '有效', revisions: [] }
    list.unshift(source)
    claim.version += 1
    claim.updatedAt = new Date().toISOString()
    return { claims: [...state.claims], audit: [audit(claimId, counter ? '保留相反证据' : '关联来源', '当前用户', input.title), ...state.audit] }
  }),
  transitionClaim: (claimId, status, note) => {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return { ok: false, message: '主张不存在' }
    if (status === '待编辑复核' && claim.facts.length === 0) return { ok: false, message: '至少需要一项可验证事实' }
    if (status === '已发布') return { ok: false, message: '发布须由编辑复核后另存发布版本' }
    claim.status = status
    claim.version += 1
    claim.updatedAt = new Date().toISOString()
    const version: VersionRecord = { id: nextId('V'), claimId, version: claim.version, editor: claim.editor || '当前用户', summary: note, changedFactIds: [], removedEvidence: [], createdAt: claim.updatedAt }
    set((current) => ({ claims: [...current.claims], versions: [version, ...current.versions], audit: [audit(claimId, `状态流转：${status}`, '当前用户', note), ...current.audit] }))
    return { ok: true, message: `已流转至${status}` }
  },
  reportSourceChange: (input) => {
    const state = get()
    const found = findSource(state.claims, input.sourceId)
    if (!found) return { ok: false, message: '来源不存在' }
    if (found.source.status !== '有效') return { ok: false, message: '该来源已撤下或已换版，不能重复登记改动' }
    if (state.jobs.some((job) => job.claimId === input.claimId && job.status === '进行中')) return { ok: false, message: '该主张已有写入任务进行中，请先完成或重试当前任务' }
    const now = new Date().toISOString()
    const jobId = nextId('JOB')
    const dependents = findDependentFacts(state.claims, input.sourceId)
    const steps: WriteStep[] = [
      { key: 'mark-source', label: `登记来源${input.action}并追加修订留痕`, state: 'pending' },
      ...dependents.map((dep) => ({ key: `invalidate:${dep.claimId}:${dep.factId}`, label: `将依赖事实 ${dep.factId} 的结论置为失效待确认`, state: 'pending' as WriteStepState }))
    ]
    let newSourceJson = ''
    if (input.action === '换版') {
      const nextVersion = found.source.version + 1
      const newSource: SourceRecord = {
        ...found.source,
        id: nextId('S'),
        contentHash: input.newContentHash || `${found.source.contentHash}@v${nextVersion}`,
        chainOfCustody: input.newCustody || `换版后重新抓取页面快照并记录哈希`,
        version: nextVersion,
        status: '有效',
        revisions: [],
        capturedAt: now
      }
      newSourceJson = JSON.stringify(newSource)
    }
    const job: WriteJob = {
      id: jobId,
      claimId: input.claimId,
      kind: '来源改动传播',
      title: `来源${input.action}：${found.source.title}`,
      status: '进行中',
      steps,
      createdAt: now,
      updatedAt: now,
      context: { sourceId: input.sourceId, action: input.action, reason: input.reason, editor: input.editor, newSourceJson, originalClaimId: found.claim.id, originalFactId: found.fact.id, counter: String(found.counter) }
    }
    set((current) => {
      const next = { ...current, jobs: [job, ...current.jobs] }
      runJob(next, jobId)
      return next
    })
    return { ok: true, message: `来源${input.action}已登记，正在传播失效到${dependents.length}项事实`, jobId }
  },
  reconfirmFact: (claimId, factId, input) => {
    let message = ''
    let ok = true
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) { message = '事实不存在'; ok = false; return state }
      if (!isStaleFact(fact)) { message = '该事实未失效，无需重新确认'; ok = false; return state }
      const record: ReconfirmRecord = {
        id: nextId('RCF'),
        editor: input.editor,
        note: input.note,
        at: new Date().toISOString(),
        conclusion: input.conclusion,
        confidence: input.confidence,
        sourceSnapshots: freezeSources([...fact.sources, ...fact.counterSources])
      }
      fact.reconfirms.push(record)
      fact.verifyState = '已重新确认'
      fact.conclusion = input.conclusion
      fact.confidence = input.confidence
      claim.version += 1
      claim.updatedAt = new Date().toISOString()
      message = `编辑已重新确认 ${fact.id}，事实恢复可用`
      return { claims: [...state.claims], audit: [audit(claimId, '重新确认事实结论', input.editor, `${fact.text}：${input.conclusion}（${input.note}）`), ...state.audit] }
    })
    return { ok, message }
  },
  savePublishedVersion: (claimId, editor, note) => {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return { ok: false, message: '主张不存在' }
    const stale = staleFacts(claim)
    if (stale.length) return { ok: false, message: `${stale.length}项事实结论失效待重新确认，不能另存发布版本` }
    if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) return { ok: false, message: '仍有证据不足且未解决疑点的事实' }
    if (claim.facts.some((fact) => fact.sources.length + fact.counterSources.length === 0)) return { ok: false, message: '存在没有来源记录的事实' }
    if (claim.facts.flatMap((fact) => fact.sources).some((source) => source.kind === '待证信息')) return { ok: false, message: '待证信息尚未完成原始来源核验' }
    if (!editor) return { ok: false, message: '缺少编辑复核人' }
    if (state.jobs.some((job) => job.claimId === claimId && job.status === '进行中')) return { ok: false, message: '该主张已有写入任务进行中，请先完成或重试当前任务' }
    const now = new Date().toISOString()
    const jobId = nextId('JOB')
    const publishNo = state.publishedVersions.filter((item) => item.claimId === claimId).length + 1
    const job: WriteJob = {
      id: jobId,
      claimId,
      kind: '发布版本固化',
      title: `另存第${publishNo}个发布版本`,
      status: '进行中',
      steps: [
        { key: 'freeze-snapshot', label: '冻结各事实当前来源快照（哈希/版本/状态）', state: 'pending' },
        { key: 'write-version', label: '写入只追加发布版本与版本记录', state: 'pending' },
        { key: 'mark-published', label: '主张状态置为已发布', state: 'pending' },
        { key: 'write-audit', label: '追加发布审计事件', state: 'pending' }
      ],
      createdAt: now,
      updatedAt: now,
      context: { editor, note, plannedVersion: String(claim.version + 1), publishedVersionId: nextId('PV'), versionRecordId: nextId('V'), auditId: nextId('AUD'), snapshotJson: '' }
    }
    set((current) => {
      const next = { ...current, jobs: [job, ...current.jobs] }
      runJob(next, jobId)
      return next
    })
    return { ok: true, message: '发布版本写入任务已启动', jobId }
  },
  retryJob: (jobId) => set((state) => {
    const next = { ...state }
    runJob(next, jobId)
    return next
  }),
  dismissJob: (jobId) => set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) })),
  reset: () => set({ claims: seedClaims.map((claim) => normalizeClaim(structuredClone(claim))), versions: structuredClone(seedVersions), publishedVersions: structuredClone(seedPublishedVersions), audit: structuredClone(seedAudit), jobs: [], simulateNextWriteFail: false, simulateFailOffset: 0, keyword: '', status: '全部' })
}), {
  name: 'gsb68:fact-check-workbench-v2',
  version: 2,
  storage: safeStorage,
  migrate: (persisted: unknown) => {
    const data = persisted as Partial<ClaimState>
    return { ...data, claims: (data.claims ?? []).map((claim) => normalizeClaim(claim as Claim)), jobs: [], publishedVersions: data.publishedVersions ?? [] }
  }
}))

/**
 * 执行（或断点续跑）一个写入任务：
 * - 已完成步骤直接跳过，未完成步骤逐步补写
 * - 任一步骤写入失败：保留此前已完成项，标记当前阻断点，后续步骤不再执行
 */
function runJob(state: ClaimState, jobId: string): void {
  const job = state.jobs.find((item) => item.id === jobId)
  if (!job || job.status === '已完成') return
  let skipLeft = state.simulateFailOffset
  for (const step of job.steps) {
    if (step.state === 'done') continue
    if (state.simulateNextWriteFail && skipLeft <= 0) {
      state.simulateNextWriteFail = false
      state.simulateFailOffset = 0
      step.state = 'failed'
      step.error = '模拟写入失败：存储暂时不可用，已完成步骤已保留'
      job.updatedAt = new Date().toISOString()
      return
    }
    if (state.simulateNextWriteFail) skipLeft -= 1
    const error = executeStep(state, job, step)
    if (error) {
      step.state = 'failed'
      step.error = error
      job.updatedAt = new Date().toISOString()
      return
    }
    step.state = 'done'
    step.error = undefined
  }
  job.status = '已完成'
  job.updatedAt = new Date().toISOString()
}

/** 每个步骤幂等：重试时靠既有数据判断是否已经落过库 */
function executeStep(state: ClaimState, job: WriteJob, step: WriteStep): string | undefined {
  if (job.kind === '来源改动传播') return propagateStep(state, job, step)
  return publishStep(state, job, step)
}

function propagateStep(state: ClaimState, job: WriteJob, step: WriteStep): string | undefined {
  const found = findSource(state.claims, job.context.sourceId)
  if (!found) return '来源已不存在，无法传播'
  const now = new Date().toISOString()
  if (step.key === 'mark-source') {
    const action = job.context.action as SourceChangeAction
    const targetStatus: SourceStatus = action === '撤下' ? '已撤下' : '已换版'
    const alreadyMarked = found.source.status === targetStatus
    const revision: SourceRevision = {
      version: found.source.version,
      contentHash: found.source.contentHash,
      status: targetStatus,
      changedAt: now,
      reason: job.context.reason
    }
    if (!alreadyMarked) {
      found.source.revisions.push(revision)
      found.source.status = targetStatus
      if (action === '换版' && job.context.newSourceJson) {
        const replacement = JSON.parse(job.context.newSourceJson) as SourceRecord
        found.source.supersededBy = replacement.id
        const list = job.context.counter === 'true' ? found.fact.counterSources : found.fact.sources
        if (!list.some((item) => item.id === replacement.id)) list.unshift(replacement)
      }
    }
    const claim = state.claims.find((item) => item.id === job.context.originalClaimId)!
    claim.version += 1
    claim.updatedAt = now
    if (!state.audit.some((item) => item.detail.includes(found.source.title) && item.action === `登记来源${action}`)) {
      state.audit.unshift(audit(claim.id, `登记来源${action}`, job.context.editor, `${found.source.title}：${job.context.reason}`))
    }
    return undefined
  }
  const match = step.key.match(/^invalidate:(.+):(.+)$/)
  if (!match) return '未知传播步骤'
  const claim = state.claims.find((item) => item.id === match[1])
  const fact = claim?.facts.find((item) => item.id === match[2])
  if (!claim || !fact) return '依赖事实已不存在'
  const invId = `INV-${job.id}-${fact.id}`
  if (fact.invalidations.some((item) => item.id === invId)) return undefined
  fact.invalidations.push({
    id: invId,
    sourceId: found.source.id,
    sourceTitle: found.source.title,
    sourceVersion: found.source.version,
    change: job.context.action as SourceChangeAction,
    at: now
  })
  fact.verifyState = '失效待确认'
  claim.version += 1
  claim.updatedAt = now
  state.audit.unshift(audit(claim.id, '事实结论失效', job.context.editor, `${fact.text}：依赖来源「${found.source.title}」${job.context.action}，结论置为失效待确认`))
  return undefined
}

function publishStep(state: ClaimState, job: WriteJob, step: WriteStep): string | undefined {
  const claim = state.claims.find((item) => item.id === job.claimId)
  if (!claim) return '主张不存在'
  const now = new Date().toISOString()
  if (step.key === 'freeze-snapshot') {
    if (!job.context.snapshotJson) job.context.snapshotJson = JSON.stringify(freezeClaim(claim))
    return undefined
  }
  if (step.key === 'write-version') {
    const exists = state.publishedVersions.some((item) => item.id === job.context.publishedVersionId)
    if (!exists) {
      const published: PublishedVersion = {
        id: job.context.publishedVersionId,
        claimId: claim.id,
        version: Number(job.context.plannedVersion),
        editor: job.context.editor,
        note: job.context.note,
        createdAt: now,
        claimWorkingVersion: claim.version,
        facts: JSON.parse(job.context.snapshotJson) as FrozenFact[]
      }
      state.publishedVersions.unshift(published)
      const record: VersionRecord = { id: job.context.versionRecordId, claimId: claim.id, version: published.version, editor: job.context.editor, summary: `另存发布版本 V${published.version}：${job.context.note}`, changedFactIds: [], removedEvidence: [], createdAt: now }
      state.versions.unshift(record)
    }
    return undefined
  }
  if (step.key === 'mark-published') {
    if (claim.status !== '已发布') claim.status = '已发布'
    if (claim.version !== Number(job.context.plannedVersion)) claim.version = Number(job.context.plannedVersion)
    claim.updatedAt = now
    return undefined
  }
  if (step.key === 'write-audit') {
    if (!state.audit.some((item) => item.id === job.context.auditId)) {
      state.audit.unshift({ id: job.context.auditId, claimId: claim.id, action: '另存发布版本', operator: job.context.editor, detail: `发布版本 V${job.context.plannedVersion} 已固化来源快照：${job.context.note}`, createdAt: now })
    }
    return undefined
  }
  return '未知发布步骤'
}

function audit(claimId: string, action: string, operator: string, detail: string): AuditEntry {
  return { id: nextId('AUD'), claimId, action, operator, detail, createdAt: new Date().toISOString() }
}

export const conclusionColor: Record<FactConclusion, string> = {
  已证实: 'green',
  部分属实: 'yellow',
  证据不足: 'orange',
  不实: 'red'
}
