import { Download, Loader2 } from 'lucide-react'
import { Field, NumberInput, Segmented, Slider } from './ui/Controls'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'
import {
  EXPORT_WIDTH_PRESETS,
  FORMAT_LABEL,
  MAX_EXPORT_WIDTH,
  MIN_EXPORT_WIDTH,
} from '../lib/export'
import type { ExportFormat } from '../types'
import { computeCanvasSize } from '../lib/render'
import { formatBytes } from '../lib/image'

interface Props {
  store: CollageStore
  busy: boolean
  lastResult: { size: number; width: number; height: number } | null
  onExport: () => void
}

export function ExportPanel({ store, busy, lastResult, onExport }: Props) {
  const { t } = useI18n()
  const { exportOptions, setExportOptions, scene, filledCount } = store

  const size = computeCanvasSize(scene, exportOptions.width)
  const isPreset = EXPORT_WIDTH_PRESETS.includes(exportOptions.width)

  return (
    <>
      <Field label={t('exportFormat')}>
        <Segmented<ExportFormat>
          value={exportOptions.format}
          onChange={(format) => setExportOptions({ format })}
          options={[
            { value: 'png', label: FORMAT_LABEL.png },
            { value: 'jpeg', label: FORMAT_LABEL.jpeg },
            { value: 'webp', label: FORMAT_LABEL.webp },
          ]}
        />
      </Field>

      <Field
        label={t('exportQuality')}
        value={exportOptions.format === 'png' ? '无损' : `${Math.round(exportOptions.quality * 100)}%`}
      >
        <Slider
          value={Math.round(exportOptions.quality * 100)}
          min={50}
          max={100}
          disabled={exportOptions.format === 'png'}
          onChange={(v) => setExportOptions({ quality: v / 100 })}
        />
        {exportOptions.format === 'png' && <div className="field-hint">PNG 为无损格式，质量固定</div>}
      </Field>

      <div className="divider" />

      <Field label={t('exportWidth')} value={`${exportOptions.width}px`}>
        <div className="ratio-row">
          {EXPORT_WIDTH_PRESETS.map((w) => (
            <button
              key={w}
              type="button"
              className={`ratio-btn${exportOptions.width === w ? ' is-active' : ''}`}
              onClick={() => setExportOptions({ width: w })}
            >
              {w}
            </button>
          ))}
          <button
            type="button"
            className={`ratio-btn${!isPreset ? ' is-active' : ''}`}
            onClick={() => setExportOptions({ width: 1440 })}
          >
            {t('widthCustom')}
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <NumberInput
            value={exportOptions.width}
            min={MIN_EXPORT_WIDTH}
            max={MAX_EXPORT_WIDTH}
            onChange={(width) => setExportOptions({ width })}
          />
        </div>
        <div className="field-hint" style={{ marginTop: 8 }}>
          {t('exportHint')}
        </div>
      </Field>

      <Field label={t('outputSize')} value={`${size.width} × ${size.height} px`}>
        <div className="field-hint">
          {lastResult
            ? `${t('lastExport')}：${formatBytes(lastResult.size)}`
            : '导出后会显示实际文件大小'}
        </div>
      </Field>

      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={busy || filledCount === 0}
        onClick={onExport}
      >
        {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
        {busy ? t('downloading') : t('download')}
      </button>
    </>
  )
}
