# CopyPilot

CopyPilot 是一个复刻 AnyToCopy 产品方向的工具站 MVP：短视频/图文链接提取、结果整理、AI 改写、任务历史和商业化页面结构。

## 技术栈

- 前端：Vue 3 + Vite + CSS
- 后端：Cloudflare Pages Functions
- 部署：Cloudflare Pages
- 第三方解析：TikHub API

## 本地开发

```bash
npm install
npm run dev
```

Vite 本地开发只跑前端。如果要测试 Cloudflare Functions：

```bash
npm run build
npx wrangler pages dev dist
```

## 密钥配置

不要把 TikHub API Key 写进前端代码。Cloudflare Pages 中配置环境变量：

- `TIKHUB_API_KEY`
- `TIKHUB_BASE_URL`，默认 `https://api.tikhub.io`
- `ACCESS_PASSWORD`（可选）：设置后所有页面和 API 都需要先输入访问密码，Cookie 30 天有效。适合内部使用或防止链接被转发滥用。
- `SESSION_SECRET`（可选）：用于签名访问密码 Cookie，生产环境建议设置一个长随机字符串。

本地测试 Functions 时可以用 Wrangler 的环境变量能力或 `.dev.vars`。`.dev.vars` 不应提交到仓库：

```bash
TIKHUB_API_KEY=your-key
TIKHUB_BASE_URL=https://api.tikhub.io
ACCESS_PASSWORD=your-internal-password
SESSION_SECRET=a-long-random-string
```

## 部署到 Cloudflare Pages

1. 创建 Cloudflare Pages 项目。
2. 连接 Git 仓库或直接上传。
3. Build command: `npm run build`
4. Build output directory: `dist`
5. 在 Settings -> Environment variables 添加 `TIKHUB_API_KEY`。
6. （可选）如需访问密码保护，添加 `ACCESS_PASSWORD`；建议同时设置 `SESSION_SECRET` 用于安全签名 Cookie。
7. 部署后绑定你购买的域名。

## 后续要补的正式版能力

- 登录/注册/验证码
- 会员配额和支付
- 批量任务队列
- R2 文件上传和大文件转写
- D1/PostgreSQL 任务历史
- API Key 管理与开发者文档
- 平台接口路径按 TikHub 控制台逐个校准，当前已预置抖音、TikTok、小红书常见分享链接解析接口

## 域名建议

我建议先用 `CopyPilot` 作为品牌名。可优先看：

- `copypilot.app`
- `copypilot.tools`
- `copypilot.cc`
- `copypilot.ai`
- `copy-pilot.com`
