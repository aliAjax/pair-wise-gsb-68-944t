import type { AuditEntry, Claim, PendingWrite, PublicationRecord, VersionRecord } from '../types'

const publishedSnapshot: Claim = {
  id: 'FC-260925-07', title: '滨河片区保租房首批入住率超九成', summary: '官方通报与物业台账显示首批保租房入住率超九成，需核查统计口径与配套商业开业情况。',
  reporter: '沈言', editor: '宋卓', status: '已发布', priority: '中', createdAt: '2026-09-25T08:10:00', updatedAt: '2026-09-26T09:30:00', version: 3,
  facts: [
    {
      id: 'F-6', text: '滨河片区保租房项目首批房源入住率已超过九成。', conclusion: '已证实', confidence: 90, unresolved: [], dependencyEvents: [],
      sources: [
        { id: 'S-6', title: '滨河片区首批保租房入住情况通报', url: 'https://example.gov.cn/housing/0925', publisher: '市住房保障局', publishedAt: '2026-09-24', capturedAt: '2026-09-25T08:40:00', kind: '原始证据', chainOfCustody: '官网通报PDF留存，哈希时间戳已记录', contentHash: 'sha256:81af02...b27e', version: 1, status: '在档' },
        { id: 'S-7', title: '物业方提供的入住登记台账（走访记录）', url: 'https://example.com/visit/binhe-ledger', publisher: '项目物业服务中心', publishedAt: '2026-09-25', capturedAt: '2026-09-25T16:05:00', kind: '二次来源', chainOfCustody: '现场走访拍照并与台账逐户核对', contentHash: 'sha256:4c9d71...08aa', version: 1, status: '在档' }
      ], counterSources: [], annotations: []
    },
    {
      id: 'F-7', text: '项目周边配套商业开业率达到八成。', conclusion: '已证实', confidence: 82, unresolved: [], dependencyEvents: [],
      sources: [
        { id: 'S-8', title: '片区商业运营月报（第八期）', url: 'https://example.com/mall-report-08', publisher: '滨河商业运营公司', publishedAt: '2026-09-23', capturedAt: '2026-09-25T18:00:00', kind: '二次来源', chainOfCustody: '运营公司公开月报PDF留存', contentHash: 'sha256:2ee1a0...55cd', version: 1, status: '在档' }
      ], counterSources: [], annotations: []
    }
  ]
}

