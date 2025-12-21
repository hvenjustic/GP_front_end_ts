# 知识图谱电商系统（毕业设计）

一个基于知识图谱的电商平台，实现基础购物流程，并加入智能 Agent 的商品运营与对话式咨询体验。

## 项目简介
- 电商功能：商品浏览、搜索、购物车、下单等核心流程。
- 知识图谱：以商品属性、品牌、品类等实体关系为底层数据结构，支持智能关联推荐。
- 管理员 Agent：自动管理商品信息、自动上架和库存维护，减少人工运营成本。
- 用户对话：内置聊天入口，用户可直接咨询商品，获取推荐或库存、价格答复。

## 技术栈
- 前端：Next.js（App Router）+ TailwindCSS v4。
- 语言与工具：TypeScript、ESLint、PostCSS。

## 开发运行
1. 确认 Node.js 版本为 22（`.nvmrc` 已提供，可执行 `nvm use`）。
2. 安装依赖：`npm install`。
3. 启动开发：`npm run dev`，默认端口 3000。

## 爬虫任务与结果页
- 任务页：`/task`（提交任务、查看队列剩余）
- 结果页：`/result`（分页列表 + 点击查看详情）
- 后端地址通过环境变量配置：`NEXT_PUBLIC_GO_API`（默认 `http://10.138.19.107:4010`）

## 目录提示
- `src/app/page.tsx`：主页与主要界面逻辑。
- `src/components`：复用组件与导航配置。
- `public/`：静态资源（如品牌图标）。

## 后续规划
- 完善知识图谱构建与可视化。
- 增强 Agent 策略（动态调价、异常库存预警）。
- 丰富用户对话意图识别与推荐精度。

## TODO · 接口对接（待接入 LangChain/后端）
- Agent 页面 · 运营总览：`GET /api/agent/stats` 返回待补货、价格异常、图谱同步时间、对话排队数。
- Agent 页面 · 自动化编排：`GET /api/agent/automations` 返回自动化流（库存巡检、调价、客服对话等）含步骤和状态。
- Agent 页面 · 审核队列：`GET /api/agent/queue` 列出补货/调价/上架草案；`POST /api/agent/queue/:id/approve` 执行并写入审计。
- Agent 页面 · 图谱信号：`GET /api/graph/signals` 提供节点、关系链、洞察文案，用于卡片展示。
- Agent 页面 · 对话示例接入：`POST /api/chat/agent` 输入用户问题，返回回复、引用与推荐商品（LangChain 入口）。
- Agent 页面 · 动作执行：`POST /api/agent/actions/replenish|price|publish` 接收结构化 payload，返回 `{ status, auditId }`。

## TODO · 产品接口（商品页待对接）
- 列表与检索：`GET /api/products?search=&category=&tags=&inStock=&sort=rating|price_asc|price_desc&page=` 返回分页商品列表、评分、库存、标签。
- 商品详情：`GET /api/products/:id` 返回主信息、图文描述、参数规格、库存、促销信息。
- 分类与标签：`GET /api/products/meta` 返回可选分类、标签、价格区间等筛选维度。
- 推荐与运营位：`GET /api/products/recommendations?scene=list|detail` 返回推荐 SKU（可由 Agent/图谱驱动）。
