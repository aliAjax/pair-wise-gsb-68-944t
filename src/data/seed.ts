import type { AuditEntry, Claim, ClaimFact, PublishedVersion, SourceRecord, VersionRecord } from '../types'

function source(record: Omit<SourceRecord, 'status' | 'revisions'> & Partial<Pick<SourceRecord, 'status' | 'revisions'>>): SourceRecord {
  return { status: '有效', revisions: [], ...record }
}

function fact(record: Omit<ClaimFact, 'verifyState' | 'invalidations' | 'reconfirms'> & Partial<Pick<ClaimFact, 'verifyState' | 'invalidations' | 'reconfirms'>>): ClaimFact {
  return { verifyState: '有效', invalidations: [], reconfirms: [], ...record }
}

export const seedClaims: Claim[] = [
  {
    id: 'FC-260929-01', title: '某地新建数据中心停用全部柴油应急电源', summary: '社交平台流传项目验收文件截图，称数据中心取消柴油发电机改为纯储能供电。',
    reporter: '沈言', editor: '宋卓', status: '待编辑复核', priority: '高', createdAt: '2026-09-29T08:10:00', updatedAt: '2026-09-29T15:30:00', version: 4,
    facts: [
      fact({
        id: 'F-1', text: '项目规划文件中曾包含2台柴油发电机组。', conclusion: '已证实', confidence: 98, unresolved: [],
        sources: [
          source({ id: 'S-1', title: '一期工程环境影响报告表', url: 'https://example.gov.cn/report/2025-1102', publisher: '市生态环境局', publishedAt: '2025-11-02', capturedAt: '2026-09-29T08:40:00', kind: '原始证据', chainOfCustody: '官网下载PDF，哈希时间戳已记录', contentHash: 'sha256:9d31f1...a42c', version: 1 }),
          source({ id: 'S-2', title: '项目设备采购公告', url: 'https://example.com/tender/8821', publisher: '公共资源交易平台', publishedAt: '2026-01-18', capturedAt: '2026-09-29T08:52:00', kind: '原始证据', chainOfCustody: '官网页面快照与原始附件同时留存', contentHash: 'sha256:7bc029...de10', version: 2 })
        ], counterSources: [], annotations: [{ id: 'N-1', author: '宋卓', role: '编辑', content: '请补充规划变更批复，不能用采购公告单独代表最终方案。', createdAt: '2026-09-29T10:20:00', resolved: false }]
      }),
      fact({
        id: 'F-2', text: '最终验收已取消柴油应急电源。', conclusion: '证据不足', confidence: 42, unresolved: ['缺少竣工验收备案原件', '网传截图无文件编号与签章页'],
        sources: [source({ id: 'S-3', title: '匿名用户上传的验收文件局部截图', url: 'https://social.example/post/9901', publisher: '社交平台账号', publishedAt: '2026-09-28', capturedAt: '2026-09-29T09:05:00', kind: '待证信息', chainOfCustody: '已保存原帖与图片EXIF，待向主管部门核验', contentHash: 'sha256:1fe210...67bd', version: 1 })],
        counterSources: [source({ id: 'C-1', title: '储能系统招标文件仍列出柴发切换接口', url: 'https://example.com/tender/9102', publisher: '公共资源交易平台', publishedAt: '2026-03-04', capturedAt: '2026-09-29T14:10:00', kind: '原始证据', chainOfCustody: '附件原文留存，相关条款见第42页', contentHash: 'sha256:c7249a...001f', version: 1 })],
        annotations: [{ id: 'N-2', author: '陆衡', role: '事实核查员', content: '该结论不得以匿名截图单独成立，需取得主管部门书面确认。', createdAt: '2026-09-29T14:25:00', resolved: false }]
      }),
      fact({
        id: 'F-3', text: '纯储能方案足以覆盖消防和一级负荷供电。', conclusion: '证据不足', confidence: 31, unresolved: ['缺少负荷计算书', '缺少消防验收文件'],
        sources: [source({ id: 'S-4', title: '设备厂商技术白皮书', url: 'https://vendor.example/white-paper', publisher: '设备厂商', publishedAt: '2026-05-12', capturedAt: '2026-09-29T11:10:00', kind: '二次来源', chainOfCustody: '厂商官网PDF留存', contentHash: 'sha256:6a8d22...41ee', version: 1 })],
        counterSources: [], annotations: []
      })
    ]
  },
  {
    id: 'FC-260928-03', title: '城区供水异味来自河道藻类暴发', summary: '居民投诉自来水异味，网络传言指向上游工业排放，需核查水质报告与采样链。',
    reporter: '顾薇', editor: '宋卓', status: '核查中', priority: '中', createdAt: '2026-09-28T09:00:00', updatedAt: '2026-09-29T13:10:00', version: 2,
    facts: [
      fact({ id: 'F-4', text: '多个采样点的2-甲基异莰醇检测值超过嗅阈值。', conclusion: '已证实', confidence: 93, unresolved: [], sources: [source({ id: 'S-5', title: '市供水水质周报', url: 'https://example.gov.cn/water/0928', publisher: '市水务局', publishedAt: '2026-09-28', capturedAt: '2026-09-28T16:20:00', kind: '原始证据', chainOfCustody: '官网数据与PDF报告留存', contentHash: 'sha256:228a2...09cf', version: 1 })], counterSources: [], annotations: [] }),
      fact({ id: 'F-5', text: '异味由上游企业偷排直接造成。', conclusion: '不实', confidence: 88, unresolved: [], sources: [], counterSources: [source({ id: 'C-2', title: '上游排口在线监测与执法巡查记录', url: 'https://example.gov.cn/env/0929', publisher: '市生态环境局', publishedAt: '2026-09-29', capturedAt: '2026-09-29T12:00:00', kind: '原始证据', chainOfCustody: '官方接口导出CSV，记录数据签名', contentHash: 'sha256:ab45d...9c31', version: 1 })], annotations: [] })
    ]
  },
  {
    id: 'FC-260927-02', title: '地铁3号线二期年底前停运夜间施工', summary: '稿件引用轨道交通集团官网公告与运输局时刻表，核查停运安排并已对外发布；今晨官网公告被撤下，需重新确认。',
    reporter: '顾薇', editor: '宋卓', status: '已发布', priority: '中', createdAt: '2026-09-27T09:30:00', updatedAt: '2026-09-30T09:05:00', version: 3,
    facts: [
      fact({
        id: 'F-6', text: '轨道交通集团曾公告3号线二期年底前夜间停运施工。', conclusion: '已证实', confidence: 90, unresolved: [],
        verifyState: '失效待确认',
        invalidations: [{ id: 'INV-seed-S9-F6', sourceId: 'S-9', sourceTitle: '关于3号线二期夜间停运施工的公告', sourceVersion: 1, change: '撤下', at: '2026-09-30T09:05:00' }],
        reconfirms: [],
        sources: [
          source({ id: 'S-9', title: '关于3号线二期夜间停运施工的公告', url: 'https://rail.example.gov.cn/notice/2026-0731', publisher: '市轨道交通集团', publishedAt: '2026-09-25', capturedAt: '2026-09-27T10:00:00', kind: '原始证据', chainOfCustody: '官网公告页HTML与PDF附件双留存', contentHash: 'sha256:5a77c0...aa11', version: 1, status: '已撤下', revisions: [{ version: 1, contentHash: 'sha256:5a77c0...aa11', status: '已撤下', changedAt: '2026-09-30T09:00:00', reason: '官网公告页被撤下，集团称方案仍在报批，不能再作为最终安排引用' }] }),
          source({ id: 'S-10', title: '本地晚报转引：3号线二期夜间停运通告', url: 'https://paper.example/news/0926', publisher: '江城晚报', publishedAt: '2026-09-26', capturedAt: '2026-09-27T10:20:00', kind: '二次来源', chainOfCustody: '数字版报纸版面留存', contentHash: 'sha256:81c04d...77f2', version: 1 })
        ], counterSources: [], annotations: [{ id: 'N-3', author: '宋卓', role: '编辑', content: '官方公告已撤下，已发版本照旧引用当时快照，重新确认前不得再发稿或导出。', createdAt: '2026-09-30T09:10:00', resolved: false }]
      }),
      fact({
        id: 'F-7', text: '运输局公布的节假日末班车时刻调整不受停运公告影响。', conclusion: '已证实', confidence: 95, unresolved: [],
        sources: [source({ id: 'S-11', title: '市交通运输局9月运行时刻表调整公告', url: 'https://jt.example.gov.cn/schedule/0901', publisher: '市交通运输局', publishedAt: '2026-09-01', capturedAt: '2026-09-27T11:00:00', kind: '原始证据', chainOfCustody: '官网表格CSV留存并记录签名', contentHash: 'sha256:0f6e91...b204', version: 1 })], counterSources: [], annotations: []
      })
    ]
  }
]

