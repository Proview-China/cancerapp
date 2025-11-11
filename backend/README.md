# CancerApp 后端服务

该服务为前端病例模块提供 REST API，基于 Express + PostgreSQL，负责病例信息与样例图片的持久化存储。

## 环境准备

1. 复制环境变量模板：

   ```bash
   cp backend/.env.example backend/.env
   ```

2. 根据实际情况修改 `.env`：

   - `DATABASE_URL`：PostgreSQL 连接串，默认指向 `postgres://postgres:aass0371@localhost:5432/cancerapp`
   - `UPLOADS_ROOT`：样例原始文件的存储目录，默认 `../uploads`
   - `PORT`：服务监听端口，默认 `4000`

3. 安装依赖并构建：

   ```bash
   cd backend
   npm install
   npm run build
   ```

4. 启动开发服务器：

   ```bash
   npm run dev
   ```

   或运行已编译的产物：

   ```bash
   npm start
   ```

## 数据库初始化

使用 `database/schema.sql` 初始化数据库，该脚本除原有数据集结构外新增以下表：

- `cases`：病例主表（唯一标识、备注、时间戳等）
- `case_samples`：病例影像表（类别、描述、文件路径、校验和等）
- `case_reports`：病例文字表（标题、摘要、Markdown 正文、标签、元数据）

通过 psql 运行：

```bash
psql postgresql://<user>:<password>@localhost:5432/cancerapp -f database/schema.sql
```

## API 概览

基础 URL：`http://localhost:4000`

### GET /cases

返回所有病例及其样例。

```json
[
  {
    "id": "...",
    "identifier": "病历编号",
    "createdAt": "2025-10-30T08:00:00.000Z",
    "updatedAt": "2025-10-30T08:00:00.000Z",
    "samples": [
      {
        "id": "...",
        "caseId": "...",
        "modality": "CT片",
        "description": "肺部CT",
        "originalFilename": "lung.png",
        "imageUrl": "http://localhost:4000/uploads/<file>"
      }
    ]
  }
]
```

### POST /cases

创建或更新病例（`identifier` 唯一），支持批量上传影像文件及文字病历。

- 请求类型：`multipart/form-data`
- 字段说明：
  - `identifier` (必填)：病例姓名或 ID
  - `samplesMeta`：JSON 字符串，描述样例元数据，例如：

    ```json
    [
      { "description": "肺组织切片", "modality": "组织切片" }
    ]
    ```

  - `sampleFiles`：与 `samplesMeta` 数组一一对应的影像文件，可多选
  - `textReports`：JSON 字符串，数组内每个元素需包含 `title` 与 `content`，可选字段包括 `summary`、`tags`（字符串数组）、`metadata`

响应返回最新的病例数据（包含 `samples` 与 `reports`）。若已有同名病例则在原记录上追加样例/文字病历。

#### 文字病历增删改查

- `GET /cases/:caseId/reports`：列出指定病例的文字记录
- `POST /cases/:caseId/reports`：新增文字记录，JSON 结构与 `textReports` 元素相同
- `PATCH /cases/:caseId/reports/:reportId`：更新标题/摘要/正文/标签/元数据（至少提供一个字段）
- `DELETE /cases/:caseId/reports/:reportId`：删除文字记录，级联移除

## 静态资源

原始样例文件存放在 `UPLOADS_ROOT` 指定目录，并通过 `/uploads/<filename>` 对外提供静态访问，前端可直接使用 `imageUrl` 字段展示无损图片。

文字病历以 Markdown 形式存储，无需额外静态资源目录。

## 错误处理

常见错误与提示：

- `400 上传样例前需要先填写病例信息`：缺少 `identifier`
- `400 样例元数据与文件数量不匹配`：`samplesMeta` 长度与上传文件数不同
- `400 不支持的样例类别`：`modality` 不在「组织切片/CT片/核磁共振片」之列
- `400 文字病历需要填写标题与正文`：`textReports` 中缺少必填字段
- `500 创建病例失败`：数据库或存储异常，查看服务端日志

## 与前端的约定

- 前端通过 `VITE_API_BASE_URL` 指向后端地址，缺省为 `http://localhost:4000`
- 导入成功后后端返回最新病例、样例及文字病历数组，前端据此同步 UI
- 样例缩略图当前等同于原始图片路径，后续可扩展独立缩略图字段

---

## 组织切片分析 Demo（四池塘）

本项目提供“组织切片”样本的演示级别分析数据，用于前端分析区“四池塘”（基础/原始/处理后/AI 文本）展示。

### 环境变量

- `PORT`（默认 `4000`）：后端监听端口
- `DATABASE_URL`：PostgreSQL 连接串（必填）
- `UPLOADS_ROOT`（默认 `./uploads`）：静态文件根目录（白名单路径之一）

### 启动与 Demo 种子

1) 启动后端（Node 20+）：

```bash
cd backend
npm install
npm run dev
# 或：DATABASE_URL=... UPLOADS_ROOT=./uploads PORT=4000 node -r tsx/register src/server.ts
```

2) 运行 Demo 种子（将 `demo_fake/BIOBANK-F10|F11|F13` 写入，并建立样本与分析关联）：

```bash
node -r tsx/register backend/scripts/seed-demo-tissue-analysis.ts
```

> 说明：脚本会复制原始图像到 `UPLOADS_ROOT` 并计算校验和，同时将原始/衍生指标与 `raw_image_path`/`parsed_image_path` 写入 `sample_tissue_analysis`。

### API 校验

- `GET /cases`：当样本模态为“组织切片”且存在分析记录时，响应中的该样本包含 `analysis` 字段（含 `raw`/`derived`/`images`/`metadata`）。

```bash
curl http://localhost:4000/cases | rg -n "analysis|组织切片" -n || true
```

- `GET /cases/:caseId/samples/:sampleId/analysis`：返回单样本分析对象（只读）。

```bash
curl http://localhost:4000/cases/<caseId>/samples/<sampleId>/analysis
```

### 路径与安全

- 静态公开目录：`/uploads` 映射至 `UPLOADS_ROOT`
- 外部打开白名单（由 Electron 侧处理）：仅允许 `uploads/` 与 `demo_fake/` 路径
- 日志/错误消息中避免输出绝对路径与敏感信息

### 日志与观测性（建议）

- 建议为关键接口记录：`method`、`path`、`status`、`duration_ms` 与分类型 `reason`（例如 `NotFound`/`Forbidden`/`Invalid`），避免包含具体文件路径。
- 若后续启用该观测性，请在启动日志中确认不含绝对路径与私密数据。
