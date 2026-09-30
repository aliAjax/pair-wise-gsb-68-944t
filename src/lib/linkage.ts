import type { Claim, ClaimFact, FactDependencyEvent, FactValidity, PublicationRecord, SourceRecord } from '../types'

/** 事实有效性：存在未重新确认的来源依赖事件即为「等待重新确认」 */
export function factValidity(fact: ClaimFact): FactValidity {
  return fact.dependencyEvents.some((event) => !event.revalidatedAt) ? '等待重新确认' : '有效'
}

/** 因来源变动失效、正在等待编辑重新确认的事实 */
export function invalidFacts(claim: Claim): ClaimFact[] {
  return claim.facts.filter((fact) => factValidity(fact) === '等待重新确认')
}

/** 事实尚未重新确认的来源变动事件 */
export function pendingEvents(fact: ClaimFact): FactDependencyEvent[] {
  return fact.dependencyEvents.filter((event) => !event.revalidatedAt)
}

/** 对照当前主张判断发布版本之后是否有来源变动（快照本身不可变，只做过期标注） */
export function publicationStaleAgainst(pub: PublicationRecord, claim: Claim): boolean {
  const findSource = (sourceId: string): SourceRecord | undefined =>
    claim.facts.flatMap((fact) => [...fact.sources, ...fact.counterSources]).find((source) => source.id === sourceId)
  const findFactEvents = (factId: string): FactDependencyEvent[] =>
    claim.facts.find((fact) => fact.id === factId)?.dependencyEvents ?? []
  return pub.snapshot.facts.some((fact) =>
    [...fact.sources, ...fact.counterSources].some((source) => {
      const live = findSource(source.id)
      if (live && live.status !== '在档' && live.removedAt && live.removedAt > pub.publishedAt) return true
      return findFactEvents(fact.id).some((event) => event.changedAt > pub.publishedAt && event.sourceId === source.id)
    })
  )
}

/** 主张是否存在被阻断的导出/发布操作：有待重新确认事实即禁止再发布、再导出 */
export function claimIsBlocked(claim: Claim): boolean {
  return invalidFacts(claim).length > 0
}
