import axios from 'axios'
import type { Claim } from '../types'
import { factValidity } from '../lib/linkage'

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 5000 })

export async function loadClaimSnapshot(fallback: Claim[]): Promise<Claim[]> {
  if (!import.meta.env.VITE_API_BASE_URL) return fallback
  try { return (await client.get<Claim[]>('/claims')).data } catch { return fallback }
}

/** 发布前校验：来源撤下/换版导致的失效事实必须先重新确认 */
export function preflightPublish(claim: Claim): { allowed: boolean; blocking: string[] } {
  const blocking: string[] = []
  const stale = claim.facts.filter((fact) => factValidity(fact) === '等待重新确认')
  if (stale.length) blocking.push(`事实 ${stale.map((fact) => fact.id).join('、')} 因来源变动失效，需编辑重新确认`)
  if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) blocking.push('仍有证据不足且未解决疑点的事实')
  if (claim.facts.some((fact) => fact.sources.length + fact.counterSources.length === 0)) blocking.push('存在没有来源记录的事实')
  if (claim.facts.flatMap((fact) => fact.sources).some((source) => source.kind === '待证信息' && source.status === '在档')) blocking.push('待证信息尚未完成原始来源核验')
  return { allowed: blocking.length === 0, blocking }
}
