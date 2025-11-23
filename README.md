# CancerApp (Multi-Platform Medical Analysis System)

CancerApp 是一个面向肿瘤病理影像管理与可视化分析的综合应用平台，支持多端协同工作。

## 核心组件

### 1. 桌面端 (Electron + React)
- **定位**：医生工作站，功能最全。
- **功能**：
  - **病例库管理**：导入/管理图像样本与文字病历。
  - **组织切片分析**：自动生成原始/衍生指标及图像路径。
  - **高密度可视化**：
    - **复合热力图**：支持归一/十分位/z分等14种维度的实时分析。
    - **多层级环形图**：集成风险仪表、特征贡献、HSI组成等多维数据。

### 2. 微信小程序 (Taro + React)
- **定位**：移动端便捷查阅工具。
- **功能**：
  - **移动端查阅**：随时随地查看病例详情。
  - **AI 智能助手**：集成了 AI 对话功能，辅助医生进行病例分析。
  - **数据可视化**：在移动端完美复刻了桌面端的图表体验。

### 3. 移动端 Web (React + Vite)
- **定位**：轻量级竖屏 Web 应用（独立只读版）。
- **功能**：
  - 适配手机浏览器的竖屏 UI。
  - 提供核心的病例查看和 AI 对话功能。

### 4. 后端服务 (Express + PostgreSQL)
- **定位**：数据中心与 API 服务。
- **功能**：提供数据存储、图像处理接口及 AI 模型集成。

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖（如果有）
npm install

# 安装各子项目依赖
cd backend && npm install
cd ../frontend && npm install
cd ../wechatapp && npm install
cd ../frontend-mobile && npm install
```

### 2. 启动后端

```bash
cd backend
npm run dev             # 启动 API 服务 (默认端口 3000)
npm run seed:demo       # (可选) 写入演示数据
```

### 3. 启动前端应用

#### 桌面端 (Desktop)
```bash
cd frontend
npm run electron:dev    # 同时启动 Vite 开发服务器和 Electron 窗口
```

#### 微信小程序 (WeChat Mini Program)
```bash
cd wechatapp
npm run dev:weapp       # 编译并监听文件变化
# 启动后，请使用"微信开发者工具"导入 wechatapp 目录进行预览
```

#### 移动端 Web (Mobile Web)
```bash
cd frontend-mobile
npm run dev             # 启动竖屏 Web 应用 (默认端口 5173)
# 注意：此应用专为竖屏设计，横屏浏览时会显示提示遮罩
```

## 目录结构

```
backend/          # Express + PostgreSQL 后端服务
frontend/         # React + Vite + Electron 桌面端
frontend-mobile/  # React + Vite 移动端 Web
wechatapp/        # Taro + React 微信小程序
openspec/         # 开发规范与变更记录
database/         # 数据库 Schema 与脚本
demo_fake/        # 演示用假数据
```

## 团队协作说明

本项目配置了严格的 `.gitignore` 规则：
- **构建产物不上传**：`dist/`, `node_modules/` 等目录被忽略，确保每位开发者在本地构建干净的环境。
- **私有文件不上传**：`.docx`, `.zip` 等敏感文档已被屏蔽。
- **一致性保证**：只要拉取代码后执行 `npm install`，即可获得与主仓库完全一致的依赖环境。

## 许可
详见 LICENSE。
