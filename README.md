# 前端（GP_front_end_ts）

## 项目说明
本项目为“生物制造知识图谱自动构建与分析平台”的前端界面，基于 Next.js（App Router）+ TailwindCSS，提供站点结果查看、图谱可视化、地理分布和 Agent 对话能力。

## 当前已实现功能
- 首页项目总览与演示入口
- `/result`：分页列表，多选 Crawl 入队、多选图谱生成，支持详情弹窗
- `/result/detail` 与 `/result/detail/graph`：结果详情与图谱可视化
- `/products`：展示从已建图站点中同步出的产品实体，并可内嵌图谱
- `/graph`：地图点位分布（读取 `/api/graph_locate`）
- `/agent`：SSE 实时对话，历史会话选择与续聊
- `/chat`：静态对话演示页（未接后端）

## 技术栈
- Next.js（App Router）、React、TypeScript
- TailwindCSS、react-icons、react-cytoscapejs、react-simple-maps

## 开发运行
1. Node.js 22（`.nvmrc` 可 `nvm use`）。
2. 安装依赖：`npm install`。
3. 启动开发：`npm run dev`（默认 3031）。

## 接口配置
- 后端地址通过环境变量 `NEXT_PUBLIC_PY_API` 配置，默认 `http://localhost:8031`。
- 统一配置文件：`src/config/api.ts`。
