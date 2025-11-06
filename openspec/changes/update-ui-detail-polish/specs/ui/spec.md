## ADDED Requirements

### Requirement: Sidebar Minimum Width
侧边栏在任何屏幕尺寸下均 MUST 保持不低于既定的最小阅读宽度，并在拖拽调整时 SHALL 受同一阈值的 clamp 约束。

#### Scenario: Enforced min width
- **WHEN** 用户拖拽缩小侧边栏
- **THEN** 侧边栏宽度 SHALL NOT 低于 360px（或项目常量 MIN_SIDEBAR_WIDTH）

#### Scenario: CSS lower bound
- **WHEN** 页面加载或容器计算误差导致宽度异常
- **THEN** CSS 层的 `min-width` SHALL 保证不低于阈值

### Requirement: Card & List Typography Polish
卡片/列表的标题与摘要 MUST 采用统一排版：字号/行高一致、摘要 2 行截断、操作区域右对齐并保持固定间距；交互 hover/active 阴影 SHALL 符合“池塘”视觉。

#### Scenario: Two-line clamp for summary
- **WHEN** 摘要文本超过两行
- **THEN** 文本 SHALL 使用 `line-clamp: 2` 截断且不破坏行高

#### Scenario: Controls alignment
- **WHEN** 卡片出现操作按钮
- **THEN** 按钮组 SHALL 使用统一间距并右对齐

### Requirement: DevTools Visual Audit
项目 SHALL 使用 Chrome DevTools MCP 进行一次可复现的 UI 细节检查并记录结果。

#### Scenario: MCP audit steps
- **WHEN** 运行 DevTools MCP
- **THEN** 完成最小宽度验证、文字截断验证、交互 hover 验证并产出 snapshot（或等效检查输出）
