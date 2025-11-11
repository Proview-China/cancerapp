## ADDED Requirements

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
侧栏顶置内容区与滚动内容区 MUST 宽度一致；滚动条 SHALL 固定在侧栏最右侧且不影响中间手柄点击；并 MUST 保证所有内容正常显示（无错位、无文本/按钮重叠、标签/值对齐）。

#### Scenario: Equal widths and non-overlapping hit areas
- **WHEN** 页面滚动或调整侧栏宽度
- **THEN** 顶置/滚动区域宽度一致；滚动条位于最右，不遮挡或抢占手柄可点击区域

#### Scenario: Content-safe layout
- **WHEN** 侧栏在最小宽度下展示包含长标题、长标签、多按钮的病例
- **THEN** 不出现错位、重叠或难以点击的控件；文本按规则截断或换行，整体排版稳定

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
