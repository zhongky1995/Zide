#!/bin/bash

# Zide 一键启动脚本
# 用法: ./scripts/dev.sh

echo "🚀 启动 Zide Desktop..."

# 1. 停止占用端口的进程
echo "📦 清理端口占用..."
lsof -ti:3006 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# 2. 清理之前的 node 进程 (仅限 zide 相关的)
pkill -f "tsc.*main.json.*watch" 2>/dev/null
pkill -f "vite" 2>/dev/null

sleep 1

# 3. 启动开发模式
echo "🔨 启动开发服务器..."
cd "$(dirname "$0")/.."

# 使用 concurrently 同时运行 main 和 renderer
npm run dev:desktop &

# 等待服务启动
sleep 8

# 4. 启动 Electron
echo "🖥️ 启动 Electron..."
open -a Electron --args "$(pwd)/apps/desktop/dist/main/index.js" 2>/dev/null || \
npx electron apps/desktop/dist/main/index.js &

echo "✅ 启动完成！"
echo "📍 访问 http://localhost:3006"
