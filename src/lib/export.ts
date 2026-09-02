import type { ExportFormat, ExportOptions } from '../types'
import { computeCanvasSize, drawCollage, type CollageScene } from './render'

/** Canvas 导出支持的三种格式（与原站一致） */
export const FORMAT_MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
}

/** 导出宽度档位，3840 即 4K */
export const EXPORT_WIDTH_PRESETS: number[] = [1080, 1600, 2048, 2560, 3840]

export const MIN_EXPORT_WIDTH = 256
export const MAX_EXPORT_WIDTH = 8192

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  mime: string
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

/** 生成下载文件名，如 merge-image-20260901-183000.png */
export function buildFilename(format: ExportFormat, width: number): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`
  const ext = format === 'jpeg' ? 'jpg' : format
  return `merge-image-${width}w-${stamp}.${ext}`
}

/**
 * 渲染并导出为 Blob。
 * 预览用的是同一套 drawCollage，只是这里的画布尺寸是导出尺寸，
 * 所以「预览所见」=「导出所得」。
 */
export async function renderToBlob(scene: CollageScene, options: ExportOptions): Promise<ExportResult> {
  const mime = FORMAT_MIME[options.format]
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D')

  // JPEG 不支持透明通道，强制铺背景色
  const sceneForExport: CollageScene =
    options.format === 'jpeg' && scene.style.transparent
      ? { ...scene, style: { ...scene.style, transparent: false } }
      : scene

  // 先按目标宽度算出画布尺寸，再一次性绘制
  const { width, height } = computeCanvasSize(sceneForExport, options.width)

  canvas.width = width
  canvas.height = height
  drawCollage(ctx, sceneForExport, options.width)

  const blob = await canvasToBlob(canvas, mime, options.quality)
  return { blob, width, height, mime: blob.type || mime }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 交给浏览器完成下载后再释放
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 检测浏览器是否支持 WebP 编码 */
export function supportsWebp(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    canvas.toBlob((blob) => resolve(!!blob && blob.type === 'image/webp'), 'image/webp')
  })
}
