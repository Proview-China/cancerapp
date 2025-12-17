# ui Specification

## Purpose
TBD - created by archiving change update-ui-detail-polish. Update Purpose after archive.
## Requirements
### Requirement: Resizable Split View Handle
左预览区与右分析区之间 MUST 提供竖向尺寸调整手柄。手柄可视高度 SHALL 不低于可视高度的 50%，并支持键盘无障碍交互（role="separator"，左右箭头微调）。

#### Scenario: Handle present and accessible
- **WHEN** 页面加载
- **THEN** 中间位置可见手柄，具备 `role="separator"` 与可聚焦状态；Tab 可聚焦，左右键可调整宽度

#### Scenario: Drag to resize with clamp
- **WHEN** 用户按住手柄拖拽左右
- **THEN** 左右两侧区域宽度发生变化，且遵循侧栏与主区 clamp 约束，无跳变

### Requirement: Quick Import Entry
侧栏“导入影像/导入文字” MUST 合并为“快速导入”。点击后展示统一的导入选项，且仅保留两项：**图像**、**文字**。文案与排版 SHALL 统一。

#### Scenario: Unified import (two items only)
- **WHEN** 点击“快速导入”
- **THEN** 弹出统一导入面板，且只包含“图像”“文字”两项入口，导入完成行为与原功能等价

### Requirement: Case Panels and Controls
单一病例的侧栏展示 MUST 分为两个框：“图像”“文字”。每个框右侧按钮组 SHALL 包含“新增”“展开/收起”，主病例只保留“编辑”“删除”“展开/收起”。文字/图片计数在框标题右侧 SHALL NOT 展示。

#### Scenario: Grouped panels
- **WHEN** 展开病例
- **THEN** 侧栏出现“图像”“文字”两个框，各自列表集中，按钮组在右侧，且无计数徽标

#### Scenario: Case-level controls only basic info
- **WHEN** 点击病例上的“编辑/删除”
- **THEN** 仅修改/删除病例基础信息（名称），不在此处新增样本或文字

### Requirement: Thumbnail Framed Scaling
侧栏中的图片缩略 MUST 在缩略容器中按原图等比缩放（保持宽高比，完整可见，居中，不裁剪），容器为统一风格的框体，尺寸由设计令牌定义。

#### Scenario: Fit into container (tall)
- **WHEN** 1000×2000 图片生成缩略
- **THEN** 在容器内等比缩放以完整可见，纵向铺满短边，水平居中，无裁切

#### Scenario: Fit into container (wide)
- **WHEN** 4000×2000 图片生成缩略
- **THEN** 在容器内等比缩放以完整可见，横向铺满短边，垂直居中，无裁切

### Requirement: Title and Theme Consistency
预览标题框颜色与文字预览整体主题 MUST 保持统一（色板/对比度一致），与既定池塘风格相协调。

#### Scenario: Unified title and text theme
- **WHEN** 切换不同病例/预览内容
- **THEN** 标题框与文字预览采用统一配色方案，无色偏或不一致阴影

### Requirement: Sidebar Width Consistency and Content Safety
在新增池塘与按钮的前提下，侧栏与分析区的最小宽度与交互命中区域 MUST 继续满足一致性与可点击性（继承现有 UI 规范）。

#### Scenario: Hit areas and min width unchanged
- WHEN 调整窗口/拖拽分隔手柄
- THEN 池塘与按钮布局不遮挡/不重叠，最小宽度守护仍然生效

### Requirement: Sidebar Minimum Width Guard
侧栏在任何屏幕尺寸下 MUST 保持不低于 420px（或配置常量指定的最小阈值），并在拖拽或布局计算时 SHALL 始终应用该 clamp 约束。

#### Scenario: Enforced min width
- **WHEN** 用户拖拽缩小侧栏
- **THEN** 侧栏宽度 SHALL NOT 低于 420px，并保持交互平滑无跳变

#### Scenario: CSS lower bound fallback
- **WHEN** 页面加载或布局计算导致宽度异常
- **THEN** CSS `min-width` SHALL 保证容器不低于阈值，避免内容压缩错位

