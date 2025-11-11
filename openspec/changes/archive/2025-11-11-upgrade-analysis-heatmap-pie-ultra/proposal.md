## Why
现有“图像总结”仅呈现基础热力图与扇形图，未充分利用 `TissueAnalysis` 的原始/衍生指标（弱/中/强阳计数、细胞总数、组织/阳性面积、IOD、ratio/density/mean_density/h_score/irs）。本提案在“不新增第三视图、不改后端”的前提下，仅通过“热力图”和“环形图”两张图承载群体结构、相关性与解释性信息，显著提升信息密度与可读性。

## What Changes
- 图一：复合热力图（单图内融合群体组成、值热力、特征-风险相关、分位带；同图可切为特征×特征相关矩阵）。
- 图二：多层级环形图（中心风险仪表 + R1 风险分层 + R2 特征贡献 + R3 分位细分 + R4 HSI 组成 + R5 缺失率；边饰编码离散度与最大相关）。
- 统一统计与配色：值热力用 z-score（±2.5 裁剪）；相关用 Spearman + BH-FDR 星标；顺序色(YlOrRd)与发散色(RdBu)一致；置信度 conf∈[0,1] 用于 alpha/厚度。

## Impact
- 影响 specs：`ui`、`analysis`（新增/修改要求）。
- 影响代码：仅前端可视化组件与计算（`VisualizationPanel.tsx` 及其样式/工具）；不改后端/数据库/API。

## Scope
- In-scope：两张图的形态、编码、统计口径、图内模式切换；统一色标与显著性/置信度规则；A11y 文案与对比度。
- Out-of-scope：新增页面或外部筛选器；后端接口/Schema 变更；数据导出功能（后续可选）。

## Data & Formula（现有字段映射）
- 细胞法：
  - p_w/p_m/p_s = 弱/中/强阳性细胞 ÷ 总细胞；p_neg = 1 - (p_w+p_m+p_s)
  - ratio_cells = p_w+p_m+p_s
  - H-score_cells = 100·(p_w·1 + p_m·2 + p_s·3) ∈ [0,300]
  - 阳性细胞密度 = 阳性细胞数 ÷ 组织面积
- 面积法：
  - ratio_area = 阳性面积 ÷ 组织面积（mm² 优先，px 兜底）
  - mean_density = IOD ÷ 阳性像素面积
  - surface_density = IOD ÷ 组织像素面积
- IRS = SI × PP（已有 `irs` 直接使用；不强制重算）。

## Statistics
- 标准化：z-score 与分位（P10–P90）并存；热力主色按 z-score，分位用于描边/分位环。
- 相关：默认 Spearman；多重校正 BH-FDR：q≤0.1/*，≤0.05/**，≤0.01/***；N<6 时隐藏星标。
- 置信度 conf 用于透明度/厚度：细胞总数↑、面积覆盖↑、阴性极端占比↓ 的归一组合；缺失以中位数填补并以斜纹表示。

## Risk Score（用于中心仪表与样本列条）
固定权重：h_score 0.4、irs 0.3、ratio 0.2、mean_density 0.1（本提案不做可配置）。

## Risks & Mitigations
- 性能：列>300 时启用 WebWorker 计算、ECharts progressive/large、虚拟滚动/降采样。
- 数据缺失：中位数填补+显式标记，保证可渲染与可解释。
- 一致性：两图色表与口径统一，工具提示含单位与口径（mm²/px）。

## Open Questions
- 星标阈值是否采用 q≤0.1/0.05/0.01 固定分级？
- conf 采用线性归一或 sigmoid；细胞数/面积/阴性占比的权重系数？
- 是否需要纳入面积法 H-score_area（不进入风险分，仅用于环图对照）？

