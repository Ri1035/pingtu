# Changelog

本项目的所有重要变更都将记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- （待规划：自定义域名绑定、git push 自动触发 Cloudflare 部署等）

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
