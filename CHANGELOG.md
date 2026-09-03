# Changelog

本项目的所有重要变更都将记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- （新功能在此记录）

### Fixed
- （修复在此记录）

## [1.5.0] - 2026-09-03

### Added
- **素材（浮层）可加边框 + 更多边框样式**：此前浮层素材无法加边框，单格边框也只有实线一种样式。本次新增：
  - 浮层素材选中后，控制条出现「边框」按钮，弹出面板可调边框宽度（0~40px 设计像素）、颜色与样式，边框随浮层一起缩放 / 旋转。
  - 边框样式从「实线」扩充为 **实线 / 虚线 / 点线 / 双线** 四种，单格边框与浮层边框共用同一套渲染，方向（向内 / 居中 / 向外）对四种样式均生效。
- **自定义画布大小**：画布比例底部新增「自定义」选项，可直接输入像素宽 × 高（100~8000px），精确控制画布尺寸，替代上方的固定比例（预览与导出一致）。
- **单格框体大小调整 + 层级浮起**：悬停工具栏的放大（+）/ 缩小（−）按钮可独立调整单个格子的框体尺寸（0.3×~3×），**其他格子的位置与大小不受影响**；调整过大小的框体在渲染时**后绘制、浮于所有未调整的框体之上**（z-order 排序）。

### Changed
- `CanvasStyle` 新增 `customWidth` / `customHeight`；`CellBorder` 新增 `pattern` 字段；`AssetOverlay` 新增 `borderWidth` / `borderColor` / `borderPattern`；新增 `CellSizeScale` 类型与 `resolveCells` / `isCellResized` 几何工具。
- `render.ts` 重构边框绘制为 `strokeBorder`（原生 `setLineDash` 实现虚线 / 点线，双线用双描边），`computeRatio` 支持 `custom`，绘制顺序按「是否调整过大小」排序。
- 新增 i18n 文案（边框样式 / 自定义尺寸等）中英双语。
- 版本号从 `v1.4.0` 升级到 `v1.5.0`。

### Notes
- 边框样式优先调研了开源方案（Fabric.js `borderDashArray` 等均为重依赖），结论同前：完全复用原生 Canvas 2D 的 `setLineDash`（MDN 标准 API）即可实现虚线 / 点线，双线用两次描边实现，无需引入第三方库。
- npm run typecheck / build 通过（gzip ~82 KB）
- 现有拼图 / 文字 / 素材库 / 修图编辑器 / 导出功能无回归

## [1.4.0] - 2026-09-03

### Added
- **浮层素材可移动 / 可调整大小**：此前「添加为浮层」的素材叠加到画布后无法移动、也无法调整大小。本次新增：拖拽浮层直接移动位置（指针捕获 + 画布比例坐标换算，边界约束在画布内）；选中后底部出现浮层控制条，含大小（5%~800%）、旋转（-180°~180°）、不透明度（0~100%）三个滑条与删除按钮；鼠标悬停在浮层上滚动滚轮也可实时缩放。
- **文字图层更多样式**：在原有字号 / 颜色 / 粗斜 / 旋转基础上新增：行距（1.0×~2.5×）、字间距（-5~20px）、对齐（左 / 中 / 右）、下划线、描边（开关 + 宽度 1~20px + 颜色）、阴影（开关 + 模糊 + 水平 / 垂直偏移 + 颜色）、不透明度（0~100%）。渲染层 `drawText` 同步支持全部新属性（letterSpacing / lineHeight / underline / stroke / shadow / globalAlpha），预览与导出一致。

### Changed
- `TextItem` / `AssetOverlay` 类型扩展：`TextItem` 新增 lineHeight、letterSpacing、align、underline、strokeColor/strokeWidth、shadowColor/shadowBlur/shadowOffsetX/Y、opacity 字段；新增 `DEFAULT_TEXT` 统一默认值。
- 版本号从 `v1.3.0` 升级到 `v1.4.0`。

### Notes
- 完全复用现有 Canvas 2D 渲染管线，未引入第三方依赖（另调研了 Fabric.js / Konva.js，均为重依赖、需重写渲染核心，对此轻量本地工具不划算）。
- npm run typecheck / build 通过（gzip ~81 KB）
- 现有拼图 / 文字 / 素材库 / 修图编辑器 / 导出功能无回归

## [1.3.0] - 2026-09-03

