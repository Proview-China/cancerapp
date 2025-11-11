## ADDED Requirements

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
“图像总结”视图 MUST 同时展示扇形图与热力图；数据来源于 `TissueAnalysis.derived` 或演示常量；Hover 提示 SHALL 显示名称与数值，配色遵循黄→橙→红渐变。

#### Scenario: Pie chart displays factor level composition
- Given 打开“图像总结”模式
- Then 展示扇形图（环形风格），以 高/中/低 三段展示因素等级占比
- And 悬停显示等级与百分比

#### Scenario: Heatmap displays key metric intensities
- Given 打开“图像总结”模式
- Then 展示热力图（行=关键指标；列=当前患者）
- And 颜色从低到高风险连续渐变（黄→橙→红），悬停显示指标名与数值

### Requirement: A11y and Responsiveness for Right-half Visualizations
二级切换与图表容器 MUST 满足键盘可达性与响应式要求；图表容器 SHALL 具备最小高度 320px，并在窗口缩放时不发生溢出。

#### Scenario: Keyboard navigation
- Then 二级切换支持左右方向键与 Enter/Space 激活；视觉焦点清晰

#### Scenario: Responsive sizing
- Then 图表容器最小高度 320px，随右半区自适应；窗口缩放不溢出