export const seedClaims: Claim[] = [
  {
    id: 'FC-260929-01', title: '某地新建数据中心停用全部柴油应急电源', summary: '社交平台流传项目验收文件截图，称数据中心取消柴油发电机改为纯储能供电。',
    reporter: '沈言', editor: '宋卓', status: '待编辑复核', priority: '高', createdAt: '2026-09-29T08:10:00', updatedAt: '2026-09-29T15:30:00', version: 4,
    facts: [
      {
        id: 'F-1', text: '项目规划文件中曾包含2台柴油发电机组。', conclusion: '已证实', confidence: 98, unresolved: [], dependencyEvents: [],
        sources: [
          { id: 'S-1', title: '一期工程环境影响报告表', url: 'https://example.gov.cn/report/2025-1102', publisher: '市生态环境局', publishedAt: '2025-11-02', capturedAt: '2026-09-29T08:40:00', kind: '原始证据', chainOfCustody: '官网下载PDF，哈希时间戳已记录', contentHash: 'sha256:9d31f1...a42c', version: 1, status: '在档' },
          { id: 'S-2', title: '项目设备采购公告', url: 'https://example.com/tender/8821', publisher: '公共资源交易平台', publishedAt: '2026-01-18', capturedAt: '2026-09-29T08:52:00', kind: '原始证据', chainOfCustody: '官网页面快照与原始附件同时留存', contentHash: 'sha256:7bc029...de10', version: 2, status: '在档' }
        ], counterSources: [], annotations: [{ id: 'N-1', author: '宋卓', role: '编辑', content: '请补充规划变更批复，不能用采购公告单独代表最终方案。', createdAt: '2026-09-29T10:20:00', resolved: false }]
      },
      {
        id: 'F-2', text: '最终验收已取消柴油应急电源。', conclusion: '证据不足', confidence: 42, unresolved: ['缺少竣工验收备案原件', '网传截图无文件编号与签章页'], dependencyEvents: [],
        sources: [{ id: 'S-3', title: '匿名用户上传的验收文件局部截图', url: 'https://social.example/post/9901', publisher: '社交平台账号', publishedAt: '2026-09-28', capturedAt: '2026-09-29T09:05:00', kind: '待证信息', chainOfCustody: '已保存原帖与图片EXIF，待向主管部门核验', contentHash: 'sha256:1fe210...67bd', version: 1, status: '在档' }],
        counterSources: [{ id: 'C-1', title: '储能系统招标文件仍列出柴发切换接口', url: 'https://example.com/tender/9102', publisher: '公共资源交易平台', publishedAt: '2026-03-04', capturedAt: '2026-09-29T14:10:00', kind: '原始证据', chainOfCustody: '附件原文留存，相关条款见第42页', contentHash: 'sha256:c7249a...001f', version: 1, status: '在档' }],
        annotations: [{ id: 'N-2', author: '陆衡', role: '事实核查员', content: '该结论不得以匿名截图单独成立，需取得主管部门书面确认。', createdAt: '2026-09-29T14:25:00', resolved: false }]
      },
      {
        id: 'F-3', text: '纯储能方案足以覆盖消防和一级负荷供电。', conclusion: '证据不足', confidence: 31, unresolved: ['缺少负荷计算书', '缺少消防验收文件'], dependencyEvents: [],
        sources: [{ id: 'S-4', title: '设备厂商技术白皮书', url: 'https://vendor.example/white-paper', publisher: '设备厂商', publishedAt: '2026-05-12', capturedAt: '2026-09-29T11:10:00', kind: '二次来源', chainOfCustody: '厂商官网PDF留存', contentHash: 'sha256:6a8d22...41ee', version: 1, status: '在档' }],
        counterSources: [], annotations: []
      }
    ]
  },
  {
    id: 'FC-260925-07', title: '滨河片区保租房首批入住率超九成', summary: '官方通报与物业台账显示首批保租房入住率超九成，需核查统计口径与配套商业开业情况。',
    reporter: '沈言', editor: '宋卓', status: '已发布', priority: '中', createdAt: '2026-09-25T08:10:00', updatedAt: '2026-09-28T10:20:00', version: 4,
    facts: [
      {
        id: 'F-6', text: '滨河片区保租房项目首批房源入住率已超过九成。', conclusion: '已证实', confidence: 90, unresolved: [],
        sources: [
          { id: 'S-6', title: '滨河片区首批保租房入住情况通报', url: 'https://example.gov.cn/housing/0925', publisher: '市住房保障局', publishedAt: '2026-09-24', capturedAt: '2026-09-25T08:40:00', kind: '原始证据', chainOfCustody: '官网通报PDF留存，哈希时间戳已记录', contentHash: 'sha256:81af02...b27e', version: 1, status: '已撤下', removedAt: '2026-09-28T10:20:00', changeNote: '机构改革页面迁移，原通报链接返回404，新地址尚未公布' },
          { id: 'S-7', title: '物业方提供的入住登记台账（走访记录）', url: 'https://example.com/visit/binhe-ledger', publisher: '项目物业服务中心', publishedAt: '2026-09-25', capturedAt: '2026-09-25T16:05:00', kind: '二次来源', chainOfCustody: '现场走访拍照并与台账逐户核对', contentHash: 'sha256:4c9d71...08aa', version: 1, status: '在档' }
        ], counterSources: [], annotations: [],
        dependencyEvents: [
          { id: 'DE-1', sourceId: 'S-6', sourceTitle: '滨河片区首批保租房入住情况通报', sourceRole: 'support', status: '已撤下', changedAt: '2026-09-28T10:20:00', note: '机构改革页面迁移，原通报链接返回404，新地址尚未公布', previousConclusion: '已证实' }
        ]
      },
      {
        id: 'F-7', text: '项目周边配套商业开业率达到八成。', conclusion: '已证实', confidence: 82, unresolved: [],
        sources: [
          { id: 'S-8', title: '片区商业运营月报（第八期）', url: 'https://example.com/mall-report-08', publisher: '滨河商业运营公司', publishedAt: '2026-09-23', capturedAt: '2026-09-25T18:00:00', kind: '二次来源', chainOfCustody: '运营公司公开月报PDF留存', contentHash: 'sha256:2ee1a0...55cd', version: 1, status: '在档' }
        ], counterSources: [], annotations: [], dependencyEvents: []
      }
    ]
  },
  {
    id: 'FC-260928-03', title: '城区供水异味来自河道藻类暴发', summary: '居民投诉自来水异味，网络传言指向上游工业排放，需核查水质报告与采样链。',
    reporter: '顾薇', editor: '宋卓', status: '核查中', priority: '中', createdAt: '2026-09-28T09:00:00', updatedAt: '2026-09-30T09:00:05', version: 3,
    facts: [
      {
        id: 'F-4', text: '多个采样点的2-甲基异莰醇检测值超过嗅阈值。', conclusion: '已证实', confidence: 93, unresolved: [], dependencyEvents: [],
        sources: [{ id: 'S-5', title: '市供水水质周报', url: 'https://example.gov.cn/water/0928', publisher: '市水务局', publishedAt: '2026-09-28', capturedAt: '2026-09-28T16:20:00', kind: '原始证据', chainOfCustody: '官网数据与PDF报告留存', contentHash: 'sha256:228a2...09cf', version: 1, status: '已撤下', removedAt: '2026-09-30T09:00:05', changeNote: '水务局回应数据引用有误，周报页面已撤回修订（写入在第二步中断）' }],
        counterSources: [], annotations: []
      },
      {
        id: 'F-5', text: '异味由上游企业偷排直接造成。', conclusion: '不实', confidence: 88, unresolved: [],
        sources: [],
        counterSources: [
          { id: 'C-2', title: '上游排口在线监测与执法巡查记录', url: 'https://example.gov.cn/env/0929', publisher: '市生态环境局', publishedAt: '2026-09-29', capturedAt: '2026-09-29T12:00:00', kind: '原始证据', chainOfCustody: '官方接口导出CSV，记录数据签名', contentHash: 'sha256:ab45d...9c31', version: 1, status: '已换版', supersededBy: 'C-3', removedAt: '2026-09-29T13:20:00', changeNote: '执法记录勘误后重新发布，原CSV下载链接已指向新版' },
          { id: 'C-3', title: '上游排口在线监测与执法巡查记录（9月29日勘误版）', url: 'https://example.gov.cn/env/0929-rev', publisher: '市生态环境局', publishedAt: '2026-09-29', capturedAt: '2026-09-29T13:40:00', kind: '原始证据', chainOfCustody: '勘误版CSV与数据签名留存，与旧版差异条款已批注', contentHash: 'sha256:d820ff...77ab', version: 1, status: '在档', supersedes: 'C-2' }
        ],
        annotations: [],
        dependencyEvents: [
          { id: 'DE-2', sourceId: 'C-2', sourceTitle: '上游排口在线监测与执法巡查记录', sourceRole: 'counter', status: '已换版', changedAt: '2026-09-29T13:20:00', note: '执法记录勘误后重新发布，原CSV下载链接已指向新版', previousConclusion: '不实', revalidatedAt: '2026-09-29T14:05:00', revalidatedBy: '宋卓', revalidationNote: '核对勘误版第42页排口数据，结论与旧版一致，维持“不实”。', renewedConclusion: '不实' }
        ]
      }
    ]
  }
]

