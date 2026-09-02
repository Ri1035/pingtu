import type { PhotoItem } from '../types'

/** 支持的输入格式 */
export const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
]

export const ACCEPT_ATTR = ACCEPTED_MIME.join(',')

export const MAX_FILE_SIZE = 60 * 1024 * 1024 // 单张 60MB

let seed = 0
function uid(): string {
  seed += 1
  return `p${Date.now().toString(36)}${seed.toString(36)}`
}

export function isImageFile(file: File): boolean {
  if (file.type) return file.type.startsWith('image/')
  return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)
}

/** 读取图片的原始宽高，并生成用于托盘的小缩略图 */
function loadImageMeta(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = url
  })
}

function makeThumbnail(img: HTMLImageElement, max = 320): string {
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * ratio))
  const h = Math.max(1, Math.round(img.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, w, h)
  try {
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  }
}

export interface LoadResult {
  photos: PhotoItem[]
  errors: string[]
}

/**
 * 把用户选择的文件读成 PhotoItem。
 * 只做本地解码，不产生任何网络请求 —— 与原站「图片不出本机」的承诺一致。
 */
export async function loadImageFiles(files: File[] | FileList): Promise<LoadResult> {
  const list = Array.from(files)
  const photos: PhotoItem[] = []
  const errors: string[] = []

  for (const file of list) {
    if (!isImageFile(file)) {
      errors.push(`${file.name}：不是受支持的图片格式`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}：超过 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB 上限`)
      continue
    }
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImageMeta(url)
      photos.push({
        id: uid(),
        name: file.name,
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        url,
        thumb: makeThumbnail(img),
        size: file.size,
      })
    } catch {
      URL.revokeObjectURL(url)
      errors.push(`${file.name}：无法解码，请确认文件未损坏`)
    }
  }

  return { photos, errors }
}

/** 释放图片占用的内存 */
export function disposePhoto(photo: PhotoItem): void {
  if (photo.url) URL.revokeObjectURL(photo.url)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
