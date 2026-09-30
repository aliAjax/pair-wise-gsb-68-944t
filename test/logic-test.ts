// 无头逻辑测试：localStorage 打桩后直接驱动 zustand store
import { useClaimStore, factValidity } from '../src/store/useClaimStore'
const store = useClaimStore

async function main() {
let pass = 0
let fail = 0
const assert = (cond: boolean, msg: string) => {
  if (cond) { pass++; console.log('  ✓', msg) } else { fail++; console.error('  ✗', msg) }
}
const flush = () => new Promise((r) => setTimeout(r, 600))
const getClaim = (id: string) => store.getState().claims.find((c) => c.id === id)!

// ---------- 场景1：已发布主张来源撤下（种子 FC-260925-07） ----------
console.log('场景1：来源撤下传播 + 发布/导出阻断')
{
  const claim = getClaim('FC-260925-07')
  const f6 = claim.facts.find((f) => f.id === 'F-6')!
  const f7 = claim.facts.find((f) => f.id === 'F-7')!
  assert(factValidity(f6) === '等待重新确认', 'F-6 依赖被撤下的 S-6，处于等待重新确认')
  assert(factValidity(f7) === '有效', 'F-7 未引用变动来源，继续可用')
  assert(f6.conclusion === '已证实', '失效事实的原结论保留显示（已证实），仅暂停使用')
  const pubs = store.getState().publications.filter((p) => p.claimId === claim.id)
  assert(pubs.length === 1 && pubs[0].snapshot.facts.find((f) => f.id === 'F-6')!.sources.find((s) => s.id === 'S-6')!.status === '在档', '发布快照保留发布当时的来源状态（在档），不受活数据影响')
  const blocked = store.getState().startPublish(claim.id, { editor: '宋卓', note: '试图再发' })
  assert(!blocked.ok && blocked.message.includes('重新确认'), '待重新确认时再次发布被阻断')
}

// ---------- 场景2：编辑重新确认后恢复 ----------
console.log('场景2：编辑重新确认解除阻断并产生新发布版本')
{
  const claimId = 'FC-260925-07'
  const before = store.getState().audit.length
  const r = store.getState().startReconfirm(claimId, { factId: 'F-6', editor: '宋卓', note: '已取得新地址通报，口径一致', conclusion: '已证实', confidence: 92 })
  assert(r.ok, '重新确认任务已启动')
  await flush()
  assert(!store.getState().pendingWrites.find((w) => w.id === r.opId), '任务全部步骤完成并从队列移除')
  const f6 = getClaim(claimId).facts.find((f) => f.id === 'F-6')!
  assert(factValidity(f6) === '有效' && f6.confidence === 92 && f6.dependencyEvents[0].revalidatedBy === '宋卓', '事实恢复有效，事件上留重新确认人与新置信度')
  assert(store.getState().audit.length === before + 1, '审计只追加 1 条重新确认记录（审计步骤原子写入）')
  const p = store.getState().startPublish(claimId, { editor: '宋卓', note: '复核后另存 #2' })
  assert(p.ok, '重新确认后发布放行')
  await flush()
  const pubs = store.getState().publications.filter((x) => x.claimId === claimId)
  assert(pubs.length === 2 && pubs[0].publicationNo === 2, '另存为发布版本 #2，#1 仍保留')
  assert(pubs[1].snapshot.facts.find((f) => f.id === 'F-6')!.sources.find((s) => s.id === 'S-6')!.status === '在档', '旧版本 #1 快照内容不变')
}

// ---------- 场景3：种子中断任务（W-1）续跑 ----------
console.log('场景3：中断写入保留已完成步骤，重试只补未完成项')
{
  const w1 = store.getState().pendingWrites.find((w) => w.id === 'W-1')!
  assert(w1.steps[0].status === '已完成' && w1.steps[1].status === '待执行', '种子任务：步骤1已完成，步骤2待执行')
  const s5 = getClaim('FC-260928-03').facts.find((f) => f.id === 'F-4')!.sources[0]
  assert(s5.status === '已撤下', '来源撤下登记已落盘（步骤1效果保留）')
  assert(factValidity(getClaim('FC-260928-03').facts.find((f) => f.id === 'F-4')!) === '有效', '步骤2未执行，事实尚未被标记失效')
  const auditBefore = store.getState().audit.length
  const retry = store.getState().retryWrite('W-1')
  assert(retry.ok, '续跑已开始')
  await flush()
  assert(!store.getState().pendingWrites.find((w) => w.id === 'W-1'), '续跑完成后任务移除')
  const f4 = getClaim('FC-260928-03').facts.find((f) => f.id === 'F-4')!
  assert(factValidity(f4) === '等待重新确认' && f4.dependencyEvents.length === 1, '续跑补做失效传播')
  assert(store.getState().audit.length === auditBefore + 2, '只补了失效与登记两条审计，步骤1未重复执行（无重复登记）')
  const s5after = f4.sources[0]
  assert(s5after.removedAt === s5.removedAt, '已完成步骤的效果未被覆盖（撤下时间保持）')
}

// ---------- 场景4：换版传播到相反证据 + 注入故障 ----------
console.log('场景4：换版影响相反证据；注入故障后续跑幂等')
{
  store.getState().setFailureStep(2)
  store.getState().toggleFailureArm() // 下次第2步失败
  const claimId = 'FC-260929-01'
  const r = store.getState().startSourceChange(claimId, {
    factId: 'F-2', sourceId: 'C-1', mode: '已换版', reason: '招标平台发布补遗，附件换版',
    replacement: { title: '储能系统招标文件（补遗版）', url: 'https://example.com/tender/9102-rev', publisher: '公共资源交易平台', publishedAt: '2026-09-30', kind: '原始证据', chainOfCustody: '补遗PDF留存', contentHash: 'sha256:new...1' }
  })
  assert(r.ok, '换版任务启动')
  await flush()
  const op = store.getState().pendingWrites.find((w) => w.id === r.opId)!
  assert(op && op.steps[0].status === '已完成' && op.steps[1].status === '已中断', '第1步完成、第2步被注入故障中断')
  const f2 = getClaim(claimId).facts.find((f) => f.id === 'F-2')!
  const oldC = f2.counterSources.find((s) => s.id === 'C-1')!
  assert(oldC.status === '已换版' && !!oldC.supersededBy, '旧相反证据标记换版并指向新版')
  assert(f2.counterSources.some((s) => s.supersedes === 'C-1'), '新版进入相反证据列表（跟随旧版位置）')
  assert(factValidity(f2) === '有效', '中断在失效步骤：结论尚未失效')
  // 续跑
  const r2 = store.getState().retryWrite(r.opId!)
  assert(r2.ok, '中断后续跑')
  await flush()
  assert(!store.getState().pendingWrites.find((w) => w.id === r.opId), '续跑后任务清空（已完成）')
  const f2b = getClaim(claimId).facts.find((f) => f.id === 'F-2')!
  assert(factValidity(f2b) === '等待重新确认', '续跑后引用相反证据的事实被标记失效')
  const events = f2b.dependencyEvents.filter((e) => e.sourceId === 'C-1')
  assert(events.length === 1 && events[0].sourceRole === 'counter', '只产生一条失效事件且角色为相反证据（幂等，无重复）')
}

// ---------- 场景5：未受影响事实在阻断期仍可编辑结论 ----------
console.log('场景5：阻断隔离')
{
  const claim = getClaim('FC-260929-01')
  const f2 = claim.facts.find((f) => f.id === 'F-2')!
  const f3 = claim.facts.find((f) => f.id === 'F-3')!
  assert(factValidity(f2) === '等待重新确认' && factValidity(f3) === '有效', 'F-2 失效、F-3 有效')
  store.getState().updateFact(claim.id, 'F-2', { conclusion: '已证实' })
  assert(getClaim(claim.id).facts.find((f) => f.id === 'F-2')!.conclusion !== '已证实', '失效事实不能直接改结论（必须走重新确认）')
  store.getState().updateFact(claim.id, 'F-3', { confidence: 45 })
  assert(getClaim(claim.id).facts.find((f) => f.id === 'F-3')!.confidence === 45, '未受影响事实照常编辑')
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (fail) process.exit(1)
}

main().catch((err) => { console.error(err); process.exit(1) })
