## ADDED Requirements

### Requirement: Case Sample Analysis Association (Tissue Only)
病例样本（`cases` → `case_samples`）对于 `modality='组织切片'` SHALL 具有关联的分析结果对象 `analysis`，包含：
- 原始指标（a–i）与单位
- 衍生指标（a–e）与单位
- 图像路径（原始/解析）

#### Scenario: List cases with tissue analysis
- WHEN 客户端请求 `GET /cases`
- THEN 返回的每个“组织切片”样本对象包含 `analysis` 字段（存在时）；其他模态不包含或为 `null`

#### Scenario: Fetch sample analysis by id
- WHEN 客户端请求 `GET /cases/{caseId}/samples/{sampleId}/analysis`
- THEN 返回与 `GET /cases` 聚合字段一致的分析对象；不存在时返回 404（含 message）

### Requirement: Aggregation and Filtering Rules
列表聚合 SHALL 仅在 `modality='组织切片'` 且存在分析数据时附加 `analysis`；非组织切片或无分析数据不附加。返回顺序与现有样本排序一致。

#### Scenario: Mixed modality cases
- WHEN 同一病例包含 CT/核磁/组织切片
- THEN 仅组织切片样本拥有 `analysis`，其它样本 `analysis` 缺省
