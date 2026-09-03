# 项目交接文档 · pingtu（拼图编辑器）

> 本文件用于交接：接手者阅读后应能独立开发、验证、部署本项目。
> 项目线上：https://pingtu-ch8.pages.dev（Cloudflare Pages）

## 1. 一句话定位

复刻 [mergeimage.org](https://mergeimage.org/zh/editor) 的**纯本地**在线拼图/图片合并编辑器：
图片全程在浏览器处理、不上传任何服务器；无后端、无第三方 UI 框架。

## 2. 关键地址与账号

| 项 | 值 |
| --- | --- |
| 本地源码 | `/data/user/work/pingtu` |
| GitHub 仓库 | https://github.com/Ri1035/pingtu （分支 `main`，公开） |
| 线上站点 | https://pingtu-ch8.pages.dev |
| Cloudflare | 项目名 `pingtu`，账号 Koka2996978242@outlook.com，account id `f1b789793774805c136bd7dfc86febd4` |
| 当前版本 | **v1.6.0**（package.json `"version": "1.6.0"`，tag `v1.6.0`） |

GitHub / Cloudflare 的 token **不存在仓库中**（均在 .gitignore 的 `.env*` 保护之外另行保管），
部署时通过环境变量 `CLOUDFLARE_API_TOKEN` 注入。

## 3. 技术栈与核心架构

- **Vite 5 + React 18 + TypeScript 5 + 原生 Canvas 2D**，产物 gzip ≈ 72 KB
- **核心不可违反的约定：**
  1. `photos` 数组顺序 = 画面排布顺序（`src/hooks/useCollage.ts`），单一数据源，无第二份映射
  2. 预览与导出共用同一渲染函数 `drawCollage`（`src/lib/render.ts`），天然所见即所得
  3. 布局数据用「数字矩阵」描述（`src/lib/official-layouts.ts`，145 套），经 `layouts.ts` 转
     GridLayout，由 `geometry.ts` 解成像素矩形；缩略图 / 命中测试 / Canvas 渲染三者共用同一套几何

### 源码地图

```
src/
├── App.tsx · main.tsx · i18n.ts · types.ts · index.css
├── hooks/useCollage.ts        # 拼图状态（photos/texts/style/exportOptions/transforms）
├── hooks/useAssets.ts         # 素材库状态
├── lib/
│   ├── official-layouts.ts    # 官方布局矩阵（145 套，权威数据源）
│   ├── layouts.ts             # 矩阵 → GridLayout 转换 + 校验
│   ├── geometry.ts            # 网格求解（solveLayout/hitTest/toCssGrid）
│   ├── render.ts              # Canvas 渲染引擎（BASE_WIDTH=1600 设计基准）
│   │                          #   · effectiveStyle() 无缝模式强制 0 间距
│   │                          #   · drawPhoto 统一平移数学 cx = centerX + offsetX×(cell.w−dw)
│   ├── export.ts              # 导出 PNG/JPEG/WebP（复用 drawCollage）
│   ├── image.ts               # 文件解码/缩略图
│   ├── fonts.ts               # 系统字体探测（Canvas 测量）+ Local Font Access API 读取本机字体
│   ├── watermark.ts           # 水印配置与内置模板（平铺/居中/角标文字、平铺/居中图片）
│   ├── assetStore.ts          # 素材存储抽象层（IndexedDB，预留云后端）
│   └── stickers.ts            # 内置 emoji 贴纸库
└── components/
    ├── CollageStage.tsx       # 画布：hover 工具条（延迟消失）/ 选中控制条 / 缩放平移 / 文字拖拽
    ├── LayoutPanel / StylePanel / TextPanel / ExportPanel / PhotoTray / AssetPanel / AssetEditor / TopBar
    ├── WatermarkPanel.tsx     # 水印面板（类型 / 排布 / 模板 / 微调）
    ├── AboutModal.tsx         # 开发者信息弹窗（#about 分享链接）
    └── ui/Controls.tsx        # Field/Slider/Segmented/Switch/NumberInput
```

## 4. 已实现功能（截至 v1.6.0）

- **基础**：1~16 张图、145 布局、画布比例、边距/间距/圆角/背景/透明、URL 同步 `?count=2&layout=0`、中英双语、localStorage 持久化
- **读取本机字体（v1.6.0）**：文字面板可「读取本机字体」——优先 Local Font Access API 枚举本机全部字体，不支持时回退 Canvas 测量探测
- **水印（v1.6.0）**：拼图最上层叠加水印（预览/导出一致），文字/图片两种类型、平铺/单个两种排布，5 套内置模板 + 旋转/不透明度/间距等微调
- **开发者信息页（v1.6.0）**：顶栏「关于」弹窗（开发者/联系方式/技术栈/协议），可复制带 `#about` 锚点的分享链接，打开链接自动唤起该页
- **图片**：点击多选批量、拖拽/粘贴上传（画布 + 托盘）、拖拽排序/点击交换、单张旋转/镜像/填充切换
- **文字**：多图层文字叠加、系统字体选择、字号/颜色/粗斜/旋转、行距/字间距/对齐/下划线/描边/阴影/不透明度、画布拖拽/选中/删除
- **浮层素材（v1.3.0 + v1.4.0 + v1.5.0）**：素材库「添加为浮层」叠加到拼图上；拖拽移动 + 大小(5%~800%)/旋转/不透明度滑条 + 滚轮缩放；v1.5.0 起支持给浮层加边框（宽度/颜色/实线·虚线·点线·双线）
- **边框样式（v1.5.0）**：单格与浮层边框支持实线 / 虚线 / 点线 / 双线四种样式，方向（向内 / 居中 / 向外）均生效
- **自定义画布大小（v1.5.0）**：画布比例「自定义」选项，直接输入像素宽 × 高（100~8000px）
- **单格框体调整（v1.5.0）**：单格框体可独立缩放（0.3×~3×），不影响其他格子；调整过的框体渲染时浮于未调整框体之上
- **无缝拼图（v1.2.0）**：`style.seamless` 开关 → 渲染层强制 gap/margin/radius=0，图片紧密无缝隙；关闭即恢复原留白值
- **单图自由调整（v1.2.0）**：选中图后底部控制条（缩放滑块 + 适应框体/居中/还原）；缩放范围无缝 [1,5] / 留白 [0.2,5]；图可小于格并在格内平移
- **素材库 + 修图（v1.1.0）**：IndexedDB 持久化素材，修图编辑器支持旋转/翻转/比例裁剪/文字/emoji 贴纸，保存为新素材

## 5. 常用命令

```bash
npm install --registry=https://registry.npmmirror.com   # 安装
npm run dev                                              # 开发 http://localhost:5173/?count=2&layout=0
npm run typecheck                                        # tsc --noEmit
npm run build                                            # typecheck + 生产构建（输出 dist/）
npm run check:layouts                                    # 校验布局矩阵合法性
node scripts/make-samples.mjs                            # 生成冒烟样例图
node scripts/smoke.mjs            # 主流程冒烟（需先起 dev/preview 在 4173）
node scripts/smoke-text.mjs       # 文字功能冒烟
node scripts/smoke-assets.mjs     # 素材库冒烟（连 5173）
node scripts/smoke-seamless.mjs   # 无缝模式冒烟（连 5173，像素级验证）
node scripts/smoke-quick.mjs      # 5 大页签快速回归（连 4173）
```

冒烟脚本用 CDP 驱动 headless Chrome，**需本地先起 server**：
`npx vite --port 5173 --host 127.0.0.1` 或 `npx vite preview --port 4173 --host 127.0.0.1`。
若脚本内 `rmSync(.smoke*)` 被环境拦截，先手动 `rm -rf .smoke*`。

## 6. 固定工作流程：修改-部署-记录（**每次必遵守，按版本号推进**）

> **核心原则**：每次修改都要归属到某个版本号，从 `package.json` 的版本号开始，按版本号推进、提交、记录、部署。

### 6.1 修改前（必做）

1. 读取本文档 `HANDOVER.md` 和 `CHANGELOG.md`，了解当前版本状态和约定规范
2. 确认当前版本号：`cat package.json | grep version` → 比如当前是 `1.3.0`
3. `git status -sb` 确认工作区干净，如有未提交改动先处理，明确回退锚点
4. 记录当前 HEAD：`git rev-parse HEAD` → 可写在临时备忘，错了方便回退

### 6.2 开发修改中

1. 按需求改代码，遵循既有代码风格和架构约定（见第 3 节）
2. 本地验证：
   - `npm run typecheck` → 类型检查通过才能继续
   - `npm run build` → 生产构建成功
   - 功能冒烟：相关 smoke 脚本跑一遍（比如素材库改动跑 `smoke-assets.mjs`）
3. 每完成一个独立功能/修复做一次 commit，**不要把多个不同改动堆在一起**

### 6.3 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[scope]: <description>

- 改动 1 要点
- 改动 2 要点
```

常用 type：
- `feat`: 新增功能
- `fix`: 修复 bug
- `refactor`: 重构（不新增不修复）
- `docs`: 文档/注释
- `style`: 格式/缩进等不影响运行的改动
- `chore`: 构建/脚本/依赖

### 6.4 版本号推进与记录

1. **版本号规则**（语义化版本）：
   - `package.json` 中的 `version` 字段是唯一版本号来源
   - `src/i18n.ts` 中的 `appVersion` 与 `package.json` 保持一致
   - 界面右上角品牌名旁显示当前版本号，用户可见
   - 主版本.次版本.修订（例：`1.3.0`）
   - 重要功能新增 → 加 **次版本**（如 `1.3.0` → `1.4.0`）
   - 小修小补 → 加 **修订号**（如 `1.3.0` → `1.3.1`）

2. **每次改动都要记入 `CHANGELOG.md`**：
   - 在 `Unreleased` 段添加本次改动记录
   - 改什么、为什么改、怎么改，写清楚
   - 发版时把 `Unreleased` 归档到新版本号下

3. **发版时同步更新三处**：
   - `package.json` 中的 `version`
   - `src/i18n.ts` 中的 `appVersion`
   - `CHANGELOG.md` 归档

### 6.5 部署

1. 提交完成后，推送 `git push origin main`
2. 项目绑定 Cloudflare Pages，**推送 main 自动触发构建部署**，等待几分钟即可
3. 部署完成后，线上地址 https://pingtu-ch8.pages.dev 验证功能
4. 部署成功后打 tag：`git tag -a v1.3.0 -m "v1.3.0: 功能名称"` → `git push origin main --tags`

### 6.6 备份

- GitHub 仓库本身就是备份，无需额外操作
- 每次发布后保留 tag，方便回滚到任意版本
- tag 列表：`git tag -l`

### 既有 tag

| Tag | 指向 | 内容 |
| --- | --- | --- |
| v1.0.0 | 2734ef8 | 首发：布局/文字/字体/导出 |
| v1.1.0 | 3861c47 | hover 修复 + 入口强化 + 素材库 + 修图编辑器 |
| v1.2.0 | d28a6c8 | 无缝拼图 + 单图自由调整 |
| v1.3.0 | 4056863 | hover 边框修复 + UI 设计系统 v2 + 浮层素材/单格调整 + 清空素材库 + 版本号工作流 |
| v1.4.0 | 37f15e7 | 浮层素材可移动/缩放 + 文字更多样式（行距/字距/对齐/下划线/描边/阴影/透明度） |
| v1.5.0 | 5024e4a | 浮层素材加边框 + 边框样式(实线/虚线/点线/双线) + 自定义画布大小 + 单格框体调整与层级浮起 |

## 7. 部署到 Cloudflare Pages

### 自动部署（当前方式，推荐）

项目已绑定 GitHub 仓库 `Ri1035/pingtu`（分支 `main`），**推送代码到 main 分支会自动触发 Cloudflare Pages 构建与发布**，无需手动操作。

```bash
# 正常开发流程
git add -A && git commit -m "feat: ..."  # 或 fix: / docs: 等
git push origin main                       # 推送即自动部署
```

部署进度可在 Cloudflare 控制台 → Workers & Pages → pingtu → Deployments 查看，或通过 API 查询：

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/f1b789793774805c136bd7dfc86febd4/pages/projects/pingtu/deployments | \
  python3 -c "import sys,json; [print(x['short_id'], x['deployment_trigger']['type'], x['latest_stage']['status'], x['created_on'][:19]) for x in json.load(sys.stdin)['result']]"
```

### 手动部署（紧急/备选）

```bash
npm run build   # 先构建 dist/
CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy dist --project-name=pingtu --commit-dirty=true
```

- wrangler 经代理偶发超时/`fetch failed`：**curl 先探活 `api.cloudflare.com`，能通则重试部署即可成功**
- 部署后验证线上 hash：`curl -s https://pingtu-ch8.pages.dev/ | grep -oE 'index-[A-Za-z0-9_-]+\.(js|css)'` 应与 `dist/assets/` 一致

## 8. 本机网络/环境备忘（Windows）

- GitHub/Cloudflare 网络不稳定时：本机 git 已 `http.sslVerify false`；
  curl 加 `--ssl-no-revoke`（schannel 吊销检查问题）
- 代理：Steam++ 默认 `127.0.0.1:54291`，可能失效（502/000）→ **先测直连，能通则不走代理**
- npm 镜像 `registry.npmmirror.com`；干净测试端口 4788
- PortableGit 1.2.0 偶尔不落盘 remote tracking ref（`[gone]`）→ 手动写
  `.git/refs/remotes/origin/main` 再 `git branch --set-upstream-to=origin/main main`

## 9. 已知边界与后续候选

- 无缝模式下 zoom 不允许 <1（保证无空白），如需「缩小留背景」请关闭无缝
- 素材库首版用 IndexedDB；`assetStore.ts` 的 `AssetBackend` 接口已预留云后端替换位
- 候选迭代：素材库分类/搜索、贴纸扩充、自定义裁剪自由拖框、自定义域名、git push 自动部署
