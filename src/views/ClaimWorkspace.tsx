import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Radio, RadioGroup, Select, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, useDisclosure, useToast } from '@chakra-ui/react'
import { EvidenceGraph } from '../components/EvidenceGraph'
import { WriteBlockingBanner } from '../components/WriteBlockingBanner'
import { conclusionColor, sourceStatusColor, useClaimStore } from '../store/useClaimStore'
import { factValidity, invalidFacts, pendingEvents, publicationStaleAgainst } from '../lib/linkage'
import type { ClaimFact, EvidenceKind, FactConclusion, SourceDraft, SourceRecord } from '../types'

const emptySourceForm: SourceDraft = { title: '', url: '', publisher: '', publishedAt: '2026-09-30', kind: '原始证据', chainOfCustody: '', contentHash: '' }

export function ClaimWorkspace() {
  const { id } = useParams()
  const toast = useToast()
  const state = useClaimStore()
  const claim = state.claims.find((item) => item.id === id)
  const [selectedFactId, setSelectedFactId] = useState(claim?.facts[0]?.id ?? '')
  const selectedFact = claim?.facts.find((item) => item.id === selectedFactId) ?? claim?.facts[0]
  const [factText, setFactText] = useState('')
  const sourceModal = useDisclosure()
  const changeModal = useDisclosure()
  const reconfirmModal = useDisclosure()
  const publishModal = useDisclosure()
  const [sourceForm, setSourceForm] = useState<SourceDraft>(emptySourceForm)
  const [counterSource, setCounterSource] = useState(false)
  const [changeTarget, setChangeTarget] = useState<{ factId: string; source: SourceRecord } | null>(null)
  const [changeMode, setChangeMode] = useState<'已撤下' | '已换版'>('已撤下')
  const [changeReason, setChangeReason] = useState('')
  const [replacement, setReplacement] = useState<SourceDraft>(emptySourceForm)
  const [reconfirmConclusion, setReconfirmConclusion] = useState<FactConclusion>('已证实')
  const [reconfirmConfidence, setReconfirmConfidence] = useState(90)
  const [reconfirmNote, setReconfirmNote] = useState('')
  const [publishNote, setPublishNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!selectedFactId && claim?.facts[0]) setSelectedFactId(claim.facts[0].id) }, [selectedFactId, claim])
  if (!claim) return <Box p="10">未找到核查主张</Box>

  const stale = invalidFacts(claim)
  const blocked = stale.length > 0
  const publications = state.publications.filter((item) => item.claimId === claim.id)
  const running = !!state.runningWriteId

  const setFact = (patch: Partial<ClaimFact>) => { if (selectedFact) state.updateFact(claim.id, selectedFact.id, patch) }
  const addSource = () => {
    if (!selectedFact || !sourceForm.title || !sourceForm.url) return
    state.addSource(claim.id, selectedFact.id, sourceForm, counterSource)
    sourceModal.onClose()
    setSourceForm(emptySourceForm)
    toast({ title: '证据已加入关系图', status: 'success' })
  }
  const openChange = (factId: string, source: SourceRecord) => {
    setChangeTarget({ factId, source })
    setChangeMode('已撤下')
    setChangeReason('')
    setReplacement({ ...emptySourceForm, title: source.title, publisher: source.publisher, kind: source.kind })
    changeModal.onOpen()
  }
  const submitChange = async () => {
    if (!changeTarget || !changeReason.trim()) return
    setBusy(true)
    const result = state.startSourceChange(claim.id, {
      factId: changeTarget.factId, sourceId: changeTarget.source.id, mode: changeMode, reason: changeReason,
      replacement: changeMode === '已换版' ? replacement : undefined
    })
    if (!result.ok || !result.opId) {
      toast({ title: result.message, status: 'error' })
      setBusy(false)
      return
    }
    await waitFor(result.opId!)
    const op = useClaimStore.getState().pendingWrites.find((item) => item.id === result.opId)
    setBusy(false)
    changeModal.onClose()
    if (op) toast({ title: '写入已中断，请在页面顶部阻断点续跑', status: 'warning', duration: 4000 })
    else toast({ title: '来源变动已登记，依赖结论已进入重新确认', status: 'success' })
  }
  const openReconfirm = (fact: ClaimFact) => {
    setReconfirmConclusion(fact.conclusion)
    setReconfirmConfidence(fact.confidence)
    setReconfirmNote('')
    reconfirmModal.onOpen()
  }
  const submitReconfirm = async () => {
    if (!selectedFact) return
    setBusy(true)
    const result = state.startReconfirm(claim.id, { factId: selectedFact.id, editor: claim.editor || '宋卓', note: reconfirmNote, conclusion: reconfirmConclusion, confidence: reconfirmConfidence })
    if (!result.ok || !result.opId) {
      toast({ title: result.message, status: 'error' })
      setBusy(false)
      return
    }
    await waitFor(result.opId)
    const op = useClaimStore.getState().pendingWrites.find((item) => item.id === result.opId)
    setBusy(false)
    reconfirmModal.onClose()
    if (op) toast({ title: '写入已中断，请续跑', status: 'warning' })
    else toast({ title: '事实已重新确认，结论恢复可用', status: 'success' })
  }
  const submitPublish = async () => {
    setBusy(true)
    const result = state.startPublish(claim.id, { editor: claim.editor || '宋卓', note: publishNote || '编辑核对后另存发布版本' })
    if (!result.ok || !result.opId) {
      toast({ title: result.message, status: 'error' })
      setBusy(false)
      return
    }
    await waitFor(result.opId)
    const op = useClaimStore.getState().pendingWrites.find((item) => item.id === result.opId)
    setBusy(false)
    if (op) {
      toast({ title: '写入已中断，请在阻断点续跑', status: 'warning' })
    } else {
      publishModal.onClose()
      setPublishNote('')
      toast({ title: '已另存为新的发布版本，旧版与审计保持不变', status: 'success' })
    }
  }
  const waitFor = (opId: string) => new Promise<void>((resolve) => {
    const unsub = useClaimStore.subscribe((s) => {
      if (s.runningWriteId !== opId) {
        unsub()
        resolve()
      }
    })
    if (useClaimStore.getState().runningWriteId !== opId) {
      unsub()
      resolve()
    }
  })
  const exportArchive = () => {
    if (blocked) {
      toast({ title: '存在等待重新确认的事实，重新确认前不能导出', status: 'error', duration: 4000 })
      return
    }
    const versions = state.versions.filter((item) => item.claimId === claim.id)
    const audit = state.audit.filter((item) => item.claimId === claim.id)
    const blob = new Blob([JSON.stringify({ claim, versions, publications, audit }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${claim.id}-核查档案.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  const exportPublication = (pubId: string) => {
    if (blocked) {
      toast({ title: '来源变动尚未重新确认，发布版本快照暂不能导出（仍可在线查看）', status: 'error', duration: 4000 })
      return
    }
    const pub = publications.find((item) => item.id === pubId)
    if (!pub) return
    const blob = new Blob([JSON.stringify({ publication: pub }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${claim.id}-发布版本#${pub.publicationNo}.json`; anchor.click(); URL.revokeObjectURL(url)
  }

  return <Box p="6" pb="16">
    <WriteBlockingBanner claimId={claim.id} />
    {blocked && <Box mb="4" bg="red.50" borderLeftWidth="4px" borderColor="red.500" p="4">
      <Text fontWeight="700" color="red.700">当前阻断点：来源发生撤下/换版，{stale.length} 项事实结论已失效并等待编辑重新确认</Text>
      <Text fontSize="sm" color="red.700" mt="1">受影响事实：{stale.map((fact) => fact.id).join('、')}；未受影响事实继续可用。重新确认完成前，本主张不能再次发布或导出，历史发布版本保留当时来源快照、仅可查看。</Text>
    </Box>}
    <Flex justify="space-between" align="flex-start" mb="4">
      <Box>
        <Text fontSize="xs" color="gray.600">{claim.id} · {claim.reporter} / {claim.editor} · V{claim.version}</Text>
        <Text fontSize="xl" fontWeight="700" mt="1">{claim.title}</Text>
        <Text color="gray.600" fontSize="sm" mt="2" maxW="760px">{claim.summary}</Text>
      </Box>
      <Flex gap="2">
        <Button variant="outline" isDisabled={blocked || running} onClick={exportArchive}>{blocked ? '导出已阻断' : '导出档案'}</Button>
        <Button colorScheme="teal" isDisabled={running} onClick={publishModal.onOpen}>{publications.length ? '另存新发布版本' : '发布正式版本'}</Button>
      </Flex>
    </Flex>
    <EvidenceGraph facts={claim.facts} />
    <Grid mt="4" templateColumns="320px 1fr" gap="4" alignItems="start">
      <Box bg="white" borderWidth="1px" p="3">
        <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">可验证事实树</Text><Badge>{claim.facts.length}</Badge></Flex>
        {claim.facts.map((fact) => {
          const validity = factValidity(fact)
          return <Box key={fact.id} as="button" textAlign="left" w="100%" p="3" mb="2" borderWidth="1px" borderColor={validity === '等待重新确认' ? 'red.400' : fact.id === selectedFact?.id ? 'teal.600' : 'gray.200'} bg={validity === '等待重新确认' ? 'red.50' : fact.id === selectedFact?.id ? 'teal.50' : 'white'} onClick={() => setSelectedFactId(fact.id)}>
            <Flex justify="space-between"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Badge colorScheme={conclusionColor[fact.conclusion]}>{fact.conclusion}</Badge></Flex>
            <Text fontSize="sm" mt="2" fontWeight="600">{fact.text}</Text>
            <Flex justify="space-between" mt="2"><Text fontSize="xs" color="gray.500">置信度 {fact.confidence}% · 疑点 {fact.unresolved.length}</Text>{validity === '等待重新确认' && <Badge colorScheme="red">等待重新确认</Badge>}</Flex>
          </Box>
        })}
        <Flex mt="3" gap="2"><Input size="sm" placeholder="拆出新的可验证事实" value={factText} onChange={(event) => setFactText(event.target.value)} /><Button size="sm" colorScheme="teal" onClick={() => { state.addFact(claim.id, factText); setFactText('') }}>添加</Button></Flex>
      </Box>
      {selectedFact && <Box bg="white" borderWidth="1px" p="4">
        <Flex justify="space-between" align="flex-start"><Box><Text fontSize="xs" color="gray.500">{selectedFact.id}</Text><Text fontWeight="700" mt="1">{selectedFact.text}</Text></Box><Badge colorScheme={conclusionColor[selectedFact.conclusion]}>{selectedFact.conclusion}</Badge></Flex>
        {factValidity(selectedFact) === '等待重新确认' && <Box mt="3" bg="red.50" borderLeftWidth="4px" borderColor="red.500" p="3">
          <Text fontWeight="700" color="red.700" fontSize="sm">结论已失效，等待编辑重新确认</Text>
          {pendingEvents(selectedFact).map((event) => <Text key={event.id} fontSize="xs" color="red.700" mt="1">来源「{event.sourceTitle}」{event.status}（{event.changedAt.replace('T', ' ').slice(0, 16)}）：{event.note}；原结论“{event.previousConclusion}”暂停对外引用。</Text>)}
          <Button size="sm" colorScheme="red" mt="2" isDisabled={running} onClick={() => openReconfirm(selectedFact)}>编辑核对并重新确认</Button>
        </Box>}
        <Grid templateColumns="1fr 1fr 1fr" gap="3" mt="4">
          <FormControl><FormLabel fontSize="xs">事实结论</FormLabel><Select size="sm" isDisabled={factValidity(selectedFact) === '等待重新确认'} value={selectedFact.conclusion} onChange={(event) => setFact({ conclusion: event.target.value as FactConclusion })}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
          <FormControl><FormLabel fontSize="xs">置信程度 {selectedFact.confidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" isDisabled={factValidity(selectedFact) === '等待重新确认'} value={selectedFact.confidence} onChange={(event) => setFact({ confidence: Number(event.target.value) })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">未解决疑点</FormLabel><Input size="sm" value={selectedFact.unresolved.join('；')} onChange={(event) => setFact({ unresolved: event.target.value ? event.target.value.split('；') : [] })} /></FormControl>
        </Grid>
        {factValidity(selectedFact) === '等待重新确认' && <Text fontSize="xs" color="red.600" mt="1">结论与置信度已锁定，须由编辑核对后在上方“重新确认”中恢复或改判。</Text>}
        <Tabs mt="5" colorScheme="teal">
          <TabList><Tab>支持证据 {selectedFact.sources.length}</Tab><Tab>相反证据 {selectedFact.counterSources.length}</Tab><Tab>批注 {selectedFact.annotations.length}</Tab><Tab>来源时间线</Tab><Tab>发布版本 {publications.length}</Tab></TabList>
          <TabPanels>
            <TabPanel px="0"><EvidenceList sources={selectedFact.sources} claimId={claim.id} factId={selectedFact.id} onAdd={() => { setCounterSource(false); sourceModal.onOpen() }} onChange={openChange} onAddDisabled={running} /></TabPanel>
            <TabPanel px="0"><EvidenceList sources={selectedFact.counterSources} claimId={claim.id} factId={selectedFact.id} onAdd={() => { setCounterSource(true); sourceModal.onOpen() }} onChange={openChange} onAddDisabled={running} counter /></TabPanel>
            <TabPanel px="0"><AnnotationList fact={selectedFact} claimId={claim.id} /></TabPanel>
            <TabPanel px="0"><Box borderLeftWidth="2px" borderColor="gray.300" pl="4">{[...selectedFact.sources, ...selectedFact.counterSources].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((source) => <Box key={source.id} mb="4"><Flex gap="2" align="center"><Text fontSize="xs" color="gray.500">{source.publishedAt} · {source.kind}</Text><Badge colorScheme={sourceStatusColor[source.status]}>{source.status}{source.version > 1 ? ` V${source.version}` : ''}</Badge>{source.supersedes && <Badge>接替 {source.supersedes}</Badge>}</Flex><Text fontWeight="600" mt="1">{source.title}</Text><Text fontSize="sm" color="gray.600">{source.publisher} · 留档 {source.capturedAt.replace('T', ' ').slice(0, 16)}</Text>{source.changeNote && <Text fontSize="xs" color="red.600" mt="1">变动说明：{source.changeNote}</Text>}</Box>)}</Box></TabPanel>
            <TabPanel px="0"><PublicationsList publications={publications} claim={claim} blocked={blocked} onExport={exportPublication} /></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>}
    </Grid>
    <Modal isOpen={sourceModal.isOpen} onClose={sourceModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>{counterSource ? '关联相反证据' : '关联支持证据'}</ModalHeader><ModalCloseButton /><ModalBody><Grid templateColumns="1fr 1fr" gap="3"><FormControl><FormLabel>来源标题</FormLabel><Input value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} /></FormControl><FormControl><FormLabel>公开地址</FormLabel><Input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} /></FormControl><FormControl><FormLabel>发布机构</FormLabel><Input value={sourceForm.publisher} onChange={(event) => setSourceForm({ ...sourceForm, publisher: event.target.value })} /></FormControl><FormControl><FormLabel>证据类型</FormLabel><Select value={sourceForm.kind} onChange={(event) => setSourceForm({ ...sourceForm, kind: event.target.value as EvidenceKind })}>{['原始证据', '二次来源', '待证信息'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl><FormControl><FormLabel>内容哈希</FormLabel><Input placeholder="sha256:..." value={sourceForm.contentHash} onChange={(event) => setSourceForm({ ...sourceForm, contentHash: event.target.value })} /></FormControl><FormControl><FormLabel>留档说明</FormLabel><Input value={sourceForm.chainOfCustody} onChange={(event) => setSourceForm({ ...sourceForm, chainOfCustody: event.target.value })} /></FormControl></Grid></ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={sourceModal.onClose}>取消</Button><Button colorScheme="teal" isDisabled={!sourceForm.title || !sourceForm.url} onClick={addSource}>加入证据关系图</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={changeModal.isOpen} onClose={changeModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>登记来源变动</ModalHeader><ModalCloseButton /><ModalBody>
      {changeTarget && <Box borderWidth="1px" p="3" mb="4" bg="gray.50"><Text fontWeight="700">{changeTarget.source.title}</Text><Text fontSize="xs" color="gray.600" mt="1">{changeTarget.source.publisher} · 留档哈希 {changeTarget.source.contentHash}</Text></Box>}
      <RadioGroup value={changeMode} onChange={(value) => setChangeMode(value as '已撤下' | '已换版')} mb="4"><Stack direction="row"><Radio value="已撤下">来源被撤下（无新版）</Radio><Radio value="已换版">来源换版（登记新版）</Radio></Stack></RadioGroup>
      <FormControl mb="3"><FormLabel>变动原因 / 说明（将写入审计，只追加）</FormLabel><Textarea rows={2} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="例如：原页面返回404；官方勘误后重新发布……" /></FormControl>
      {changeMode === '已换版' && <Box borderLeftWidth="3px" borderColor="orange.400" pl="3" mb="2">
        <Text fontSize="sm" fontWeight="700" mb="2">新版来源快照</Text>
        <Grid templateColumns="1fr 1fr" gap="3">
          <FormControl><FormLabel fontSize="xs">新版标题</FormLabel><Input size="sm" value={replacement.title} onChange={(event) => setReplacement({ ...replacement, title: event.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">新版地址</FormLabel><Input size="sm" value={replacement.url} onChange={(event) => setReplacement({ ...replacement, url: event.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">发布机构</FormLabel><Input size="sm" value={replacement.publisher} onChange={(event) => setReplacement({ ...replacement, publisher: event.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">证据类型</FormLabel><Select size="sm" value={replacement.kind} onChange={(event) => setReplacement({ ...replacement, kind: event.target.value as EvidenceKind })}>{['原始证据', '二次来源', '待证信息'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
          <FormControl><FormLabel fontSize="xs">内容哈希</FormLabel><Input size="sm" value={replacement.contentHash} onChange={(event) => setReplacement({ ...replacement, contentHash: event.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">留档说明</FormLabel><Input size="sm" value={replacement.chainOfCustody} onChange={(event) => setReplacement({ ...replacement, chainOfCustody: event.target.value })} /></FormControl>
        </Grid>
      </Box>}
      <Text fontSize="xs" color="red.600">登记后，所有引用该来源（含相反证据）的事实结论立即失效并等待编辑重新确认；未引用的事实不受影响。</Text>
    </ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={changeModal.onClose}>取消</Button><Button colorScheme="orange" isLoading={busy} isDisabled={!changeReason.trim() || (changeMode === '已换版' && (!replacement.title || !replacement.url))} onClick={submitChange}>登记变动并传播</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={reconfirmModal.isOpen} onClose={reconfirmModal.onClose}><ModalOverlay /><ModalContent><ModalHeader>编辑核对并重新确认事实</ModalHeader><ModalCloseButton /><ModalBody>
      {selectedFact && <Box mb="4">{pendingEvents(selectedFact).map((event) => <Box key={event.id} bg="red.50" p="2" mb="2" fontSize="xs" color="red.700">来源「{event.sourceTitle}」{event.status}：{event.note}<br />原结论：{event.previousConclusion}</Box>)}</Box>}
      <Grid templateColumns="1fr 1fr" gap="3" mb="3">
        <FormControl><FormLabel fontSize="xs">重新确认后的结论</FormLabel><Select size="sm" value={reconfirmConclusion} onChange={(event) => setReconfirmConclusion(event.target.value as FactConclusion)}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
        <FormControl><FormLabel fontSize="xs">置信程度 {reconfirmConfidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" value={reconfirmConfidence} onChange={(event) => setReconfirmConfidence(Number(event.target.value))} /></FormControl>
      </Grid>
      <FormControl><FormLabel>核对依据（审计留痕，只追加）</FormLabel><Textarea rows={4} value={reconfirmNote} onChange={(event) => setReconfirmNote(event.target.value)} placeholder="说明对照新版来源/补证材料的核对过程与结论变化" /></FormControl>
    </ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={reconfirmModal.onClose}>取消</Button><Button colorScheme="teal" isLoading={busy} isDisabled={!reconfirmNote.trim()} onClick={submitReconfirm}>确认并恢复结论</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={publishModal.isOpen} onClose={publishModal.onClose}><ModalOverlay /><ModalContent><ModalHeader>{publications.length ? '编辑核对后另存发布版本' : '发布正式版本'}</ModalHeader><ModalCloseButton /><ModalBody>
      {blocked
        ? <Box bg="red.50" p="4"><Text fontWeight="700" color="red.700">发布被阻断</Text><Text fontSize="sm" color="red.700" mt="1">事实 {stale.map((fact) => fact.id).join('、')} 的来源已撤下/换版，结论等待重新确认。重新确认前不能再次发布或导出；已发布的 {publications.length} 个历史版本保留当时来源快照，不受影响、可查看。</Text></Box>
        : <>
          <FormControl mb="4"><FormLabel>发布说明（随版本快照留档）</FormLabel><Textarea rows={3} value={publishNote} onChange={(event) => setPublishNote(event.target.value)} placeholder="本轮核对范围、结论变化与仍需关注的疑点" /></FormControl>
          <Text fontSize="xs" color="gray.500">本次将另存为发布版本 #{publications.length + 1}，完整冻结当前主张与全部来源哈希；旧发布版本与审计记录不修改、只追加。</Text>
        </>}
    </ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={publishModal.onClose}>取消</Button>{!blocked && <Button colorScheme="teal" isLoading={busy} onClick={submitPublish}>另存为发布版本 #{publications.length + 1}</Button>}</ModalFooter></ModalContent></Modal>
  </Box>
}

function EvidenceList({ sources, claimId, factId, onAdd, onChange, onAddDisabled, counter = false }: { sources: SourceRecord[]; claimId: string; factId: string; onAdd: () => void; onChange: (factId: string, source: SourceRecord) => void; onAddDisabled?: boolean; counter?: boolean }) {
  void claimId
  return <Box><Flex justify="space-between" mb="3"><Text fontSize="sm" color="gray.600">{counter ? '相反证据与支持证据并列保留' : '按原始证据、二次来源、待证信息分类'}</Text><Button size="sm" colorScheme={counter ? 'red' : 'teal'} variant="outline" isDisabled={onAddDisabled} onClick={onAdd}>{counter ? '关联相反证据' : '关联支持证据'}</Button></Flex>{sources.map((source) => <Box key={source.id} borderWidth="1px" borderLeftWidth="4px" borderLeftColor={source.status === '在档' ? 'green.300' : source.status === '已撤下' ? 'red.400' : 'orange.400'} p="3" mb="2" bg={source.status === '在档' ? 'white' : 'red.50'}>
    <Flex justify="space-between"><Text fontWeight="600">{source.title}</Text><HStackBadges source={source} /></Flex>
    <Text fontSize="xs" color="gray.600" mt="2">{source.publisher} · {source.publishedAt} · V{source.version}</Text>
    <Text fontFamily="mono" fontSize="xs" mt="2">{source.contentHash}</Text>
    {source.status !== '在档' && <Box mt="2"><Text fontSize="xs" color="red.700">{source.status}于 {(source.removedAt ?? '').replace('T', ' ').slice(0, 16)}：{source.changeNote}</Text>{source.supersededBy && <Text fontSize="xs" color="orange.700">新版记录：{source.supersededBy}</Text>}</Box>}
    {source.supersedes && <Text fontSize="xs" color="orange.700" mt="1">本记录接替旧版 {source.supersedes}，旧版结论需重新确认</Text>}
    <Divider my="2" /><Text fontSize="xs">{source.chainOfCustody}</Text><Text fontSize="xs" color="blue.600" mt="1" wordBreak="break-all">{source.url}</Text>
    {source.status === '在档' && <Flex justify="flex-end" mt="2"><Button size="xs" variant="outline" colorScheme="orange" isDisabled={onAddDisabled} onClick={() => onChange(factId, source)}>登记撤下 / 换版</Button></Flex>}
  </Box>)}</Box>
}

function HStackBadges({ source }: { source: SourceRecord }) {
  return <Flex gap="1">
    <Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge>
    <Badge colorScheme={sourceStatusColor[source.status]}>{source.status}</Badge>
  </Flex>
}

function PublicationsList({ publications, claim, blocked, onExport }: { publications: ReturnType<typeof useClaimStore.getState>['publications']; claim: ReturnType<typeof useClaimStore.getState>['claims'][number]; blocked: boolean; onExport: (pubId: string) => void }) {
  if (!publications.length) return <Text fontSize="sm" color="gray.500">尚无发布版本；编辑核对后发布将在此另存不可变快照。</Text>
  return <Box>{publications.map((pub) => {
    const stale = publicationStaleAgainst(pub, claim)
    return <Box key={pub.id} borderWidth="1px" p="3" mb="2" bg={stale ? 'orange.50' : 'white'}>
      <Flex justify="space-between" align="center">
        <Box><Text fontWeight="700">发布版本 #{pub.publicationNo}（V{pub.claimVersion}）</Text><Text fontSize="xs" color="gray.500" mt="1">{pub.publishedAt.replace('T', ' ').slice(0, 16)} · 编辑 {pub.editor}</Text></Box>
        <Flex gap="2" align="center">{stale && <Badge colorScheme="orange">快照后来源已变动</Badge>}<Badge colorScheme="gray">不可变快照</Badge><Button size="xs" variant="outline" isDisabled={blocked} onClick={() => onExport(pub.id)}>{blocked ? '导出阻断中' : '导出该版本'}</Button></Flex>
      </Flex>
      <Text fontSize="sm" mt="2">{pub.note}</Text>
      <Text fontSize="xs" color="gray.500" mt="2">快照含 {pub.snapshot.facts.length} 项事实、{pub.snapshot.facts.flatMap((fact) => [...fact.sources, ...fact.counterSources]).length} 条来源及哈希；{stale ? '该版本发布后其引用来源发生撤下/换版，继续对外引用前须重新确认并另存新版本。' : '快照与当前来源状态一致。'}</Text>
    </Box>
  })}</Box>
}

function AnnotationList({ fact, claimId }: { fact: ClaimFact; claimId: string }) {
  const addAnnotation = useClaimStore((state) => state.addAnnotation)
  const resolve = useClaimStore((state) => state.resolveAnnotation)
  const [text, setText] = useState('')
  return <Box><Flex gap="2" mb="3"><Input placeholder="添加事实核查批注" value={text} onChange={(event) => setText(event.target.value)} /><Button onClick={() => { addAnnotation(claimId, fact.id, { author: '陆衡', role: '事实核查员', content: text }); setText('') }}>添加</Button></Flex>{fact.annotations.map((item) => <Box key={item.id} borderLeftWidth="3px" borderColor={item.resolved ? 'green.400' : 'orange.400'} bg={item.resolved ? 'green.50' : 'orange.50'} p="3" mb="2"><Flex justify="space-between"><Text fontWeight="600" fontSize="sm">{item.role} {item.author}</Text><Button size="xs" variant="ghost" isDisabled={item.resolved} onClick={() => resolve(claimId, fact.id, item.id)}>{item.resolved ? '已解决' : '标记解决'}</Button></Flex><Text fontSize="sm" mt="2">{item.content}</Text><Text fontSize="xs" color="gray.500" mt="1">{item.createdAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box>
}