export const seedVersions: VersionRecord[] = [
  { id: 'V-1', claimId: 'FC-260929-01', version: 4, editor: '沈言', summary: '补充储能系统招标文件和相反证据，降低第二、第三项事实置信度。', changedFactIds: ['F-2', 'F-3'], removedEvidence: ['匿名聊天记录截图'], createdAt: '2026-09-29T15:30:00' },
  { id: 'V-2', claimId: 'FC-260929-01', version: 3, editor: '陆衡', summary: '补充匿名截图保管链和未解决疑点。', changedFactIds: ['F-2'], removedEvidence: [], createdAt: '2026-09-29T14:25:00' },
  { id: 'V-3', claimId: 'FC-260927-02', version: 3, editor: '宋卓', summary: '另存发布版本 V3：地铁夜间停运稿经编辑复核后对外发布。', changedFactIds: [], removedEvidence: [], createdAt: '2026-09-27T16:00:00' }
]

export const seedPublishedVersions: PublishedVersion[] = [
  {
    id: 'PV-1',
    claimId: 'FC-260927-02',
    version: 3,
    editor: '宋卓',
    note: '编辑复核通过，两项事实均有官方来源，对外发布。',
    createdAt: '2026-09-27T16:00:00',
    claimWorkingVersion: 3,
    facts: [
      {
        factId: 'F-6', text: '轨道交通集团曾公告3号线二期年底前夜间停运施工。', conclusion: '已证实', confidence: 90,
        sources: [
          { sourceId: 'S-9', title: '关于3号线二期夜间停运施工的公告', publisher: '市轨道交通集团', url: 'https://rail.example.gov.cn/notice/2026-0731', kind: '原始证据', version: 1, contentHash: 'sha256:5a77c0...aa11', status: '有效', capturedAt: '2026-09-27T10:00:00' },
          { sourceId: 'S-10', title: '本地晚报转引：3号线二期夜间停运通告', publisher: '江城晚报', url: 'https://paper.example/news/0926', kind: '二次来源', version: 1, contentHash: 'sha256:81c04d...77f2', status: '有效', capturedAt: '2026-09-27T10:20:00' }
        ], counterSources: []
      },
      {
        factId: 'F-7', text: '运输局公布的节假日末班车时刻调整不受停运公告影响。', conclusion: '已证实', confidence: 95,
        sources: [{ sourceId: 'S-11', title: '市交通运输局9月运行时刻表调整公告', publisher: '市交通运输局', url: 'https://jt.example.gov.cn/schedule/0901', kind: '原始证据', version: 1, contentHash: 'sha256:0f6e91...b204', status: '有效', capturedAt: '2026-09-27T11:00:00' }], counterSources: []
      }
    ]
  }
]

