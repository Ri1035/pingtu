import type { CanvasStyle, CellRect, GridLayout, PhotoItem, PhotoTransform, TextItem } from '../types'
import { canvasRatioFromContent, computeContentRatio, parseRatio, solveLayout } from './geometry'

/**
 * Canvas 2D 渲染引擎
 * ------------------------------------------------------------------
 * 预览和导出走同一条管线：区别只在画布尺寸。
 * 这样既保证所见即所得，也让「4K 导出」只需把 width 传大即可。
 */

/**
 * 设计基准宽度。
 * 边距 / 间距 / 圆角都以这个宽度为基准（"设计像素"），
 * 渲染时按 实际宽度 / BASE_WIDTH 等比缩放，
 * 因此改变导出分辨率不会改变画面观感。
 */
export const BASE_WIDTH = 1600

export const DEFAULT_TRANSFORM: PhotoTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  fit: 'cover',
  flipH: false,
  flipV: false,
}

export interface CollageScene {
  layout: GridLayout
  /** 与 layout 格子顺序一一对应的照片（未填入为 null） */
  slots: (PhotoItem | null)[]
  transforms: Record<string, PhotoTransform>
  style: CanvasStyle
  /** 叠加在整张画布上的文字图层 */
  texts?: TextItem[]
}

export interface DrawOptions {
  /** 是否绘制空槽占位（仅预览需要，导出时不会画出来） */
  showPlaceholders?: boolean
  /** 高亮的格子名（点选交换时给反馈） */
  highlight?: string | null
  /** 透明背景下绘制棋盘格（仅预览） */
  checkerboard?: boolean
}

/** 计算画布比例：'auto' 时根据照片原始比例推算 */
export function computeRatio(scene: CollageScene): number {
  const { style, layout, slots } = scene
  if (style.ratio === 'auto') {
    const contentRatio = computeContentRatio(layout, slots)
    // 无缝模式外边距归零，画布比例等于内容比例
    const margin = style.seamless ? 0 : style.margin
    return canvasRatioFromContent(contentRatio, BASE_WIDTH, margin)
  }
  return parseRatio(style.ratio, parseRatio(layout.suggestRatio))
}

/**
 * 无缝拼图模式使用的「实际样式」：
 * 图片之间及边缘的间距/留白/圆角全部强制为 0，图片紧密拼接。
 * 用户存于 style 中的 margin/gap/radius 原值不动 —— 关闭无缝后立即恢复，
 * 因此与原有留白模式完全兼容、互不污染。
 */
export function effectiveStyle(style: CanvasStyle): CanvasStyle {
  if (!style.seamless) return style
  return { ...style, margin: 0, gap: 0, radius: 0 }
}

/** 由宽度推算画布尺寸（高度由比例决定） */
export function computeCanvasSize(scene: CollageScene, width: number): { width: number; height: number } {
  const ratio = computeRatio(scene)
  return { width: Math.round(width), height: Math.max(1, Math.round(width / ratio)) }
}

