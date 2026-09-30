import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, useDisclosure, useToast } from '@chakra-ui/react'
import { EvidenceGraph } from '../components/EvidenceGraph'
import { ReconfirmModal, ReportSourceChangeModal, WriteJobPanel } from '../components/SourceLifecycle'
import { claimBlockers, conclusionColor, useClaimStore } from '../store/useClaimStore'
import type { ClaimFact, EvidenceKind, FactConclusion, PublishedVersion, SourceRecord } from '../types'

export function ClaimWorkspace() {
  const { id } = useParams()
  const toast = useToast()
  const state = useClaimStore()
  const claim = state.claims.find((item) => item.id === id)
  const [selectedFactId, setSelectedFactId] = useState(claim?.facts[0]?.id ?? '')
  const selectedFact = claim?.facts.find((item) => item.id === selectedFactId) ?? claim?.facts[0]
  const [factText, setFactText] = useState('')
  const sourceModal = useDisclosure()
  const versionModal = useDisclosure()
  const changeModal = useDisclosure()
  const reconfirmModal = useDisclosure()
  const [changingSource, setChangingSource] = useState<SourceRecord | null>(null)
  const [sourceForm, setSourceForm] = useState<Omit<SourceRecord, 'id' | 'capturedAt' | 'version' | 'status' | 'revisions'>>({ title: '', url: '', publisher: '', publishedAt: '2026-09-30', kind: '原始证据', chainOfCustody: '', contentHash: '' })
  const [counterSource, setCounterSource] = useState(false)
  const [transitionNote, setTransitionNote] = useState('')
  const [publishNote, setPublishNote] = useState('')
  useEffect(() => { if (!selectedFactId && claim?.facts[0]) setSelectedFactId(claim.facts[0].id) }, [selectedFactId, claim])
  if (!claim) return <Box p="10">未找到核查主张</Box>
  const blockers = claimBlockers(claim, state.jobs)
  const claimJobs = state.jobs.filter((job) => job.claimId === claim.id)
  const publishedVersions = state.publishedVersions.filter((item) => item.claimId === claim.id)
  const setFact = (patch: Partial<ClaimFact>) => { if (selectedFact) state.updateFact(claim.id, selectedFact.id, patch) }
  const addSource = () => {
    if (!selectedFact || !sourceForm.title || !sourceForm.url) return
    state.addSource(claim.id, selectedFact.id, sourceForm, counterSource)
    sourceModal.onClose()
    toast({ title: '证据已加入关系图', status: 'success' })
  }
  const openSourceChange = (source: SourceRecord) => { setChangingSource(source); changeModal.onOpen() }
  const transition = (status: typeof claim.status) => {
    const result = state.transitionClaim(claim.id, status, transitionNote || `由${claim.status}流转至${status}`)
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) { versionModal.onClose(); setTransitionNote('') }
  }
  const savePublished = () => {
    const result = state.savePublishedVersion(claim.id, claim.editor || '宋卓', publishNote || '编辑核对后另存发布版本')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) { versionModal.onClose(); setPublishNote('') }
  }
  const exportArchive = () => {
    if (blockers.length) {
      toast({ title: '重新确认前不能导出', description: blockers.map((item) => item.label).join('；'), status: 'error', duration: 5000 })
      return
    }
    const versions = state.versions.filter((item) => item.claimId === claim.id)
    const audit = state.audit.filter((item) => item.claimId === claim.id)
    const blob = new Blob([JSON.stringify({ claim, publishedVersions, versions, audit }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${claim.id}-核查档案.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <Box p="6" pb="16">
    <Flex justify="space-between" align="flex-start" mb="4"><Box><Text fontSize="xs" color="gray.600">{claim.id} · {claim.reporter} / {claim.editor} · V{claim.version}</Text><Text fontSize="xl" fontWeight="700" mt="1">{claim.title}</Text><Text color="gray.600" fontSize="sm" mt="2" maxW="760px">{claim.summary}</Text></Box><Flex gap="2"><Button variant="outline" onClick={exportArchive}>导出档案</Button><Button colorScheme="teal" onClick={versionModal.onOpen}>状态与版本</Button></Flex></Flex>
    {blockers.length > 0 && <Box borderWidth="1px" borderColor="red.400" bg="red.50" p="3" mb="3"><Text fontWeight="700" color="red.700" fontSize="sm">当前阻断点（重新确认前不能再次发布或导出）：</Text>{blockers.map((blocker, index) => <Text key={index} fontSize="sm" color="red.700" mt="1">· [{blocker.type}] {blocker.label}</Text>)}</Box>}
    {claimJobs.length > 0 && <Box mb="3"><WriteJobPanel jobs={claimJobs} /></Box>}
    <EvidenceGraph facts={claim.facts} />
    <Grid mt="4" templateColumns="320px 1fr" gap="4" alignItems="start">
      <Box bg="white" borderWidth="1px" p="3">
        <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">可验证事实树</Text><Badge>{claim.facts.length}</Badge></Flex>
        {claim.facts.map((fact) => {
          const stale = fact.verifyState === '失效待确认'
          return <Box key={fact.id} as="button" textAlign="left" w="100%" p="3" mb="2" borderWidth="1px" borderColor={stale ? 'red.400' : fact.id === selectedFact?.id ? 'teal.600' : 'gray.200'} bg={stale ? 'red.50' : fact.id === selectedFact?.id ? 'teal.50' : 'white'} onClick={() => setSelectedFactId(fact.id)}>
            <Flex justify="space-between"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Badge colorScheme={stale ? 'red' : conclusionColor[fact.conclusion]}>{stale ? '失效待确认' : fact.verifyState === '已重新确认' ? '已重新确认' : fact.conclusion}</Badge></Flex>
            <Text fontSize="sm" mt="2" fontWeight="600">{fact.text}</Text>
            <Text fontSize="xs" color="gray.500" mt="2">置信度 {fact.confidence}% · 疑点 {fact.unresolved.length}</Text>
            {stale && <Text fontSize="xs" color="red.600" mt="1">依赖来源{fact.invalidations.at(-1)?.change}，结论已失效</Text>}
          </Box>
        })}
        <Flex mt="3" gap="2"><Input size="sm" placeholder="拆出新的可验证事实" value={factText} onChange={(event) => setFactText(event.target.value)} /><Button size="sm" colorScheme="teal" onClick={() => { state.addFact(claim.id, factText); setFactText('') }}>添加</Button></Flex>
      </Box>
      {selectedFact && <Box bg="white" borderWidth="1px" p="4">
        <Flex justify="space-between" align="flex-start"><Box><Text fontSize="xs" color="gray.500">{selectedFact.id}</Text><Text fontWeight="700" mt="1">{selectedFact.text}</Text></Box><Badge colorScheme={selectedFact.verifyState === '失效待确认' ? 'red' : conclusionColor[selectedFact.conclusion]}>{selectedFact.verifyState === '失效待确认' ? '失效待确认' : selectedFact.verifyState === '已重新确认' ? `已重新确认·${selectedFact.conclusion}` : selectedFact.conclusion}</Badge></Flex>
        {selectedFact.verifyState === '失效待确认' && <Box mt="3" p="3" bg="red.50" borderWidth="1px" borderColor="red.300">
          <Text fontSize="sm" color="red.700" fontWeight="600">事实结论已失效，等待编辑重新确认</Text>
          {selectedFact.invalidations.map((inv) => <Text key={inv.id} fontSize="xs" color="red.700" mt="1">来源「{inv.sourceTitle}」{inv.change}（原 V{inv.sourceVersion}），{inv.at.replace('T', ' ').slice(0, 16)}</Text>)}
          <Button size="sm" mt="2" colorScheme="red" onClick={reconfirmModal.onOpen}>编辑核对并重新确认</Button>
        </Box>}
        {selectedFact.verifyState === '已重新确认' && selectedFact.reconfirms.length > 0 && <Box mt="3" p="3" bg="green.50" borderWidth="1px" borderColor="green.300">
          <Text fontSize="sm" color="green.800" fontWeight="600">已由编辑重新确认，事实恢复可用</Text>
          {selectedFact.reconfirms.map((record) => <Text key={record.id} fontSize="xs" color="green.800" mt="1">{record.at.replace('T', ' ').slice(0, 16)} · {record.editor} · {record.conclusion} {record.confidence}% · {record.note}</Text>)}
        </Box>}
        <Grid templateColumns="1fr 1fr 1fr" gap="3" mt="4" opacity={selectedFact.verifyState === '失效待确认' ? 0.55 : 1} pointerEvents={selectedFact.verifyState === '失效待确认' ? 'none' : 'auto'}>
          <FormControl><FormLabel fontSize="xs">事实结论</FormLabel><Select size="sm" value={selectedFact.conclusion} onChange={(event) => setFact({ conclusion: event.target.value as FactConclusion })}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
          <FormControl><FormLabel fontSize="xs">置信程度 {selectedFact.confidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" value={selectedFact.confidence} onChange={(event) => setFact({ confidence: Number(event.target.value) })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">未解决疑点</FormLabel><Input size="sm" value={selectedFact.unresolved.join('；')} onChange={(event) => setFact({ unresolved: event.target.value ? event.target.value.split('；') : [] })} /></FormControl>
        </Grid>
        {selectedFact.verifyState === '失效待确认' && <Text fontSize="xs" color="gray.500" mt="1">结论编辑已锁定，重新确认后方可修改。</Text>}
        <Tabs mt="5" colorScheme="teal">
          <TabList><Tab>支持证据 {selectedFact.sources.length}</Tab><Tab>相反证据 {selectedFact.counterSources.length}</Tab><Tab>批注 {selectedFact.annotations.length}</Tab><Tab>来源时间线</Tab><Tab>重新确认留痕 {selectedFact.reconfirms.length}</Tab></TabList>
          <TabPanels>
            <TabPanel px="0"><EvidenceList sources={selectedFact.sources} claimId={claim.id} factId={selectedFact.id} onAdd={() => { setCounterSource(false); sourceModal.onOpen() }} onSourceChange={openSourceChange} /></TabPanel>
            <TabPanel px="0"><EvidenceList sources={selectedFact.counterSources} claimId={claim.id} factId={selectedFact.id} onAdd={() => { setCounterSource(true); sourceModal.onOpen() }} onSourceChange={openSourceChange} counter /></TabPanel>
            <TabPanel px="0"><AnnotationList fact={selectedFact} claimId={claim.id} /></TabPanel>
            <TabPanel px="0"><Box borderLeftWidth="2px" borderColor="gray.300" pl="4">{[...selectedFact.sources, ...selectedFact.counterSources].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((source) => <Box key={source.id} mb="4"><Text fontSize="xs" color="gray.500">{source.publishedAt} · {source.kind}</Text><Text fontWeight="600" mt="1">{source.title} {source.status !== '有效' && <Badge colorScheme={source.status === '已撤下' ? 'red' : 'orange'}>{source.status}</Badge>}</Text><Text fontSize="sm" color="gray.600">{source.publisher} · 留档 {source.capturedAt.replace('T', ' ').slice(0, 16)}</Text>{source.revisions.map((revision) => <Text key={revision.version} fontSize="xs" color="red.600" mt="1">{revision.changedAt.replace('T', ' ').slice(0, 16)} 登记{revision.status}：{revision.reason}</Text>)}</Box>)}</Box></TabPanel>
            <TabPanel px="0">{selectedFact.reconfirms.length === 0 ? <Text fontSize="sm" color="gray.500">尚无重新确认记录</Text> : selectedFact.reconfirms.map((record) => <Box key={record.id} borderLeftWidth="3px" borderColor="green.400" bg="green.50" p="3" mb="2"><Text fontSize="sm" fontWeight="600">{record.editor} · {record.at.replace('T', ' ').slice(0, 16)}</Text><Text fontSize="sm" mt="1">结论 {record.conclusion} · 置信度 {record.confidence}%</Text><Text fontSize="sm">{record.note}</Text><Text fontSize="xs" color="gray.500" mt="2">确认当时来源快照 {record.sourceSnapshots.length} 条：{record.sourceSnapshots.map((snapshot) => `${snapshot.sourceId}@V${snapshot.version}(${snapshot.status})`).join('，')}</Text></Box>)}</TabPanel>
          </TabPanels>
        </Tabs>
      </Box>}
    </Grid>
    <Modal isOpen={sourceModal.isOpen} onClose={sourceModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>{counterSource ? '关联相反证据' : '关联支持证据'}</ModalHeader><ModalCloseButton /><ModalBody><Grid templateColumns="1fr 1fr" gap="3"><FormControl><FormLabel>来源标题</FormLabel><Input value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} /></FormControl><FormControl><FormLabel>公开地址</FormLabel><Input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} /></FormControl><FormControl><FormLabel>发布机构</FormLabel><Input value={sourceForm.publisher} onChange={(event) => setSourceForm({ ...sourceForm, publisher: event.target.value })} /></FormControl><FormControl><FormLabel>证据类型</FormLabel><Select value={sourceForm.kind} onChange={(event) => setSourceForm({ ...sourceForm, kind: event.target.value as EvidenceKind })}>{['原始证据', '二次来源', '待证信息'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl><FormControl><FormLabel>内容哈希</FormLabel><Input placeholder="sha256:..." value={sourceForm.contentHash} onChange={(event) => setSourceForm({ ...sourceForm, contentHash: event.target.value })} /></FormControl><FormControl><FormLabel>留档说明</FormLabel><Input value={sourceForm.chainOfCustody} onChange={(event) => setSourceForm({ ...sourceForm, chainOfCustody: event.target.value })} /></FormControl></Grid></ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={sourceModal.onClose}>取消</Button><Button colorScheme="teal" isDisabled={!sourceForm.title || !sourceForm.url} onClick={addSource}>加入证据关系图</Button></ModalFooter></ModalContent></Modal>
    <Modal isOpen={versionModal.isOpen} onClose={versionModal.onClose} size="2xl"><ModalOverlay /><ModalContent><ModalHeader>状态流转与发布版本</ModalHeader><ModalCloseButton /><ModalBody>
      <Text fontWeight="700" fontSize="sm" mb="2">已发布版本（只追加，保留当时来源快照）</Text>
      {publishedVersions.length === 0 ? <Text fontSize="sm" color="gray.500" mb="3">尚未发布</Text> : publishedVersions.map((pv) => <PublishedVersionCard key={pv.id} published={pv} />)}
      <Divider my="3" />
      <Text fontWeight="700" fontSize="sm" mb="2">另存新的发布版本</Text>
      {blockers.length > 0 && <Box bg="red.50" borderWidth="1px" borderColor="red.300" p="2" mb="2">{blockers.map((blocker, index) => <Text key={index} fontSize="xs" color="red.700">· [{blocker.type}] {blocker.label}</Text>)}</Box>}
      <FormControl mb="3"><FormLabel fontSize="xs">发布说明</FormLabel><Textarea rows={2} value={publishNote} onChange={(event) => setPublishNote(event.target.value)} /></FormControl>
      <Text fontSize="xs" color="gray.500">发布按「冻结快照 → 写入版本 → 置已发布 → 追加审计」分步落库；写入失败后重试只补未完成步骤。状态流转与发布分开，失效事实重新确认前不能再次发布。</Text>
      <Divider my="3" />
      <FormControl mb="3"><FormLabel fontSize="xs">状态流转说明</FormLabel><Textarea rows={2} value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} /></FormControl>
    </ModalBody><ModalFooter><Button mr="2" variant="outline" onClick={() => transition('待编辑复核')}>提交编辑复核</Button><Button mr="2" variant="ghost" colorScheme="gray" onClick={() => transition('核查中')}>退回核查中</Button><Button colorScheme="teal" isDisabled={blockers.length > 0 || !publishNote.trim()} onClick={savePublished}>编辑核对后另存发布版本</Button></ModalFooter></ModalContent></Modal>
    <ReportSourceChangeModal isOpen={changeModal.isOpen} onClose={changeModal.onClose} claimId={claim.id} factId={selectedFact?.id ?? ''} source={changingSource} />
    <ReconfirmModal isOpen={reconfirmModal.isOpen} onClose={reconfirmModal.onClose} claimId={claim.id} fact={selectedFact ?? null} />
  </Box>
}

function PublishedVersionCard({ published }: { published: PublishedVersion }) {
  const [open, setOpen] = useState(false)
  return <Box borderWidth="1px" borderColor="green.300" bg="green.50" p="3" mb="2">
    <Flex justify="space-between"><Box><Text fontWeight="700" fontSize="sm">发布版本 V{published.version} · {published.editor}</Text><Text fontSize="xs" color="gray.600" mt="1">{published.createdAt.replace('T', ' ').slice(0, 16)} · {published.note}</Text></Box><Button size="xs" variant="ghost" onClick={() => setOpen(!open)}>{open ? '收起快照' : '查看来源快照'}</Button></Flex>
    {open && <Box mt="2">{published.facts.map((frozen) => <Box key={frozen.factId} borderTopWidth="1px" pt="2" mt="2"><Text fontSize="xs" fontWeight="700">{frozen.factId} · {frozen.conclusion} {frozen.confidence}%</Text><Text fontSize="xs" color="gray.600">{frozen.text}</Text>{[...frozen.sources, ...frozen.counterSources].map((snapshot) => <Text key={snapshot.sourceId} fontSize="xs" fontFamily="mono" color="gray.600" mt="1">{snapshot.sourceId} V{snapshot.version} {snapshot.status} {snapshot.contentHash} — {snapshot.title}</Text>)}</Box>)}</Box>}
  </Box>
}

function EvidenceList({ sources, claimId, factId, onAdd, onSourceChange, counter = false }: { sources: SourceRecord[]; claimId: string; factId: string; onAdd: () => void; onSourceChange: (source: SourceRecord) => void; counter?: boolean }) {
  return <Box><Flex justify="space-between" mb="3"><Text fontSize="sm" color="gray.600">{counter ? '相反证据与支持证据并列保留' : '按原始证据、二次来源、待证信息分类'}</Text><Button size="sm" colorScheme={counter ? 'red' : 'teal'} variant="outline" onClick={onAdd}>{counter ? '关联相反证据' : '关联支持证据'}</Button></Flex>{sources.map((source) => {
    const changed = source.status !== '有效'
    return <Box key={source.id} borderWidth="1px" borderColor={changed ? 'red.400' : 'gray.200'} bg={changed ? 'red.50' : 'white'} p="3" mb="2">
      <Flex justify="space-between"><Text fontWeight="600">{source.title}</Text><Flex gap="1"><Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge>{changed && <Badge colorScheme={source.status === '已撤下' ? 'red' : 'orange'}>{source.status}</Badge>}</Flex></Flex>
      <Text fontSize="xs" color="gray.600" mt="2">{source.publisher} · {source.publishedAt} · V{source.version}</Text>
      <Text fontFamily="mono" fontSize="xs" mt="2">{source.contentHash}</Text>
      {source.supersededBy && <Text fontSize="xs" color="orange.700" mt="1">已由 {source.supersededBy} 换版接替</Text>}
      <Divider my="2" /><Text fontSize="xs">{source.chainOfCustody}</Text><Text fontSize="xs" color="blue.600" mt="1" wordBreak="break-all">{source.url}</Text>
      <Flex justify="flex-end" mt="2">
        <Button size="xs" variant="outline" colorScheme="red" isDisabled={changed} onClick={() => onSourceChange(source)}>{changed ? '已登记改动' : '登记撤下 / 换版'}</Button>
      </Flex>
    </Box>
  })}</Box>
}

function AnnotationList({ fact, claimId }: { fact: ClaimFact; claimId: string }) {
  const addAnnotation = useClaimStore((state) => state.addAnnotation)
  const resolve = useClaimStore((state) => state.resolveAnnotation)
  const [text, setText] = useState('')
  return <Box><Flex gap="2" mb="3"><Input placeholder="添加事实核查批注" value={text} onChange={(event) => setText(event.target.value)} /><Button onClick={() => { addAnnotation(claimId, fact.id, { author: '陆衡', role: '事实核查员', content: text }); setText('') }}>添加</Button></Flex>{fact.annotations.map((item) => <Box key={item.id} borderLeftWidth="3px" borderColor={item.resolved ? 'green.400' : 'orange.400'} bg={item.resolved ? 'green.50' : 'orange.50'} p="3" mb="2"><Flex justify="space-between"><Text fontWeight="600" fontSize="sm">{item.role} {item.author}</Text><Button size="xs" variant="ghost" isDisabled={item.resolved} onClick={() => resolve(claimId, fact.id, item.id)}>{item.resolved ? '已解决' : '标记解决'}</Button></Flex><Text fontSize="sm" mt="2">{item.content}</Text><Text fontSize="xs" color="gray.500" mt="1">{item.createdAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box>
}
