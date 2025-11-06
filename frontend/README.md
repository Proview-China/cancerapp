# CancerApp — React + Tauri 桌面环境

轻量化但功能齐全的桌面应用脚手架，前端基于 React + Vite，后端采用 Tauri (Rust)。默认提供前后端通信示例、完善的构建脚本以及跨平台打包能力。

## 快速开始

```bash
cd frontend
npm install
npm run tauri:dev
```

开发模式会同时启动 Vite 开发服务器与 Tauri 桌面容器，支持热重载与 Rust 命令调试。

## 常用脚本

- `npm run dev`：仅启动前端 Vite 站点，适合纯前端调试。
- `npm run tauri:dev`：启动完整的 Tauri 桌面应用。
- `npm run tauri:build`：打包生成跨平台安装包。
- `npm run lint`：使用 ESLint 校验前端代码质量。

## 目录结构

```
.
├── public/            # 静态资源
├── src/               # React + TypeScript UI 代码
├── src-tauri/
│   ├── src/main.rs    # Tauri 主进程与命令定义
│   ├── Cargo.toml     # Rust 依赖与构建配置
│   └── tauri.conf.json# 桌面应用元信息与打包配置
└── vite.config.ts     # Vite 配置
```

## Rust 命令示例

`src/App.tsx` 中的表单会通过 `invoke('greet')` 调用 Rust 命令，并在 UI 上展示返回结果。可以在 `src-tauri/src/main.rs` 中添加更多命令，扩展业务逻辑。

## 打包提示

首次执行 `npm run tauri:build` 时，Rust 会为当前平台下载构建依赖。若需多平台打包，可在对应操作系统上运行同一命令，或配置 CI/CD 构建流程。

## 病例导入（影像 + 文字）演示流程

> 需要后端服务已启动（参考 `backend/README.md`）并完成 `database/schema.sql` 初始化。

1. 启动后端：`cd backend && npm run dev`
2. 启动前端：`cd frontend && npm run electron:dev`（或 `npm run dev` 仅起 Vite）
3. 在“病例”页点击“导入影像”或“导入文字”打开导入弹窗：
   - 影像模式：选择图像文件；填写或确认自动生成的名称、类别后导入。
   - 文字模式：可手动输入标题/摘要/正文，或点击“导入文档”选择本地 `.docx/.txt/.md` 文件，系统自动转换为 Markdown；也可使用“加载示例病历”一键填充 3 条 Demo。
4. 导入成功后，病例卡会展示影像数量与文字数量；点击影像或文字即可在右侧查看：
   - 影像支持缩放拖拽，居中显示；
   - 文字以 Markdown 渲染，并在分析面板中展示摘要与标签。
5. 文字病历支持“编辑”“删除”操作；影像可单独删除或通过后端 API 重命名、补充样例。
