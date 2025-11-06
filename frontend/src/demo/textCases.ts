import type { CaseReportDraft } from '../types/cases'

export const demoTextCases: Array<CaseReportDraft & { suggestedIdentifier: string }> = [
  {
    suggestedIdentifier: 'TXT-HCC-20231101',
    title: '原发性肝细胞癌首诊评估记录',
    summary: '汇总患者基本信息、影像征象、肿瘤标志物与初步分期，包含多学科评估建议。',
    tags: ['肝癌', '初诊', 'MDT'],
    metadata: {
      department: '肝胆外科',
      attending: '张语桐',
      source: 'demo-markdown',
    },
    content: `## 基本信息
- 患者：男，58 岁，乙肝携带 25 年
- 主诉：右上腹隐痛伴乏力 2 周
- 既往史：高血压 10 年（控制良好），无糖尿病

## 实验室结果
| 项目 | 数值 | 参考范围 |
| ---- | ---- | -------- |
| ALT | 78 U/L | 9-50 |
| AST | 65 U/L | 15-40 |
| AFP | **1325 ng/mL** | < 7 |
| CA19-9 | 41 U/mL | < 39 |
| 凝血酶原时间 | 15.2 s | 11-14 |

## 影像学摘要
1. MRI 平扫提示右叶 VI 段 4.1 cm 结节，动脉期强化、门静脉期洗脱。
2. 肝内其余区未见明确转移，门静脉主干通畅。
3. 肝表包膜完整，Child-Pugh 评分 **B7**。

## 诊断与计划
- 临床分期：CNLC IIa，BCLC B。
- MDT 建议：先行 TACE 联合 lenvatinib 靶向治疗，6 周后复评可评估肝切或消融时机。
- 随访：每 4 周复查肝功及 AFP，必要时复做 MRI。`,
  },
  {
    suggestedIdentifier: 'TXT-NSCLC-POSTOP',
    title: '右上肺腺癌术后病程记录（第 5 天）',
    summary: '记录术后恢复、病理结果补充以及靶向/免疫治疗评估。',
    tags: ['肺癌', '术后', '病程'],
    metadata: {
      department: '胸外科',
      attending: '李俊彤',
      source: 'demo-markdown',
    },
    content: `### 术后一般情况
- 体温 36.8℃，血压 118/72 mmHg，心率 86 次/分。
- 胸腔引流量 220 mL/24h，颜色由淡血性转清亮。
- 伤口无渗液，疼痛 VAS 评分 3 分。

### 病理补充
- 浸润性腺癌（乳头状+微乳头型），最大径 2.6 cm。
- pT2aN1M0，EGFR L858R 突变阳性，PD-L1 TPS 8%。

### 药物与并发症
1. 术后常规使用头孢唑啉预防感染，第 3 天停用。
2. 低分子肝素 4000 IU qd，计划 10 天后评估停药。
3. 未出现房颤、气胸等严重并发症。

### 后续计划
- 拟术后 4 周启动奥希替尼辅助治疗。
- 免疫治疗暂不推荐，建议肿瘤委员会再次评估。
- 出院教育：保持呼吸训练，每日激励肺量计 10 次。`,
  },
  {
    suggestedIdentifier: 'TXT-AML-INDUCTION',
    title: '急性髓系白血病诱导化疗监护记录',
    summary: '记录第 12 天骨髓象、并发症、输血策略与护理要点。',
    tags: ['血液', '化疗', '并发症'],
    metadata: {
      department: '血液科',
      attending: '陈立衡',
      source: 'demo-markdown',
    },
    content: `### 化疗方案执行
- 2024-10-21 起行 "7+3"（阿糖胞苷 + 柔红霉素）。
- 目前为 Day 12，持续粒细胞缺乏。

### 骨髓细胞学
- 细胞增生活跃，粒/红 2.1:1。
- 原始细胞 12%，较入院下降 58%。
- 免疫分型提示 CD34 弱阳、HLA-DR 阳。

### 并发症与处理
1. **发热性中性粒细胞减少症**：最高 38.7℃，已升级哌拉西林他唑巴坦 + 阿米卡星。
2. 口腔黏膜炎 Ⅱ 级，使用复方氯己定含漱 + 氧化锌软膏。
3. 血小板 12×10^9/L，输入单采血小板 1U 后升至 38×10^9/L。

### 护理提示
- 加强中心静脉导管维护，48h 更换敷贴。
- 给予低菌饮食及 HEPA 病房管理。
- 若 Day 14 骨髓原始细胞 <5%，考虑进入巩固治疗评估。`,
  },
]
