## ADDED Requirements

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

