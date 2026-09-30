import { useState } from 'react'
import { Badge, Box, Button, Flex, Input, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import { invalidFacts, publicationStaleAgainst } from '../lib/linkage'
import { PendingWritesSummary } from '../components/WriteBlockingBanner'

export function AuditArchive() {
  const state = useClaimStore()
  const toast = useToast()
  const [keyword, setKeyword] = useState('')
  const rows = state.audit.filter((item) => `${item.claimId} ${item.action} ${item.operator} ${item.detail}`.toLowerCase().includes(keyword.toLowerCase()))
  const blockedClaims = state.claims.filter((claim) => invalidFacts(claim).length > 0)
  const globalBlocked = blockedClaims.length > 0
  const download = (name: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
  }
  const exportAudit = () => download('事实核查-审计日志（只追加）.json', { generatedAt: new Date().toISOString(), audit: state.audit })
  const exportAll = () => {
    if (globalBlocked) {
      toast({ title: `主张 ${blockedClaims.map((claim) => claim.id).join('、')} 存在等待重新确认的事实，全量档案导出已阻断；审计日志仍可单独导出`, status: 'error', duration: 5000 })
      return
    }
    download('事实核查档案与审计.json', { generatedAt: new Date().toISOString(), claims: state.claims, versions: state.versions, publications: state.publications, audit: state.audit })
  }
  return <Box p="6" pb="16">
    <Flex justify="space-between" align="center" mb="5"><Box><Text fontSize="xs" color="gray.600">主张 / 来源替换 / 重新确认 / 发布版本</Text><Text fontSize="xl" fontWeight="700" mt="1">核查档案与审计</Text></Box><Flex gap="2"><Button variant="outline" onClick={exportAudit}>导出审计日志</Button><Button colorScheme={globalBlocked ? 'red' : 'teal'} onClick={exportAll}>{globalBlocked ? '全量导出已阻断' : '导出全部档案'}</Button></Flex></Flex>
    {state.pendingWrites.length > 0 && <Box mb="4"><PendingWritesSummary /></Box>}
    {globalBlocked && <Box mb="4" bg="red.50" borderLeftWidth="4px" borderColor="red.500" p="3"><Text fontSize="sm" color="red.700">当前阻断点：{blockedClaims.map((claim) => `${claim.id}（${invalidFacts(claim).length} 项事实待重新确认）`).join('；')}。相关主张重新确认前不能发布或导出含其内容的档案。</Text></Box>}

    <Box bg="white" borderWidth="1px" p="4" mb="5">
      <Text fontWeight="700" mb="3">发布版本（另存快照，只追加不可变）</Text>
      {state.publications.length === 0 && <Text fontSize="sm" color="gray.500">暂无发布版本</Text>}
      {state.publications.map((pub) => {
        const claim = state.claims.find((item) => item.id === pub.claimId)
        const stale = claim ? publicationStaleAgainst(pub, claim) : false
        return <Flex key={pub.id} justify="space-between" align="center" borderWidth="1px" p="3" mb="2" bg={stale ? 'orange.50' : 'white'}>
          <Box><Text fontWeight="700" fontSize="sm">#{pub.publicationNo} · {pub.claimId}（V{pub.claimVersion}）</Text><Text fontSize="xs" color="gray.500" mt="1">{pub.publishedAt.replace('T', ' ').slice(0, 16)} · {pub.editor} · 快照含 {pub.snapshot.facts.length} 项事实 / {pub.snapshot.facts.flatMap((fact) => [...fact.sources, ...fact.counterSources]).length} 条来源哈希</Text><Text fontSize="xs" color="gray.600" mt="1">{pub.note}</Text></Box>
          {stale ? <Badge colorScheme="orange">快照后来源已变动 · 引用前须重新确认</Badge> : <Badge colorScheme="green">快照有效</Badge>}
        </Flex>
      })}
    </Box>

    <Flex gap="3" mb="3"><Input maxW="460px" placeholder="搜索主张、动作、操作人或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Text alignSelf="center" fontSize="xs" color="gray.500">共{rows.length}条不可变审计事件（只追加）</Text></Flex>
    <Box bg="white" borderWidth="1px"><Table size="sm"><Thead><Tr><Th>时间</Th><Th>主张</Th><Th>动作</Th><Th>操作人</Th><Th>说明</Th></Tr></Thead><Tbody>{rows.map((item) => <Tr key={item.id}><Td fontSize="xs">{item.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td fontFamily="mono" fontSize="xs">{item.claimId}</Td><Td><Badge colorScheme={item.action.includes('失效') ? 'red' : item.action.includes('重新确认') ? 'teal' : item.action.includes('撤下') || item.action.includes('换版') ? 'orange' : item.action.includes('发布') ? 'green' : 'blue'}>{item.action}</Badge></Td><Td>{item.operator}</Td><Td fontSize="sm">{item.detail}</Td></Tr>)}</Tbody></Table></Box>
    <Box mt="5" bg="white" borderWidth="1px" p="4"><Text fontWeight="700">版本与留痕原则</Text><Text fontSize="sm" color="gray.600" mt="2">来源撤下或换版后，依赖它的事实结论立即失效并等待编辑重新确认，未受影响事实继续可用；发布版本保留当时来源快照，编辑核对后只能另存新版本，旧发布版本与审计记录一律只追加、不可覆盖。写入中断时保留已完成步骤，重试只补未完成部分。</Text></Box>
  </Box>
}
