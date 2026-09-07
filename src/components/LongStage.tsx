import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { useI18n } from '../i18n'
import type { LongStore } from '../hooks/useLongCollage'
import { drawLongCollage } from '../lib/longCollage'

/** 预览画布的安全高度上限，防止超大长图触发浏览器 canvas 尺寸限制 */
const PREVIEW_MAX_H = 14000

interface Props {
  store: LongStore
}

/**
 * 长拼图预览画布。
 * 与主拼图同一套 drawLongCollage：预览即所见即所得（含模糊边缘 / 文字 / 水印）。
 * 画布内部按「设计宽度」绘制，CSS 等比缩放铺满可用宽度并保持纵向无限滚动。
 */
export function LongStage({ store }: Props) {
  const { t } = useI18n()
  const { scene, layout, addFiles } = store
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [boxW, setBoxW] = useState(0)
  const [isDropping, setIsDropping] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setBoxW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 依据可用宽度重绘预览
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || scene.photos.length === 0) return

    const designW = Math.max(1, layout.width)
    let drawW = Math.max(designW, Math.round(boxW))
    // 高度封顶：过长时降低绘制宽度，保证不超过浏览器 canvas 上限
    if (designW > 0 && layout.height / designW * drawW > PREVIEW_MAX_H) {
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
  }, [scene, layout, boxW])

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
      <div className="stage long-stage" onDragOver={(e) => { e.preventDefault(); setIsDropping(true) }} onDragLeave={() => setIsDropping(false)} onDrop={onDrop}>
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
      ref={containerRef}
      className={`stage long-stage${isDropping ? ' is-dropping' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDropping(true) }}
      onDragLeave={() => setIsDropping(false)}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} className="long-preview" style={{ width: '100%', height: 'auto' }} />
      <div className="long-stage-bar">
        <span>{t('longTotalHeight')}: {layout.height}px × {layout.width}px</span>
        <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('long-file')?.click()}>
          <Upload size={14} />
          {t('longUpload')}
        </button>
      </div>
    </div>
  )
}