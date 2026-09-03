# 拼图编辑器 / Merge Image Clone

一个 **100% 本地** 的在线图片合并 / 拼图 Web App，参考 [mergeimage.org](https://mergeimage.org/zh/editor) 实现。
支持 1 ~ 16 张图片的混合布局、多种比例 / 边距 / 间距 / 圆角 / 背景设置，
一键导出 PNG / JPEG / WebP。**图片全程在浏览器中处理，不会上传到任何服务器**。

## ✨ 还原的功能

| 模块 | 原站 | 本项目 |
| --- | --- | --- |
| 图片数量选择 | 1~16 | 1~16 |
| 布局预设 | 海量 | **145 套**（与官方一致的矩阵库，按张数 1~16 索引，全部经过矩形合并校验） |
| 画布比例 | 自动 / 1:1 / 3:4 / 9:16 / 4:3 / 16:9 | 同上 |
| 边距 / 间距 / 圆角 / 背景 | ✓ | ✓ |
| 无缝拼图（间距/留白全零，紧密拼接） | – | **✓**（v1.2.0 新建，与留白模式一键切换） |
| 拖拽排序 / 移动 | ✓ | ✓ |
| 单张构图：缩放 / 平移 / 旋转 / 镜像 | ✓ | ✓（含移动端捏合缩放） |
| 单图自由缩放滑块 + 适应框体/居中/还原 | – | **✓**（v1.2.0 新建，选中图片即出控制条） |
| 透明背景 | ✓ | ✓ |
| 悬浮工具条：替换 / 旋转 / 镜像 / 移除 | ✓ | ✓（额外含「填充/适应」切换） |
| 点击交换两张图 | ✓ | ✓ |
| 拖拽文件到画布 / 粘贴上传 | ✓ | ✓（v1.1.0：托盘区也支持拖拽批量） |
| 点击添加按钮 → 系统文件管理器多选批量 | ✓ | ✓ |
| 文字叠加图层（多图层） | – | **✓**（新建） |
| 字体选择（系统可用字体） | – | **✓**（新建，Canvas 探测） |
| 文字画布拖拽定位 / 选中 / 删除 | – | **✓**（新建） |
| 素材库（本地持久化，可反复使用） | – | **✓**（v1.1.0 新建，IndexedDB） |
| 素材修图（旋转/翻转/裁剪/文字/贴纸） | – | **✓**（v1.1.0 新建，保存为新素材） |
| 导出格式 PNG / JPEG / WebP | ✓ | ✓ |
| 导出分辨率：4K 自定义 | ✓ | ✓（1080 / 1600 / 2048 / 2560 / 3840 + 自定义） |
| 质量调节（JPEG/WebP） | ✓ | ✓ |
| URL 同步状态 `?count=2&layout=0` | ✓ | ✓ |
| 中英双语 | ✓ | ✓ |
| 本地持久化样式与导出设置 | ✓ | ✓（localStorage） |

## 🧱 选定的开源基础 / 参考项目

为避免「凭空乱造」，先调研了 4 个最接近的开源项目，最终选定 **esmcelroy/photo-grid-collage-maker** 作为主要架构参考，并融合其他几个项目的优点：

| 候选项目 | 技术栈 | 取舍 | 在本项目中的使用 |
| --- | --- | --- | --- |
| [**esmcelroy/photo-grid-collage-maker**](https://github.com/esmcelroy/photo-grid-collage-maker) | React 19 + TS + Vite + Tailwind + shadcn/ui + html2canvas | 99 套布局 / CSS Grid 缩略图预览 / 边距间距圆角 / PNG 导出 — 与原站「数量 + 布局 + 样式 + 导出」四维最贴合；但用 html2canvas 处理透明和 4K 有坑 | **主要参考**：状态模型、布局描述法、CSS Grid 缩略图、UI 交互 |
| [**FastMirror-MC/image-stitcher**](https://github.com/FastMirror-MC/image-stitcher) | React 19 + TS + Vite + Tailwind 4 + Radix + Zustand | 横向 / 纵向拼接、间距、边框、背景；不支持布局切换与画布比例 | 参考 UI 面板结构 |
| [**bjdekker/photo-collage**](https://github.com/bjdekker/photo-collage) | React + TS + Canvas 2D | 递归二分法自动布局、Canvas 导出 JPG/PNG/SVG；缺乏原站的「选数量 → 选布局」模式 | 参考 Canvas 导出管线 |
| [**liuxin2533/aspect-grid-collageify**](https://github.com/liuxin2533/aspect-grid-collageify) | TS 库 | 纯 Core + 编辑器分层、网格插入、跨格合并 | 参考「库 vs 编辑器」的分层思想 |

## 🛠 技术栈

- **Vite 5** + **React 18** + **TypeScript 5**
- **Canvas 2D** 渲染（预览和导出共用一套管线 → 真正的所见即所得）
- **CSS Grid** 渲染布局缩略图（与真实渲染共用同一份布局数据）
- **localStorage** 持久化样式与导出设置
- **IndexedDB** 持久化素材库（存储抽象层预留云端接口）
- 无任何后端，无任何第三方 UI 框架 → 产物仅 ~72KB gzip

## 🏗 代码结构

```
src/
├── App.tsx · main.tsx · i18n.ts · types.ts · index.css
├── hooks/useCollage.ts           # 拼图状态管理（图片顺序 = 唯一数据源）
├── hooks/useAssets.ts            # 素材库状态管理（列表 / 上传 / 编辑保存 / 删除）
├── lib/
│   ├── official-layouts.ts       # 官方布局矩阵库（145 套，数字矩阵格式）
│   ├── layouts.ts                # 矩阵 → GridLayout 转换器 + 校验器
│   ├── geometry.ts               # 网格求解器（CSS Grid → 像素矩形）
│   ├── render.ts                 # Canvas 2D 渲染引擎
│   ├── export.ts                 # 导出 PNG / JPEG / WebP
│   ├── image.ts                  # 文件解码 / 缩略图生成
│   ├── fonts.ts                  # 系统字体探测（Canvas 测量法）
│   ├── assetStore.ts             # 素材存储抽象层（IndexedDB 实现，预留云接口）
│   └── stickers.ts               # 内置 emoji 贴纸库（40 枚）
└── components/
    ├── TopBar.tsx
    ├── LayoutPanel.tsx           # 数量 / 布局选择
    ├── StylePanel.tsx            # 比例 / 边距 / 间距 / 圆角 / 背景
    ├── TextPanel.tsx             # 文字图层管理
    ├── ExportPanel.tsx           # 格式 / 质量 / 宽度
    ├── CollageStage.tsx          # 画布 + 悬浮工具条（延迟消失机制）
    ├── PhotoTray.tsx             # 底部托盘（可拖拽上传）
    ├── AssetPanel.tsx            # 素材库页签（网格 + 上传 / 编辑 / 加入拼图）
    ├── AssetEditor.tsx           # 素材修图编辑器（旋转 / 翻转 / 裁剪 / 文字 / 贴纸）
    └── ui/Controls.tsx           # Field / Slider / Segmented / Switch / NumberInput
```

每个文件都可以独立读懂；新增一个布局只需在 `layouts.ts` 加一行。

## 🚀 本地运行

```bash
npm install --registry=https://registry.npmmirror.com
npm run dev
# 打开 http://localhost:5173/?count=2&layout=0
```

构建与自检：

```bash
npm run typecheck       # tsc --noEmit
npm run build           # 类型检查 + 生产构建
npm run check:layouts   # 校验 99 套布局的数据完整性
npm run samples         # 生成测试用的样例图片
npm run smoke           # 端到端冒烟测试（需要先 npm run dev 或 npm run preview）
```

## 📝 维护者备忘

- 边距 / 间距 / 圆角统一以 `BASE_WIDTH = 1600px` 为基准等比缩放，因此「提高导出宽度不会改变画面观感」——这是 render.ts 里 `scale = width / BASE_WIDTH` 一行解决的。
- 状态模型刻意只用 `photos` 一个数组来表达「谁在哪里」，切换布局 / 改变数量时无需重新映射。
- 同一个 `solveLayout` 同时服务于：缩略图（CSS Grid）、预览命中测试、Canvas 渲染。三个地方看到的是同一个几何。
- 新增布局时跑一遍 `npm run check:layouts`，它会拒绝任何「同名格子不构成矩形」的脏数据。