import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { useI18n } from '../i18n'
import type { LongStore } from '../hooks/useLongCollage'
import { drawLongCollage } from '../lib/longCollage'
import { drawText, drawWatermark } from '../lib/render'
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
  // 离屏基础层缓存：背景/棋盘格 + 图片堆叠 + 标题（静态，仅在这些变化或容器尺寸变化时重画）。
  // 拖拽文字时直接 drawImage 贴回，避免逐帧重跑 paintCell 的离屏渐变，显著降低卡顿。
  const baseCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const textDrag = useRef<TextDrag | null>(null)
  // rAF 合并拖拽位移：一帧只提交一次状态更新，避免高频 pointer 事件导致重渲抖动
  const textDragRaf = useRef<number | null>(null)
  const pendingTextMove = useRef<{ id: string; x: number; y: number } | null>(null)
  const [boxW, setBoxW] = useState(0)
  const [isDropping, setIsDropping] = useState(false)
  // 基础层重画后自增，驱动动态层在下一次渲染时重新合成
  const [baseKey, setBaseKey] = useState(0)

  // 预览绘制尺寸：以设计宽度为准，过低时放大填满可用宽度，高度封顶
  const drawSize = useMemo(() => {
    const designW = Math.max(1, layout.width)
    if (designW <= 0) return null
    let drawW = Math.max(designW, Math.round(boxW))
    if (layout.height > 0 && (layout.height / designW) * drawW > PREVIEW_MAX_H) {
      drawW = Math.max(1, Math.floor((PREVIEW_MAX_H * designW) / layout.height))
    }
    const drawH = Math.max(1, Math.round((layout.height / designW) * drawW))
    return { designW, drawW, drawH }
  }, [layout, boxW])

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

  // —— 基础层：背景/棋盘格 + 图片堆叠 + 标题 ——
  // 只在图片、样式或容器尺寸变化时重画到离屏画布，拖拽文字不会触碰这层。
  useEffect(() => {
    if (!drawSize || scene.photos.length === 0) return
    const { designW, drawW, drawH } = drawSize
    const base = baseCanvasRef.current
    if (base.width !== drawW) base.width = drawW
    if (base.height !== drawH) base.height = drawH
    const ctx = base.getContext('2d')
    if (!ctx) return
    drawLongCollage(ctx, { ...scene, style: { ...scene.style, width: designW } }, drawW, {
      layers: 'base',
      checkerboard: scene.style.transparent,
    })
    setBaseKey((k) => k + 1)
  }, [scene.photos, scene.style, drawSize])

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
      // 斜切按「中心为原点的水平剪切」计入外接盒：x 方向整体加宽 |tan| * 半高
      const W = maxW * wScale
      const H = lines.length * lineHeight * hScale
      const shear = Math.abs(Math.tan(((text.skewX ?? 0) * Math.PI) / 180)) * H * 0.5
      return { x: cx - W / 2 - shear, y: cy - H / 2, w: W + shear * 2, h: H }
    },
    [],
  )

  // 组合绘制：贴回缓存的 base，再叠加上动态层（文字 + 水印）+ 选中框。
  // 字体缩放口径与 drawLongCollage 一致（fontSize 以 1600 为基准）。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !drawSize || scene.photos.length === 0) return
    const { drawW, drawH } = drawSize
    if (canvas.width !== drawW) canvas.width = drawW
    if (canvas.height !== drawH) canvas.height = drawH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const base = baseCanvasRef.current
    if (base.width === drawW && base.height === drawH) ctx.drawImage(base, 0, 0)

    // 附加文字（动态层）
    if (scene.texts) {
      for (const text of scene.texts) {
        drawText(ctx, text, drawW, drawH)
      }
    }
    // 水印叠加最上层
    if (scene.watermark) {
      drawWatermark(ctx, scene.watermark, scene.watermarkImage ?? null, drawW, drawH)
    }

    // 选中文字虚线框（在画布设计坐标系里绘制）
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
  }, [scene.texts, selectedTextId, scene.watermark, scene.watermarkImage, baseKey, drawSize, texts, textBounds])

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
      pendingTextMove.current = { id: td.textId, x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)) }
      if (textDragRaf.current == null) {
        textDragRaf.current = requestAnimationFrame(() => {
          textDragRaf.current = null
          const p = pendingTextMove.current
          pendingTextMove.current = null
          if (p) updateText(p.id, { x: p.x, y: p.y })
        })
      }
    },
    [updateText],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (textDrag.current?.pointerId === e.pointerId) {
        // 拖拽结束时立即落定最后一个待提交的位置，避免丢帧
        if (textDragRaf.current != null) {
          cancelAnimationFrame(textDragRaf.current)
          textDragRaf.current = null
        }
        const p = pendingTextMove.current
        pendingTextMove.current = null
        if (p) updateText(p.id, { x: p.x, y: p.y })
        textDrag.current = null
      }
    },
    [updateText],
  )

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