import type { ExportFormat, PhotoItem, TextItem, WatermarkConfig } from '../types'
import { drawText, drawWatermark } from './render'

export const LONG_FORMAT_MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * 长拼图渲染引擎（电商详情页 / 公众号长图）
 * ------------------------------------------------------------------
 * 与主拼图不同的定位：
 *  - 固定画布宽度，图片按上传顺序**纵向堆叠**成一张超长图
 *  - 相邻图片之间可开启「模糊边缘」：重叠一段 `feather` 高，
 *    用纵向 alpha 渐变做**交叉过渡**，交界处平滑衔接而非硬拼接
 * 预览与导出走同一条 drawLongCollage，天然所见即所得
 */

/** 长图常用宽度：淘宝/天猫详情页标准 750px，公众号正文 1080px */
export const LONG_WIDTH_PRESETS = [720, 750, 800, 1080, 1200]

export const MIN_LONG_WIDTH = 320
export const MAX_LONG_WIDTH = 4096

/** 长图切片导出：每段不超过该高度（px），避免单张图片体积过大无法上传 */
export const LONG_SLICE_HEIGHT = 5000

/** 长拼图样式 */
export interface LongStyle {
  /** 画布宽度（px） */
  width: number
  /** 交界「模糊边缘」重叠高度（设计 px，相对 style.width）；0 = 硬拼接 */
  feather: number
  /** 背景色 */
  background: string
  /** 是否透明背景（导出 PNG/WebP 有效） */
  transparent: boolean
  /** 顶部标题文字（空 = 不显示） */
  title: string
  /** 标题颜色 */
  titleColor: string
  /** 标题字号（px，相对 style.width） */
  titleSize: number
}

/** 长拼图渲染场景 */
export interface LongScene {
  /** 按堆叠顺序排列的图片 */
  photos: PhotoItem[]
  style: LongStyle
  /** 附加文字图层（可多条，y 用 0~1 相对总长） */
  texts?: TextItem[]
  /** 水印配置（叠加最上层） */
  watermark?: WatermarkConfig
  /** 图片水印用的图片 */
  watermarkImage?: HTMLImageElement | null
}

export function defaultLongStyle(): LongStyle {
  return {
    width: 750,
    feather: 120,
    background: '#ffffff',
    transparent: false,
    title: '',
    titleColor: '#111827',
    titleSize: 48,
  }
}

export interface LongCell {
  /** 指向 photos 的索引 */
  index: number
  x: number
  y: number
  w: number
  h: number
}

export interface LongLayout {
  width: number
  height: number
  cells: LongCell[]
}

/**
 * 计算长图排版：
 * - 每张图等比缩放为画布宽度
 * - 相邻两图重叠 `feather` 高（交叉过渡的交接带）
 * - 总高 = Σh - feather×(n-1)
 * feather 为设计像素，按 width/style.width 等比缩放。
 */
export function layoutLong(photos: PhotoItem[], style: LongStyle, targetWidth: number): LongLayout {
  const width = Math.max(1, Math.round(targetWidth))
  const n = photos.length
  const feather = Math.max(0, (style.feather * width) / Math.max(1, style.width))

  const heights: number[] = []
  for (const p of photos) {
    const ratio = p.height / Math.max(1, p.width)
    heights.push(ratio * width)
  }

  const cells: LongCell[] = []
  let y = 0
  for (let i = 0; i < n; i++) {
    cells.push({ index: i, x: 0, y, w: width, h: heights[i] })
    y += heights[i]
    if (i < n - 1) y -= feather // 与下一张重叠 feather
  }

  return { width, height: Math.max(1, Math.round(y)), cells }
}

/**
 * 把单张图片以 cover 方式画进 rect，并对上下边缘做纵向 alpha 渐变（交叉过渡）。
 * 用离屏画布 + destination-in 打 alpha 遮罩，再贴回主画布。
 */
function paintCell(
  ctx: CanvasRenderingContext2D,
  photo: PhotoItem,
  rect: LongCell,
  feather: number,
  fadeTop: boolean,
  fadeBottom: boolean,
): void {
  const w = Math.max(1, Math.round(rect.w))
  const h = Math.max(1, Math.round(rect.h))
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')
  if (!tctx) return

  const iw = photo.width
  const ih = photo.height
  if (iw <= 0 || ih <= 0) return
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  tctx.imageSmoothingEnabled = true
  tctx.imageSmoothingQuality = 'high'
  tctx.drawImage(photo.source, (w - dw) / 2, (h - dh) / 2, dw, dh)

  if ((fadeTop || fadeBottom) && feather > 0) {
    const f = Math.min(feather, h)
    tctx.globalCompositeOperation = 'destination-in'
    const grad = tctx.createLinearGradient(0, 0, 0, h)
    if (fadeTop) {
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(Math.min(1, f / h), 'rgba(0,0,0,1)')
    } else {
      grad.addColorStop(0, 'rgba(0,0,0,1)')
    }
    if (fadeBottom) {
      grad.addColorStop(Math.max(0, 1 - f / h), 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
    } else {
      grad.addColorStop(1, 'rgba(0,0,0,1)')
    }
    tctx.fillStyle = grad
    tctx.fillRect(0, 0, w, h)
  }

  ctx.drawImage(tmp, Math.round(rect.x), Math.round(rect.y))
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number, cell = 16): void {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#e9edf2'
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if (((x / cell) | 0) % 2 === ((y / cell) | 0) % 2) continue
      ctx.fillRect(x, y, cell, cell)
    }
  }
  ctx.restore()
}

