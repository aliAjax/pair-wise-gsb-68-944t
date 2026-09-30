import { useState } from 'react'
import { Badge, Box, Button, Flex, Input, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from '@chakra-ui/react'
import { WriteJobPanel } from '../components/SourceLifecycle'
import { isStaleFact, useClaimStore } from '../store/useClaimStore'
import type { PublishedVersion } from '../types'

export function AuditArchive() {
  const state = useClaimStore()
  const toast = useToast()
  const [keyword, setKeyword] = useState('')
  const rows = state.audit.filter((item) => `${item.claimId} ${item.action} ${item.operator} ${item.detail}`.toLowerCase().includes(keyword.toLowerCase()))
  const staleClaims = state.claims.filter((claim) => claim.facts.some(isStaleFact))
  const runningJobs = state.jobs.filter((job) => job.status === '进行中')
  const exportAll = () => {
    if (staleClaims.length) {
      toast({
        title: '重新确认前不能导出全部档案',
        description: staleClaims.map((claim) => `${claim.id} 有${claim.facts.filter(isStaleFact).length}项失效待确认事实`).join('；'),
        status: 'error',
        duration: 5000
      })
      return
    }
    const payload = { generatedAt: new Date().toISOString(), claims: state.claims, publishedVersions: state.publishedVersions, versions: state.versions, audit: state.audit }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = '事实核查档案与审计.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <Box p="6" pb="16">
    <Flex justify="space-between" align="center" mb="5"><Box><Text fontSize="xs" color="gray.600">主张 / 证据替换 / 批注 / 发布版本</Text><Text fontSize="xl" fontWeight="700" mt="1">核查档案与审计</Text></Box><Button colorScheme="teal" onClick={exportAll}>导出全部档案</Button></Flex>
    {staleClaims.length > 0 && <Box borderWidth="1px" borderColor="red.400" bg="red.50" p="3" mb="4"><Text fontWeight="700" color="red.700" fontSize="sm">导出阻断：以下主张存在来源改动后失效、尚未重新确认的事实</Text>{staleClaims.map((claim) => <Text key={claim.id} fontSize="sm" color="red.700" mt="1">· {claim.id} {claim.title}：{claim.facts.filter(isStaleFact).map((fact) => fact.id).join('、')}（已发布旧版快照仍可在版本记录中查看引用）</Text>)}</Box>}
    {runningJobs.length > 0 && <Box mb="4"><Text fontWeight="700" mb="2">进行中的写入任务（已完成项已落库，重试仅补未完成步骤）</Text><WriteJobPanel compact jobs={state.jobs} /></Box>}
    <Text fontWeight="700" mb="2">已发布版本（只追加，固化当时来源快照）</Text>
    <Box bg="white" borderWidth="1px" mb="4">
      {state.publishedVersions.length === 0 ? <Text p="3" fontSize="sm" color="gray.500">尚无发布版本</Text> : <Table size="sm"><Thead><Tr><Th>时间</Th><Th>主张</Th><Th>发布版本</Th><Th>编辑</Th><Th>事实/来源快照</Th><Th>说明</Th></Tr></Thead><Tbody>{state.publishedVersions.map((pv) => {
        const snapshotCount = pv.facts.reduce((total, frozen) => total + frozen.sources.length + frozen.counterSources.length, 0)
        return <Tr key={pv.id}><Td fontSize="xs">{pv.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td fontFamily="mono" fontSize="xs">{pv.claimId}</Td><Td><Badge colorScheme="green">V{pv.version}</Badge></Td><Td>{pv.editor}</Td><Td fontSize="xs">{pv.facts.length} 项事实 / {snapshotCount} 条来源快照（哈希与状态已冻结）</Td><Td fontSize="sm" maxW="280px">{pv.note}</Td></Tr>
      })}</Tbody></Table>}
    </Box>
    <Flex gap="3" mb="3"><Input maxW="460px" placeholder="搜索主张、动作、操作人或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Text alignSelf="center" fontSize="xs" color="gray.500">共{rows.length}条不可变审计事件</Text></Flex>
    <Box bg="white" borderWidth="1px"><Table size="sm"><Thead><Tr><Th>时间</Th><Th>主张</Th><Th>动作</Th><Th>操作人</Th><Th>说明</Th></Tr></Thead><Tbody>{rows.map((item) => <Tr key={item.id}><Td fontSize="xs">{item.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td fontFamily="mono" fontSize="xs">{item.claimId}</Td><Td><Badge colorScheme={item.action.includes('撤下') || item.action.includes('失效') ? 'red' : item.action.includes('换版') ? 'orange' : item.action.includes('发布') || item.action.includes('重新确认') ? 'green' : 'blue'}>{item.action}</Badge></Td><Td>{item.operator}</Td><Td fontSize="sm">{item.detail}</Td></Tr>)}</Tbody></Table></Box>
    <Box mt="5" bg="white" borderWidth="1px" p="4"><Text fontWeight="700">版本差异原则</Text><Text fontSize="sm" color="gray.600" mt="2">来源撤下或换版后：依赖来源的事实结论立即失效并等待编辑重新确认，未受影响的事实继续可用；发布版本永久保留当时来源快照，重新确认前不能再次发布或导出。旧发布版本与审计事件只追加、不可覆盖；被替换证据仍保留在版本记录中。</Text></Box>
  </Box>
}
