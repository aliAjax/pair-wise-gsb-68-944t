import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, Flex, HStack, Spinner, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useClaimStore } from '../store/useClaimStore'
import type { PendingWrite } from '../types'

const stepColor: Record<string, string> = {
  已完成: 'green',
  已中断: 'red',
  待执行: 'gray'
}

function Steps({ op }: { op: PendingWrite }) {
  const interruptedIndex = op.steps.findIndex((step) => step.status === '已中断')
  const pendingIndex = op.steps.findIndex((step) => step.status === '待执行')
  return <HStack align="stretch" mt="2" spacing="2" flexWrap="wrap">
    {op.steps.map((step, index) => <Box key={step.key} px="3" py="2" borderRadius="4px" borderWidth="1px" borderColor={`${stepColor[step.status]}.300`} bg={`${stepColor[step.status]}.50`} minW="150px">
      <Text fontSize="xs" color="gray.500">步骤 {index + 1}</Text>
      <Text fontSize="sm" fontWeight="600">{step.label} · {step.status}</Text>
      {step.error && <Text fontSize="xs" color="red.600" mt="1">{step.error}</Text>}
    </Box>)}
    <Box alignSelf="center" fontSize="xs" color="gray.500" maxW="260px">
      {interruptedIndex >= 0
        ? <>当前阻断点：<Text as="span" color="red.600" fontWeight="700">步骤 {interruptedIndex + 1}「{op.steps[interruptedIndex].label}」</Text>，其之前步骤已落盘，重试只补未完成部分。</>
        : pendingIndex >= 0
          ? <>下一个待写入：步骤 {pendingIndex + 1}「{op.steps[pendingIndex].label}」</>
          : null}
    </Box>
  </HStack>
}

/** 主张工作台顶部：本主张被中断的写入任务 */
export function WriteBlockingBanner({ claimId }: { claimId: string }) {
  const navigate = useNavigate()
  const pendingWrites = useClaimStore((state) => state.pendingWrites)
  const retryWrite = useClaimStore((state) => state.retryWrite)
  const runningWriteId = useClaimStore((state) => state.runningWriteId)
  const ops = pendingWrites.filter((op) => op.claimId === claimId)
  if (!ops.length) return null
  return <Box mb="4">
    {ops.map((op) => {
      const running = runningWriteId === op.id
  const interrupted = op.steps.some((step) => step.status === '已中断')
  const nextStep = op.steps.find((step) => step.status !== '已完成')
      return <Alert key={op.id} status={interrupted ? 'error' : 'warning'} variant="left-accent" flexDirection="column" alignItems="stretch" mb="2">
        <Flex align="center">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle fontSize="sm">{op.title}</AlertTitle>
            <AlertDescription fontSize="xs" display="block">
              多步写入未完成 · 开始于 {op.startedAt.replace('T', ' ').slice(0, 19)} · 已完成项不会重复写入{nextStep ? ` · 下一待补步骤：${nextStep.label}` : ''}
            </AlertDescription>
          </Box>
          <Button size="sm" colorScheme="red" isDisabled={running || !!runningWriteId} onClick={() => retryWrite(op.id)}>
            {running ? <Spinner size="xs" mr="2" /> : null}从阻断点续跑
          </Button>
        </Flex>
        <Steps op={op} />
      </Alert>
    })}
  </Box>
}

/** 全局被中断写入概览（列表页/侧边栏用） */
export function PendingWritesSummary({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const pendingWrites = useClaimStore((state) => state.pendingWrites)
  const retryWrite = useClaimStore((state) => state.retryWrite)
  const runningWriteId = useClaimStore((state) => state.runningWriteId)
  if (!pendingWrites.length) return null
  return <Alert status="warning" variant="left-accent" flexDirection="column" alignItems="stretch">
    <AlertTitle fontSize="sm">有 {pendingWrites.length} 个多步写入任务未完成，相关主张的重新发布与导出已暂停</AlertTitle>
    {!compact && pendingWrites.map((op) => {
      const interruptedIndex = op.steps.findIndex((step) => step.status === '已中断')
      const running = runningWriteId === op.id
      return <Box key={op.id} mt="2" bg="white" borderWidth="1px" p="3" borderRadius="4px">
        <Flex align="center" gap="3">
          <Box flex="1">
            <Text fontSize="sm" fontWeight="700">{op.title}</Text>
            <Text fontSize="xs" color="gray.500" mt="1">
              {op.steps.map((step, index) => <Text as="span" key={step.key} mr="2" color={step.status === '已中断' ? 'red.600' : step.status === '已完成' ? 'green.600' : 'gray.500'}>
                {index + 1}.{step.label}（{step.status}）
              </Text>)}
            </Text>
            {interruptedIndex >= 0 && <Text fontSize="xs" color="red.600" mt="1">阻断点：步骤 {interruptedIndex + 1}「{op.steps[interruptedIndex].label}」— {op.steps[interruptedIndex].error}</Text>}
          </Box>
          <Button size="sm" variant="outline" onClick={() => navigate(`/claims/${op.claimId}`)}>前往核对</Button>
          <Button size="sm" colorScheme="red" isDisabled={running || !!runningWriteId} onClick={() => retryWrite(op.id)}>
            {running ? <Spinner size="xs" mr="2" /> : null}续跑未完成步骤
          </Button>
        </Flex>
      </Box>
    })}
  </Alert>
}
