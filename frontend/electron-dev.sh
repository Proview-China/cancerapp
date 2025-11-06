#!/bin/bash
# Electron 开发环境启动脚本（禁用沙箱）

echo "Starting Electron app without sandbox..."
cd /home/proview/Desktop/Coder/cancerapp/frontend

# 先启动 Vite
npm run dev &
VITE_PID=$!

# 等待 Vite 启动
echo "Waiting for Vite to start..."
sleep 3

# 启动 Electron（完全禁用沙箱）
export ELECTRON_DISABLE_SANDBOX=1
npx electron electron/main.cjs --no-sandbox --disable-gpu-sandbox --disable-setuid-sandbox --disable-dev-shm-usage

# 清理
kill $VITE_PID