/** 圆角矩形路径（不依赖 ctx.roundRect，兼容性更好） */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  if (radius <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell = 16,
): void {
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

/** 在指定格子里画一张照片（cover + 缩放 + 平移 + 旋转 + 镜像） */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photo: PhotoItem,
  transform: PhotoTransform,
  cell: CellRect,
  radius: number,
): void {
  const rot = ((transform.rotation % 360) + 360) % 360
  const quarter = rot === 90 || rot === 270
  const pw = quarter ? photo.height : photo.width
  const ph = quarter ? photo.width : photo.height
  if (pw <= 0 || ph <= 0) return

  // cover 铺满（可能裁切）；contain 完整显示（可能留白）
  // zoom 允许 < 1：cover 下缩小会露边（配合背景/透明形成「缩小卡片」效果），
  // contain 下缩小即完整小图 —— 都由 offset 约束边界、可格内平移。
  const fit =
    transform.fit === 'contain' ? Math.min(cell.w / pw, cell.h / ph) : Math.max(cell.w / pw, cell.h / ph)
  const zoom = Math.max(0.05, transform.zoom)
  const scale = fit * zoom
  const dw = pw * scale
  const dh = ph * scale

  // 统一平移公式：offset ∈ [-0.5, 0.5] 表示「图片中心相对格子中心的位移程度」。
  //   图大于格 (dw>cell.w)：中心可动范围 = (dw-cell.w)/2 → 表现为裁切窗口平移；
  //   图小于格 (dw<cell.w)：中心可动范围 = (cell.w-dw)/2 → 表现为格内平移（不越界）。
  // 两情形可用同一公式表达：cx = centerX + offsetX * (cell.w - dw)
  // （offset 符号约定：正值把图片中心向右移）
  const cx = cell.x + cell.w / 2 + transform.offsetX * (cell.w - dw)
  const cy = cell.y + cell.h / 2 + transform.offsetY * (cell.h - dh)

  ctx.save()
  roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius)
  ctx.clip()
  ctx.translate(cx, cy)
  if (rot !== 0) ctx.rotate((rot * Math.PI) / 180)
  if (transform.flipH || transform.flipV) ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1)
  ctx.drawImage(photo.source, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

/** 空槽占位符：虚线框 + 加号 + 序号 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  cell: CellRect,
  radius: number,
  index: number,
  label: string,
): void {
  ctx.save()
  roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius)
  ctx.fillStyle = 'rgba(148,163,184,0.08)'
  ctx.fill()
  ctx.setLineDash([Math.max(6, cell.w * 0.03), Math.max(5, cell.w * 0.025)])
  ctx.lineWidth = Math.max(1.5, cell.w * 0.006)
  ctx.strokeStyle = 'rgba(100,116,139,0.55)'
  ctx.stroke()
  ctx.setLineDash([])

  const cx = cell.x + cell.w / 2
  const cy = cell.y + cell.h / 2
  const unit = Math.min(cell.w, cell.h)
  const plus = unit * 0.11
  ctx.strokeStyle = 'rgba(100,116,139,0.85)'
  ctx.lineWidth = Math.max(2, unit * 0.014)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - plus, cy)
  ctx.lineTo(cx + plus, cy)
  ctx.moveTo(cx, cy - plus)
  ctx.lineTo(cx, cy + plus)
  ctx.stroke()

  ctx.fillStyle = 'rgba(100,116,139,0.9)'
  ctx.font = `600 ${Math.max(11, unit * 0.085)}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label || String(index + 1), cx, cy + unit * 0.19)
  ctx.restore()
}

/**
 * 在画布上绘制一条文字图层。
 * 文字按「设计像素」定位：x/y 是相对画布的比例，fontSize 以 BASE_WIDTH 为基准缩放。
 */
function drawText(ctx: CanvasRenderingContext2D, text: TextItem, width: number, height: number): void {
  const content = text.content
  if (!content) return
  const scale = width / BASE_WIDTH
  const fontSize = Math.max(1, text.fontSize * scale)
  const style = `${text.italic ? 'italic ' : ''}${text.bold ? '700 ' : '400 '}${fontSize}px "${text.fontFamily}", sans-serif`

  ctx.save()
  ctx.font = style
  ctx.fillStyle = text.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const cx = text.x * width
  const cy = text.y * height

  ctx.translate(cx, cy)
  if (text.rotation !== 0) ctx.rotate((text.rotation * Math.PI) / 180)

  // 多行文字按换行符拆分，逐行绘制
  const lines = content.split('\n')
  const lineHeight = fontSize * 1.25
  const startY = -((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, startY + i * lineHeight)
  })
  ctx.restore()
}

/**
 * 把整张拼图画到画布上。
 * @param canvasWidth  画布像素宽（预览时为显示宽度，导出时为目标宽度）
 */
export function drawCollage(
  ctx: CanvasRenderingContext2D,
  scene: CollageScene,
  canvasWidth: number,
  options: DrawOptions = {},
): { width: number; height: number } {
  const { width, height } = computeCanvasSize(scene, canvasWidth)
  const scale = width / BASE_WIDTH
  // 无缝模式：间距/边距/圆角强制归零（用户原始值不动，关闭即恢复）
  const style = effectiveStyle(scene.style)
  const margin = style.margin * scale
  const gap = style.gap * scale
  const radius = style.radius * scale

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

  const content: CellRect = {
    x: margin,
    y: margin,
    w: Math.max(1, width - margin * 2),
    h: Math.max(1, height - margin * 2),
  }
  const solved = solveLayout(scene.layout, content, gap)

  solved.names.forEach((name, index) => {
    const cell = solved.cells[name]
    if (!cell || cell.w <= 0 || cell.h <= 0) return
    const photo = scene.slots[index]
    if (photo) {
      const transform = scene.transforms[photo.id] ?? DEFAULT_TRANSFORM
      drawPhoto(ctx, photo, transform, cell, radius)
    } else if (options.showPlaceholders) {
      drawPlaceholder(ctx, cell, radius, index, '')
    }

    if (options.highlight === name) {
      ctx.save()
      roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius)
      ctx.lineWidth = Math.max(2, width * 0.0035)
      ctx.strokeStyle = '#2563eb'
      ctx.stroke()
      ctx.restore()
    }
  })

  // 文字图层叠加在最上层
  if (scene.texts) {
    for (const text of scene.texts) {
      drawText(ctx, text, width, height)
    }
  }

  ctx.restore()
  return { width, height }
}