### Requirement: Replace Emojis and Remove Placeholder Text
侧栏中“📷/✍️” MUST 替换为“图像/文字”中文；“未设置显示名称”文案 SHALL 移除。

#### Scenario: Text labels only
- **WHEN** 浏览病例列表
- **THEN** 看不到 Emoji 与“未设置显示名称”，仅出现中文“图像/文字”及有效字段

### Requirement: Card & List Typography Polish
卡片/列表的标题与摘要 MUST 采用统一排版：字号/行高一致、摘要 2 行截断、操作区域右对齐并保持固定间距；交互 hover/active 阴影 SHALL 符合“池塘”视觉。

#### Scenario: Two-line clamp for summary
- **WHEN** 摘要文本超过两行
- **THEN** 文本 SHALL 使用 `line-clamp: 2` 截断且不破坏行高

#### Scenario: Controls alignment
- **WHEN** 卡片出现操作按钮
- **THEN** 按钮组 SHALL 使用统一间距并右对齐

### Requirement: DevTools Visual Audit
项目 SHALL 使用 Chrome DevTools MCP/Playwright MCP 进行一次可复现的 UI 细节检查并记录结果。

#### Scenario: MCP audit steps
- **WHEN** 运行 MCP 脚本
- **THEN** 完成：分屏手柄可用性、最小宽度验证、滚动条与手柄命中、分组与按钮策略、缩略图缩放、主题统一，并产出 snapshot（或等效检查输出）

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

### Requirement: Analysis Page Feature Parity with Case Page
分析页面（主界面第二块/右侧区或等效路由） MUST 提供与病例页面相同的功能集与交互（列表、预览、导入、编辑、删除、展开/收起、缩略/Markdown 渲染等），达到“功能一致性（parity）”。

#### Scenario: End-to-end parity
- WHEN 用户在分析页面执行任意操作
- THEN 行为与病例页面等价（含文案/提示/禁用态/错误处理），使用相同后端 API，无新增接口

### Requirement: Synchronized State Between Case and Analysis Panels
病例页面与分析页面（右侧分析区）的 UI 状态（选择、展开、滚动位置、过滤等） MUST 联动同步，减少切换成本。

#### Scenario: Bidirectional sync
- WHEN 在任一侧选择/展开/滚动
- THEN 另一侧同步相同的选择与展开状态；滚动位置在合理范围内对齐或保持相对定位

### Requirement: Accessibility and i18n Consistency
分析页面的键盘可达性（Tab 顺序、角色、快捷键）与中文标签/单位/精度 SHALL 与病例页面保持一致。

#### Scenario: A11y and formatting tokens
- WHEN 在分析页面遍历关键交互（导入、列表操作、按钮组）
- THEN 可通过键盘完成；数值与单位格式与现有规范一致，空值显示“未提供”

### Requirement: AI Chat Panel in Analysis Area
分析页右半“分析区” MUST 显示 AI 聊天面板，以气泡式展现对话，遵循项目的主题与排版风格，不影响左侧病例与预览交互。  
**Modification:** 聊天面板 MUST 调用后端 `/ai/chat` 流式接口，边流式渲染增量文本，缺省配置时提示用户配置 DeepSeek。

#### Scenario: Streamed AI Reply
- **WHEN** 用户在“分析”页 AI 面板发送消息
- **THEN** 面板立即显示用户消息并创建助手占位气泡，随着 `/ai/chat` 的流式响应追加文本，直至完成

#### Scenario: Missing Config Notice
- **WHEN** DeepSeek base-url 或 api-key 未配置
- **THEN** 发送入口应提示“未配置”，阻止发送或降级为本地 demo 文案，并引导用户前往“设置-后台行为”填写

### Requirement: Case-Scoped Conversation Context
会话上下文 SHALL 以病例（caseId）为粒度隔离；同一病例下的影像/文字共享同一会话；不同病例之间互不影响。

#### Scenario: Switch case and retain session
- WHEN 切换病例 A/B
- THEN A 与 B 的会话内容互不干扰，返回 A 时仍显示 A 的历史内容

