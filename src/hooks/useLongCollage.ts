import { useCallback, useMemo, useRef, useState } from 'react'
import type { ExportFormat, PhotoItem, TextItem, WatermarkConfig } from '../types'
import { DEFAULT_WATERMARK } from '../lib/watermark'
import { loadImageFiles, disposePhoto } from '../lib/image'
import { defaultLongStyle, layoutLong, type LongScene, type LongStyle } from '../lib/longCollage'

/**
 * 长拼图状态管理
 * ------------------------------------------------------------------
 * 独立于主拼图 useCollage：图片数组 `photos` 的顺序 = 长图从上到下的堆叠顺序。
 * 复用主拼图的解码（loadImageFiles）、水印配置（WatermarkConfig）、
 * 文字图层（TextItem）与导出宽度档位，只是排版与渲染走长图管线。
 */

const DEFAULT_LONG_TEXT = {
  fontFamily: 'sans-serif',
  fontSize: 42,
  color: '#111827',
  lineHeight: 1.25,
}

export interface LongExportState {
  format: ExportFormat
  quality: number
  width: number
  slice: boolean
  segment: number
}

const DEFAULT_EXPORT: LongExportState = {
  format: 'png',
  quality: 0.92,
  width: 750,
  slice: true,
  segment: 5000,
}

export function useLongCollage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [style, setStyleRaw] = useState<LongStyle>(defaultLongStyle)
  const [texts, setTexts] = useState<TextItem[]>([])
  const [watermark, setWatermarkRaw] = useState<WatermarkConfig>(DEFAULT_WATERMARK)
  const [watermarkImage, setWatermarkImage] = useState<HTMLImageElement | null>(null)
  const [exportState, setExportStateRaw] = useState<LongExportState>(DEFAULT_EXPORT)
  const [notice, setNotice] = useState<string | null>(null)

  const setStyle = useCallback((patch: Partial<LongStyle>) => {
    setStyleRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  const setWatermark = useCallback((patch: Partial<WatermarkConfig>) => {
    setWatermarkRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  const setExportState = useCallback((patch: Partial<LongExportState>) => {
    setExportStateRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  // atIndex 存在时在指定位置插入（按 index 处插入多条 loaded），否则追加到堆叠末尾。
  // 用于「素材库插入到长图指定位置」：堆叠里选中某一项后，新素材就插到它后面。
  const addFiles = useCallback(async (files: File[] | FileList, atIndex?: number) => {
    const { photos: loaded, errors } = await loadImageFiles(files)
    if (loaded.length > 0) {
      setPhotos((prev) => {
        if (atIndex == null || atIndex < 0 || atIndex > prev.length) return [...prev, ...loaded]
        const next = prev.slice()
        next.splice(atIndex, 0, ...loaded)
        return next
      })
    }
    if (errors.length > 0) setNotice(errors[0])
    return loaded.length
  }, [])

  const removePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => {
        const target = prev.find((p) => p.id === id)
        if (target) disposePhoto(target)
        return prev.filter((p) => p.id !== id)
      })
    },
    [],
  )

  const movePhoto = useCallback((from: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const to = from + direction
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[from]
      next[from] = next[to]
      next[to] = tmp
      return next
    })
  }, [])

  // —— 附加文字 ——
  // 预览视口中心（0~1），新文字默认落在「右侧当前停靠的那一段」中间，便于就地排版而非跨图居中
  const viewYRef = useRef(0.5)
  const [viewY, setViewYState] = useState(0.5)
  const setViewY = useCallback((v: number) => {
    const next = Math.min(1, Math.max(0, v))
    viewYRef.current = next
    setViewYState(next)
  }, [])

  const textSeedRef = useRef(0)
  const addText = useCallback((partial?: Partial<TextItem>): TextItem => {
    textSeedRef.current += 1
    const item: TextItem = {
      id: `lt${Date.now().toString(36)}${textSeedRef.current.toString(36)}`,
      content: '',
      fontFamily: DEFAULT_LONG_TEXT.fontFamily,
      fontSize: DEFAULT_LONG_TEXT.fontSize,
      color: DEFAULT_LONG_TEXT.color,
      bold: false,
      italic: false,
      rotation: 0,
      lineHeight: DEFAULT_LONG_TEXT.lineHeight,
      letterSpacing: 0,
      align: 'center',
      underline: false,
      strokeWidth: 0,
      strokeColor: '#111827',
      shadowBlur: 0,
      shadowColor: '#000000',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      x: 0.5,
      y: viewYRef.current ?? 0.5,
      ...partial,
    }
    setTexts((prev) => [...prev, item])
    return item
  }, [])

  const updateText = useCallback((id: string, patch: Partial<TextItem>) => {
    setTexts((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const removeText = useCallback((id: string) => {
    setTexts((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setPhotos((prev) => {
      prev.forEach(disposePhoto)
      return []
    })
    setTexts([])
    setWatermarkRaw(DEFAULT_WATERMARK)
    setWatermarkImage(null)
  }, [])

  // 设计尺寸（在 style.width 上的整体高度）
  const layout = useMemo(() => layoutLong(photos, style, style.width), [photos, style])

  const scene: LongScene = useMemo(
    () => ({ photos, style, texts, watermark, watermarkImage }),
    [photos, style, texts, watermark, watermarkImage],
  )

  return {
    photos,
    style,
    setStyle,
    texts,
    addText,
    updateText,
    removeText,
    viewY,
    setViewY,
    watermark,
    setWatermark,
    watermarkImage,
    setWatermarkImage,
    exportState,
    setExportState,
    layout,
    scene,
    addFiles,
    removePhoto,
    movePhoto,
    clearAll,
    notice,
    setNotice,
  }
}

export type LongStore = ReturnType<typeof useLongCollage>