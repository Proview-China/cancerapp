# CancerApp 微信小程序壳

基于 Taro + React 的只读小程序，展示病历库、病例详情（分析数据 + 预测&建议）以及 AI 对话入口。默认使用 fake demo 数据，可配置真实 API。

## 环境要求
- Node.js 18+
- npm 9+
- 微信开发者工具（导入 `project.config.json`）

## 安装依赖
```bash
cd wechatapp
npm install
```

## 开发调试
```bash
npm run dev:weapp
```
- 初次运行会生成 `dist` 目录。
- 打开微信开发者工具，选择“导入项目”，目录指向 `wechatapp`，AppID 可暂用 `touristappid`。

## 构建
```bash
npm run build:weapp
```

## API 配置
- 通过环境变量 `WECHATAPP_API_BASE` 指定后端地址（需 HTTPS 且添加到微信开发者域名白名单）。
- `WECHATAPP_USE_DEMO=true`（默认）时读取 `src/assets/demo-cases.json`，不会发起网络请求。
- 如需连接真实 API，请在命令前设置：
  ```bash
  WECHATAPP_API_BASE=https://example.com WECHATAPP_USE_DEMO=false npm run build:weapp
  ```

## 页面与上下文
1. **pages/index**：病例库列表 + 搜索，悬浮 AI 按钮（无上下文）。
2. **pages/case-detail**：展示分析指标与预测/建议 Tab，悬浮 AI 按钮会带上病例上下文。
3. **pages/ai-chat**：显示上下文提示条、对话列表与输入框，目前使用 mock 回复。

## 数据字段
详见 `docs/data-requirements.md`，包含病例/样本/报告/分析字段清单及只读约束。
