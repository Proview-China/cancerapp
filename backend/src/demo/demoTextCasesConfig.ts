export type DemoSectionKey = 'overview' | 'guideline' | 'testing' | 'treatment'

export type DemoTextCaseConfig = {
  index: number
  identifier: string
  displayName: string
  summaries: Record<DemoSectionKey, string>
}

export const DEMO_TEXT_CASES: DemoTextCaseConfig[] = [
  {
    index: 1,
    identifier: 'DEMO-TEXT-01',
    displayName: '王梅',
    summaries: {
      overview: 'HCV 相关代偿期肝硬化合家族肝癌史的典型 HCC 高危患者',
      guideline: '肝硬化高危人群中右叶单发 3–4 cm LI-RADS 5 结节，影像已满足 HCC 诊断',
      testing: 'AFP/PIVKA-II 双高结合中分化 HCC 病理与 IHC，为模型提供高质量标签',
      treatment: 'Child A、BCLC A 期单发 HCC，以根治性肝切除联合规范随访和抗病毒为主',
    },
  },
  {
    index: 2,
    identifier: 'DEMO-TEXT-02',
    displayName: '李强',
    summaries: {
      overview: 'HBV 相关代偿期肝硬化中年男性，体检偶然发现肝占位的无症状高危人群',
      guideline: '右肝 2.2 cm 结节合 HBV 肝硬化背景，按早期 HCC 路径分期与决策',
      testing: '围绕小结节建立实验室与影像随访框架，强调 AFP/PIVKA-II 动态监测',
      treatment: '代偿肝硬化单发小结节，优先局部切除或消融并长期抗病毒与规律随访',
    },
  },
  {
    index: 3,
    identifier: 'DEMO-TEXT-03',
    displayName: '张丽华',
    summaries: {
      overview: 'NASH 相关失代偿肝硬化老年女性，腹水水肿明显并出现多发肝内结节',
      guideline: '代谢相关肝硬化背景下多发结节，需在失代偿前提下评估 HCC 分期与可治性',
      testing: '结合实验室、影像和必要组织学的多模检测，刻画失代偿期多发结节谱系',
      treatment: '肝功能储备差 + 多发结节，以支持治疗和个体化局部控制为主，评估移植可能',
    },
  },
  {
    index: 4,
    identifier: 'DEMO-TEXT-04',
    displayName: '王建国',
    summaries: {
      overview: '长期大量饮酒导致失代偿酒精性肝硬化，急性上消化道出血入院的高危病例',
      guideline: '酒精性失代偿肝硬化合可疑肝占位，需在止血和稳定循环前提下谨慎完成分期',
      testing: '以内镜止血与血流动力学评估为先，分阶段补全肝脏影像与肿瘤标志物检查',
      treatment: '终末期酒精性肝硬化以止血、戒酒和肝功能支持为核心，肿瘤仅作有限缓解性处理',
    },
  },
  {
    index: 5,
    identifier: 'DEMO-TEXT-05',
    displayName: '刘芸',
    summaries: {
      overview: '既往 AIH 治疗中断的中年女性，出现乏力黄疸的自身免疫性肝炎急性加重',
      guideline: '目前无明确肿瘤证据，主要按 AIH 活动度与肝功能分级路径而非 HCC 分期管理',
      testing: '以肝功能、自身抗体和必要肝穿为主，兼顾基础 HCC 监测但未发现确定占位',
      treatment: '强化免疫抑制与肝保护治疗，分阶段减量与随访，暂不进入肿瘤特异治疗通路',
    },
  },
  {
    index: 6,
    identifier: 'DEMO-TEXT-06',
    displayName: '赵海',
    summaries: {
      overview: 'HBV 肝硬化合胆道疾病老年男性，进行性黄疸与皮肤瘙痒提示重度胆汁淤积',
      guideline: '肝门区肿块 + 胆汁淤积，需在 HBV 肝硬化基础上区分胆管癌与其他肿瘤路径',
      testing: '围绕减黄展开的实验室、MRCP/CT 与肿瘤标志物检测，必要时获取组织学证实',
      treatment: '以减黄和胆道引流为首要目标，视评估结果考虑根治性切除或综合治疗并持续抗病毒',
    },
  },
  {
    index: 7,
    identifier: 'DEMO-TEXT-07',
    displayName: '周敏',
    summaries: {
      overview: 'HCV SVR 后仍残留 F3–F4 纤维化的代偿期患者，随访中发现 AFP 升高',
      guideline: '丙肝治愈但肝硬化仍在，单发 2.5 cm 典型 HCC 提醒 SVR 人群仍需长期监测',
      testing: '以 AFP 与定期影像为核心的随访范例，早期捕捉小病灶并完成分期评估',
      treatment: '代偿肝硬化单发 2.5 cm 早期 HCC，优选肝切除或消融并强化代谢与抗病毒管理',
    },
  },
  {
    index: 8,
    identifier: 'DEMO-TEXT-08',
    displayName: '陈磊',
    summaries: {
      overview: '非肝硬化 HBV 感染合疑似黄曲霉毒素暴露的中年男性，右上腹疼痛伴巨大肝占位',
      guideline: '非肝硬化背景下单发约 7.5 cm 巨大典型 HCC，需与良性占位及转移瘤严格鉴别',
      testing: '强调术前肝储备评估与肿瘤标志物动态，术后进入高频影像与实验室随访通路',
      treatment: '非肝硬化单发巨大 HCC，以扩大肝切除为主并长期抗病毒和监测复发',
    },
  },
  {
    index: 9,
    identifier: 'DEMO-TEXT-09',
    displayName: '杨梅',
    summaries: {
      overview: '乙状结肠癌根治术后 3 年，CEA 逐渐升高并出现右上腹隐痛的随访期患者',
      guideline: '无慢性肝病背景，多发肝结节合 CEA 升高，按 CRC 肝转移而非原发 HCC 进行分型',
      testing: '以 CEA 为核心联合法肝/胸 CT 和必要活检分子检测，确认多发结直肠癌肝转移',
      treatment: '结直肠癌肝限局性转移优先评估切除/局部治疗，并联合全身化疗 ± 靶向或免疫',
    },
  },
  {
    index: 10,
    identifier: 'DEMO-TEXT-10',
    displayName: '孙伟',
    summaries: {
      overview: '中青年 HBV 相关 HCC 可能性极大',
      guideline: '单发 4 cm 右叶 VIII 段 LI-RADS 5 病灶',
      treatment: '年轻 HBV 感染者 + 单发 4 cm 典型 HCC',
      testing: '年轻 HBV 高危 + 早期可切除 HCC',
    },
  },
]

