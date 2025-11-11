## ADDED Requirements

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
