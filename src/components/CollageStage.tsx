import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Maximize2,
  Minimize2,
  RotateCw,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import type { PhotoTransform, TextItem } from '../types'
import { DEFAULT_TRANSFORM, computeRatio, drawCollage } from '../lib/render'
import { solveLayout } from '../lib/geometry'
import type { CollageStore } from '../hooks/useCollage'
import { useI18n } from '../i18n'

interface Props {
  store: CollageStore
  /** 打开系统文件选择器；传入索引表示替换该位置的图片 */
  onPickFiles: (replaceIndex?: number) => void
  onFilesDropped: (files: FileList | File[]) => void
  /** 当前选中的文字图层 id（用于高亮与拖拽） */
  selectedTextId: string | null
  onSelectText: (id: string | null) => void
}

interface PointerRecord {
  id: number
  x: number
  y: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const TAP_THRESHOLD = 5

/** 计算某张图在格子里「可平移的余量」，用于把鼠标位移换算成偏移比例 */
function computeOverflow(
  cell: { w: number; h: number },
  photo: { width: number; height: number },
  transform: PhotoTransform,
): { overflowX: number; overflowY: number } {
  const quarter = ((transform.rotation % 360) + 360) % 360
  const swapped = quarter === 90 || quarter === 270
  const pw = swapped ? photo.height : photo.width
  const ph = swapped ? photo.width : photo.height
  if (pw <= 0 || ph <= 0) return { overflowX: 0, overflowY: 0 }
  const fit = transform.fit === 'contain' ? Math.min(cell.w / pw, cell.h / ph) : Math.max(cell.w / pw, cell.h / ph)
  const scale = fit * Math.max(1, transform.zoom)
  return {
    overflowX: Math.max(0, pw * scale - cell.w),
    overflowY: Math.max(0, ph * scale - cell.h),
  }
}

export function CollageStage({ store, onPickFiles, onFilesDropped, selectedTextId, onSelectText }: Props) {
  const { t } = useI18n()
  const { scene, slots, updateTransform, resetTransform, removePhoto, swapSlots, texts, updateText, removeText } =
    store

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [zoomHint, setZoomHint] = useState<string | null>(null)
  const [isDropping, setIsDropping] = useState(false)

  /**
   * 悬浮菜单「延迟消失」机制：
   * 鼠标从图片移向悬浮工具条时，路径上可能短暂离开画布区域。
   * 若 onPointerLeave 立即清空 hoverIndex，工具条会在鼠标到达前被卸载（历史 bug）。
   * 解法：离开时只启动 ~300ms 定时器；期间若鼠标进入工具条（onPointerEnter）则取消。
   */
  const hoverTimer = useRef<number | null>(null)
  const cancelHoverTimer = useCallback(() => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])
  const scheduleClearHover = useCallback(() => {
    cancelHoverTimer()
    hoverTimer.current = window.setTimeout(() => {
      setHoverIndex(null)
      hoverTimer.current = null
    }, 300)
  }, [cancelHoverTimer])

  // 卸载时清理定时器
  useEffect(() => cancelHoverTimer, [cancelHoverTimer])

  // 拖拽平移手势状态
  const gesture = useRef<{
    pointerId: number
    areaIndex: number
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    moved: boolean
  } | null>(null)
  const pointers = useRef<Map<number, PointerRecord>>(new Map())
  const pinch = useRef<{ startDistance: number; startZoom: number; index: number } | null>(null)
  const zoomHintTimer = useRef<number | null>(null)

  // 文字拖拽手势状态
  const textDrag = useRef<{
    pointerId: number
    textId: string
    startX: number
    startY: number
    startTextX: number
    startTextY: number
    moved: boolean
  } | null>(null)

  // —— 容器尺寸 ——
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ratio = useMemo(() => computeRatio(scene), [scene])

  // 预览尺寸：在容器内等比铺满
  const preview = useMemo(() => {
    const padW = Math.max(0, box.w - 48)
    const padH = Math.max(0, box.h - 48)
    if (padW <= 0 || padH <= 0) return { w: 0, h: 0 }
    const w = Math.min(padW, padH * ratio)
    return { w: Math.round(w), h: Math.round(w / ratio) }
  }, [box, ratio])

  // 预览用的格子几何（命中测试与工具条定位都依赖它）
  const solved = useMemo(() => {
    if (preview.w <= 0) return null
    const scale = preview.w / 1600
    const margin = scene.style.margin * scale
    const gap = scene.style.gap * scale
    return solveLayout(
      scene.layout,
      { x: margin, y: margin, w: Math.max(1, preview.w - margin * 2), h: Math.max(1, preview.h - margin * 2) },
      gap,
    )
  }, [preview, scene])

