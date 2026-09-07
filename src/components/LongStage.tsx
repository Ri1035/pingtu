import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { useI18n } from '../i18n'
import type { LongStore } from '../hooks/useLongCollage'
import { drawLongCollage } from '../lib/longCollage'
import type { TextItem } from '../types'

/** 预览画布的安全高度上限，防止超大长图触发浏览器 canvas 尺寸限制 */
const PREVIEW_MAX_H = 14000
const TAP_THRESHOLD = 6

interface Props {
  store: LongStore
  /** 当前选中文字 id（与侧栏 TextPanel 共享同一选中态） */
  selectedTextId: string | null
  onSelectText: (id: string | null) => void
}

interface TextDrag {
  pointerId: number
  textId: string
  startX: number
  startY: number
  startTextX: number
  startTextY: number
  moved: boolean
}

/**
 * 长拼图预览画布。
 * 与导出走同一 drawLongCollage（含模糊边缘 / 文字 / 水印），所见即所得。
 * 额外能力：
 *  - 竖向无限滚动，滚动时把视口中心比例上报给 store，新文字默认落在当前段中间
 *  - 点击 / 拖动文字可直接调整位置（命中测试与绘制同口径，含变形缩放）
 */
export function LongStage({ store, selectedTextId, onSelectText }: Props) {
  const { t } = useI18n()
  const { scene, layout, addFiles, setViewY, updateText, texts } = store
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textDrag = useRef<TextDrag | null>(null)
  const [boxW, setBoxW] = useState(0)
  const [isDropping, setIsDropping] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setBoxW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 滚动时上报视口中心比例（0~1），供新文字定位到当前段中间
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el || el.scrollHeight <= 0) return
    setViewY((el.scrollTop + el.clientHeight / 2) / el.scrollHeight)
  }, [setViewY])

  // 依据可用宽度重绘预览
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || scene.photos.length === 0) return

    const designW = Math.max(1, layout.width)
    let drawW = Math.max(designW, Math.round(boxW))
    // 高度封顶：过长时降低绘制宽度，保证不超过浏览器 canvas 上限
    if (designW > 0 && (layout.height / designW) * drawW > PREVIEW_MAX_H) {
      drawW = Math.max(1, Math.floor((PREVIEW_MAX_H * designW) / layout.height))
    }
    const drawH = Math.max(1, Math.round((layout.height / designW) * drawW))
    if (canvas.width !== drawW) canvas.width = drawW
    if (canvas.height !== drawH) canvas.height = drawH

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawLongCollage(ctx, { ...scene, style: { ...scene.style, width: designW } }, drawW, {
      checkerboard: scene.style.transparent,
    })

    // 选中文字虚线框（在 drawW 设计坐标系里绘制）
    if (selectedTextId) {
      const st = texts.find((ite) => ite.id === selectedTextId)
      const b = st ? textBounds(st, drawW, drawH) : null
      if (b) {
        const pad = 6
        ctx.save()
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#2563eb'
        ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, (b.h || 0) + pad * 2)
        ctx.restore()
      }
    }
  }, [scene, layout, boxW, selectedTextId, texts])

  /** 计算文字在画布设计坐标系里的外接盒（与 drawText 使用同一 fontSize 缩放） */
  const textBounds = useCallback(
    (text: TextItem, w: number, h: number): { x: number; y: number; w: number; h: number } | null => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx || !text.content || w <= 0 || h <= 0) return null
      const scale = w / 1600
      const fontSize = Math.max(1, text.fontSize * scale)
      ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? '700 ' : '400 '}${fontSize}px "${text.fontFamily}", sans-serif`
      const letterSpacing = (text.letterSpacing ?? 0) * scale
      const lines = text.content.split('\n')
      let maxW = 0
      for (const line of lines) {
        const lw = ctx.measureText(line).width + Math.max(0, line.length - 1) * letterSpacing
        maxW = Math.max(maxW, lw)
      }
      const lineHeight = fontSize * (text.lineHeight ?? 1.25)
      const wScale = text.scaleX ?? 1
      const hScale = text.scaleY ?? 1
      const cx = text.x * w
      const cy = text.y * h
      return { x: cx - (maxW * wScale) / 2, y: cy - (lines.length * lineHeight * hScale) / 2, w: maxW * wScale, h: lines.length * lineHeight * hScale }
    },
    [],
  )

  /** 命中测试：返回鼠标位置下的文字 id（后加入的在上层） */
  const textAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current
      if (!canvas || scene.photos.length === 0) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      const x = ((clientX - rect.left) * canvas.width) / rect.width
      const y = ((clientY - rect.top) * canvas.height) / rect.height
      for (let i = texts.length - 1; i >= 0; i--) {
        const b = textBounds(texts[i], canvas.width, canvas.height)
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return texts[i].id
      }
      return null
    },
    [texts, textBounds, scene.photos.length],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const id = textAt(e.clientX, e.clientY)
      if (!id) {
        onSelectText(null)
        textDrag.current = null
        return
      }
      const text = texts.find((it) => it.id === id)
      if (!text) return
      onSelectText(id)
      textDrag.current = {
        pointerId: e.pointerId,
        textId: id,
        startX: e.clientX,
        startY: e.clientY,
        startTextX: text.x,
        startTextY: text.y,
        moved: false,
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [textAt, texts, onSelectText],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const td = textDrag.current
      if (!td || td.pointerId !== e.pointerId) return
      const canvas = canvasRef.current
      const rect = canvas?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      const dx = e.clientX - td.startX
      const dy = e.clientY - td.startY
      if (!td.moved && Math.hypot(dx, dy) < TAP_THRESHOLD) return
      td.moved = true
      // 屏幕像素位移 → 画布比例位移（canvas CSS 宽即画布逻辑宽）
      const nx = td.startTextX + dx / rect.width
      const ny = td.startTextY + dy / rect.height
      updateText(td.textId, { x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)) })
    },
    [updateText],
  )

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (textDrag.current?.pointerId === e.pointerId) textDrag.current = null
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDropping(false)
      if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  if (scene.photos.length === 0) {
    return (
      <div
        ref={scrollerRef}
        className="stage long-stage"
        onDragOver={(e) => { e.preventDefault(); setIsDropping(true) }}
        onDragLeave={() => setIsDropping(false)}
        onDrop={onDrop}
      >
        <div className="stage-empty">
          <button type="button" className="btn btn-primary btn-lg stage-empty-btn" onClick={() => document.getElementById('long-file')?.click()}>
            <ImagePlus size={18} />
            {t('longUpload')}
          </button>
          <p className="stage-empty-hint">{t('dragHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollerRef}
      className={`stage long-stage${isDropping ? ' is-dropping' : ''}`}
      onScroll={handleScroll}
      onDragOver={(e) => { e.preventDefault(); setIsDropping(true) }}
      onDragLeave={() => setIsDropping(false)}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        className="long-preview"
        style={{ width: '100%', height: 'auto', cursor: selectedTextId ? 'grab' : 'default', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="long-stage-bar">
        <span>{t('longTotalHeight')}: {layout.height}px × {layout.width}px</span>
        <span className="long-stage-hint">{t('longTextDragHint')}</span>
        <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('long-file')?.click()}>
          <Upload size={14} />
          {t('longUpload')}
        </button>
      </div>
    </div>
  )
}