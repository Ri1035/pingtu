import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetOverlay, CanvasStyle, CellBorder, CellSizeScale, ExportOptions, GridLayout, PhotoItem, PhotoTransform, TextItem } from '../types'
import { getLayoutsForCount, MAX_COUNT, MIN_COUNT } from '../lib/layouts'
import { DEFAULT_TRANSFORM, type CollageScene } from '../lib/render'
import { loadImageFiles, disposePhoto } from '../lib/image'

/**
 * 编辑器状态管理
 * ------------------------------------------------------------------
 * 核心约定：**图片数组的顺序就是画面的排布顺序**。
 *   格子[i] 显示的永远是 photos[i]，没有第二份「谁在哪个格子」的映射表。
 *
 * 这样换来三点好处：
 *   1. 切换布局 / 改变图片数量时无需重新映射，自动保持一致
 *   2. 交换、排序、删除都退化成数组操作，不会出现状态不同步
 *   3. 超出格子数的图片自然成为「未使用」，逻辑自洽
 */

export const DEFAULT_STYLE: CanvasStyle = {
  ratio: 'auto',
  margin: 0,
  gap: 12,
  radius: 0,
  background: '#ffffff',
  transparent: false,
  seamless: false,
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'png',
  quality: 0.92,
  width: 2048,
}

/** 文字图层的默认参数 */
export const DEFAULT_TEXT = {
  fontFamily: 'sans-serif',
  fontSize: 48,
  color: '#111827',
}

const SETTINGS_KEY = 'merge-image:settings'

interface PersistedSettings {
  style: CanvasStyle
  exportOptions: ExportOptions
}

function readParams(): { count: number; layoutIndex: number } {
  if (typeof window === 'undefined') return { count: 2, layoutIndex: 0 }
  const params = new URLSearchParams(window.location.search)
  const count = Number(params.get('count'))
  const layout = Number(params.get('layout'))
  return {
    count: Number.isFinite(count) && count >= MIN_COUNT && count <= MAX_COUNT ? Math.round(count) : 2,
    layoutIndex: Number.isFinite(layout) && layout >= 0 ? Math.round(layout) : 0,
  }
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { style: DEFAULT_STYLE, exportOptions: DEFAULT_EXPORT }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      style: { ...DEFAULT_STYLE, ...(parsed.style ?? {}) },
      exportOptions: { ...DEFAULT_EXPORT, ...(parsed.exportOptions ?? {}) },
    }
  } catch {
    return { style: DEFAULT_STYLE, exportOptions: DEFAULT_EXPORT }
  }
}

