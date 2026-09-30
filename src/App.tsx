import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Badge, Box, Button, Flex, HStack, Select, Switch, Text, VStack } from '@chakra-ui/react'
import { useClaimStore } from './store/useClaimStore'
import { ClaimList } from './views/ClaimList'
import { ClaimWorkspace } from './views/ClaimWorkspace'
import { ReviewQueue } from './views/ReviewQueue'
import { AuditArchive } from './views/AuditArchive'

function Shell() {
  const reset = useClaimStore((state) => state.reset)
  const review = useClaimStore((state) => state.claims.filter((item) => item.status === '待编辑复核').length)
  const pendingWrites = useClaimStore((state) => state.pendingWrites)
  const failureArmed = useClaimStore((state) => state.failureArmed)
  const failureStep = useClaimStore((state) => state.failureStep)
  const toggleFailureArm = useClaimStore((state) => state.toggleFailureArm)
  const setFailureStep = useClaimStore((state) => state.setFailureStep)
  return <Flex minH="100vh">
    <Box position="fixed" w="238px" inset="0 auto 0 0" bg="#17342f" color="white" px="4" py="5" display="flex" flexDirection="column">
      <HStack borderBottomWidth="1px" borderColor="whiteAlpha.300" pb="5">
        <Box w="40px" h="40px" bg="#c79c39" color="#17342f" display="grid" placeItems="center" fontWeight="800" borderRadius="4px">核</Box>
        <Box><Text fontWeight="700" fontSize="sm">事实核查工作台</Text><Text color="whiteAlpha.600" fontSize="xs" mt="1">证据链与发布审阅</Text></Box>
      </HStack>
      <VStack align="stretch" mt="5" spacing="1">
        {[['/', '核查主张'], ['/reviews', '编辑复核'], ['/audit', '档案与审计']].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}><Flex px="3" py="2.5" borderRadius="4px" justify="space-between" fontSize="sm" color="whiteAlpha.700"><span>{label}</span>
          {label === '编辑复核' && review > 0 && <Badge colorScheme="red">{review}</Badge>}
          {label === '档案与审计' && pendingWrites.length > 0 && <Badge colorScheme="orange">{pendingWrites.length} 写入中断</Badge>}
        </Flex></NavLink>)}
      </VStack>
      <Box mt="4" bg="blackAlpha.300" p="3">
        <Text fontSize="xs" color="whiteAlpha.600">写入故障演练</Text>
        <Flex mt="2" align="center" justify="space-between">
          <Text fontSize="xs">下次多步写入在选定步骤失败</Text>
          <Switch size="sm" colorScheme="orange" isChecked={failureArmed} onChange={toggleFailureArm} />
        </Flex>
        <Select size="xs" mt="2" bg="whiteAlpha.200" color="white" borderColor="whiteAlpha.300" value={failureStep} onChange={(event) => setFailureStep(Number(event.target.value))}>
          <option value={1}>第 1 步中断</option>
          <option value={2}>第 2 步中断</option>
          <option value={3}>第 3 步中断</option>
        </Select>
        <Text fontSize="10px" color="whiteAlpha.500" mt="1">中断后已完成步骤保留，重试只补未完成项</Text>
      </Box>
      <Box mt="3" bg="blackAlpha.300" p="3">
        <Text fontSize="xs" color="whiteAlpha.600">当前角色</Text><Text fontSize="sm" mt="1">事实核查员 陆衡</Text><Text fontSize="xs" color="whiteAlpha.500" mt="1">来源撤下/换版必须传播到引用结论</Text>
      </Box>
      <Box mt="auto" pt="3">
        <Button size="xs" variant="outline" color="white" borderColor="whiteAlpha.400" w="100%" onClick={reset}>恢复演示数据</Button>
      </Box>
    </Box>
    <Box ml="238px" flex="1" minW="0">
      <Routes>
        <Route path="/" element={<ClaimList />} />
        <Route path="/claims/:id" element={<ClaimWorkspace />} />
        <Route path="/reviews" element={<ReviewQueue />} />
        <Route path="/audit" element={<AuditArchive />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  </Flex>
}

export function App() { return <BrowserRouter><Shell /></BrowserRouter> }