### Requirement: Basic Controls (New/Upload/Send)
聊天面板 MUST 提供：
- “＋”按钮：新建对话/清空当前病例会话（确认可选，本次可直接清空）
- “上传文件”能力：选择本地文件，作为本条消息的附件展示（本次无需真实上传）
- “发送”按钮：发送文本（可带附件）并显示占位回复

#### Scenario: Compose and send
- WHEN 输入文本并可选选择文件
- THEN 点击“发送”后出现用户消息与占位 AI 回复；点击“＋”清空当前病例对话

### Requirement: Right-half panel supports mode switching
右半区 MUST 支持“文字总结”与“图像总结”两种模式切换；标题样式 SHALL 保持一致，切换 SHALL 不影响左侧预览与列表操作。

#### Scenario: Right-half panel supports mode switching
- Given 进入“分析”页且右半区可见
- When 在右半区标题栏点击二级切换“文字总结｜图像总结”（或使用键盘）
- Then 右半区内容在 AI 对话与“图像总结”两种视图间切换
- And 两种模式的标题样式一致，无布局跳变

### Requirement: Right-half Subpage Toggle and Header Actions
右半区标题栏左侧 MUST 显示二级切换（tablist/tab）；右侧 MUST 显示当前会话名称与“新建对话”。在“图像总结”模式点击“新建对话” SHALL 切回“文字总结”并聚焦输入框。

#### Scenario: Toggle placed left; chat info and “新建对话” placed right
- Given 右半区标题栏可见
- Then 左侧显示“文字总结｜图像总结”切换（tablist/tab，aria-selected/aria-controls 正确）
- And 右侧显示当前会话名称与“新建对话”按钮
- And 在“图像总结”模式点击“新建对话”将切回“文字总结”并聚焦输入

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

### Requirement: A11y and Responsiveness for Right-half Visualizations
二级切换与图表容器 MUST 满足键盘可达性与响应式要求；图表容器 SHALL 具备最小高度 320px，并在窗口缩放时不发生溢出。

#### Scenario: Keyboard navigation
- Then 二级切换支持左右方向键与 Enter/Space 激活；视觉焦点清晰

#### Scenario: Responsive sizing
- Then 图表容器最小高度 320px，随右半区自适应；窗口缩放不溢出

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

### Requirement: WeChat Miniapp Shell Read-only Experience
项目 MUST 提供一个基于 Taro 的微信小程序壳，默认进入首页展示病历库列表，点击病例后进入仅含“分析数据”与“预测&建议”两个模块的详情页，并以 fake demo 数据只读展示。

#### Scenario: Cases index as landing page
- **WHEN** 打开小程序或返回首页
- **THEN** 首屏展示病历库列表（含搜索/折叠控件），不渲染分析/预测内容，数据来源于现有 demo API

#### Scenario: Case detail tabs
- **WHEN** 用户在首页点击某个病例
- **THEN** 跳转到病例详情页，顶部只有标题导航，主区域包含“分析数据”与“预测&建议”两个 Tab，内容与当前桌面端 demo 对齐

### Requirement: AI Floating Button and Context Rules
微信小程序壳 SHALL 在病历库页与病例详情页右下角展示悬浮 AI 按钮；从首页进入 AI 页面时不得附带病例上下文，而从详情页进入时 MUST 传递当前病例/样本的上下文参数。

#### Scenario: Global AI entry from index
- **WHEN** 在病历库首页点击悬浮 AI 按钮
- **THEN** 跳转到 AI 对话页，显示“无上下文”提示且不会自动带入病例数据

#### Scenario: Contextual AI entry from detail
- **WHEN** 在病例详情页点击悬浮 AI 按钮
- **THEN** 跳转 AI 对话页并附带当前病例/样本/报告摘要参数，界面提示“当前上下文：<病例>”，供后续 AI 识别

### Requirement: Desktop Visual Parity and Mobile Adaptation
微信小程序壳 MUST 复用桌面端的视觉/排版 token（色板、阴影、圆角、间距、字体粗细），并在微信安全区内保持只读展示的美术一致性，不新增编辑/导入能力。

