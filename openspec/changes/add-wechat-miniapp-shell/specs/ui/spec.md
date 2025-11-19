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