/** 顶部标题：居中加粗文字，带一点下边距 */
function drawTitle(ctx: CanvasRenderingContext2D, style: LongStyle, width: number, height: number): void {
  const title = style.title
  if (!title) return
  const fontSize = Math.max(10, (style.titleSize * width) / Math.max(1, style.width))
  const y = Math.max(20, height * 0.03) + fontSize / 2

  ctx.save()
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.titleColor
  ctx.fillText(title, width / 2, y)
  ctx.restore()
}

export interface LongDrawOptions {
  /** 透明背景下的棋盘格（仅预览） */
  checkerboard?: boolean
}

/**
 * 把整张长图画到画布上，返回画布像素尺寸。
 * @param canvasWidth 目标宽度（预览=显示宽度，导出=导出宽度）
 */
export function drawLongCollage(
  ctx: CanvasRenderingContext2D,
  scene: LongScene,
  canvasWidth: number,
  options: LongDrawOptions = {},
): { width: number; height: number } {
  const layout = layoutLong(scene.photos, scene.style, canvasWidth)
  const { width, height } = layout
  const feather = Math.max(0, (scene.style.feather * width) / Math.max(1, scene.style.width))

  ctx.save()
  ctx.clearRect(0, 0, width, height)

  const opaque = !scene.style.transparent
  if (opaque) {
    ctx.fillStyle = scene.style.background
    ctx.fillRect(0, 0, width, height)
  } else if (options.checkerboard) {
    drawCheckerboard(ctx, width, height)
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 由下往上顺次绘制；相邻两图通过「上一张下缘淡出 + 下一张上缘淡入」交叉过渡
  if (scene.photos.length > 0) {
    for (let i = 0; i < layout.cells.length; i++) {
      const cell = layout.cells[i]
      paintCell(ctx, scene.photos[cell.index], cell, feather, i > 0, i < layout.cells.length - 1)
    }
  }

  // 顶部标题 + 附加文字
  drawTitle(ctx, scene.style, width, height)
  if (scene.texts) {
    for (const text of scene.texts) {
      drawText(ctx, text, width, height)
    }
  }

  // 水印叠加最上层
  if (scene.watermark) {
    drawWatermark(ctx, scene.watermark, scene.watermarkImage ?? null, width, height)
  }

  ctx.restore()
  return { width, height }
}

export interface LongExportOptions {
  format: ExportFormat
  quality: number
  /** 导出宽度（px），按此等比缩放整张长图 */
  width: number
  /** 是否切片导出：每段不超过 `segment` px，返回多张 */
  slice: boolean
  /** 切片分段的最高高度（px），仅在 slice 为 true 时生效 */
  segment?: number
}

export interface LongExportPart {
  blob: Blob
  width: number
  height: number
  /** 第几段（从 1 开始；非切片时恒为 1） */
  part: number
  total: number
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出失败：浏览器无法生成图片'))),
      mime,
      quality,
    )
  })
}

/**
 * 渲染并导出长图。
 * 预览用的是同一套 drawLongCollage，只是这里画布尺寸是导出尺寸，所见即所得。
 * 需要 jpeg 时强制铺背景色（jpeg 不支持透明）。
 */
export async function exportLongImage(
  scene: LongScene,
  options: LongExportOptions,
): Promise<LongExportPart[]> {
  const mime = LONG_FORMAT_MIME[options.format]
  const effective: LongScene =
    options.format === 'jpeg' && scene.style.transparent
      ? { ...scene, style: { ...scene.style, transparent: false } }
      : scene

  const layout = layoutLong(effective.photos, effective.style, options.width)
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D')
  drawLongCollage(ctx, effective, options.width)

  const seg = Math.max(1, Math.round(options.segment ?? LONG_SLICE_HEIGHT))
  const shouldSlice = options.slice && layout.height > seg

  if (!shouldSlice) {
    const blob = await canvasToBlob(canvas, mime, options.quality)
    return [{ blob, width: layout.width, height: layout.height, part: 1, total: 1 }]
  }

  const parts: LongExportPart[] = []
  const total = Math.ceil(layout.height / seg)
  for (let i = 0; i < total; i++) {
    const sh = Math.min(seg, layout.height - i * seg)
    const sub = document.createElement('canvas')
    sub.width = layout.width
    sub.height = sh
    const sctx = sub.getContext('2d')
    if (!sctx) continue
    sctx.drawImage(canvas, 0, -i * seg)
    const blob = await canvasToBlob(sub, mime, options.quality)
    parts.push({ blob, width: layout.width, height: sh, part: i + 1, total })
  }
  return parts
}