import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seedAudit, seedClaims, seedPendingWrites, seedPublications, seedVersions } from '../data/seed'
import { preflightPublish } from '../services/api'
import { factValidity, invalidFacts } from '../lib/linkage'
import type {
  AuditEntry, Claim, ClaimAnnotation, ClaimFact, FactConclusion,
  PendingWrite, PublicationRecord, PublishParams, ReconfirmParams, SourceChangeParams, SourceDraft,
  SourceRecord, SourceRole, VersionRecord, WriteResult
} from '../types'

export { factValidity, invalidFacts } from '../lib/linkage'
export type { FactValidity } from '../types'

interface ClaimState {
  claims: Claim[]
  versions: VersionRecord[]
  publications: PublicationRecord[]
  audit: AuditEntry[]
  pendingWrites: PendingWrite[]
  keyword: string
  status: Claim['status'] | '全部'
  runningWriteId: string | null
  failureArmed: boolean
  failureStep: number
  setKeyword: (value: string) => void
  setStatus: (value: Claim['status'] | '全部') => void
  setFailureStep: (step: number) => void
  toggleFailureArm: () => void
  addClaim: (input: { title: string; summary: string; reporter: string; priority: Claim['priority'] }) => Claim
  updateFact: (claimId: string, factId: string, patch: Partial<ClaimFact>) => void
  addFact: (claimId: string, text: string) => void
  addAnnotation: (claimId: string, factId: string, annotation: Omit<ClaimAnnotation, 'id' | 'createdAt' | 'resolved'>) => void
  resolveAnnotation: (claimId: string, factId: string, annotationId: string) => void
  addSource: (claimId: string, factId: string, source: SourceDraft, counter: boolean) => void
  transitionClaim: (claimId: string, status: Claim['status'], note: string) => { ok: boolean; message: string }
  startSourceChange: (claimId: string, params: SourceChangeParams) => WriteResult
  startReconfirm: (claimId: string, params: ReconfirmParams) => WriteResult
  startPublish: (claimId: string, params: PublishParams) => WriteResult
  retryWrite: (opId: string) => WriteResult
  reset: () => void
}

