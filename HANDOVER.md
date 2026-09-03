# 项目交接文档 · pingtu（拼图编辑器）

> 本文件用于交接：接手者阅读后应能独立开发、验证、部署本项目。
> 项目线上：https://pingtu-ch8.pages.dev（Cloudflare Pages）

## 1. 一句话定位

复刻 [mergeimage.org](https://mergeimage.org/zh/editor) 的**纯本地**在线拼图/图片合并编辑器：
图片全程在浏览器处理、不上传任何服务器；无后端、无第三方 UI 框架。

## 2. 关键地址与账号

| 项 | 值 |
| --- | --- |
| 本地源码 | `C:\Users\KOKA\Desktop\拼图\merge-image` |
| GitHub 仓库 | https://github.com/Ri1035/pingtu （分支 `main`，公开） |
| 线上站点 | https://pingtu-ch8.pages.dev |
| Cloudflare | 项目名 `pingtu`，账号 Koka2996978242@outlook.com，account id `f1b789793774805c136bd7dfc86febd4` |
| 当前版本 | **v1.2.0**（package.json `"version": "1.2.0"`，tag `v1.2.0`） |

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
│   ├── fonts.ts               # 系统字体探测（Canvas 测量）
│   ├── assetStore.ts          # 素材存储抽象层（IndexedDB，预留云后端）
│   └── stickers.ts            # 内置 emoji 贴纸库
└── components/
    ├── CollageStage.tsx       # 画布：hover 工具条（延迟消失）/ 选中控制条 / 缩放平移 / 文字拖拽
    ├── LayoutPanel / StylePanel / TextPanel / ExportPanel / PhotoTray / AssetPanel / AssetEditor / TopBar
    └── ui/Controls.tsx        # Field/Slider/Segmented/Switch/NumberInput
```

## 4. 已实现功能（截至 v1.2.0）

- **基础**：1~16 张图、145 布局、画布比例、边距/间距/圆角/背景/透明、URL 同步 `?count=2&layout=0`、中英双语、localStorage 持久化
- **图片**：点击多选批量、拖拽/粘贴上传（画布 + 托盘）、拖拽排序/点击交换、单张旋转/镜像/填充切换
- **文字**：多图层文字叠加、系统字体选择、字号/颜色/粗斜/旋转、画布拖拽/选中/删除
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

## 6. 版本发布流程（务必遵守）

1. 改动前：`git status -sb` 确认干净，明确回退锚点（当前 commit/tag）
2. 改代码 → 本地验证（typecheck/build/相关 smoke）→ **分门别类提交**（feat:/fix:/docs:）
3. 发版时：更新 `CHANGELOG.md`（Keep a Changelog）+ `package.json` 版本号
   → `git tag -a vX.Y.Z -m "..."` → 推送 `git push origin main --tags`
4. **CHANGELOG 中「Unreleased」段随时记录，发版时归档**；本次迭代历史见 git log

### 既有 tag

| Tag | 指向 | 内容 |
| --- | --- | --- |
| v1.0.0 | 2734ef8 | 首发：布局/文字/字体/导出 |
| v1.1.0 | 3861c47 | hover 修复 + 入口强化 + 素材库 + 修图编辑器 |
| v1.2.0 | d28a6c8 | 无缝拼图 + 单图自由调整 |

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
