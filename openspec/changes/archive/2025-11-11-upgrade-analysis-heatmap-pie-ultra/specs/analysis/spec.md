## ADDED Requirements

### Requirement: Dual Metric Systems (Cell- and Area-based)
系统 SHALL 并行支持细胞法与面积法派生并用于可视化：
- 细胞法：ratio_cells、H-score_cells、阳性细胞密度；
- 面积法：ratio_area、mean_density、surface_density；
面积口径优先使用 `mm²`，`px` 仅兜底；tooltip 中 MUST 标注单位来源。

#### Scenario: Consistent units across charts
- Then 当面积以像素口径提供时，tooltip 明确标注 `px` 并与 `mm²` 口径区分；不混淆单位

### Requirement: Standardization and Clipping
前端 SHALL 为所有特征计算 z-score（相对全库），并在 ±2.5 进行裁剪；同时提供分位（P10–P90）以支持分位带与描边。

#### Scenario: Z-score clipping with overflow hint
- Then 超出 ±2.5 的单元以点纹提示被裁剪，原值在 tooltip 中完整显示

### Requirement: Correlation and BH-FDR
前端 SHALL 使用 Spearman 相关并进行 BH-FDR 多重校正以确定星标；当样本量 N<6 时不显示星标。

#### Scenario: Star thresholds
- Then FDR 阈值：q≤0.1 → `*`，q≤0.05 → `**`，q≤0.01 → `***`

### Requirement: Confidence and Imputation
前端 SHALL 计算置信度 conf∈[0,1]，基于细胞总数↑、面积覆盖↑、阴性极端占比↓ 的归一组合；缺失采用中位数填补且以灰斜纹表示。

#### Scenario: Missing values explicitly marked
- Then 缺失被中位数填补但在图上以灰斜纹标识，tooltip 说明“由缺失填补”

### Requirement: Deterministic Risk Score
综合风险分 SHALL 使用固定权重：h_score 0.4、irs 0.3、ratio 0.2、mean_density 0.1；所有视图使用相同定义。

#### Scenario: Risk score consistency
- Then 中心仪表、样本列条与相关条引用的风险分数数值一致，无漂移
### Requirement: Heatmap Judgement Dimensions (Case-local)
系统 SHALL 在病例内对每个特征计算以下“判断维度”，以供热力图横轴使用：
- 归一（0–1）、归一十分位（离散到10档）、z分（病例内；不足样本回退）、|z|、分位（0–1）、分位组(Q1–Q5)、相对排名、正偏/负偏（基于z）、IQR位置、置信度、稳定性（CV反向）、权重（固定权重）、完备度（1-缺失率）。

#### Scenario: Case-local computation and fallback
- Then 以上维度均按“当前病例内样本集合”计算；若样本不足（例如 <3），z类维度回退为归一值；tooltip 需说明口径

### Requirement: Visual Jitter Does Not Alter Data
为避免大片连片的视觉效果，客户端可以对热力图单元格应用确定性微抖动（基于 case/sample/feature/dimension 的伪随机）；无论是否启用抖动，系统 SHALL 保证抖动仅影响显示，且 SHALL NOT 改变底层数值或 tooltip 文案。

#### Scenario: Deterministic jitter safeguard
- Then 抖动幅度 SHALL ≤ 0.18，且 clamp 到 [0,1]；刷新后色块位置稳定一致
