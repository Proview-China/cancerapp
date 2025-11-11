## Overview
仅通过两张图完成高信息密度可视化：复合热力图（值/相关二态同图）与多层级环形图（中心+五环+边饰）。不改后端；统计与配色在两图间统一。

## Color & Encoding
- 值/比例：YlOrRd（黄→橙→红）。
- 相关/效应：RdBu（蓝负白中红正）。
- 缺失：灰 + 斜纹；超界（z>|2.5|）：点纹提示。
- 置信度 conf：热力 alpha、R1 厚度（0–1）。

## Metrics & Formula
- 细胞法：p_w/p_m/p_s，p_neg=1-(p_w+p_m+p_s)，ratio_cells，H-score_cells∈[0,300]，阳性细胞密度=阳性细胞数/组织面积。
- 面积法：ratio_area，mean_density=IOD/阳性像素面积，surface_density=IOD/组织像素面积。
- IRS：直接使用 `derived.irs`。
- 标准化：z-score 相对全库；分位 P10–P90；z 裁剪 ±2.5。
- 相关：Spearman；BH-FDR 星标：q≤0.1/*，≤0.05/**，≤0.01/***；N<6 不出星标。
- 风险分：固定权重 h_score 0.4、irs 0.3、ratio 0.2、mean_density 0.1。
- 置信度 conf：cells、area、neg_ratio 线性归一组合（或 sigmoid），记入 [0,1]。
- 缺失：中位数填补 + 斜纹视觉提示；tooltip 标注“由缺失填补”。

## Chart 1: Composite Heatmap
- 结构：
  - 顶：HSI 组成谱带（列=样本，阴/弱/中/强 100% 极细堆叠）。
  - 主：样本×特征值热力（色=z-score，alpha=conf）。
    - 单元叠加：四类占比纹理、positive_intensity 圆点（半径）、分位描边（Q1/Q2/Q3），右上紧凑原值。
  - 左：特征-风险相关条（RdBu + 星标）。
  - 底：特征分位带（条形分位 + ▲定位）。
- 模式切换：相关矩阵（特征×特征，主对角留白，层次聚类重排）。
- Tooltip：原值/单位、z-score、分位、四类占比、conf、ρ/p(FDR)。

## Chart 2: Hierarchical Ring
- 中心：综合风险仪表（0–1）。
- R1：风险分层（高/中/低，角度=占比，厚度=conf）。
- R2：特征贡献（角度=标准化贡献或回归权重，半径=均值）。
- R3：分位细分（Q1–Q5：色深=均值；径差=样本占比）。
- R4：HSI 组成（阴/弱/中/强）。
- R5：缺失率窄环（灰刻痕）。
- 外沿虚线：离散度(IQR/中位数)；内沿尖刺：最大相关（方向指向目标特征，长度=|ρ|）。
- Tooltip：样本数/占比、均值/IQR、贡献、缺失率、ρ/p(FDR)、分位区间。

## Performance
- 计算：WebWorker；matrix/相关/聚类在 Worker 内完成。
- 渲染：ECharts dataset + progressive/large；列>300 时虚拟滚动/降采样。
- 回退：样本极少或缺失严重时展示最小子集与提示。

## Accessibility
- aria-label/description；数值对比度（WCAG AA）；键盘聚焦环不遮挡关键标注。

