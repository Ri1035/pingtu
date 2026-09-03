import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Trash2,
  Type,
  Sticker,
  Check,
  X,
} from 'lucide-react'
import type { AssetItem } from '../types'
import { useI18n } from '../i18n'
import { STICKER_GLYPHS } from '../lib/stickers'

/**
 * 素材修图编辑器（全屏覆盖层）
 * ------------------------------------------------------------------
 * 能力：
 *   - 旋转 90° / 水平垂直翻转（所见即所得）
 *   - 裁剪：预设比例（1:1 / 4:3 / 3:4 / 16:9），按比例从内容居中裁切；
 *     「Free/自由」= 不裁剪
 *   - 叠加文字（改字号/颜色/拖动定位）
 *   - 叠加 emoji 贴纸（改大小/拖动定位）
 * 结果：保存为「新素材」入库（origin=edited），原素材保留。
 *
 * 坐标系约定（所有预览/导出共用 drawEditScene，保证所见即所得）：
 *   - 「内容区」= 旋转 / 翻转后、裁切前的整张图片
 *   - 旋转 90/270 时内容宽高互换
 *   - 裁剪窗口从内容区「居中」取目标比例（无自由拖框，避免拖框复杂度）
 *   - 图层存于「最终画布」的比例坐标（0~1），不受裁剪影响
 */

interface EditLayer {
  id: string
  kind: 'text' | 'sticker'
  content: string
  /** 字号：相对输出画布短边的比例 */
  fontSizeRatio: number
  color: string
  /** 相对最终画布宽高的比例中心点 0~1 */
  x: number
  y: number
  rotation: number
}

interface Props {
  asset: AssetItem
  sourceImage: HTMLImageElement
  onSave: (blob: Blob) => void
  onClose: () => void
}

