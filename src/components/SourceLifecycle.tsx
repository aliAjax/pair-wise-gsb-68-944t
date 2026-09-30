import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Text, Textarea } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import type { ClaimFact, SourceChangeAction, SourceRecord, WriteJob } from '../types'

const stepColor = (state: WriteJob['steps'][number]['state']) => state === 'done' ? 'green' : state === 'failed' ? 'red' : 'gray'
const stepMark = (state: WriteJob['steps'][number]['state']) => state === 'done' ? '✓' : state === 'failed' ? '✕' : '○'

/** 分批写入任务面板：标出当前阻断步骤，支持仅补写未完成项的重试 */
export function WriteJobPanel({ jobs, compact = false }: { jobs: WriteJob[]; compact?: boolean }) {
  const retry = useClaimStore((state) => state.retryJob)
  const dismiss = useClaimStore((state) => state.dismissJob)
  if (!jobs.length) return null
  return <Flex direction="column" gap="2">
    {jobs.map((job) => {
      const failed = job.steps.find((step) => step.state === 'failed')
      const pendingCount = job.steps.filter((step) => step.state !== 'done').length
      return <Box key={job.id} borderWidth="1px" borderColor={job.status === '已完成' ? 'green.300' : 'red.300'} bg={job.status === '已完成' ? 'green.50' : 'red.50'} p="3">
        <Flex justify="space-between" align="center">
          <Box><Text fontWeight="700" fontSize="sm">{job.kind} · {job.title}</Text>
            <Text fontSize="xs" color="gray.600" mt="1">
              {job.status === '已完成' ? '全部步骤写入完成，任务已闭环' : <>已保留 {job.steps.length - pendingCount} 个已完成步骤，<Text as="span" color="red.700" fontWeight="700">当前阻断点：{failed?.label ?? '待执行'}。重试只补未完成部分</Text></>}
            </Text></Box>
          <Badge colorScheme={job.status === '已完成' ? 'green' : 'red'}>{job.status === '已完成' ? '已完成' : `${pendingCount}/${job.steps.length} 步待补写`}</Badge>
        </Flex>
        <Box mt="2" ml="1">
          {job.steps.map((step) => <Flex key={step.key} fontSize="xs" mt="1" align="baseline" gap="2">
            <Text as="span" color={`${stepColor(step.state)}.600`} fontFamily="mono">{stepMark(step.state)}</Text>
            <Text color={step.state === 'done' ? 'gray.500' : step.state === 'failed' ? 'red.700' : 'gray.700'} textDecoration={step.state === 'done' ? 'line-through' : 'none'}>{step.label}{step.state === 'done' ? '（已落库，重试时跳过）' : ''}</Text>
            {step.error && <Text color="red.600">— {step.error}</Text>}
          </Flex>)}
        </Box>
        {job.status === '进行中' && <Flex mt="3" gap="2">
          <Button size="xs" colorScheme="red" variant="solid" onClick={() => retry(job.id)}>重试未完成步骤</Button>
          {compact && <Button size="xs" variant="ghost" onClick={() => dismiss(job.id)}>移除面板</Button>}
        </Flex>}
        {job.status === '已完成' && !compact && <Button size="xs" mt="2" variant="ghost" onClick={() => dismiss(job.id)}>关闭任务记录</Button>}
      </Box>
    })}
  </Flex>
}

