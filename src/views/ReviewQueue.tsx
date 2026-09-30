import { Badge, Box, Button, Flex, Text, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { WriteJobPanel } from '../components/SourceLifecycle'
import { claimBlockers, useClaimStore } from '../store/useClaimStore'
import type { Claim, ClaimFact } from '../types'

export function ReviewQueue() {
  const state = useClaimStore()
  const toast = useToast()
  const navigate = useNavigate()
  const reviewClaims = state.claims.filter((claim) => claim.status === '待编辑复核' || claim.facts.some((fact) => fact.verifyState === '失效待确认' || fact.annotations.some((note) => !note.resolved)))
  const approve = (claim: Claim) => {
    const result = state.savePublishedVersion(claim.id, claim.editor || '宋卓', '编辑完成事实、来源与相反证据复核，另存发布版本。')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
  }
  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">编辑审阅 / 来源撤下换版 / 失效事实重新确认 / 发布前检查</Text><Text fontSize="xl" fontWeight="700" mt="1">复核队列</Text></Box>
    <Flex direction="column" gap="3">{reviewClaims.map((claim) => {
      const unresolved = claim.facts.flatMap((fact) => fact.annotations.filter((note) => !note.resolved).map((note) => ({ fact, note })))
      const stale = claim.facts.filter((fact) => fact.verifyState === '失效待确认')
      const blocking = claim.facts.filter((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)
      const blockers = claimBlockers(claim, state.jobs)
      const claimJobs = state.jobs.filter((job) => job.claimId === claim.id)
      return <Box key={claim.id} bg="white" borderWidth="1px" borderColor={stale.length ? 'red.300' : 'gray.200'} p="4">
        <Flex justify="space-between"><Box><Text fontFamily="mono" fontSize="xs" color="gray.500">{claim.id}</Text><Text fontWeight="700" mt="1">{claim.title}</Text></Box><Badge colorScheme={stale.length ? 'red' : 'orange'}>{stale.length ? `${claim.status}·${stale.length}项失效待确认` : claim.status}</Badge></Flex>
        {stale.length > 0 && <Box mt="3" bg="red.50" borderWidth="1px" borderColor="red.300" p="2"><Text fontSize="sm" fontWeight="700" color="red.700">来源改动击穿的事实结论（重新确认前不得发布/导出）</Text>{stale.map((fact) => <StaleRow key={fact.id} claimId={claim.id} fact={fact} onReconfirm={() => { navigate(`/claims/${claim.id}`) }} />)}</Box>}
        <Flex mt="4" gap="4"><Box flex="1"><Text fontSize="sm" fontWeight="600">未解决批注 {unresolved.length}</Text>{unresolved.map(({ fact, note }) => <Box key={note.id} bg="orange.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id} · {note.author}</Text><Text fontSize="sm">{note.content}</Text></Box>)}</Box><Box flex="1"><Text fontSize="sm" fontWeight="600">发布阻断 {blocking.length}</Text>{blocking.map((fact) => <Box key={fact.id} bg="red.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Text fontSize="sm">{fact.unresolved.join('；')}</Text></Box>)}</Box></Flex>
        {claimJobs.length > 0 && <Box mt="3"><WriteJobPanel compact jobs={claimJobs} /></Box>}
        <Flex mt="4" gap="2" align="center">
          {blockers.length > 0
            ? <Button size="sm" colorScheme="red" isDisabled>发布前校验未通过（{blockers.length}个阻断点）</Button>
            : <Button size="sm" colorScheme="teal" onClick={() => approve(claim)}>批准并另存发布版本</Button>}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/claims/${claim.id}`)}>进入核查台处理</Button>
        </Flex>
      </Box>
    })}</Flex>
  </Box>

  function StaleRow({ fact, onReconfirm }: { claimId: string; fact: ClaimFact; onReconfirm: () => void }) {
    return <Box p="2" mt="1" borderWidth="1px" borderColor="red.200">
      <Text fontSize="xs" color="gray.500">{fact.id} · 原结论 {fact.conclusion} {fact.confidence}%</Text>
      <Text fontSize="sm">{fact.text}</Text>
      {fact.invalidations.map((inv) => <Text key={inv.id} fontSize="xs" color="red.700" mt="1">来源「{inv.sourceTitle}」{inv.change}（V{inv.sourceVersion}）· {inv.at.replace('T', ' ').slice(0, 16)}</Text>)}
      <Button size="xs" mt="2" colorScheme="red" variant="outline" onClick={onReconfirm}>去重新确认</Button>
    </Box>
  }
}
