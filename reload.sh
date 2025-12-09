#!/bin/bash

echo "🚀 开始更新前端..."

PROJECT_DIR="/var/www/Graduation-Project"
DEPLOY_DIR="/var/www/html"

echo "📌 切换到项目目录：$PROJECT_DIR"
cd $PROJECT_DIR

echo "📦 安装依赖..."
npm install

echo "🏗️  构建 Next.js（限制单核，降低服务器压力）..."
RAYON_NUM_THREADS=1 taskset -c 0 npm run build

echo "📤 导出静态文件..."
npm run export

echo "🧹 清空部署目录：$DEPLOY_DIR"
sudo rm -rf $DEPLOY_DIR/*

echo "📁 复制 out 静态文件到部署目录..."
sudo cp -r out/* $DEPLOY_DIR/

echo "🔁 重启 Nginx..."
sudo systemctl restart nginx

echo "🎉 前端更新完成！"
