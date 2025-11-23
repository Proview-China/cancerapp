## ADDED Requirements
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
