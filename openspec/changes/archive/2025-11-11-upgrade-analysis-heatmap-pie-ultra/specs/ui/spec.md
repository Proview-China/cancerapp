## MODIFIED Requirements

### Requirement: Visualization Panel (Image Summary) – Pie and Heatmap
“图像总结”视图 MUST 以两张图承载信息：
- 图一：复合热力图（行=指标，列=“医生判断维度”——归一/归一十分位/z分/|z|/分位/分位组(Q)/排名/正偏/负偏/IQR位/置信/稳定/权重/完备；病例内统计；单元格白色网格分隔；可选确定性抖动只影响可视化不改变数据；图例与画布居中、无横向滚动）。同图的“相关矩阵”等扩展视图不在本次范围。
- 图二：多层级环形图（中心综合风险仪表 + R1 风险分层 + R2 特征贡献 + R3 分位细分 + R4 HSI 组成 + R5 缺失率）。
两图 SHALL 使用统一顺序色(YlOrRd)；缺失以灰表示；z-score 在 ±2.5 裁剪（若样本不足回退到归一）。Hover SHALL 提供原值/单位或标准化说明（z/分位等）。

#### Scenario: Heatmap with judgement dimensions
- Given 打开“图像总结”
- Then 主区显示“指标×判断维度”热力（列包含归一/z/分位/排名/偏差/IQR/置信/稳定/权重/完备等）
- And 单元格具备白色网格分隔，必要时应用确定性抖动以避免大片连片；图例与画布居中且无横向滚动

#### Scenario: Correlation matrix (out-of-scope this change)
- Then 本次不要求在同图切换相关矩阵；后续变更可按需加入

#### Scenario: Multi-layer ring with unified semantics
- Then 图二显示中心综合风险（0–1），R1 风险分层，R2 特征贡献，R3 分位细分（Q1–Q5），R4 HSI 组成，R5 缺失率窄环；整体居中显示

## ADDED Requirements

### Requirement: Composite Heatmap – Legends and Tooltips
复合热力图 MUST 提供统一图例与 tooltip：
- 图例明确顺序色与范围（0–1；z 裁剪±2.5 时在 tooltip 说明）。
- tooltip 显示：原值/单位或标准化说明（z/分位/排名/偏差等）。

#### Scenario: Unified color and legends
- Then 值热力/相关矩阵的图例与色标一致；超界以点纹提示；缺失以灰斜纹表示

### Requirement: Ring Chart – Data Completeness Cues
环形图 MUST 以视觉编码体现数据质量：
- 缺失率以 R5 灰刻痕显示。

#### Scenario: Hover details on ring
- Then 悬停显示样本数/占比、均值/IQR、贡献、缺失率、与风险/最相关特征的 ρ/p 与分位区间

### Requirement: Confidence and Low-N Masking
置信度 conf∈[0,1] SHALL 编码到热力 alpha 与 R1 厚度；当样本量 N<6 时相关星标 SHALL 隐藏并在 tooltip 中注明“样本量不足”。

#### Scenario: Low-N masking
- Then N<6 时不渲染显著性星标，但保留 ρ 数值与相应说明