### Fixed
- **悬停边框按钮点不到**：单格边框设置弹出框与工具栏分离，鼠标移动时会触发 pointerleave 导致工具栏消失。修复方案：将工具栏和边框弹出框放在同一个 `toolbar-group` 容器内，共享 pointerEnter/pointerLeave 事件，鼠标从工具栏移到弹出框不会丢失 hover 状态。
- **i18n 全覆盖**：修复 `StylePanel` 画布比例按钮硬编码中文标签、底部样式提示中文；`ExportPanel` 中"无损"、"PNG 为无损格式"、"导出后会显示实际文件大小" 3 处硬编码文本；`TextPanel` 中错误引用 `t('ratioAuto')` 作为字体通用标签（改为 `t('fontGeneric')`）。
- **无障碍补全**：为 `CollageStage` 悬浮工具条 12 个图标按钮、调整条 3 个按钮、空态大按钮添加 `aria-label`；为 `AssetEditor` 工具栏 5 个图标按钮、裁剪比例 5 个按钮、颜色预设 8 个按钮、删除图层按钮、贴纸单元格 40 个添加 `aria-label`；为边框方向 3 个按钮添加 `aria-label`。
- **React StrictMode 兼容**：`useCollage.ts` 中 `textSeed` 从模块级变量改为 `useRef`，避免严格模式下 `addText` 计数翻倍。
- **死代码清理**：移除 `geometry.ts` 中未使用的 `hitTest` 导出；移除 `layouts.ts` 中未使用的 `toGridTemplate` 导出、未使用的 `AREA_LETTERS` 常量；移除 `fonts.ts` 中未使用的 `isFontCacheReady` 导出；移除 `stickers.ts` 中未使用的 `stickerAt` 导出及未使用的 `StickerItem` 类型导入。

### Added
- **UI 设计系统 v2**：重构 `index.css`，建立完整的 Design Tokens 体系（色彩/圆角/阴影/动效变量），新增 `--ease-out`、`--radius-pill`、`--danger-soft`、`--warn`、`--warn-soft` 等 token，统一全组件样式基调。
- **四端响应式布局**：新增 4 个断点覆盖全设备：
  - `<=960px`：侧边栏收窄至 300px
  - `<=820px`：侧栏移至底部，画布上移，隐藏顶栏备注
  - `<=600px`：手机端专用——顶栏/侧栏/托盘尺寸缩小，按钮字号适配，布局网格缩列，滑条/弹窗紧凑化
  - `<=400px`：超小屏——布局缩至 2 列，素材单列，托盘图片更小
- **无障碍增强**：全局 `:focus-visible` 焦点环，按钮 `:active` 缩放反馈，`-webkit-backdrop-filter` 双写兼容 Safari。
- **Bug 修复**：
  - 格子放大按钮上限 3 倍（原无上限）
  - 裁剪模式按钮硬编码中文改为 i18n（`fitContain` / `fitCover`）
  - `AssetPanel` 中 `webkitdirectory` 改用类型断言而非 `as any`
  - `HANDOVER.md` 旧本机路径改为正确路径
  - i18n 中 `fitCover` / `fitContain` 中文/英文文案修正
- **网站图标（favicon）**：使用拼图四叶草图标 SVG 替换为新的风格图标，优先使用矢量 SVG 格式（`favicon.svg`），同时保留 `favicon.ico`（16/32/48）、`favicon-16x16.png`、`favicon-32x32.png`、`apple-touch-icon.png`（180×180）、`favicon-192x192.png`、`favicon-512x512.png` 多尺寸回退，适配浏览器标签栏 / 收藏夹 / 移动端首屏 / PWA。
- **素材库支持扫描本地文件夹**：素材库面板新增「扫描文件夹」按钮，调用浏览器文件系统 API 让用户选择本地图片文件夹，自动过滤并批量导入所有支持的图片格式（JPEG / PNG / GIF / WebP / BMP / SVG / TIFF / HEIC / AVIF 等），导入过程实时显示进度。刷新页面后需重新选择文件夹（浏览器权限限制，不作持久化）。
- **浮层素材（AssetOverlay）**：素材库新增「添加为浮层」按钮（✨图标），点击后素材以自由浮层的形式叠加在拼图画布之上，可透明、旋转、缩放（类似文字图层的图片版）。浮层位于所有格子内容和文字图层之上。
- **单格大小调整**：悬停工具栏新增放大（➕）和缩小（➖）按钮，可独立调整单个格子的大小而不影响其他格子（缩放倍率 0.3~3 倍）。
- **单格边框设置**：悬停工具栏新增边框按钮（⬜），点击后弹出边框设置面板，支持宽度（0~20px，滑块调节）、颜色（颜色选择器）、方向（向内 / 居中 / 向外）三种模式。边框样式随格子缩放同比例缩放。
- **一键清空素材库**：素材库面板新增清空按钮（红色 X 图标），点击后弹出确认对话框，确认后清空 IndexedDB 中所有素材数据并显示 toast 提示
- **顶部栏图标与网站 favicon 一致**：将 `TopBar` 中的品牌图标从 lucide-react 的 `Images` 替换为 `favicon.svg` 的拼图 SVG 图案
- **修改-部署-记录工作流程文档**：在 `HANDOVER.md` 第 6 节新增完整固定工作流程规范（按版本号推进），所有后续改动需先读取此文档
- **版本号显示**：在 `TopBar` 品牌名旁添加版本号标签（`v1.3.0`），用户界面可见
- **版本号统一管理**：`package.json` → `i18n.ts(appVersion)` → 界面显示，三处联动，发版时同步更新

