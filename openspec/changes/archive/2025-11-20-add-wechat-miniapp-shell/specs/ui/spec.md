## ADDED Requirements
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