const CROP_RATIO_KEYS: { key: string; value: number }[] = [
  { key: 'chipFree', value: 0 },
  { key: 'chip11', value: 1 },
  { key: 'chip43', value: 4 / 3 },
  { key: 'chip34', value: 3 / 4 },
  { key: 'chip169', value: 16 / 9 },
]
const PRESET_COLORS = ['#111827', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#2563eb', '#a855f7', '#ec4899']
const MAX_OUTPUT = 4096

function uid(): string {
  return `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

export function AssetEditor({ asset, sourceImage, onSave, onClose }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [cropRatio, setCropRatio] = useState(0) // 0 = 自由（不裁）
  const [layers, setLayers] = useState<EditLayer[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [saving, setSaving] = useState(false)

  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // —— 内容区尺寸（旋转后） ——
  const rotated = rotation % 180 !== 0
  const contentW = rotated ? sourceImage.naturalHeight : sourceImage.naturalWidth
  const contentH = rotated ? sourceImage.naturalWidth : sourceImage.naturalHeight

  /** 内容区按 cropRatio 居中裁切后的逻辑尺寸（像素）。cropRatio=0 → 全图 */
  const cropSize = useMemo(() => {
    if (cropRatio <= 0) return { w: contentW, h: contentH }
    if (contentW / contentH > cropRatio) {
      // 内容偏宽 → 裁宽度
      return { w: contentH * cropRatio, h: contentH }
    }
    return { w: contentW, h: contentW / cropRatio }
  }, [cropRatio, contentW, contentH])

  // —— 输出画布（crop 区域 + 缩放上限） ——
  const outSize = useMemo(() => {
    const scale = Math.min(1, MAX_OUTPUT / Math.max(cropSize.w, cropSize.h))
    return {
      w: Math.max(1, Math.round(cropSize.w * scale)),
      h: Math.max(1, Math.round(cropSize.h * scale)),
    }
  }, [cropSize])

  // —— 预览显示尺寸 ——
  const [view, setView] = useState({ w: 0, h: 0 })
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const availW = Math.max(80, el.clientWidth - 90)
    const availH = Math.max(80, el.clientHeight - 170)
    const scale = Math.min(availW / outSize.w, availH / outSize.h, 2)
    setView({ w: Math.max(1, Math.round(outSize.w * scale)), h: Math.max(1, Math.round(outSize.h * scale)) })
  }, [outSize])

  useEffect(() => {
    fitView()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(fitView)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])

  // —— 绘制（预览） ——
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || view.w <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = Math.round(view.w * dpr)
    canvas.height = Math.round(view.h * dpr)
    canvas.style.width = `${view.w}px`
    canvas.style.height = `${view.h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawEditScene(ctx, sourceImage, { rotation, flipH, flipV }, cropSize, layers, view.w, view.h, activeId)
  }, [view, sourceImage, rotation, flipH, flipV, cropSize, layers, activeId])

  // —— 键盘 ——
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeId) {
        e.preventDefault()
        setLayers((prev) => prev.filter((l) => l.id !== activeId))
        setActiveId(null)
      } else if (e.key === 'Escape') {
        setActiveId(null)
        setShowStickerPanel(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId])

  const addTextLayer = useCallback(() => {
    const layer: EditLayer = {
      id: uid(),
      kind: 'text',
      content: t('assetEditNewText'),
      fontSizeRatio: 0.1,
      color: '#111827',
      x: 0.5,
      y: 0.5,
      rotation: 0,
    }
    setLayers((prev) => [...prev, layer])
    setActiveId(layer.id)
    setShowStickerPanel(false)
  }, [t])

  const addStickerLayer = useCallback((glyph: string) => {
    const layer: EditLayer = {
      id: uid(),
      kind: 'sticker',
      content: glyph,
      fontSizeRatio: 0.22,
      color: '#000000',
      x: 0.5,
      y: 0.5,
      rotation: 0,
    }
    setLayers((prev) => [...prev, layer])
    setActiveId(layer.id)
    setShowStickerPanel(false)
  }, [])

  const updateActive = useCallback(
    (patch: Partial<EditLayer>) => {
      setLayers((prev) => prev.map((l) => (l.id === activeId ? { ...l, ...patch } : l)))
    },
    [activeId],
  )

  /** 画布像素内命中图层（用 measureText 精确量宽度，从上层往下） */
  const layerAtPixel = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const px = clientX - rect.left
      const py = clientY - rect.top
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i]
        const fs = l.fontSizeRatio * Math.min(rect.width, rect.height)
        ctx.font = `${fs}px system-ui, -apple-system, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
        const w = ctx.measureText(l.content).width
        const cx = l.x * rect.width
        const cy = l.y * rect.height
        if (px >= cx - w / 2 - 6 && px <= cx + w / 2 + 6 && py >= cy - fs / 2 - 6 && py <= cy + fs / 2 + 6) {
          return l.id
        }
      }
      return null
    },
    [layers],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hitId = layerAtPixel(e.clientX, e.clientY)
    if (hitId) {
      const l = layers.find((item) => item.id === hitId)
      if (!l) return
      setActiveId(hitId)
      dragRef.current = {
        id: hitId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: l.x,
        origY: l.y,
      }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }
    setActiveId(null)
    setShowStickerPanel(false)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const nx = d.origX + (e.clientX - d.startX) / rect.width
    const ny = d.origY + (e.clientY - d.startY) / rect.height
    setLayers((prev) => prev.map((l) => (l.id === d.id ? { ...l, x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)) } : l)))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const activeLayer = layers.find((l) => l.id === activeId) ?? null
  const activeTextLayer = activeLayer?.kind === 'text'

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = outSize.w
      canvas.height = outSize.h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      drawEditScene(ctx, sourceImage, { rotation, flipH, flipV }, cropSize, layers, outSize.w, outSize.h, null)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('导出失败')
      onSave(blob)
    } finally {
      setSaving(false)
    }
  }, [sourceImage, rotation, flipH, flipV, cropSize, layers, outSize, onSave])

  return (
    <div className="asset-editor" ref={containerRef}>
      <div className="asset-editor-topbar">
        <div className="asset-editor-title">
          <span className="asset-editor-name" title={asset.name}>
            {asset.name}
          </span>
          <span className="pill">{`${outSize.w} × ${outSize.h}`}</span>
        </div>
        <div className="asset-editor-tools">
          <button type="button" className="btn btn-icon" title={t('rotateRight')} aria-label={t('rotateRight')} onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw size={16} />
          </button>
          <button type="button" className={`btn btn-icon${flipH ? ' is-active' : ''}`} title={t('flipH')} aria-label={t('flipH')} onClick={() => setFlipH((v) => !v)}>
            <FlipHorizontal2 size={16} />
          </button>
          <button type="button" className={`btn btn-icon${flipV ? ' is-active' : ''}`} title={t('flipV')} aria-label={t('flipV')} onClick={() => setFlipV((v) => !v)}>
            <FlipVertical2 size={16} />
          </button>
          <span className="divider-v" />
          <button type="button" className="btn btn-icon" title={t('assetEditAddText')} aria-label={t('assetEditAddText')} onClick={addTextLayer}>
            <Type size={16} />
          </button>
          <button
            type="button"
            className={`btn btn-icon${showStickerPanel ? ' is-active' : ''}`}
            title={t('assetEditAddSticker')}
            aria-label={t('assetEditAddSticker')}
            onClick={() => {
              setShowStickerPanel((v) => !v)
              setActiveId(null)
            }}
          >
            <Sticker size={16} />
          </button>
        </div>
        <div className="asset-editor-actions">
          <button type="button" className="btn" onClick={onClose}>
            <X size={15} />
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Check size={15} />
            {saving ? t('saving') : t('assetEditSave')}
          </button>
        </div>
      </div>

      <div className="asset-editor-body">
        <canvas
          ref={canvasRef}
          className="asset-editor-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ cursor: activeLayer ? 'grab' : 'default' }}
        />

        {/* 裁剪比例条 */}
        <div className="asset-editor-crops">
          {CROP_RATIO_KEYS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${cropRatio === c.value ? ' is-active' : ''}`}
              onClick={() => setCropRatio(c.value)}
              aria-label={t(c.key)}
            >
              {t(c.key)}
            </button>
          ))}
        </div>

        {activeLayer && (
          <div className="asset-editor-props">
            {activeTextLayer ? (
              <input
                className="text-input"
                value={activeLayer.content}
                onChange={(e) => updateActive({ content: e.target.value })}
                placeholder={t('textContentPlaceholder')}
              />
            ) : (
              <span className="asset-editor-glyph-preview">{activeLayer.content}</span>
            )}
            <label className="asset-editor-slider">
              <span className="field-label">{t('assetEditSize')}</span>
              <input
                type="range"
                className="slider"
                min={0.03}
                max={0.8}
                step={0.01}
                value={activeLayer.fontSizeRatio}
                onChange={(e) => updateActive({ fontSizeRatio: Number(e.target.value) })}
              />
            </label>
            {activeTextLayer && (
              <div className="color-row">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`preset-color${activeLayer.color === c ? ' is-active' : ''}`}
                    style={{ background: c, border: c === '#ffffff' ? '1px solid #d5dce6' : undefined }}
                    onClick={() => updateActive({ color: c })}
                    aria-label={c}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setLayers((prev) => prev.filter((l) => l.id !== activeId))
                setActiveId(null)
              }}
              aria-label={t('textDelete')}
            >
              <Trash2 size={14} />
              {t('textDelete')}
            </button>
          </div>
        )}

        {showStickerPanel && (
          <div className="sticker-panel">
            {STICKER_GLYPHS.map((g) => (
              <button key={g} type="button" className="sticker-cell" onClick={() => addStickerLayer(g)} aria-label={g}>
                {g}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 渲染编辑场景（预览与导出共用，所见即所得）。
 * @param cropW cropH 裁切窗口的像素宽高（内容坐标），已是旋转/翻转后图像的比例裁切
 */
function drawEditScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  transform: { rotation: number; flipH: boolean; flipV: boolean },
  crop: { w: number; h: number },
  layers: EditLayer[],
  outW: number,
  outH: number,
  activeId: string | null,
): void {
  ctx.save()
  ctx.clearRect(0, 0, outW, outH)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 1) 旋转/翻转后的内容坐标系：源图按 rotation/flip 变换后，内容宽=crop 基准
  // 做法：先算「未旋转源图」的绘制尺寸，让旋转后等于 crop.w × crop.h 的内容
  // 源图绘制时以中心对齐；旋转 90 会交换宽高。
  const rotated = transform.rotation % 180 !== 0
  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  // 内容完整尺寸（旋转后）：crop 是旋转后内容的一部分，但旋转前 drawImage 需要源区域
  // 简化正确模型：把「旋转后完整内容」缩放到 fit outW/outH，再 clip crop
  // 由于 crop 保持中心（ratio 裁剪），完整内容中心 = crop 中心。
  // 完整内容尺寸（旋转后）：
  const contentFullW = rotated ? srcH : srcW
  const contentFullH = rotated ? srcW : srcH
  // 画布 = crop 部分放大到 outW×outH；因此完整内容在画布上的尺寸：
  const fullOnCanvasW = (contentFullW / crop.w) * outW
  const fullOnCanvasH = (contentFullH / crop.h) * outH

  ctx.save()
  // clip 到输出画布
  ctx.beginPath()
  ctx.rect(0, 0, outW, outH)
  ctx.clip()
  // 内容中心位于画布中心（因为 crop 是中心裁切）
  ctx.translate(outW / 2, outH / 2)
  ctx.scale(fullOnCanvasW / srcW, fullOnCanvasH / srcH)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  if (transform.flipH) ctx.scale(-1, 1)
  if (transform.flipV) ctx.scale(1, -1)
  ctx.drawImage(img, -srcW / 2, -srcH / 2)
  ctx.restore()

  // 2) 图层（基于输出画布比例坐标）
  for (const layer of layers) {
    const fs = layer.fontSizeRatio * Math.min(outW, outH)
    ctx.save()
    ctx.font = `${fs}px system-ui, -apple-system, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = layer.color
    ctx.translate(layer.x * outW, layer.y * outH)
    if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.fillText(layer.content, 0, 0)
    ctx.restore()

    if (activeId === layer.id) {
      const w = ctx.measureText(layer.content).width
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#2563eb'
      ctx.translate(layer.x * outW, layer.y * outH)
      if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180)
      ctx.strokeRect(-w / 2 - 6, -fs / 2 - 6, w + 12, fs + 12)
      ctx.restore()
    }
  }
  ctx.restore()
}