export function ReportSourceChangeModal({ isOpen, onClose, claimId, factId, source }: { isOpen: boolean; onClose: () => void; claimId: string; factId: string; source: SourceRecord | null }) {
  const report = useClaimStore((state) => state.reportSourceChange)
  const [action, setAction] = useState<SourceChangeAction>('撤下')
  const [reason, setReason] = useState('')
  const [newHash, setNewHash] = useState('')
  const [newCustody, setNewCustody] = useState('')
  useEffect(() => { if (isOpen) { setAction('撤下'); setReason(''); setNewHash(''); setNewCustody('') } }, [isOpen, source?.id])
  if (!source) return null
  const submit = () => {
    if (!reason.trim()) return
    const result = report({ claimId, factId, sourceId: source.id, action, reason, editor: '宋卓', newContentHash: newHash, newCustody })
    if (result.ok) onClose()
  }
  return <Modal isOpen={isOpen} onClose={onClose} size="xl"><ModalOverlay /><ModalContent>
    <ModalHeader>登记来源改动并传播失效</ModalHeader><ModalCloseButton />
    <ModalBody>
      <Box bg="gray.50" p="3" mb="3"><Text fontSize="xs" color="gray.500">{source.id} · 当前 V{source.version} · {source.contentHash}</Text><Text fontWeight="700" fontSize="sm" mt="1">{source.title}</Text></Box>
      <Text fontSize="xs" color="gray.600" mb="3">登记后旧来源仅追加修订留痕、不覆盖原始内容；所有依赖该来源的事实结论将自动置为失效待确认，未受影响的事实继续可用。</Text>
      <Grid templateColumns="1fr 1fr" gap="3">
        <FormControl><FormLabel fontSize="xs">改动类型</FormLabel><Select size="sm" value={action} onChange={(event) => setAction(event.target.value as SourceChangeAction)}><option>撤下</option><option>换版</option></Select></FormControl>
        <FormControl><FormLabel fontSize="xs">撤下/换版说明（写入审计）</FormLabel><Input size="sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例：官网公告页被撤下，方案仍在报批" /></FormControl>
        {action === '换版' && <>
          <FormControl><FormLabel fontSize="xs">换版后内容哈希</FormLabel><Input size="sm" value={newHash} onChange={(event) => setNewHash(event.target.value)} placeholder="留空则按 @vN 占位" /></FormControl>
          <FormControl><FormLabel fontSize="xs">重新留档说明</FormLabel><Input size="sm" value={newCustody} onChange={(event) => setNewCustody(event.target.value)} placeholder="例：换版后重新抓取快照" /></FormControl>
        </>}
      </Grid>
    </ModalBody>
    <ModalFooter><Button variant="ghost" mr="3" onClick={onClose}>取消</Button><Button colorScheme="orange" isDisabled={!reason.trim()} onClick={submit}>登记并传播失效</Button></ModalFooter>
  </ModalContent></Modal>
}

export function ReconfirmModal({ isOpen, onClose, claimId, fact }: { isOpen: boolean; onClose: () => void; claimId: string; fact: ClaimFact | null }) {
  const reconfirm = useClaimStore((state) => state.reconfirmFact)
  const [note, setNote] = useState('')
  const [conclusion, setConclusion] = useState<ClaimFact['conclusion']>('已证实')
  const [confidence, setConfidence] = useState(80)
  useEffect(() => { if (isOpen && fact) { setNote(''); setConclusion(fact.conclusion); setConfidence(fact.confidence) } }, [isOpen, fact?.id])
  if (!fact) return null
  const submit = () => {
    if (!note.trim()) return
    const result = reconfirm(claimId, fact.id, { editor: '宋卓', note, conclusion, confidence })
    if (result.ok) onClose()
  }
  return <Modal isOpen={isOpen} onClose={onClose} size="xl"><ModalOverlay /><ModalContent>
    <ModalHeader>编辑重新确认事实结论</ModalHeader><ModalCloseButton />
    <ModalBody>
      <Box bg="red.50" borderWidth="1px" borderColor="red.200" p="3" mb="3">
        <Text fontSize="xs" color="red.700">结论因以下来源改动失效：</Text>
        {fact.invalidations.map((inv) => <Text key={inv.id} fontSize="sm" mt="1">{inv.sourceTitle}（{inv.change}，原 V{inv.sourceVersion}）— {inv.at.replace('T', ' ').slice(0, 16)}</Text>)}
      </Box>
      <Text fontWeight="700" fontSize="sm" mb="3">{fact.text}</Text>
      <Text fontSize="xs" color="gray.600" mb="3">重新确认后事实恢复可引用，确认动作与当时来源快照一并追加留痕；之后才能另存新的发布版本。</Text>
      <Grid templateColumns="1fr 1fr" gap="3" mb="3">
        <FormControl><FormLabel fontSize="xs">复核后结论</FormLabel><Select size="sm" value={conclusion} onChange={(event) => setConclusion(event.target.value as ClaimFact['conclusion'])}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
        <FormControl><FormLabel fontSize="xs">置信程度 {confidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></FormControl>
      </Grid>
      <FormControl><FormLabel fontSize="xs">重新确认说明</FormLabel><Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例：已致电集团宣传部取得书面说明，停运安排取消，结论改判" /></FormControl>
    </ModalBody>
    <ModalFooter><Button variant="ghost" mr="3" onClick={onClose}>取消</Button><Button colorScheme="teal" isDisabled={!note.trim()} onClick={submit}>确认并恢复事实可用</Button></ModalFooter>
  </ModalContent></Modal>
}
