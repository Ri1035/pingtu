import { useEffect, useRef, useState } from 'react'
import { CornerDownRight, Grid3x3, Image as ImageIcon, ImagePlus, LayoutGrid, Type } from 'lucide-react'
import { Field, Segmented, Slider, Switch } from './ui/Controls'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'
import { detectFonts, type FontInfo } from '../lib/fonts'
import { WATERMARK_TEMPLATES } from '../lib/watermark'

interface Props {
  store: CollageStore
}

const PRESET_WATERMARK_COLORS = ['#111827', '#ffffff', '#6b7280', '#dc2626', '#2563eb']

/** 模板 id → 图标 */
const TPL_ICONS: Record<string, typeof Type> = {
  textTile: Grid3x3,
  textCenter: Type,
  textCorner: CornerDownRight,
  imageTile: LayoutGrid,
  imageCenter: ImageIcon,
}

export function WatermarkPanel({ store }: Props) {
  const { t } = useI18n()
  const { watermark, setWatermark, watermarkImage, setWatermarkImage } = store
  const [fonts, setFonts] = useState<FontInfo[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    detectFonts()
      .then((list) => {
        if (alive) setFonts(list)
      })
      .catch(() => {
        /* 字体探测失败时忽略，使用默认字体 */
      })
    return () => {
      alive = false
    }
  }, [])

  const handlePickImage = () => fileRef.current?.click()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setWatermarkImage(img)
        setWatermark({ type: 'image' })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <Switch
        checked={watermark.enabled}
        label={t('watermarkEnable')}
        onChange={(on) => setWatermark({ enabled: on })}
      />

      {!watermark.enabled ? (
        <div className="field-hint" style={{ marginTop: 8 }}>
          {t('watermarkHint')}
        </div>
      ) : (
        <>
          <Field label={t('watermarkTemplate')}>
            <div className="template-grid">
              {WATERMARK_TEMPLATES.map((tpl) => {
                const Icon = TPL_ICONS[tpl.id] ?? Type
                const label = `watermarkTpl${tpl.id.charAt(0).toUpperCase()}${tpl.id.slice(1)}`
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className="template-card"
                    onClick={() => setWatermark(tpl.patch)}
                  >
                    <Icon size={16} />
                    <span>{t(label)}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label={t('watermarkType')}>
            <Segmented
              value={watermark.type}
              onChange={(v) => setWatermark({ type: v })}
              options={[
                { value: 'text' as const, label: t('watermarkTypeText') },
                { value: 'image' as const, label: t('watermarkTypeImage') },
              ]}
            />
          </Field>

          <Field label={t('watermarkMode')}>
            <Segmented
              value={watermark.mode}
              onChange={(v) => setWatermark({ mode: v })}
              options={[
                { value: 'tile' as const, label: t('watermarkModeTile') },
                { value: 'single' as const, label: t('watermarkModeSingle') },
              ]}
            />
          </Field>

          {watermark.type === 'text' ? (
            <>
              <Field label={t('watermarkText')}>
                <input
                  className="text-input"
                  value={watermark.text}
                  placeholder={t('watermarkTextPlaceholder')}
                  onChange={(e) => setWatermark({ text: e.target.value })}
                />
              </Field>

              <Field label={t('textFont')}>
                <select
                  className="text-input"
                  value={watermark.fontFamily}
                  onChange={(e) => setWatermark({ fontFamily: e.target.value })}
                >
                  {fonts.map((f) => (
                    <option
                      key={f.family}
                      value={f.family}
                      style={{ fontFamily: `"${f.family}", sans-serif` }}
                    >
                      {f.family}
                      {f.generic ? ` (${t('fontGeneric')})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('textSize')} value={`${watermark.fontSize}px`}>
                <Slider value={watermark.fontSize} min={12} max={160} onChange={(v) => setWatermark({ fontSize: v })} />
              </Field>

              <Field label={t('textColor')}>
                <div className="color-row">
                  <input
                    className="swatch"
                    type="color"
                    value={watermark.color}
                    onChange={(e) => setWatermark({ color: e.target.value })}
                    aria-label={t('textColor')}
                  />
                  <div className="preset-colors" style={{ marginTop: 0 }}>
                    {PRESET_WATERMARK_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`preset-color${watermark.color === c ? ' is-active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setWatermark({ color: c })}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label={watermarkImage ? t('watermarkUploadReplace') : t('watermarkUpload')}>
                {watermarkImage ? (
                  <div className="watermark-image-row">
                    <img className="watermark-thumb" src={watermarkImage.src} alt="" />
                    <button type="button" className="btn btn-ghost" onClick={handlePickImage}>
                      {t('watermarkUploadReplace')}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary btn-lg" onClick={handlePickImage}>
                    <ImagePlus size={16} />
                    {t('watermarkUpload')}
                  </button>
                )}
              </Field>

              <Field label={t('watermarkScale')} value={`${Math.round(watermark.imageScale * 100)}%`}>
                <Slider
                  value={watermark.imageScale}
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  onChange={(v) => setWatermark({ imageScale: v })}
                />
              </Field>
            </>
          )}

          <Field label={t('opacity')} value={`${Math.round(watermark.opacity * 100)}%`}>
            <Slider value={watermark.opacity} min={0.02} max={1} step={0.01} onChange={(v) => setWatermark({ opacity: v })} />
          </Field>

          <Field label={t('textRotation')} value={`${watermark.rotation}°`}>
            <Slider value={watermark.rotation} min={-90} max={90} onChange={(v) => setWatermark({ rotation: v })} />
          </Field>

          {watermark.mode === 'tile' ? (
            <Field label={t('watermarkSpacing')} value={`${watermark.spacing}px`}>
              <Slider value={watermark.spacing} min={0} max={400} onChange={(v) => setWatermark({ spacing: v })} />
            </Field>
          ) : (
            <>
              <Field label={t('watermarkPositionX')} value={`${Math.round(watermark.x * 100)}%`}>
                <Slider value={watermark.x} min={0} max={1} step={0.01} onChange={(v) => setWatermark({ x: v })} />
              </Field>
              <Field label={t('watermarkPositionY')} value={`${Math.round(watermark.y * 100)}%`}>
                <Slider value={watermark.y} min={0} max={1} step={0.01} onChange={(v) => setWatermark({ y: v })} />
              </Field>
            </>
          )}

          <div className="field-hint">{t('watermarkHint')}</div>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
    </>
  )
}