export const seedAudit: AuditEntry[] = [
  { id: 'A-1', claimId: 'FC-260929-01', action: '建立核查主张', operator: '沈言', detail: '创建3项可验证事实', createdAt: '2026-09-29T08:10:00' },
  { id: 'A-2', claimId: 'FC-260929-01', action: '关联原始证据', operator: '沈言', detail: '关联环评报告和设备采购公告', createdAt: '2026-09-29T08:55:00' },
  { id: 'A-3', claimId: 'FC-260929-01', action: '添加相反证据', operator: '陆衡', detail: '储能招标附件与纯储能结论冲突，保留争议', createdAt: '2026-09-29T14:10:00' },
  { id: 'A-4', claimId: 'FC-260927-02', action: '另存发布版本', operator: '宋卓', detail: '发布版本 V3 已固化来源快照：编辑复核通过，两项事实均有官方来源，对外发布。', createdAt: '2026-09-27T16:00:00' },
  { id: 'A-5', claimId: 'FC-260927-02', action: '登记来源撤下', operator: '宋卓', detail: '关于3号线二期夜间停运施工的公告：官网公告页被撤下，集团称方案仍在报批，不能再作为最终安排引用', createdAt: '2026-09-30T09:00:00' },
  { id: 'A-6', claimId: 'FC-260927-02', action: '事实结论失效', operator: '宋卓', detail: '轨道交通集团曾公告3号线二期年底前夜间停运施工。：依赖来源「关于3号线二期夜间停运施工的公告」撤下，结论置为失效待确认', createdAt: '2026-09-30T09:05:00' }
]