### Changed
- 版本号从 `v1.2.0` 升级到 `v1.3.0`
- 工作流程改为按版本号推进：每次修改都归属到某个版本号，从 `package.json` 开始

### Notes
- npm run typecheck / build 通过
- 现有拼图 / 文字 / 素材库 / 修图编辑器 / 导出功能无回归

## [1.2.0] - 2026-09-03

### Added
- **「无缝拼图」模式**：在「样式」面板新增「无缝拼图」开关（与留白模式并列），开启后 `gap / margin / radius` 全部强制归零，图片紧密拼接不出现任何白色缝隙或留白。三个滑块在无缝开启时自动禁用并显示 0px，关闭无缝后立即恢复原值，与留白模式完全兼容互不污染。
- **单图自由缩放**：选中图片后格子底部出现调整控制条（含 110px 缩放滑块 + 实时百分比 + 适应框体/居中/还原按钮）。缩放范围：
  - **留白模式** 0.2× ~ 5×（可缩到比格子小、露出背景，实现"图片卡"效果）
  - **无缝模式** 1× ~ 5×（最低 cover 铺满，保证无缝不留白）
- **格内平移**：统一 offset 数学为 `cx = centerX + offsetX × (cell.w − dw)`，**同时支持「图大于格（裁切窗口平移）」与「图小于格（格内平移不越界）」**。拖拽图片移动始终受边界约束。
- **快捷操作**：调整控制条一键「适应框体」（fit cover / zoom=1 / offset 居中）、「居中」（offset=0）、「还原」（resetTransform）。已有「复位构图」悬浮工具条按钮继续保留。
- **滚轮 / 捏合缩放约束**动态化：无缝模式下不能缩小到 < 1（避免留白），普通模式保留 0.2 下限。

### Changed
- `PhotoTransform.zoom` 允许值从 `[1, 5]` 扩展为 `[0.2, 5]`，配合 `fit` 模式实现完整 cover/contain 自由调整。
- `drawPhoto` offset 公式统一（原"仅 overflow>0 裁切窗口平移"扩展为"任意尺寸在格内或裁切范围平移"），与 `computePanGeometry`（CollageStage 内部）保持同一数学模型。

### Notes
- 端到端测试：新增 `scripts/smoke-seamless.mjs`，用 CDP 真实采样 canvas 像素验证无缝开启后交界处不再为背景白，且单图缩放控制条 100%↔500% 拖动工作。已通过。`smoke-quick.mjs` 5 项核心功能回归全过。
- npm run typecheck / build 通过（gzip ~72 KB）
- 现有拼图 / 文字 / 素材库 / 修图编辑器 / 导出功能**无回归**

## [1.1.0] - 2026-09-03

### Fixed
- **悬停菜单失灵（核心交互 bug）**：图片上的悬浮工具条在鼠标移向按钮的过程中，因 `stage-inner.onPointerLeave` 立即清空 `hoverIndex` 导致工具条在鼠标到达前被卸载。修复方案为「延迟消失」机制：`pointerleave` 启动 300ms 定时器；工具条 `pointerenter` 取消定时器。同时将工具条定位由「浮出格子上方」改为「格子内顶部」，消除鼠标路径上的空隙。已通过 CDP 冒烟验证。

### Added
- **图片添加入口体系强化**：
  - 空态画布渲染「添加图片」大按钮，点击直达系统文件多选（代替原"先添加几张图片吧"纯提示）。
  - 底部 `PhotoTray` 新增文件拖拽批量上传（含蓝色高亮反馈），通过 `dataTransfer.types` 判断仅外部文件触发，不影响托盘内图片拖拽排序。
