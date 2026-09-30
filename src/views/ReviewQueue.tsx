import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Flex, Spinner, Text, useToast } from '@chakra-ui/react'
import { preflightPublish } from '../services/api'
import { factValidity, invalidFacts, pendingEvents } from '../lib/linkage'
import { useClaimStore } from '../store/useClaimStore'

export function ReviewQueue() {
  const navigate = useNavigate()
  const toast = useToast()
  const state = useClaimStore()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const reviewClaims = state.claims.filter((claim) => claim.status === '待编辑复核' || claim.facts.some((fact) => fact.annotations.some((note) => !note.resolved)))
  const waitFor = (opId: string) => new Promise<void>((resolve) => {
    const unsub = useClaimStore.subscribe((s) => {
      if (s.runningWriteId !== opId) { unsub(); resolve() }
    })
    if (useClaimStore.getState().runningWriteId !== opId) { unsub(); resolve() }
  })
  const publish = async (claimId: string) => {
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return
    setPublishingId(claimId)
    const result = state.startPublish(claimId, { editor: claim.editor || '宋卓', note: '编辑完成事实、来源与相反证据复核，另存发布版本。' })
    if (!result.ok || !result.opId) {
      toast({ title: result.message, status: 'error' })
      setPublishingId(null)
      return
    }
    await waitFor(result.opId)
    const left = useClaimStore.getState().pendingWrites.find((item) => item.id === result.opId)
    setPublishingId(null)
    toast(left
      ? { title: '写入中断，已完成步骤保留，请到主张页续跑', status: 'warning', duration: 4000 }
      : { title: '已另存发布版本并锁定快照', status: 'success' })
  }
  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">编辑审阅 / 来源变动 / 发布前检查</Text><Text fontSize="xl" fontWeight="700" mt="1">复核队列</Text></Box>
    <Flex direction="column" gap="3">{reviewClaims.map((claim) => {
      const unresolved = claim.facts.flatMap((fact) => fact.annotations.filter((note) => !note.resolved).map((note) => ({ fact, note })))
      const stale = invalidFacts(claim)
      const check = preflightPublish(claim)
      const writes = state.pendingWrites.filter((op) => op.claimId === claim.id)
      const busy = publishingId === claim.id
      return <Box key={claim.id} bg="white" borderWidth="1px" p="4" borderLeftWidth="4px" borderLeftColor={stale.length ? 'red.500' : writes.length ? 'orange.400' : 'transparent'}>
        <Flex justify="space-between"><Box><Text fontFamily="mono" fontSize="xs" color="gray.500">{claim.id}</Text><Text fontWeight="700" mt="1">{claim.title}</Text></Box><Badge colorScheme="orange">{claim.status}</Badge></Flex>
        {stale.length > 0 && <Box mt="3" bg="red.50" p="3"><Text fontSize="sm" fontWeight="700" color="red.700">来源变动阻断：{stale.length} 项事实等待重新确认，重新确认前不能发布或导出</Text>{stale.map((fact) => <Box key={fact.id} mt="2" p="2" bg="white" borderLeftWidth="3px" borderLeftColor="red.400">
          <Text fontSize="xs" color="gray.500">{fact.id} · 原结论{fact.conclusion}</Text>
          {pendingEvents(fact).map((event) => <Text key={event.id} fontSize="xs" color="red.700">来源「{event.sourceTitle}」{event.status}（{event.sourceRole === 'counter' ? '相反证据' : '支持证据'}）：{event.note}</Text>)}
        </Box>)}<Button size="sm" colorScheme="red" mt="3" onClick={() => navigate(`/claims/${claim.id}`)}>前往重新确认</Button></Box>}
        {writes.length > 0 && <Box mt="3" bg="orange.50" p="3"><Text fontSize="sm" fontWeight="700" color="orange.700">多步写入中断：已完成步骤保留，续跑后才能继续发布</Text><Button size="sm" colorScheme="orange" mt="2" onClick={() => navigate(`/claims/${claim.id}`)}>查看阻断点并续跑</Button></Box>}
        <Flex mt="4" gap="4"><Box flex="1"><Text fontSize="sm" fontWeight="600">未解决批注 {unresolved.length}</Text>{unresolved.map(({ fact, note }) => <Box key={note.id} bg="orange.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id} · {note.author}</Text><Text fontSize="sm">{note.content}</Text></Box>)}</Box><Box flex="1"><Text fontSize="sm" fontWeight="600">发布前校验</Text>{check.blocking.length === 0
          ? <Box bg="green.50" p="2" mt="2"><Text fontSize="sm" color="green.700">校验通过：无失效事实、无未结疑点、来源均已核验</Text></Box>
          : check.blocking.map((message) => <Box key={message} bg="red.50" p="2" mt="2"><Text fontSize="sm" color="red.700">{message}</Text></Box>)}</Box></Flex>
        <Button mt="4" size="sm" colorScheme="teal" isDisabled={!check.allowed || busy || !!state.runningWriteId} onClick={() => publish(claim.id)}>
          {busy && <Spinner size="xs" mr="2" />}批准并另存发布版本（不覆盖旧版）
        </Button>
      </Box>
    })}</Flex>
  </Box>
}