export const seedVersions: VersionRecord[] = [
  { id: 'V-1', claimId: 'FC-260929-01', version: 4, editor: '沈言', summary: '补充储能系统招标文件和相反证据，降低第二、第三项事实置信度。', changedFactIds: ['F-2', 'F-3'], removedEvidence: ['匿名聊天记录截图'], createdAt: '2026-09-29T15:30:00' },
  { id: 'V-2', claimId: 'FC-260929-01', version: 3, editor: '陆衡', summary: '补充匿名截图保管链和未解决疑点。', changedFactIds: ['F-2'], removedEvidence: [], createdAt: '2026-09-29T14:25:00' },
  { id: 'V-3', claimId: 'FC-260925-07', version: 3, editor: '宋卓', summary: '编辑核对官方通报与物业台账，另存首个发布版本。', changedFactIds: ['F-6', 'F-7'], removedEvidence: [], createdAt: '2026-09-26T09:30:00' }
]

export const seedPublications: PublicationRecord[] = [
  { id: 'PUB-1', claimId: 'FC-260925-07', publicationNo: 1, claimVersion: 3, editor: '宋卓', note: '首发：入住率超九成，配套商业开业率八成。', publishedAt: '2026-09-26T09:30:00', snapshot: publishedSnapshot }
]

/** 写入在“失效引用事实”之前中断：来源已登记撤下，但依赖结论尚未失效、审计尚未追加 */
export const seedPendingWrites: PendingWrite[] = [
  {
    id: 'W-1', kind: 'source-change', claimId: 'FC-260928-03', title: '来源撤下：市供水水质周报', startedAt: '2026-09-30T09:00:00',
    params: { factId: 'F-4', sourceId: 'S-5', mode: '已撤下', reason: '水务局回应数据引用有误，周报页面已撤回修订' },
    steps: [
      { key: 'register', label: '登记来源撤下', status: '已完成', finishedAt: '2026-09-30T09:00:05' },
      { key: 'invalidate', label: '失效引用事实', status: '待执行' },
      { key: 'audit', label: '追加审计留痕', status: '待执行' }
    ]
  }
]