- **素材库模块（全新）**：
  - 第 5 个左侧页签「素材库」，素材以 2 列网格展示缩略图 + 尺寸 + 大小。
  - 持久化通过 IndexedDB 实现（`pingtu-assets` 数据库），符合「图片不上传」承诺。
  - **存储抽象层** `AssetBackend` 接口（`list / save / remove`）已预留云端扩展位 —— 日后接入云素材时只需新写 `CloudAssetBackend` 实现并替换 `getAssetBackend()` 返回，UI 零改动。
  - 素材卡操作：编辑 / 加入拼图 / 删除（带确认）。
  - 「加入拼图」一键把素材送入托盘参与拼图。
- **素材修图编辑器（全新，全屏覆盖层）**：
  - 旋转 90° / 水平垂直翻转（所见即所得，旋转按钮开关高亮）。
  - 裁剪：5 个比例预设（自由 / 1:1 / 4:3 / 3:4 / 16:9），按内容中心裁切。
  - **文字叠加**：可改字号 / 颜色 / 拖动定位 / 键盘删除；蓝色虚线选中框用 `measureText` 精确量取。
  - **emoji 贴纸叠加**：内置 40 枚贴纸库（6 列网格选择），可调大小 / 拖动定位。
  - **保存产物**：导出为 PNG 存入素材库（`origin: edited`），原素材保留；保存后底部 toast 提示。
  - 预览与导出共用 `drawEditScene` 渲染函数，保证所见即所得。

### Changed
- 工具条激活态：`.btn-icon.is-active` 蓝色软背景 + 边框（用于翻转开关 / 贴纸面板开关）。
- 顶部分割线 `.divider-v` 工具栏内的竖向分隔符。

### Notes
- 端到端测试：新增 `scripts/smoke-assets.mjs`（素材库专项 CDP 冒烟，覆盖上传 → 编辑 → 加文字 → 保存新素材 → 加入拼图 → 控制台无错）与 `scripts/smoke-quick.mjs`（5 项核心功能快速回归）。两者均通过。
- npm run typecheck / build 通过（gzip ~72 KB）；现有拼图 / 文字 / 导出功能无回归。

## [1.0.0] - 2026-09-03

### Added
- **首个可用版本**：复刻 [mergeimage.org](https://mergeimage.org/zh/editor) 的在线拼图 / 图片合并编辑器，100% 本地浏览器处理，图片不上传任何服务器。
- 图片数量 1~16 张选择；内置 **145 套官方布局矩阵库**（按张数索引、经矩形合并校验），并修复了官方数据中 count=10 的两处编号缺失 bug。
- 画布比例：自动 / 1:1 / 3:4 / 9:16 / 4:3 / 16:9。
- 样式调节：边距 / 间距 / 圆角 / 背景色 / 透明背景。
- 图片交互：拖拽排序与移动、点击交换两张图、单张缩放 / 平移 / 旋转 / 镜像、悬浮工具条（替换 / 旋转 / 镜像 / 移除 / 填充适应切换）。
- 文件导入：点击添加按钮调用系统文件管理器，支持一次多选批量添加；拖拽文件到画布、粘贴图片上传。
- **文字叠加功能**：多图层文字、可拖拽定位 / 选中 / 键盘删除；字号 / 颜色 / 粗体 / 斜体 / 旋转可调，支持多行文本。
- **系统字体选择**：Canvas 测量法探测本机已安装字体，下拉实时预览并应用。
- 导出：PNG / JPEG / WebP；分辨率 1080 / 1600 / 2048 / 2560 / 3840 + 自定义；JPEG/WebP 质量可调。
- 其他：URL 同步状态（`?count=2&layout=0`）、中英双语、localStorage 持久化样式与导出设置。
- 技术栈：Vite 5 + React 18 + TypeScript 5 + 原生 Canvas 2D，预览与导出共用一套渲染管线（所见即所得）。

### Changed
- 建立语义化版本管理；仓库规范整理（完善 .gitignore、清理本地产物与临时文件）。

### Notes
- 以 [esmcelroy/photo-grid-collage-maker](https://github.com/esmcelroy/photo-grid-collage-maker) 为主要架构参考，另调研并融合 3 个开源拼图项目的优点，详见 `README.md`。

[Unreleased]: https://github.com/Ri1035/pingtu/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/Ri1035/pingtu/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Ri1035/pingtu/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Ri1035/pingtu/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Ri1035/pingtu/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Ri1035/pingtu/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Ri1035/pingtu/releases/tag/v1.0.0
