import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Field, NumberInput, Segmented, Slider, Switch } from './ui/Controls'
import { TextPanel, type TextStore } from './TextPanel'
import { WatermarkPanel } from './WatermarkPanel'
import { AssetPanel } from './AssetPanel'
import { useI18n } from '../i18n'
import type { LongStore } from '../hooks/useLongCollage'
import type { AssetStore } from '../hooks/useAssets'
import { LONG_SLICE_HEIGHT, LONG_WIDTH_PRESETS } from '../lib/longCollage'
import { FORMAT_LABEL } from '../lib/export'
import type { ExportFormat } from '../types'
import { formatBytes } from '../lib/image'

interface Props {
  store: LongStore
  assetStore: AssetStore
  /** 当前选中文字 id（与长图预览画布共享同一选中态） */
  selectedTextId: string | null
  onSelectText: (id: string | null) => void
  busy: boolean
  lastResult: { size: number; width: number; height: number } | null
  onExport: () => void
}

const PRESET_BACKGROUNDS = ['#ffffff', '#f5f5f4', '#111827', '#0f172a', '#2563eb', '#fecdd3', '#d9f99d']

export function LongCollagePanel({ store, assetStore, selectedTextId, onSelectText, busy, lastResult, onExport }: Props) {
  const { t } = useI18n()
  const { photos, style, setStyle, texts, exportState, setExportState, addFiles, removePhoto, movePhoto, setNotice } = store
  const fileRef = useRef<HTMLInputElement>(null)
  // 堆叠中选中的插入锚点（索引）：在此项后面插入素材库图片；null = 追加到末尾
  const [insertAt, setInsertAt] = useState<number | null>(null)

  const isWidthPreset = LONG_WIDTH_PRESETS.includes(style.width)
  const selectedText = texts.find((it) => it.id === selectedTextId) ?? null

  /** 把素材库的图片追加到长拼图堆叠队列（若已选中插入点，则插到其后面） */
  const handleAddAsset = (file: File) => {
    void addFiles([file], insertAt != null ? insertAt + 1 : undefined)
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const n = await addFiles(files)
    if (n > 0) setNotice(null)
    e.target.value = ''
  }

  return (
    <>
      {/* —— 上传 —— */}
      <button type="button" className="btn btn-primary btn-lg" onClick={() => fileRef.current?.click()}>
        <ImagePlus size={16} />
        {t('longUpload')}
      </button>
      <div className="field-hint">{t('longUploadHint')}</div>
      <input id="long-file" ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />

      {/* —— 图片顺序 —— */}
      {photos.length > 0 && (
        <section>
          <div className="section-title">{t('longStack')}</div>
          <div className="long-stack">
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                className={`long-stack-item${insertAt === i ? ' is-insert-target' : ''}`}
                onClick={() => setInsertAt(i === insertAt ? null : i)}
                title={t('longInsertPick')}
              >
                <img className="long-stack-thumb" src={photo.thumb} alt="" />
                <span className="long-stack-order">{i + 1}</span>
                <span className="long-stack-name">{photo.name ?? photo.id}</span>
                <div className="long-stack-actions">
                  <button type="button" title={t('longMoveUp')} disabled={i === 0} onClick={(e) => { e.stopPropagation(); movePhoto(i, -1) }}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" title={t('longMoveDown')} disabled={i === photos.length - 1} onClick={(e) => { e.stopPropagation(); movePhoto(i, 1) }}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" title={t('longRemove')} onClick={(e) => { e.stopPropagation(); removePhoto(photo.id) }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 6 }}>
            {insertAt != null ? (
              <>
                {t('longInsertActive', insertAt + 1)}
                <button type="button" className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setInsertAt(null)}>
                  {t('longInsertCancel')}
                </button>
              </>
            ) : (
              t('longInsertHint')
            )}
          </div>
          <div className="divider" />
        </section>
      )}

      {/* —— 样式 —— */}
      <section>
        <div className="section-title">{t('longSectionStyle')}</div>

        <Field label={t('longCanvasWidth')} value={`${style.width}px`}>
          <div className="ratio-row">
            {LONG_WIDTH_PRESETS.map((w) => (
              <button key={w} type="button" className={`ratio-btn${style.width === w ? ' is-active' : ''}`} onClick={() => setStyle({ width: w })}>
                {w}
              </button>
            ))}
            <button type="button" className={`ratio-btn${!isWidthPreset ? ' is-active' : ''}`} onClick={() => setStyle({ width: 1440 })}>
              {t('widthCustom')}
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <NumberInput value={style.width} min={320} max={4096} onChange={(width) => setStyle({ width })} />
          </div>
          <div className="field-hint" style={{ marginTop: 6 }}>{t('longWidthHint')}</div>
        </Field>

        <Field label={t('longFeather')} value={`${style.feather}px`}>
          <Slider value={style.feather} min={0} max={300} step={4} onChange={(feather) => setStyle({ feather })} />
          <div className="field-hint">{t('longFeatherHint')}</div>
        </Field>

        <Field label={t('longTitleText')}>
          <input className="text-input" value={style.title} onChange={(e) => setStyle({ title: e.target.value })} placeholder={t('longTitle')} />
        </Field>
        {style.title && (
          <>
            <Field label={t('longTitleColor')}>
              <div className="color-row">
                <input className="swatch" type="color" value={style.titleColor} onChange={(e) => setStyle({ titleColor: e.target.value })} aria-label={t('longTitleColor')} />
              </div>
            </Field>
            <Field label={t('longTitleSize')} value={`${style.titleSize}px`}>
              <Slider value={style.titleSize} min={12} max={160} onChange={(titleSize) => setStyle({ titleSize })} />
            </Field>
          </>
        )}

        <Field label={t('background')}>
          <div className="color-row">
            <input className="swatch" type="color" value={style.background} onChange={(e) => setStyle({ background: e.target.value })} aria-label={t('background')} />
            <div className="preset-colors" style={{ marginTop: 0 }}>
              {PRESET_BACKGROUNDS.map((c) => (
                <button key={c} type="button" className={`preset-color${style.background === c ? ' is-active' : ''}`} style={{ background: c }} onClick={() => setStyle({ background: c })} title={c} />
              ))}
            </div>
          </div>
        </Field>

        <Switch checked={style.transparent} label={t('transparent')} onChange={(transparent) => setStyle({ transparent })} />
        <div className="field-hint">{t('transparentHint')}</div>
      </section>

      <div className="divider" />

      {/* —— 文字（复用主拼图） —— */}
      <section>
        <div className="section-title">{t('tabText')}</div>
        <TextPanel store={store as TextStore} selectedTextId={selectedTextId} onSelectText={onSelectText} />
        {selectedText && (
          <>
            <Field label="X" value={`${Math.round(selectedText.x * 100)}%`}>
              <Slider value={selectedText.x} min={-0.2} max={1.2} step={0.01} onChange={(x) => store.updateText(selectedText.id, { x })} />
            </Field>
            <Field label="Y" value={`${Math.round(selectedText.y * 100)}%`}>
              <Slider value={selectedText.y} min={0} max={1} step={0.01} onChange={(y) => store.updateText(selectedText.id, { y })} />
            </Field>
            <div className="field-hint">{t('longTextPositionHint')}</div>
          </>
        )}
      </section>

      <div className="divider" />

      {/* —— 水印（复用主拼图） —— */}
      <section>
        <div className="section-title">{t('tabWatermark')}</div>
        <WatermarkPanel store={store} />
      </section>

      <div className="divider" />

      {/* —— 素材库（复用主拼图，追加进长图队列） —— */}
      <section>
        <div className="section-title">{t('tabAssets')}</div>
        <AssetPanel assetStore={assetStore} onAddFileToCollage={handleAddAsset} />
      </section>

      <div className="divider" />

      {/* —— 导出 —— */}
      <section>
        <div className="section-title">{t('longSectionExport')}</div>

        <Field label={t('exportFormat')}>
          <Segmented<ExportFormat>
            value={exportState.format}
            onChange={(format) => setExportState({ format })}
            options={[
              { value: 'png', label: FORMAT_LABEL.png },
              { value: 'jpeg', label: FORMAT_LABEL.jpeg },
              { value: 'webp', label: FORMAT_LABEL.webp },
            ]}
          />
        </Field>

        <Field label={t('exportQuality')} value={exportState.format === 'png' ? t('lossless') : `${Math.round(exportState.quality * 100)}%`}>
          <Slider value={Math.round(exportState.quality * 100)} min={50} max={100} disabled={exportState.format === 'png'} onChange={(v) => setExportState({ quality: v / 100 })} />
        </Field>

        <Field label={t('longExportWidth')} value={`${exportState.width}px`}>
          <div className="ratio-row">
            {LONG_WIDTH_PRESETS.map((w) => (
              <button key={w} type="button" className={`ratio-btn${exportState.width === w ? ' is-active' : ''}`} onClick={() => setExportState({ width: w })}>
                {w}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <NumberInput value={exportState.width} min={320} max={4096} onChange={(width) => setExportState({ width })} />
          </div>
        </Field>

        <Switch checked={exportState.slice} label={t('longSlice')} onChange={(slice) => setExportState({ slice })} />
        <div className="field-hint">{t('longSliceHint')}</div>
        {exportState.slice && (
          <Field label={t('longSegment')} value={`${exportState.segment}px`}>
            <Slider value={exportState.segment ?? LONG_SLICE_HEIGHT} min={1000} max={10000} step={500} onChange={(segment) => setExportState({ segment })} />
          </Field>
        )}

        <Field label={t('longTotalHeight')} value={lastResult ? `${lastResult.height} × ${lastResult.width} px` : `${Math.round((store.layout.height * exportState.width) / Math.max(1, style.width))} × ${exportState.width} px`}>
          <div className="field-hint">
            {lastResult ? `${t('lastExport')}：${formatBytes(lastResult.size)}` : t('exportSizeHint')}
          </div>
        </Field>

        <button type="button" className="btn btn-primary btn-lg" disabled={busy || photos.length === 0} onClick={onExport}>
          {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          {busy ? t('downloading') : t('download')}
        </button>
      </section>
    </>
  )
}