let idSeed = 100
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeed++}`

function makeAudit(claimId: string, action: string, operator: string, detail: string, createdAt = new Date().toISOString()): AuditEntry {
  return { id: nextId('AUD'), claimId, action, operator, detail, createdAt }
}

export const useClaimStore = create<ClaimState>()(persist((set, get) => {
  /** 追加审计 */
  const appendAudit = (state: ClaimState, entry: AuditEntry) => {
    state.audit.unshift(entry)
  }

  /** 定位事实内的来源（支持/相反）；来源撤下应传播到所有引用它的事实 */
  const locateSource = (claim: Claim, factId: string, sourceId: string): { fact: ClaimFact; source: SourceRecord; role: SourceRole } | undefined => {
    const fact = claim.facts.find((item) => item.id === factId)
    if (!fact) return
    const support = fact.sources.find((item) => item.id === sourceId)
    if (support) return { fact, source: support, role: 'support' }
    const counter = fact.counterSources.find((item) => item.id === sourceId)
    if (counter) return { fact, source: counter, role: 'counter' }
    // 来源可能被其它事实引用：来源撤下应传播到所有依赖它的事实
    for (const other of claim.facts) {
      if (other.id === factId) continue
      const s = other.sources.find((item) => item.id === sourceId)
      if (s) return { fact: other, source: s, role: 'support' }
      const c = other.counterSources.find((item) => item.id === sourceId)
      if (c) return { fact: other, source: c, role: 'counter' }
    }
  }

  /** 找到所有引用该来源的事实 */
  const dependentFacts = (claim: Claim, sourceId: string) =>
    claim.facts.flatMap((fact) =>
      fact.sources.some((s) => s.id === sourceId) || fact.counterSources.some((s) => s.id === sourceId)
        ? [{ fact, role: (fact.counterSources.some((s) => s.id === sourceId) ? 'counter' : 'support') as SourceRole }]
        : []
    )

  const mutate = (fn: (fnState: ClaimState) => void): void => {
    set((state) => {
      fn(state)
      return { ...state }
    })
  }

  /** 各步骤的业务处理；返回错误信息（undefined 表示通过），均为幂等设计以支持续跑 */
  const handlers: Record<string, (draft: ClaimState, op: PendingWrite) => string | undefined> = {
    register: (draft, op) => {
      const claim = draft.claims.find((item) => item.id === op.claimId)
      if (!claim) return '主张不存在'
      const params = op.params as SourceChangeParams
      const located = locateSource(claim, params.factId, params.sourceId)
      if (!located) return '来源不存在'
      const { source } = located
      const now = new Date().toISOString()
      if (params.mode === '已换版' && params.replacement) {
        const newSource: SourceRecord = {
          ...params.replacement,
          id: nextId('S'), capturedAt: now, version: source.version + 1,
          status: '在档', supersedes: source.id
        }
        const list = located.role === 'counter' ? located.fact.counterSources : located.fact.sources
        list.push(newSource)
        source.status = '已换版'
        source.supersededBy = newSource.id
        source.removedAt = now
        source.changeNote = params.reason
      } else {
        source.status = '已撤下'
        source.removedAt = now
        source.changeNote = params.reason
      }
      claim.version += 1
      claim.updatedAt = now
    },
    invalidate: (draft, op) => {
      const claim = draft.claims.find((item) => item.id === op.claimId)
      if (!claim) return '主张不存在'
      const params = op.params as SourceChangeParams
      const now = new Date().toISOString()
      const affected: string[] = []
      for (const { fact, role } of dependentFacts(claim, params.sourceId)) {
        const source = [...fact.sources, ...fact.counterSources].find((s) => s.id === params.sourceId)!
        const exists = fact.dependencyEvents.some((event) => event.sourceId === source.id && !event.revalidatedAt)
        if (!exists) {
          fact.dependencyEvents.push({
            id: nextId('DE'),
            sourceId: source.id,
            sourceTitle: source.title,
            sourceRole: role,
            status: params.mode,
            changedAt: now,
            note: params.reason,
            previousConclusion: fact.conclusion
          })
          affected.push(fact.id)
        }
      }
      if (affected.length) {
        claim.version += 1
        claim.updatedAt = now
        appendAudit(draft, makeAudit(claim.id, '事实结论失效·等待重新确认', '系统', `事实 ${affected.join('、')} 依赖来源 ${params.sourceId}（${params.mode}），结论暂停使用并等待编辑重新确认`))
      }
    },
    reconfirm: (draft, op) => {
      const claim = draft.claims.find((item) => item.id === op.claimId)
      if (!claim) return '主张不存在'
      const params = op.params as ReconfirmParams
      const fact = claim.facts.find((item) => item.id === params.factId)
      if (!fact) return '事实不存在'
      const now = new Date().toISOString()
      fact.dependencyEvents
        .filter((event) => !event.revalidatedAt)
        .forEach((event) => {
          event.revalidatedAt = now
          event.revalidatedBy = params.editor
          event.revalidationNote = params.note
          event.renewedConclusion = params.conclusion
        })
      fact.conclusion = params.conclusion
      fact.confidence = params.confidence
      claim.version += 1
      claim.updatedAt = now
    },
    snapshot: (draft, op) => {
      const claim = draft.claims.find((item) => item.id === op.claimId)
      if (!claim) return '主张不存在'
      const params = op.params as PublishParams
      const check = preflightPublish(claim)
      if (!check.allowed) return check.blocking.join('；')
      const now = new Date().toISOString()
      const no = draft.publications.filter((item) => item.claimId === claim.id).length + 1
      const snapshotVersion = claim.version
      const snapshot = structuredClone(claim)
      draft.publications.unshift({
        id: nextId('PUB'), claimId: claim.id, publicationNo: no, claimVersion: snapshotVersion,
        editor: params.editor, note: params.note, publishedAt: now, snapshot
      })
      draft.versions.unshift({
        id: nextId('V'), claimId: claim.id, version: snapshotVersion + 1, editor: params.editor,
        summary: `编辑核对后另存发布版本 #${no}（V${snapshotVersion}）：${params.note}`,
        changedFactIds: claim.facts.map((fact) => fact.id), removedEvidence: [], createdAt: now
      })
      claim.status = '已发布'
      claim.version = snapshotVersion + 1
      claim.updatedAt = now
    },
    audit: (draft, op) => {
      const claim = draft.claims.find((item) => item.id === op.claimId)
      if (!claim) return '主张不存在'
      const now = new Date().toISOString()
      if (op.kind === 'source-change') {
        const params = op.params as SourceChangeParams
        const source = claim.facts
          .flatMap((fact) => [...fact.sources, ...fact.counterSources])
          .find((s) => s.id === params.sourceId)
        appendAudit(draft, makeAudit(claim.id, params.mode === '已撤下' ? '登记来源撤下' : '登记来源换版', '陆衡', `${params.sourceId} ${source?.title ?? ''}：${params.reason}${params.mode === '已换版' && source?.supersededBy ? ` → ${source.supersededBy}` : ''}`, now))
      } else if (op.kind === 'publish') {
        const params = op.params as PublishParams
        const pub = draft.publications.find((item) => item.claimId === claim.id)
        appendAudit(draft, makeAudit(claim.id, '另存发布版本', params.editor, `发布版本 #${pub?.publicationNo}（V${pub?.claimVersion}）快照已锁定`, now))
      } else if (op.kind === 'reconfirm') {
        const params = op.params as ReconfirmParams
        appendAudit(draft, makeAudit(claim.id, '事实结论重新确认', params.editor, `事实 ${params.factId} 重新确认，结论维持/更新为“${params.conclusion}”：${params.note}`, now))
      }
    }
  }

  /** 在同一次 set 内执行业务处理并标记步骤，返回错误信息（undefined 表示成功） */
  const applyStep = (op: PendingWrite, stepKey: string): string | undefined => {
    let error: string | undefined
    mutate((draft) => {
      error = handlers[stepKey](draft, op)
      const target = draft.pendingWrites.find((item) => item.id === op.id)?.steps.find((item) => item.key === stepKey)
      if (!target) {
        error = error ?? '写入步骤不存在'
        return
      }
      if (error) {
        target.status = '已中断'
        target.error = error
      } else {
        target.status = '已完成'
        target.finishedAt = new Date().toISOString()
      }
    })
    return error
  }

  /** 注入故障检查：true 表示该步应中断。步骤标记在同步 set 中落盘。 */
  const faultHits = (opId: string, stepIndex: number, stepKey: string): boolean => {
    let hit = false
    mutate((draft) => {
      if (draft.failureArmed && draft.failureStep === stepIndex + 1) {
        hit = true
        draft.failureArmed = false
        const target = draft.pendingWrites.find((item) => item.id === opId)?.steps.find((item) => item.key === stepKey)
        if (target) {
          target.status = '已中断'
          target.error = '写入失败：存储暂时不可用，已完成步骤已保留'
        }
      }
    })
    return hit
  }

  /** 续跑或运行多步写入任务 */
  const runWrite = async (opId: string): Promise<WriteResult> => {
    let op = get().pendingWrites.find((item) => item.id === opId)
    if (!op) return { ok: false, message: '写入任务不存在' }
    set({ runningWriteId: opId })

    while (true) {
      op = get().pendingWrites.find((item) => item.id === opId)
      if (!op) break
      // 续跑点 = 第一个未完成步骤（含“已中断”），其后步骤必然尚未执行
      const pendingIndex = op.steps.findIndex((step) => step.status !== '已完成')
      if (pendingIndex === -1) break
      const step = op.steps[pendingIndex]

      // 将中断步骤重置为待执行，随后在同一通道中重试
      mutate((draft) => {
        const target = draft.pendingWrites.find((item) => item.id === opId)?.steps[pendingIndex]
        if (target && target.status === '已中断') {
          target.status = '待执行'
          target.error = undefined
        }
      })

      // 写入通道故障优先判定：该步业务不落盘，重试时整体补做（处理器均幂等）
      if (faultHits(opId, pendingIndex, step.key)) {
        set({ runningWriteId: null })
        return { ok: false, message: `写入在「${step.label}」中断，已完成步骤已保留，可从该步骤续跑`, opId }
      }

      const businessError = applyStep(op, step.key)
      if (businessError) {
        set({ runningWriteId: null })
        return { ok: false, message: `步骤「${step.label}」被阻断：${businessError}`, opId }
      }

      // 模拟写入耗时
      await new Promise((resolve) => setTimeout(resolve, 180))
    }

    mutate((draft) => {
      draft.pendingWrites = draft.pendingWrites.filter((item) => item.id !== opId)
    })
    set({ runningWriteId: null })
    return { ok: true, message: '全部步骤已完成', opId }
  }

  const startWrite = (input: Omit<PendingWrite, 'id' | 'startedAt' | 'steps'>, steps: { key: string; label: string }[]): WriteResult => {
    const opId = nextId('W')
    mutate((draft) => {
      draft.pendingWrites.unshift({
        ...input,
        id: opId,
        startedAt: new Date().toISOString(),
        steps: steps.map((step) => ({ ...step, status: '待执行' as const }))
      })
    })
    void runWrite(opId)
    return { ok: true, message: '写入已开始', opId }
  }

  return {
    claims: seedClaims,
    versions: seedVersions,
    publications: seedPublications,
    audit: seedAudit,
    pendingWrites: seedPendingWrites,
    keyword: '',
    status: '全部',
    runningWriteId: null,
    failureArmed: false,
    failureStep: 2,
    setKeyword: (keyword) => set({ keyword }),
    setStatus: (status) => set({ status }),
    setFailureStep: (failureStep) => set({ failureStep }),
    toggleFailureArm: () => set((state) => ({ failureArmed: !state.failureArmed })),
    addClaim: (input) => {
      const now = new Date().toISOString()
      const claim: Claim = { id: nextId('FC'), ...input, editor: '宋卓', status: '核查中', createdAt: now, updatedAt: now, version: 1, facts: [] }
      set((state) => ({ claims: [claim, ...state.claims], audit: [makeAudit(claim.id, '建立核查主张', input.reporter, input.summary), ...state.audit] }))
      return claim
    },
    addFact: (claimId, text) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim || !text.trim()) return state
      claim.facts.push({ id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sources: [], counterSources: [], annotations: [], dependencyEvents: [] })
      claim.version += 1
      claim.updatedAt = new Date().toISOString()
      return { claims: [...state.claims], audit: [makeAudit(claimId, '拆分可验证事实', claim.reporter, text), ...state.audit] }
    }),
    updateFact: (claimId, factId, patch) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return state
      // 等待重新确认的事实，结论编辑被锁定，必须走重新确认流程
      if (factValidity(fact) === '等待重新确认' && (patch.conclusion !== undefined || patch.confidence !== undefined)) return state
      if (patch.conclusion && patch.conclusion !== '证据不足' && fact.unresolved.length) {
        patch.confidence = Math.min(patch.confidence ?? fact.confidence, 75)
      }
      Object.assign(fact, patch)
      claim.version += 1
      claim.updatedAt = new Date().toISOString()
      return { claims: [...state.claims], audit: [makeAudit(claimId, '更新事实结论', '当前用户', `${fact.text}：${fact.conclusion}`), ...state.audit] }
    }),
    addAnnotation: (claimId, factId, input) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return state
      fact.annotations.unshift({ ...input, id: nextId('N'), createdAt: new Date().toISOString(), resolved: false })
      return { claims: [...state.claims], audit: [makeAudit(claimId, '添加批注', input.author, input.content), ...state.audit] }
    }),
    resolveAnnotation: (claimId, factId, annotationId) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const annotation = claim?.facts.find((item) => item.id === factId)?.annotations.find((item) => item.id === annotationId)
      if (!claim || !annotation) return state
      annotation.resolved = true
      return { claims: [...state.claims], audit: [makeAudit(claimId, '解决批注', '当前用户', annotation.content), ...state.audit] }
    }),
    addSource: (claimId, factId, input, counter) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return state
      const list = counter ? fact.counterSources : fact.sources
      const sameTitle = list.filter((item) => item.title === input.title).length
      const source: SourceRecord = { ...input, id: nextId(counter ? 'C' : 'S'), capturedAt: new Date().toISOString(), version: sameTitle + 1, status: '在档' }
      list.unshift(source)
      claim.version += 1
      claim.updatedAt = new Date().toISOString()
      return { claims: [...state.claims], audit: [makeAudit(claimId, counter ? '保留相反证据' : '关联来源', '当前用户', input.title), ...state.audit] }
    }),
    transitionClaim: (claimId, status, note) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      if (invalidFacts(claim).length) return { ok: false, message: '存在等待重新确认的事实，不能提交复核' }
      if (status === '待编辑复核' && claim.facts.length === 0) return { ok: false, message: '至少需要一项可验证事实' }
      claim.status = status
      claim.version += 1
      claim.updatedAt = new Date().toISOString()
      const version: VersionRecord = { id: nextId('V'), claimId, version: claim.version, editor: claim.editor || '当前用户', summary: note, changedFactIds: [], removedEvidence: [], createdAt: claim.updatedAt }
      set((current) => ({ claims: [...current.claims], versions: [version, ...current.versions], audit: [makeAudit(claimId, `状态流转：${status}`, '当前用户', note), ...current.audit] }))
      return { ok: true, message: `已流转至${status}` }
    },
    startSourceChange: (claimId, params) => {
      const claim = get().claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      const fact = claim.facts.find((item) => item.id === params.factId)
      const source = fact && [...fact.sources, ...fact.counterSources].find((item) => item.id === params.sourceId)
      if (!fact || !source) return { ok: false, message: '来源不存在' }
      if (source.status !== '在档') return { ok: false, message: '该来源已登记过变动' }
      if (params.mode === '已换版' && (!params.replacement || !params.replacement.title || !params.replacement.url)) {
        return { ok: false, message: '换版需要填写新版来源标题与地址' }
      }
      const label = params.mode === '已撤下' ? '来源撤下' : '来源换版'
      return startWrite(
        { kind: 'source-change', claimId, title: `${label}：${source.title}`, params },
        [{ key: 'register', label: '登记来源变动' }, { key: 'invalidate', label: '失效引用事实' }, { key: 'audit', label: '追加审计留痕' }]
      )
    },
    startReconfirm: (claimId, params) => {
      const claim = get().claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === params.factId)
      if (!claim || !fact) return { ok: false, message: '事实不存在' }
      if (factValidity(fact) !== '等待重新确认') return { ok: false, message: '该事实无需重新确认' }
      if (!params.note.trim()) return { ok: false, message: '请填写重新确认依据' }
      return startWrite(
        { kind: 'reconfirm', claimId, title: `重新确认：${fact.text.slice(0, 20)}…`, params },
        [{ key: 'reconfirm', label: '重新确认并恢复结论' }, { key: 'audit', label: '追加审计留痕' }]
      )
    },
    startPublish: (claimId, params) => {
      const claim = get().claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      if (invalidFacts(claim).length) return { ok: false, message: '存在等待重新确认的事实，重新确认前不能再次发布' }
      const check = preflightPublish(claim)
      if (!check.allowed) return { ok: false, message: check.blocking.join('；') }
      return startWrite(
        { kind: 'publish', claimId, title: `另存发布版本（${claim.title.slice(0, 16)}…）`, params },
        [{ key: 'snapshot', label: '发布前校验并锁定快照' }, { key: 'audit', label: '追加审计留痕' }]
      )
    },
    retryWrite: (opId) => {
      const op = get().pendingWrites.find((item) => item.id === opId)
      if (!op) return { ok: false, message: '没有可续跑的写入任务' }
      if (get().runningWriteId) return { ok: false, message: '已有写入正在执行' }
      void runWrite(opId)
      return { ok: true, message: '已从未完成步骤续跑', opId }
    },
    reset: () => set({
      claims: structuredClone(seedClaims), versions: structuredClone(seedVersions),
      publications: structuredClone(seedPublications), audit: structuredClone(seedAudit),
      pendingWrites: structuredClone(seedPendingWrites),
      keyword: '', status: '全部', runningWriteId: null, failureArmed: false, failureStep: 2
    })
  }
}, {
  name: 'gsb68:fact-check-workbench',
  version: 2,
  migrate: (persisted: unknown) => {
    const state = (persisted ?? {}) as Partial<ClaimState>
    return {
      ...state,
      publications: state.publications ?? [],
      pendingWrites: state.pendingWrites ?? [],
      runningWriteId: null,
      failureArmed: false,
      failureStep: state.failureStep ?? 2,
      claims: (state.claims ?? []).map((claim) => ({
        ...claim,
        facts: claim.facts.map((fact) => ({
          ...fact,
          dependencyEvents: fact.dependencyEvents ?? [],
          sources: fact.sources.map((source) => ({ ...source, status: source.status ?? '在档' })),
          counterSources: fact.counterSources.map((source) => ({ ...source, status: source.status ?? '在档' }))
        }))
      }))
    } as ClaimState
  }
}))
export const conclusionColor: Record<FactConclusion, string> = {
  已证实: 'green',
  部分属实: 'yellow',
  证据不足: 'orange',
  不实: 'red'
}

export const sourceStatusColor: Record<SourceRecord['status'], string> = {
  在档: 'green',
  已撤下: 'red',
  已换版: 'orange'
}