export function useCollage() {
  const initial = useRef(readParams()).current
  const persisted = useRef(loadSettings()).current

  const [count, setCountRaw] = useState(initial.count)
  const [layoutIndex, setLayoutIndexRaw] = useState(initial.layoutIndex)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [transforms, setTransforms] = useState<Record<string, PhotoTransform>>({})
  const [texts, setTexts] = useState<TextItem[]>([])
  const [cellBorders, setCellBorders] = useState<Record<string, CellBorder>>({})
  const [cellSizes, setCellSizes] = useState<Record<string, CellSizeScale>>({})
  const [overlays, setOverlays] = useState<AssetOverlay[]>([])
  const [style, setStyleRaw] = useState<CanvasStyle>(persisted.style)
  const [exportOptions, setExportOptionsRaw] = useState<ExportOptions>(persisted.exportOptions)
  const [notice, setNotice] = useState<string | null>(null)

  const layouts = useMemo(() => getLayoutsForCount(count), [count])
  const layout: GridLayout = layouts[Math.min(layoutIndex, layouts.length - 1)] ?? layouts[0]

  // —— URL 同步：与 /editor?count=2&layout=0 的地址格式保持一致 ——
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.set('count', String(count))
    params.set('layout', String(layouts.indexOf(layout)))
    const next = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', next)
  }, [count, layoutIndex, layouts, layout])

  // —— 设置持久化 ——
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ style, exportOptions }))
    } catch {
      /* 隐私模式下 localStorage 可能不可写，忽略即可 */
    }
  }, [style, exportOptions])

  const setCount = useCallback((next: number) => {
    setCountRaw((prev) => {
      const clamped = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(next)))
      if (clamped === prev) return prev
      // 保持当前布局的序号，超出新布局数量时退回第一个
      setLayoutIndexRaw((i) => (i < getLayoutsForCount(clamped).length ? i : 0))
      return clamped
    })
  }, [])

  const setLayoutIndex = useCallback((index: number) => {
    setLayoutIndexRaw(Math.max(0, index))
  }, [])

  const setStyle = useCallback((patch: Partial<CanvasStyle>) => {
    setStyleRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  const setExportOptions = useCallback((patch: Partial<ExportOptions>) => {
    setExportOptionsRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  /** 追加图片；返回真正新增的数量 */
  const addFiles = useCallback(async (files: File[] | FileList) => {
    const { photos: loaded, errors } = await loadImageFiles(files)
    if (loaded.length > 0) {
      setPhotos((prev) => [...prev, ...loaded])
    }
    if (errors.length > 0) setNotice(errors[0])
    return loaded.length
  }, [])

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) disposePhoto(target)
      return prev.filter((p) => p.id !== id)
    })
    setTransforms((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  /** 替换指定位置的图片（位置为空时相当于在该处插入） */
  const replacePhotoAt = useCallback(async (index: number, file: File) => {
    const { photos: loaded, errors } = await loadImageFiles([file])
    if (loaded.length === 0) {
      if (errors.length > 0) setNotice(errors[0])
      return
    }
    setPhotos((prev) => {
      if (index < 0 || index > prev.length) return prev
      const next = prev.slice()
      const old = next[index]
      next[index] = loaded[0]
      if (old) disposePhoto(old)
      return next
    })
  }, [])

  /** 交换两个格子里的图片（索引越界时自动忽略） */
  const swapSlots = useCallback((a: number, b: number) => {
    setPhotos((prev) => {
      if (a === b || a < 0 || b < 0 || a >= prev.length || b >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[a]
      next[a] = next[b]
      next[b] = tmp
      return next
    })
  }, [])

  const moveSlot = useCallback(
    (from: number, direction: -1 | 1) => {
      swapSlots(from, from + direction)
    },
    [swapSlots],
  )

  const updateTransform = useCallback((id: string, patch: Partial<PhotoTransform>) => {
    setTransforms((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? DEFAULT_TRANSFORM), ...patch },
    }))
  }, [])

  const resetTransform = useCallback((id: string) => {
    setTransforms((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setPhotos((prev) => {
      prev.forEach(disposePhoto)
      return []
    })
    setTransforms({})
    setTexts([])
    setCellBorders({})
    setCellSizes({})
    setOverlays([])
  }, [])

  // —— 文字图层 ——
  const textSeedRef = useRef(0)
  const addText = useCallback((partial?: Partial<TextItem>): TextItem => {
    textSeedRef.current += 1
    const id = `t${Date.now().toString(36)}${textSeedRef.current.toString(36)}`
    const item: TextItem = {
      id,
      content: partial?.content ?? '',
      fontFamily: partial?.fontFamily ?? DEFAULT_TEXT.fontFamily,
      fontSize: partial?.fontSize ?? DEFAULT_TEXT.fontSize,
      color: partial?.color ?? DEFAULT_TEXT.color,
      bold: partial?.bold ?? false,
      italic: partial?.italic ?? false,
      rotation: partial?.rotation ?? 0,
      x: partial?.x ?? 0.5,
      y: partial?.y ?? 0.5,
    }
    setTexts((prev) => [...prev, item])
    return item
  }, [])

  const updateText = useCallback((id: string, patch: Partial<TextItem>) => {
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const removeText = useCallback((id: string) => {
    setTexts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearTexts = useCallback(() => {
    setTexts([])
  }, [])

  // —— 单格边框 ——
  const updateCellBorder = useCallback((cellName: string, patch: Partial<CellBorder>) => {
    setCellBorders((prev) => ({
      ...prev,
      [cellName]: { ...(prev[cellName] ?? { width: 0, color: '#000000', direction: 'center' }), ...patch },
    }))
  }, [])

  const removeCellBorder = useCallback((cellName: string) => {
    setCellBorders((prev) => {
      const next = { ...prev }
      delete next[cellName]
      return next
    })
  }, [])

  // —— 单格大小 ——
  const updateCellSize = useCallback((cellName: string, patch: Partial<CellSizeScale>) => {
    setCellSizes((prev) => ({
      ...prev,
      [cellName]: { ...(prev[cellName] ?? { w: 1, h: 1 }), ...patch },
    }))
  }, [])

  const resetCellSize = useCallback((cellName: string) => {
    setCellSizes((prev) => {
      const next = { ...prev }
      delete next[cellName]
      return next
    })
  }, [])

  // —— 浮层素材 ——
  const addOverlay = useCallback((overlay: AssetOverlay) => {
    setOverlays((prev) => [...prev, overlay])
  }, [])

  const updateOverlay = useCallback((id: string, patch: Partial<AssetOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id))
  }, [])

  const clearOverlays = useCallback(() => {
    setOverlays([])
  }, [])

  /** 与格子顺序对齐的槽位（不足为 null） */
  const slots = useMemo<(PhotoItem | null)[]>(() => {
    const names: string[] = []
    for (const row of layout.areas) {
      for (const token of row.trim().split(/\s+/)) {
        if (token && !names.includes(token)) names.push(token)
      }
    }
    return names.map((_, index) => photos[index] ?? null)
  }, [layout, photos])

  const scene: CollageScene = useMemo(
    () => ({ layout, slots, transforms, style, texts, cellBorders, cellSizes, overlays }),
    [layout, slots, transforms, style, texts, cellBorders, cellSizes, overlays],
  )

  const filledCount = slots.filter(Boolean).length
  const emptyCount = slots.length - filledCount
  const unusedCount = Math.max(0, photos.length - slots.length)

  return {
    // 布局
    count,
    layouts,
    layout,
    layoutIndex: layouts.indexOf(layout),
    setCount,
    setLayoutIndex,
    // 图片
    photos,
    slots,
    filledCount,
    emptyCount,
    unusedCount,
    addFiles,
    removePhoto,
    replacePhotoAt,
    swapSlots,
    moveSlot,
    // 变换
    transforms,
    updateTransform,
    resetTransform,
    // 文字图层
    texts,
    addText,
    updateText,
    removeText,
    clearTexts,
    // 单格边框
    cellBorders,
    updateCellBorder,
    removeCellBorder,
    // 单格大小
    cellSizes,
    updateCellSize,
    resetCellSize,
    // 浮层素材
    overlays,
    addOverlay,
    updateOverlay,
    removeOverlay,
    clearOverlays,
    // 样式与导出
    style,
    setStyle,
    exportOptions,
    setExportOptions,
    scene,
    // 其它
    clearAll,
    notice,
    setNotice,
  }
}

export type CollageStore = ReturnType<typeof useCollage>