#### Scenario: Theme tokens and spacing applied
- **WHEN** 渲染任何页面（首页/详情/AI）
- **THEN** 背景使用桌面端暖米色渐变 `linear-gradient(135deg,#f1ede5,#ece6db,#f6f2ea)`，卡片/气泡使用统一阴影 `rgba(78,70,60,0.16)` + 内阴影，圆角 12–16，文字权重沿用桌面标题/副标题粗细（600–700 / 500），页面内边距遵循 12/16/24 间距并适配顶部/底部安全区，组件不贴边且不越过导航/手势区域

#### Scenario: Cases index uses desktop card structure
- **WHEN** 查看病例库首页
- **THEN** 搜索条与卡片沿用桌面端圆角（14–16）与浅色阴影；卡片头显示 identifier + displayName（字重 600+），右侧轻量文字按钮；折叠区分“图像/文字”分组并展示数量/标题/摘要，分隔线使用浅棕透明线，与桌面端分组标题色一致；不展示分析内容且所有交互仅为查看/折叠/本地收藏状态

#### Scenario: Case detail grid and tabs follow desktop layout
- **WHEN** 查看病例详情页
- **THEN** Tab 使用桌面端下划线/高亮样式；分析指标以 2–3 列栅格卡片呈现（副标题 + 数值 + 单位），卡片圆角 12–16、阴影同首页卡片，行高与间距与桌面一致；空态/加载态保持留白；预测&建议以卡片容器展示标题与段落行距（约 1.5x）、次文本色，且不引入编辑控件

#### Scenario: AI chat banner and bubbles match warm aesthetic
- **WHEN** 打开 AI 对话页
- **THEN** 顶部上下文 Banner 采用暖色卡片（panel 渐变 + 阴影 + 圆角 12–14）+小图标/圆点提示病例/报告信息；气泡与输入区使用暖灰背景、轻阴影与圆角胶囊样式（圆角 12–16，间距 8–12），可加轻量渐变/纹理呼应“池塘/火山口”气质但不引入重型图形库；不使用默认白底圆形气泡，保持只读本地对话

### Requirement: WeChat Miniapp Case Index Mirrors Desktop Cards
WeChat 小程序病例列表页 SHALL 采用与桌面端左侧栏一致的卡片分组（病例→图像/文字分区）、操作（编辑/删除/收起）与操作区（全部收起、快速导入、搜索），并保持火山口/池塘视觉 token 与高保真字体。

#### Scenario: Card grouping and controls
- **GIVEN** 进入小程序病例列表页  
- **WHEN** 查看任一病例卡  
- **THEN** 显示图像分区与文字分区、每项含编辑/删除，病例卡可展开/收起，头部含“全部收起/快速导入/搜索”，且卡片渐变/阴影/圆角/字体与桌面一致。

### Requirement: WeChat Miniapp Detail Tabs for Preview and Analysis
病例详情页 MUST 提供“预览 | 数据分析”两段互斥 tab（不滚动切换），并复刻桌面右侧栏的全部信息块与顺序：基本信息 → 基础病理数据 → 分析数据 → 预测&建议；预览支持图片缩放/重置+缩略图或 Markdown 文本排版。

#### Scenario: Preview tab
- **GIVEN** 在病例详情页选择“预览”  
- **WHEN** 当前样本为图片  
- **THEN** 显示大图、缩放比例、重置按钮和缩略图浮窗，使用桌面同款视觉与字体；如为文本，则以 Markdown 标题/正文排版展示，文案与桌面一致。

#### Scenario: Analysis tab card parity
- **GIVEN** 在病例详情页选择“数据分析”  
- **WHEN** 查看信息块  
- **THEN** 以栅格卡片呈现“基本信息/基础病理数据/分析数据/预测&建议”且顺序保持；卡片尺寸/圆角/渐变/内外阴影、字号字重与桌面一致；所有字段与桌面文案全量显示，无裁剪。

#### Scenario: Safe-area and keyboard fit
- **GIVEN** 设备存在挖孔/顶部胶囊或底部 Home 条，且在详情页中使用输入控件（如 AI 悬浮按钮点击进入对话前键盘弹出）  
- **THEN** 预览/分析区域与悬浮按钮不被遮挡，保留安全区内边距，键盘弹出时悬浮元素隐藏或上移，右上三点/关闭按钮可点击。

