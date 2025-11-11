## Why
我们需要一个可演示（demo）版本，对“组织切片”样本在右侧分析区展示结构化的检测结果：
- 明确区分“基础信息（基本）/ 原始分析数据 / 处理后指标 / AI 预测与推理”四类信息，以“池塘/小池塘”布局提高清晰度。
- 仅针对“组织切片”样本执行该展示，其它模态暂不处理（后续扩展）。
- 不在页面内渲染分析后的结果图；而是在分析区右上/右侧提供两个按钮：查看原始图像 / 查看解析图像（均调用系统默认图片查看器打开）。
- 为演示效果，后端需能存储并返回原始/衍生指标、以及两类图像的文件路径；前端以只读方式展示。

## What Changes
- UI（分析区）
  - 将右侧分析区拆分为“池塘”与“小池塘”布局：
    1) 基本信息池塘：当前样本/病例的基础元信息（名称、模态、采集时间等）
    2) 原始数据池塘：组织切片的原始分析数据（a–i，如弱/中/强阳性细胞数、IOD 细胞总数、阳性/组织面积与像素、阳性强度等）
    3) 处理后数据池塘：衍生指标（a–e：阳性细胞比率、阳性细胞密度、平均光密度值、H-Score、IRS）
    4) AI 预测与推理池塘：展示三段 markdown 文本（仅 demo，不执行真实推理）
  - 在分析区右上或右侧新增两个按钮：
    - “查看原始图像” → 调用系统默认图片查看器打开原始图像
    - “查看解析图像” → 调用系统默认图片查看器打开解析（分析后）图像
  - 页面不嵌入显示解析后的图片（不可见），仅通过按钮打开外部查看器
- 数据（后端 + 数据库）
  - 仅对“组织切片”样本存储原始与衍生分析指标，以及原始/解析图像的本地路径（供 Electron 打开）
  - 为 demo 引入三名病人的组织切片样本数据；数据源位于仓库根目录 `demo_fake/` 下（如：BIOBANK-F10/F11/F13）
- AI（占位）
  - 生成三段 AI 预测与深度推理的 markdown 内容，并按既有左栏 markdown 显示风格进行编排（仅用于展示）

## Impact
- 受影响规范：
  - ui：分析区布局与交互增加（新增按钮、分区布局、可达性）
  - cases：样本与分析结果的关联（仅组织切片）
  - analysis（新增能力）：组织切片原始/衍生指标的数据模型与接口
- 受影响代码：
  - 前端：分析区组件（布局与按钮）、服务层读取分析数据、Electron bridge（系统打开）
  - 后端：数据模型/表、查询聚合、静态路径和本地文件路径解析
- 兼容性：
  - 不改动已有病例/文字病历功能；非“组织切片”样本无分析数据时，前端显示“未提供”占位

## Out of Scope
- 非“组织切片”模态的分析与 UI 展示（后续变更处理）
- 真正的 AI 推理/模型集成（本次仅展示 markdown 占位内容）

## Terminology & Units（术语与单位）
- “组织切片”= Tissue Slide（模态取值：`组织切片`）
- 原始指标（a–i）单位：
  - a/b/c/d：`count`
  - e/f：`mm²`
  - g/h：`pixel`
  - i：`unitless`（或按数据来源区间）
- 衍生指标（a–e）单位：
  - a：`%`
  - b：`number/mm²`
  - c/d/e：`unitless`

## API Contract（示例，仅组织切片样本 analysis 字段）
```json
{
  "analysis": {
    "raw": {
      "pos_cells_1_weak": 123,
      "pos_cells_2_moderate": 45,
      "pos_cells_3_strong": 6,
      "iod_total_cells": 456,
      "positive_area_mm2": 1.23,
      "tissue_area_mm2": 12.34,
      "positive_area_px": 34567,
      "tissue_area_px": 456789,
      "positive_intensity": 0.76
    },
    "derived": {
      "positive_cells_ratio": 38.16,
      "positive_cells_density": 12.4,
      "mean_density": 0.54,
      "h_score": 185,
      "irs": 6
    },
    "images": {
      "raw_image_path": "/abs/path/demo_fake/BIOBANK-F10/raw.jpg",
      "parsed_image_path": "/abs/path/demo_fake/BIOBANK-F10/parsed.jpg"
    },
    "metadata": { "source": "demo" }
  }
}
```

## Ambiguities / Clarifications（需确认）
- demo_fake 的目录/命名规范（原始/解析图像文件名、是否提供 manifest）
- `positive_intensity` 的取值范围定义与约定精度
- 非 Electron 环境（纯 Web）时是否需要提供降级打开方式（本次拟仅提示不支持）
- 单样本是否可能存在多区域/多张切片（本次采用一对一汇总）

## Rollout & Validation
- 开发阶段：以只读 demo 数据为准；不影响既有接口
- 验证：UI 手动检查池塘展示、按钮行为、边界与禁用态；后端日志与错误消息检查