  /**
   * 计算某条文字在画布预览坐标系里的包围盒（用于命中测试与选中框）。
   * 返回 null 表示该文字为空或无法定位。
   */
  const textBounds = useCallback(
    (text: TextItem): { x: number; y: number; w: number; h: number } | null => {
      if (!text.content || preview.w <= 0) return null
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return null
      const scale = preview.w / 1600
      const fontSize = Math.max(1, text.fontSize * scale)
      ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? '700 ' : '400 '}${fontSize}px "${text.fontFamily}", sans-serif`
      const lines = text.content.split('\n')
      let maxW = 0
      for (const line of lines) {
        maxW = Math.max(maxW, ctx.measureText(line).width)
      }
      const lineHeight = fontSize * 1.25
      const h = lines.length * lineHeight
      const cx = text.x * preview.w
      const cy = text.y * preview.h
      return { x: cx - maxW / 2, y: cy - h / 2, w: maxW, h }
    },
    [preview],
  )

  /** 命中测试：返回鼠标位置下的文字图层 id（优先于格子命中） */
  const textAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = (clientX - rect.left) * (preview.w / rect.width)
      const y = (clientY - rect.top) * (preview.h / rect.height)
      // 从后往前遍历（上层优先）
      for (let i = texts.length - 1; i >= 0; i--) {
        const b = textBounds(texts[i])
        if (!b) continue
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return texts[i].id
      }
      return null
    },
    [texts, textBounds, preview],
  )

  // —— 绘制 ——
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || preview.w <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = Math.round(preview.w * dpr)
    canvas.height = Math.round(preview.h * dpr)
    canvas.style.width = `${preview.w}px`
    canvas.style.height = `${preview.h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawCollage(ctx, scene, preview.w, {
      showPlaceholders: true,
      highlight: selectedIndex != null ? (solved?.names[selectedIndex] ?? null) : null,
      checkerboard: scene.style.transparent,
    })

    // 叠加选中文字的虚线框
    if (selectedTextId) {
      const selectedText = texts.find((item) => item.id === selectedTextId)
      if (selectedText) {
        const b = textBounds(selectedText)
        if (b) {
          const pad = 6
          ctx.save()
          ctx.setLineDash([5, 4])
          ctx.lineWidth = 1.5
          ctx.strokeStyle = '#2563eb'
          ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
          ctx.restore()
        }
      }
    }
  }, [scene, preview, selectedIndex, solved, selectedTextId, texts, textBounds])