### Requirement: WeChat Miniapp AI Dialog Parity with Shortcuts
小程序 AI 对话页 SHALL 保留桌面 demo 文案与上下文 banner，支持附件按钮与快捷问题/预设，气泡含角色标签/时间/头像风格；入口为病例及列表页右下悬浮按钮。

#### Scenario: Entry and context
- **GIVEN** 在列表页或详情页点击 AI 悬浮按钮  
- **WHEN** 打开 AI 对话页  
- **THEN** 显示上下文 banner（含病例/报告摘要时展示），初始消息为桌面 demo 文案，输入区右侧含附件按钮，且气泡包含角色标签/时间/头像风格。

#### Scenario: Shortcuts available
- **GIVEN** 进入 AI 对话页  
- **WHEN** 未输入文本  
- **THEN** 可点击快捷问题/预设填充输入框或直接发送，发送后对话流按角色气泡渲染，键盘安全区适配。

### Requirement: Sidebar Drag-and-drop Ordering for Reports
病例侧栏“文字”列表 MUST 支持在同一病例内部通过拖拽卡片改变文字病历顺序，并在保存成功后在所有视图中保持一致。

#### Scenario: Drag to reorder reports within a case
- **GIVEN** 某病例下存在至少 3 条文字病历，当前按既有顺序展示
- **WHEN** 用户按住其中一条文字病历卡片并向上或向下拖动
- **THEN** 该卡片 SHALL 以浮层形式随指针移动，其他卡片在同一列表内自动让位（保持单列顺序，不产生跨病例移动）

#### Scenario: Persist report ordering after drop
- **WHEN** 用户松开拖拽并完成一次重排
- **THEN** 列表在当前会话中立即以新顺序渲染
- **AND** 客户端 SHALL 调用对应的报告排序 API，将该病例下所有报告 ID 的新顺序发送到后端以持久化

#### Scenario: Handle reorder failure for reports
- **WHEN** 排序 API 返回错误或网络请求失败
- **THEN** 前端 SHALL 回滚到拖拽前的报告顺序
- **AND** 在侧栏内或顶部以非打断式提示用户“排序保存失败，请稍后重试”

### Requirement: Sidebar Drag-and-drop Ordering for Samples
病例侧栏“图像”列表 MUST 支持在同一病例内部通过拖拽卡片改变样本顺序，并在保存成功后在所有视图中保持一致。

#### Scenario: Drag to reorder samples within a case
- **GIVEN** 某病例下存在多个图像样本
- **WHEN** 用户按住其中一个样本卡片并向上或向下拖动
- **THEN** 该卡片 SHALL 在当前病例的样本列表中移动，其他样本卡片自动让位；拖拽过程中不允许跨病例移动样本

#### Scenario: Persist sample ordering after drop
- **WHEN** 用户松开拖拽并完成一次样本重排
- **THEN** 列表在当前会话中立即以新顺序渲染
- **AND** 客户端 SHALL 调用对应的样本排序 API，将该病例下所有样本 ID 的新顺序发送到后端以持久化

#### Scenario: Handle reorder failure for samples
- **WHEN** 样本排序 API 返回错误或网络请求失败
- **THEN** 前端 SHALL 回滚到拖拽前的样本顺序
- **AND** 在侧栏内或顶部以非打断式提示用户“排序保存失败，请稍后重试”

### Requirement: Settings Backstage Controls
设置页 MUST 提供“后台行为”配置项。  
**Modification:** SHALL 新增 DeepSeek/OpenAI base-url、api-key（以及模型可选）的输入与保存按钮；保存后调用后端 `/ai/config` 更新，key 不以明文回显。

#### Scenario: Save AI Provider Config
- **WHEN** 在“设置-后台行为”输入 base-url/api-key 并点击保存
- **THEN** 前端调用配置接口保存；UI 显示“已配置/未配置”状态，不展示明文 key，后续聊天应使用新配置

