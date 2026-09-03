/**
 * 全局类型定义
 *
 * 设计要点：
 * - `GridLayout` 与参考项目 esmcelroy/photo-grid-collage-maker 保持同构
 *   （CSS Grid 的 grid-template + grid-template-areas 描述法），
 *   好处是「缩略图预览」可直接用浏览器原生 CSS Grid 渲染，
 *   与真实渲染结果天然一致，且新增布局只需加一行数据。
 * - 变换（缩放/平移/旋转/镜像）挂在「图片」上而不是「格子」上，
 *   这样图片在格子间移动时，用户调好的构图不会丢。
 */

/** 一张已导入的图片 */
export interface PhotoItem {
  id: string
  /** 文件名，用于提示 */
  name: string
  /** 解码后的位图，导出时用（保留原始分辨率） */
  source: CanvasImageSource
  /** 原始像素宽高 */
  width: number
  height: number
  /** objectURL，删除图片时用于释放内存 */
  url: string
  /** 托盘用的小图 dataURL，避免长时间持有大图解码结果 */
  thumb: string
  /** 文件大小（字节），用于展示 */
  size: number
}

/** 单张图片的取景 / 变换参数 */
export interface PhotoTransform {
  /** 缩放，1 = 铺满格子（cover），> 1 为放大裁切 */
  zoom: number
  /** 平移，相对「可移动范围」的比例，取值 -0.5 ~ 0.5，0 为居中 */
  offsetX: number
  offsetY: number
  /** 旋转角度，仅支持 0 / 90 / 180 / 270 */
  rotation: number
  /** 填充模式：cover 铺满裁切；contain 完整显示（留白由背景填补） */
  fit: 'cover' | 'contain'
  flipH: boolean
  flipV: boolean
}

/**
 * 一条叠加在画布上的文字图层。
 * 与图片格子无关，作为自由浮层渲染在整张拼图之上。
 */
export interface TextItem {
  id: string
  /** 文字内容 */
  content: string
  /** 字体族名（来自系统可用字体） */
  fontFamily: string
  /** 字号（设计像素，以 BASE_WIDTH 为基准等比缩放） */
  fontSize: number
  /** 文字颜色 */
  color: string
  /** 是否粗体 */
  bold: boolean
  /** 是否斜体 */
  italic: boolean
  /** 旋转角度（度） */
  rotation: number
  /** 行高倍率（相对字号，默认 1.25） */
  lineHeight: number
  /** 字间距（设计像素，默认 0，可为负） */
  letterSpacing: number
  /** 对齐方式（相对文字块中心） */
  align: 'left' | 'center' | 'right'
  /** 下划线 */
  underline: boolean
  /** 描边颜色（strokeWidth 为 0 时不描边） */
  strokeColor: string
  /** 描边宽度（设计像素，0 = 关闭描边） */
  strokeWidth: number
  /** 阴影颜色 */
  shadowColor: string
  /** 阴影模糊半径（0 = 关闭阴影） */
  shadowBlur: number
  /** 阴影水平偏移（设计像素） */
  shadowOffsetX: number
  /** 阴影垂直偏移（设计像素） */
  shadowOffsetY: number
  /** 不透明度 0~1（默认 1） */
  opacity: number
  /** 水平位置，相对画布宽度的比例 0~1（0=左，1=右，0.5=居中） */
  x: number
  /** 垂直位置，相对画布高度的比例 0~1 */
  y: number
}

/** 画布样式 */
export interface CanvasStyle {
  /** 画布比例，'auto' / 'w/h' / 'custom'，例如 '16/9' */
  ratio: string
  /** 自定义画布宽度（ratio === 'custom' 时生效，像素） */
  customWidth: number
  /** 自定义画布高度（ratio === 'custom' 时生效，像素） */
  customHeight: number
  /** 外边距（设计像素，基准宽度 BASE_WIDTH） */
  margin: number
  /** 图片间距（设计像素） */
  gap: number
  /** 图片圆角（设计像素） */
  radius: number
  /** 背景色 */
  background: string
  /** 是否透明背景（导出 PNG/WebP 时有效） */
  transparent: boolean
  /**
   * 无缝拼图模式：图片间及边缘的间距/留白/圆角全部归零，
   * 图片紧密拼接不出现缝隙。渲染时强制 margin/gap/radius = 0
   * （不覆盖用户存的间距值，关闭后恢复原设置）。
   */
  seamless: boolean
}

/** 导出设置 */
export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp'
  /** 0.5 ~ 1.0，仅 jpeg / webp 生效 */
  quality: number
  /** 导出宽度（px） */
  width: number
}

export type ExportFormat = ExportOptions['format']