  // —— 键盘快捷键 ——
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 优先删除选中的文字
        if (selectedTextId) {
          e.preventDefault()
          removeText(selectedTextId)
          onSelectText(null)
          return
        }
        if (selectedIndex == null) return
        e.preventDefault()
        const photo = slots[selectedIndex]
        if (photo) removePhoto(photo.id)
        setSelectedIndex(null)
      } else if (e.key === 'Escape') {
        setSelectedIndex(null)
        onSelectText(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIndex, slots, removePhoto, selectedTextId, removeText, onSelectText])

  const indexAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current
      if (!canvas || !solved) return null
      const rect = canvas.getBoundingClientRect()
      const x = (clientX - rect.left) * (preview.w / rect.width)
      const y = (clientY - rect.top) * (preview.h / rect.height)
      for (let i = 0; i < solved.names.length; i++) {
        const c = solved.cells[solved.names[i]]
        if (!c) continue
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return i
      }
      return null
    },
    [solved, preview],
  )

  const flashZoom = useCallback((value: number) => {
    setZoomHint(`${Math.round(value * 100)}%`)
    if (zoomHintTimer.current) window.clearTimeout(zoomHintTimer.current)
    zoomHintTimer.current = window.setTimeout(() => setZoomHint(null), 900)
  }, [])

  /**
   * 滚轮缩放必须用原生非被动监听。
   * React 在根节点上把 wheel 注册成了 passive，处理函数里调 preventDefault 会无效
   * 并触发告警，页面会跟着一起滚动。
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheelNative = (e: WheelEvent) => {
      const index = indexAt(e.clientX, e.clientY)
      const photo = index != null ? slots[index] : null
      if (!photo) return
      e.preventDefault()
      const current = (store.transforms[photo.id] ?? DEFAULT_TRANSFORM).zoom
      const next = clamp(current * (1 - e.deltaY * 0.0016), MIN_ZOOM, MAX_ZOOM)
      if (next === current) return
      updateTransform(photo.id, { zoom: next })
      flashZoom(next)
    }
    canvas.addEventListener('wheel', onWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheelNative)
  }, [indexAt, slots, store.transforms, updateTransform, flashZoom])

  // —— 指针交互 ——
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 文字优先：命中文字则进入文字拖拽/选中逻辑
    const textId = textAt(e.clientX, e.clientY)
    if (textId) {
      const text = texts.find((item) => item.id === textId)
      if (text) {
        onSelectText(textId)
        textDrag.current = {
          pointerId: e.pointerId,
          textId,
          startX: e.clientX,
          startY: e.clientY,
          startTextX: text.x,
          startTextY: text.y,
          moved: false,
        }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        return
      }
    }

    const index = indexAt(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })

    // 双指进入捏合缩放
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      const photo = index != null ? slots[index] : null
      if (index != null && photo) {
        pinch.current = {
          startDistance: Math.hypot(a.x - b.x, a.y - b.y),
          startZoom: (store.transforms[photo.id] ?? DEFAULT_TRANSFORM).zoom,
          index,
        }
      }
      gesture.current = null
      return
    }

    if (index == null) {
      // 点击空白处取消文字选中
      if (selectedTextId) onSelectText(null)
      return
    }
    const photo = slots[index]
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    if (!photo) return
    const transform = store.transforms[photo.id] ?? DEFAULT_TRANSFORM
    gesture.current = {
      pointerId: e.pointerId,
      areaIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: transform.offsetX,
      startOffsetY: transform.offsetY,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 文字拖拽
    const td = textDrag.current
    if (td && td.pointerId === e.pointerId) {
      const dx = e.clientX - td.startX
      const dy = e.clientY - td.startY
      if (!td.moved && Math.hypot(dx, dy) < TAP_THRESHOLD) return
      td.moved = true
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      // 屏幕像素位移 → 画布比例位移（canvas CSS 宽即 preview.w，对应 x 比例 0~1）
      const nx = td.startTextX + dx / rect.width
      const ny = td.startTextY + dy / rect.height
      updateText(td.textId, { x: clamp01(nx), y: clamp01(ny) })
      return
    }

    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })
    }

    // 捏合缩放
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values())
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const photo = slots[pinch.current.index]
      if (photo && pinch.current.startDistance > 0) {
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, (pinch.current.startZoom * distance) / pinch.current.startDistance),
        )
        updateTransform(photo.id, { zoom: next })
        flashZoom(next)
      }
      return
    }

    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) {
      const hover = indexAt(e.clientX, e.clientY)
      if (hover !== hoverIndex) {
        if (hover !== null) {
          // 移到某个格子上：立即定位并取消延迟清除
          cancelHoverTimer()
          setHoverIndex(hover)
        } else {
          // 移到空白处：延迟清除，留出移向悬浮工具条的时间窗
          scheduleClearHover()
        }
      }
      return
    }

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved && Math.hypot(dx, dy) < TAP_THRESHOLD) return
    g.moved = true

    const photo = slots[g.areaIndex]
    if (!photo || !solved) return
    const cell = solved.cells[solved.names[g.areaIndex]]
    if (!cell) return
    const transform = store.transforms[photo.id] ?? DEFAULT_TRANSFORM
    const { overflowX, overflowY } = computeOverflow(cell, photo, transform)
    const scale = preview.w / (canvasRef.current?.getBoundingClientRect().width || preview.w)
    const px = dx * scale
    const py = dy * scale

    updateTransform(photo.id, {
      offsetX: overflowX > 0 ? clamp(g.startOffsetX - px / overflowX, -0.5, 0.5) : 0,
      offsetY: overflowY > 0 ? clamp(g.startOffsetY - py / overflowY, -0.5, 0.5) : 0,
    })
  }

  const finishGesture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 文字拖拽结束
    if (textDrag.current && textDrag.current.pointerId === e.pointerId) {
      textDrag.current = null
      return
    }

    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null

    const g = gesture.current
    gesture.current = null
    if (!g || g.pointerId !== e.pointerId) return

    const photo = slots[g.areaIndex]
    if (!g.moved) {
      // 视为点击：空槽上传 / 已选则交换 / 否则选中
      if (!photo) {
        onPickFiles(g.areaIndex)
        return
      }
      if (selectedIndex == null) {
        setSelectedIndex(g.areaIndex)
      } else if (selectedIndex === g.areaIndex) {
        setSelectedIndex(null)
      } else {
        swapSlots(selectedIndex, g.areaIndex)
        setSelectedIndex(null)
      }
    }
  }

  // ---------- 悬浮工具条 ----------
  const toolbarIndex = hoverIndex ?? null
  const toolbarPhoto = toolbarIndex != null ? slots[toolbarIndex] : null
  const toolbarCell = toolbarIndex != null && solved ? solved.cells[solved.names[toolbarIndex]] : null
  const toolbarTransform = toolbarPhoto ? (store.transforms[toolbarPhoto.id] ?? DEFAULT_TRANSFORM) : null

  return (
    <div
      className="stage-canvas"
      ref={containerRef}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDropping(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setIsDropping(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDropping(false)
        if (e.dataTransfer?.files?.length) onFilesDropped(e.dataTransfer.files)
      }}
    >
      {/* 移出判定放在外层：工具栏是 canvas 的兄弟节点，
          但这里不能立即清空 hoverIndex —— 鼠标从图片移向工具栏时
          会先经过 canvas 与工具栏之间的空隙触发 pointerleave，
          若立即卸载工具栏，鼠标就永远点不到按钮（历史 bug）。
          因此改为「延迟清除」：300ms 内进入工具栏即取消。 */}
      <div
        className="stage-inner"
        onPointerLeave={() => {
          gesture.current = null
          scheduleClearHover()
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          style={{ cursor: toolbarPhoto ? 'grab' : 'pointer' }}
        />

        {toolbarCell && toolbarIndex != null && (
          <div
            className="slot-toolbar"
            style={{
              left: toolbarCell.x + toolbarCell.w / 2,
              top: toolbarCell.y + 8,
            }}
            onPointerEnter={() => {
              // 进入工具栏：取消延迟清除，保持显示
              cancelHoverTimer()
              setHoverIndex(toolbarIndex)
            }}
            onPointerLeave={() => scheduleClearHover()}
          >
            {toolbarPhoto && toolbarTransform ? (
              <>
                <button type="button" title={t('replace')} onClick={() => onPickFiles(toolbarIndex)}>
                  <ImagePlus size={14} />
                </button>
                <button
                  type="button"
                  title={t('rotateRight')}
                  onClick={() => updateTransform(toolbarPhoto.id, { rotation: (toolbarTransform.rotation + 90) % 360 })}
                >
                  <RotateCw size={14} />
                </button>
                <button
                  type="button"
                  title={t('flipH')}
                  onClick={() => updateTransform(toolbarPhoto.id, { flipH: !toolbarTransform.flipH })}
                >
                  <FlipHorizontal2 size={14} />
                </button>
                <button
                  type="button"
                  title={t('flipV')}
                  onClick={() => updateTransform(toolbarPhoto.id, { flipV: !toolbarTransform.flipV })}
                >
                  <FlipVertical2 size={14} />
                </button>
                <button
                  type="button"
                  title={toolbarTransform.fit === 'cover' ? '完整显示' : '铺满裁切'}
                  onClick={() =>
                    updateTransform(toolbarPhoto.id, { fit: toolbarTransform.fit === 'cover' ? 'contain' : 'cover' })
                  }
                >
                  {toolbarTransform.fit === 'cover' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button type="button" title={t('resetView')} onClick={() => resetTransform(toolbarPhoto.id)}>
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="is-danger"
                  title={t('remove')}
                  onClick={() => {
                    removePhoto(toolbarPhoto.id)
                    setSelectedIndex(null)
                    setHoverIndex(null)
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <button type="button" title={t('clickToAdd')} onClick={() => onPickFiles(toolbarIndex)}>
                <ImagePlus size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {zoomHint && <div className="zoom-badge">{`${t('zoom')} ${zoomHint}`}</div>}

      <div className="stage-status">
        {selectedIndex != null && <span className="pill pill-accent">{t('swapHint')}</span>}
        <span className="pill">
          {preview.w} × {preview.h}
        </span>
      </div>

      {store.filledCount === 0 && (
        <div className="stage-empty">
          <button type="button" className="btn btn-primary btn-lg stage-empty-btn" onClick={() => onPickFiles()}>
            <Upload size={16} />
            {t('addPhotos')}
          </button>
          <div className="stage-empty-hint">{t('emptyStateHint')}</div>
        </div>
      )}
      {isDropping && <div className="drop-mask">{t('dragHint')}</div>}
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
