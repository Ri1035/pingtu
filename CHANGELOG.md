# Changelog

本项目的所有重要变更都将记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- （待规划：自定义域名绑定、git push 自动触发 Cloudflare 部署等）

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
