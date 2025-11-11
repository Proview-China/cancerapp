## ADDED Requirements

### Requirement: Analysis Panel Pond Layout for Tissue Slides
右侧分析区 MUST 按“池塘/小池塘”布局展示以下四类信息（仅当所选样本 `modality='组织切片'`）：
1) 基本信息池塘（样本/病例元信息）
2) 原始数据池塘（九项原始指标 a–i，含中英文名与单位）
3) 处理后数据池塘（五项衍生指标 a–e，含中英文名与单位）
4) AI 预测与推理池塘（三段 markdown 文本，遵循左栏 markdown 风格）

#### Scenario: Pond grid layout and labeling
- WHEN 选择“组织切片”样本
- THEN 四个池塘依次呈现；每个池塘内使用两列网格（≥1280px），窄屏自动降为单列；每个“小池塘”显示“名称（中/英）+ 值 + 单位”

### Requirement: Value Formatting & Units
各数据项 MUST 显示单位与格式：`%`/`number/mm²`/`mm²`/`px`/`unitless`；百分比保留 2 位小数，面积保留 2 位小数，像素为整数，unitless 2 位小数（H-Score/IRS 可为整数）。

#### Scenario: Consistent formatting
- WHEN 渲染任一池塘数据
- THEN 单位与精度符合设计令牌；空值显示“未提供”，无需显示单位

### Requirement: Open Image via System Viewer
分析区右上/右侧 MUST 提供两个按钮：
- 查看原始图像（Open Original Image）
- 查看解析图像（Open Parsed Image）
点击后 SHALL 使用系统默认图片查看器打开本地图像。若路径不可用或环境不支持，按钮 SHALL 禁用或提示。

#### Scenario: Buttons present and accessible
- WHEN 页面加载且选中“组织切片”样本并且存在图像路径
- THEN 两个按钮可见且可用；Tab 可聚焦，Enter/Space 触发；无图像路径时禁用/隐藏

#### Scenario: No inline analyzed image
- WHEN 打开分析区
- THEN 页面不内嵌显示“解析图像”，仅通过按钮外部打开

### Requirement: Loading, Empty, and Non-Tissue States
分析区 SHALL 提供加载、空数据与非组织切片三种状态：
- Loading：显示骨架或 loading 指示，不闪烁
- Empty：以“未提供”占位，不显示单位
- Non-Tissue：显示提示“该样本类型不提供此类分析”

#### Scenario: State transitions
- WHEN 切换选择样本或数据加载完成
- THEN 状态从 Loading → 数据或 Empty；切换模态到非组织切片显示 Non-Tissue 提示

### Requirement: AI Markdown Rendering Rules
AI 池塘 MUST 支持 h2/h3、段落、无序列表、粗体、斜体；不渲染图片/HTML；每段不超过 800 字，最多 3 段。

#### Scenario: Markdown safety
- WHEN 渲染 AI 文本
- THEN 任何 HTML 被忽略/剥离，超长文本截断或显示“已截断”提示

## MODIFIED Requirements

### Requirement: Sidebar Width Consistency and Content Safety
在新增池塘与按钮的前提下，侧栏与分析区的最小宽度与交互命中区域 MUST 继续满足一致性与可点击性（继承现有 UI 规范）。

#### Scenario: Hit areas and min width unchanged
- WHEN 调整窗口/拖拽分隔手柄
- THEN 池塘与按钮布局不遮挡/不重叠，最小宽度守护仍然生效
