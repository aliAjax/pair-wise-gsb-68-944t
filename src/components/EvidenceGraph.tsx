import { Badge, Box, Flex, Text } from '@chakra-ui/react'
import { isStaleFact } from '../store/useClaimStore'
import type { ClaimFact } from '../types'

export function EvidenceGraph({ facts }: { facts: ClaimFact[] }) {
  return <Box borderWidth="1px" bg="white" p="4">
    <Flex justify="space-between" mb="3"><Text fontWeight="700">主张与证据关系</Text><Text fontSize="xs" color="gray.600">实线支持 / 虚线反驳 / 红色为来源改动后结论失效</Text></Flex>
    <Flex overflowX="auto" gap="3" minH="150px" align="center">
      <Box minW="150px" bg="teal.700" color="white" p="3" borderRadius="4px"><Text fontSize="xs">核查主张</Text><Text fontWeight="700" mt="2">待发布报告</Text></Box>
      {facts.map((fact) => {
        const stale = isStaleFact(fact)
        return <Box key={fact.id} minW="210px" borderWidth="1px" borderColor={stale ? 'red.500' : 'gray.300'} borderStyle={stale ? 'dashed' : 'solid'} bg={stale ? 'red.50' : 'white'} p="3" position="relative" _before={{ content: '"—"', position: 'absolute', left: '-12px', color: stale ? 'red.500' : 'teal.600' }}>
          <Flex justify="space-between" align="center"><Text fontSize="xs" color="gray.500">事实 {fact.id}</Text>{stale && <Badge colorScheme="red">失效待确认</Badge>}{fact.verifyState === '已重新确认' && <Badge colorScheme="green">已重新确认</Badge>}</Flex>
          <Text fontSize="sm" fontWeight="700" mt="1">{fact.text}</Text>
          <Flex mt="3" gap="2"><Box flex="1" borderWidth="1px" borderColor="green.300" p="2"><Text fontSize="xs">支持 {fact.sources.length}</Text></Box><Box flex="1" borderWidth="1px" borderColor="red.300" borderStyle="dashed" p="2"><Text fontSize="xs">反驳 {fact.counterSources.length}</Text></Box></Flex>
        </Box>
      })}
    </Flex>
  </Box>
}
