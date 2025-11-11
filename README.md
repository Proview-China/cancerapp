# CancerApp（桌面端：React + Vite + Electron；后端：Express + PostgreSQL）

面向肿瘤病理影像管理与可视化分析的桌面应用。支持病例导入（图像/文字）、组织切片分析 Demo、以及“图像总结”高信息密度可视化（复合热力图 + 多层级环形图）。

## 功能亮点
- 病例库：导入/管理图像样本与文字病历；Electron 外部打开原图/解析图。
- 组织切片分析 Demo：后端种子脚本生成原始/衍生指标及图像路径；前端自动消费。
- 图像总结（可视化）：
  - 复合热力图：行=指标，列=“医生判断维度”（归一/十分位/z分/|z|/分位/Q组/排名/正偏/负偏/IQR位/置信/稳定/权重/完备）；病例内统计；白色网格与确定性微抖动避免色块连片；实时居中自适应。
  - 多层级环形图：中心风险仪表 + 风险分层 + 特征贡献 + 分位细分 + HSI 组成 + 缺失率；与热力图统一配色、实时居中。

## 快速开始
1) 安装依赖
```bash
cd backend && npm i && cd ../frontend && npm i
```
2) 初始化数据库（PostgreSQL）
```bash
psql postgresql://postgres:aass0371@localhost:5432/cancerapp -f database/schema.sql
```
3) 启动后端并导入 Demo
```bash
cd backend
npm run dev &           # 开发模式
npm run seed:demo       # 写入 demo_fake F10/F11/F13
```
4) 启动前端（桌面/浏览器二选一）
```bash
cd frontend
npm run electron:dev    # 桌面端（推荐）
# 或
npm run dev             # 浏览器预览
```

## 配置
- 前端 API 地址：`VITE_API_BASE_URL`（默认 `http://localhost:4000`）。
- 后端环境：`backend/.env`（`DATABASE_URL`、`UPLOADS_ROOT`、`PORT`）。

## 可视化说明（图像总结）
- 病例隔离：所有统计均在“当前病例”内完成；样本过少时 z 分回退为归一值。
- 热力图列（判断维度）包括：归一/十分位/z分/|z|/分位/Q组/排名/正偏/负偏/IQR位/置信/稳定/权重/完备；单元格带白色网格，且应用确定性微抖动（仅影响显示，不改变数据）。
- 实时居中：拖动左右分隔手柄或窗口缩放时，图表自动 `resize` 保持居中。

## 规范与贡献
- 遵循 OpenSpec 规范（`openspec/`）。重要改动需先提交变更提案并通过严格校验，实施后归档。
- 本次实现对应归档变更：`openspec/changes/archive/2025-11-11-upgrade-analysis-heatmap-pie-ultra/`。

## 目录结构（节选）
```
backend/     # Express + pg 后端
frontend/    # React + Vite + Electron 前端
openspec/    # 规范与变更
database/    # SQL 脚本
demo_fake/   # 演示数据
```

## 许可
详见 LICENSE。