/** 网格布局模板 */
export interface GridLayout {
  id: string
  name: string
  /** 该布局能容纳的图片数量 */
  photoCount: number
  /** CSS grid-template 简写：'1fr 1fr / 1fr'，斜杠前为列、后为行 */
  gridTemplate: string
  /** 网格区域，每行一个字符串，空格分隔；相同字母表示合并单元格 */
  areas: string[]
  /** 建议的画布比例 'w/h'，作为「自动」之外的兜底 */
  suggestRatio: string
}

/** 求解后的单元格矩形 */
export interface CellRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 素材库中的一条素材（Asset）。
 * 与拼图里的 PhotoItem 不同：素材是**持久化**资源，
 * 存储在本机 IndexedDB（未来可切换云端后端），可反复加入拼图。
 */
export interface AssetItem {
  id: string
  /** 素材名（上传时的文件名，或修图产物自动命名） */
  name: string
  /** 原始文件的 Blob，用于导出 / 再次编辑 */
  blob: Blob
  /** 预览小图 dataURL（网格缩略图用） */
  thumb: string
  /** 原始像素宽高 */
  width: number
  height: number
  /** 字节数 */
  size: number
  /** 创建时间戳（ms） */
  createdAt: number
  /** 来源标记：'upload' 用户上传 / 'edited' 修图产物 */
  origin: 'upload' | 'edited'
}

/**
 * 贴纸库中的一枚贴纸。
 * 首版内置一组 emoji / 简单图形，用户可缩放旋转叠加到素材上。
 */
export interface StickerItem {
  id: string
  /** 贴纸内容：emoji 字符或内置 SVG 的关键字 */
  glyph: string
  /** 是否为 emoji（决定字体渲染方式） */
  isEmoji: boolean
}

/** 边框样式：实线 / 虚线 / 点线 / 双线 */
export type BorderPattern = 'solid' | 'dashed' | 'dotted' | 'double'

/**
 * 单个格子的边框设置。
 */
export interface CellBorder {
  /** 边框宽度（设计像素，以 BASE_WIDTH 为基准） */
  width: number
  /** 边框颜色 */
  color: string
  /** 边框方向：向内 / 向外 / 居中 */
  direction: 'inward' | 'outward' | 'center'
  /** 边框样式 */
  pattern: BorderPattern
}

/**
 * 单个格子的大小缩放倍率（1 = 原始大小）。
 */
export interface CellSizeScale {
  w: number
  h: number
}

/**
 * 浮在拼图画布之上的素材图层。
 * 与 TextItem 类似，但显示的是图片而非文字。
 */
export interface AssetOverlay {
  id: string
  /** 素材缩略图 dataURL */
  thumb: string
  /** 原始像素宽高 */
  width: number
  height: number
  /** 水平位置，相对画布宽度的比例 0~1 */
  x: number
  /** 垂直位置，相对画布高度的比例 0~1 */
  y: number
  /** 缩放倍率 */
  scale: number
  /** 旋转角度（度） */
  rotation: number
  /** 不透明度 0~1 */
  opacity: number
  /** 边框宽度（设计像素，0 = 无边框） */
  borderWidth: number
  /** 边框颜色 */
  borderColor: string
  /** 边框样式 */
  borderPattern: BorderPattern
  /** 图片的 HTMLImageElement，用于绘制 */
  source: HTMLImageElement
  /** 原始文件名 */
  name: string
}

/** 水印内容类型：文字 / 图片 */
export type WatermarkType = 'text' | 'image'

/** 水印排布方式：平铺铺满 / 单个放置 */
export type WatermarkMode = 'tile' | 'single'

/**
 * 水印配置：叠加在整张拼图最上层的版权 / 标识。
 * 文字与图片共用一套开关，按 type 走不同渲染分支。
 */
export interface WatermarkConfig {
  /** 是否启用水印 */
  enabled: boolean
  /** 水印内容类型 */
  type: WatermarkType
  /** 排布方式 */
  mode: WatermarkMode
  /** 文字水印的文字内容 */
  text: string
  /** 文字水印字体 */
  fontFamily: string
  /** 文字水印字号（设计像素，以 BASE_WIDTH 为基准） */
  fontSize: number
  /** 文字颜色 */
  color: string
  /** 不透明度 0~1 */
  opacity: number
  /** 旋转角度（度） */
  rotation: number
  /** 平铺时相邻标记的额外间距（设计像素，相对文字字号 / 图片尺寸） */
  spacing: number
  /** 单个模式：水平位置 0~1（0 左，1 右） */
  x: number
  /** 单个模式：垂直位置 0~1（0 上，1 下） */
  y: number
  /** 图片水印：宽度占画布宽度的比例 0~1 */
  imageScale: number
}