export const seedAudit: AuditEntry[] = [
  { id: 'A-1', claimId: 'FC-260929-01', action: '建立核查主张', operator: '沈言', detail: '创建3项可验证事实', createdAt: '2026-09-29T08:10:00' },
  { id: 'A-2', claimId: 'FC-260929-01', action: '关联原始证据', operator: '沈言', detail: '关联环评报告和设备采购公告', createdAt: '2026-09-29T08:55:00' },
  { id: 'A-3', claimId: 'FC-260928-03', action: '添加相反证据', operator: '陆衡', detail: '储能招标附件与纯储能结论冲突，保留争议', createdAt: '2026-09-29T14:10:00' },
  { id: 'A-101', claimId: 'FC-260925-07', action: '另存发布版本', operator: '宋卓', detail: '发布版本 #1（V3）已锁定快照', createdAt: '2026-09-26T09:30:00' },
  { id: 'A-102', claimId: 'FC-260925-07', action: '登记来源撤下', operator: '陆衡', detail: 'S-6 滨河片区首批保租房入住情况通报：机构改革页面迁移，原通报链接返回404', createdAt: '2026-09-28T10:20:00' },
  { id: 'A-103', claimId: 'FC-260925-07', action: '事实结论失效·等待重新确认', operator: '系统', detail: '事实 F-6 依赖来源 S-6，结论“已证实”暂停使用', createdAt: '2026-09-28T10:20:00' },
  { id: 'A-104', claimId: 'FC-260928-03', action: '登记来源换版', operator: '陆衡', detail: 'C-2 上游排口在线监测与执法巡查记录 → C-3 勘误版', createdAt: '2026-09-29T13:20:00' },
  { id: 'A-105', claimId: 'FC-260928-03', action: '事实结论失效·等待重新确认', operator: '系统', detail: '事实 F-5 依赖来源 C-2，结论“不实”暂停使用', createdAt: '2026-09-29T13:20:00' },
  { id: 'A-106', claimId: 'FC-260928-03', action: '事实结论重新确认', operator: '宋卓', detail: 'F-5 依据勘误版 C-3 复核，维持“不实”', createdAt: '2026-09-29T14:05:00' }
]
