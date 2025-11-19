#!/bin/bash

echo "Starting CancerApp..."

# 进入项目目录
cd /home/proview/Desktop/Coder/cancerapp/frontend

# 杀死所有旧进程
pkill -f electron
pkill -f vite

# 启动 Vite
echo "Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# 等待 Vite 启动
echo "Waiting for Vite to be ready..."
sleep 5

# 检查 Vite 是否在运行
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "Vite server failed to start!"
    exit 1
fi

echo "Vite is ready, starting Electron..."

# 直接使用 Electron 二进制文件，禁用所有沙箱
./node_modules/electron/dist/electron electron/main.cjs \
    --no-sandbox \
    --disable-setuid-sandbox \
    --disable-gpu-sandbox \
    --disable-dev-shm-usage

# 清理
kill $VITE_PID