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
- **THEN** 仅修改/删除病例基础信息（名称、描述等），不涉及图像或文字条目的批量操作
