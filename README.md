# 前端（GP_front_end_ts）

## 项目说明
本项目为知识图谱电商场景的前端界面，基于 Next.js（App Router）+ TailwindCSS，提供任务录入、结果查看、图谱可视化与 Agent 对话的运营台。

## 当前已实现功能
- 首页概览与导航入口
- `/task`：批量提交站点任务，查看 crawl/preprocess/graph 队列状态，支持清空队列
- `/result`：分页列表，多选 Crawl 入队、多选图谱生成，支持详情弹窗
- `/result/detail` 与 `/result/detail/graph`：结果详情与图谱可视化
- `/products`：仅展示 `graph_json` 不为空的任务，并可内嵌图谱
- `/graph`：地图点位分布（读取 `/api/graph_locate`）
- `/agent`：SSE 实时对话，历史会话选择与续聊
- `/chat`：静态演示页（未接后端）

## 技术栈
- Next.js（App Router）、React、TypeScript
- TailwindCSS、react-icons、react-cytoscapejs、react-simple-maps

## 开发运行
1. Node.js 22（`.nvmrc` 可 `nvm use`）。
2. 安装依赖：`npm install`。
3. 启动开发：`npm run dev`（默认 3000）。

## 接口配置
- 后端地址通过环境变量 `NEXT_PUBLIC_PY_API` 配置，默认 `http://localhost:8000`。
- 统一配置文件：`src/config/api.ts`。
