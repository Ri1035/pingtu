import { Field, Slider, Switch } from './ui/Controls'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'
import { DEFAULT_STYLE } from '../hooks/useCollage'
import { BASE_WIDTH } from '../lib/render'

const RATIOS = [
  { value: 'auto', label: '自动' },
  { value: '1/1', label: '1:1' },
  { value: '3/4', label: '3:4' },
  { value: '9/16', label: '9:16' },
  { value: '4/3', label: '4:3' },
  { value: '16/9', label: '16:9' },
]

const PRESET_COLORS = ['#ffffff', '#f5f5f4', '#111827', '#0f172a', '#2563eb', '#fecdd3', '#d9f99d', 'transparent']

export function StylePanel({ store }: { store: CollageStore }) {
  const { t } = useI18n()
  const { style, setStyle } = store

  return (
    <>
      <section>
        <div className="section-title">{t('canvasRatio')}</div>
        <div className="ratio-row">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`ratio-btn${style.ratio === r.value ? ' is-active' : ''}`}
              onClick={() => setStyle({ ratio: r.value })}
              aria-pressed={style.ratio === r.value}
            >
              {r.value === 'auto' ? t('ratioAuto') : r.label}
            </button>
          ))}
        </div>
      </section>

      <div className="divider" />

      <section>
        <div className="seamless-head">
          <div>
            <div className="field-label" style={{ fontWeight: 600 }}>{t('seamlessMode')}</div>
            <div className="field-hint" style={{ marginTop: 4 }}>{t('seamlessHint')}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={style.seamless}
            className={`switch${style.seamless ? ' is-on' : ''}`}
            onClick={() => {
              setStyle({ seamless: !style.seamless })
            }}
          />
        </div>
        {style.seamless && (
          <div className="seamless-on-tip">
            <span className="pill pill-accent">{t('seamlessModeOn')}</span>
            <span className="field-hint">{t('seamlessOffHint')}</span>
          </div>
        )}
      </section>

      <div className="divider" />

      <Field label={t('margin')} value={style.seamless ? '0px' : `${style.margin}px`}>
        <Slider value={style.seamless ? 0 : style.margin} min={0} max={120} disabled={style.seamless} onChange={(v) => setStyle({ margin: v })} />
      </Field>

      <Field label={t('gap')} value={style.seamless ? '0px' : `${style.gap}px`}>
        <Slider value={style.seamless ? 0 : style.gap} min={0} max={80} disabled={style.seamless} onChange={(v) => setStyle({ gap: v })} />
      </Field>

      <Field label={t('radius')} value={style.seamless ? '0px' : `${style.radius}px`}>
        <Slider value={style.seamless ? 0 : style.radius} min={0} max={120} disabled={style.seamless} onChange={(v) => setStyle({ radius: v })} />
      </Field>

      <div className="divider" />

      <section>
        <div className="section-title">{t('background')}</div>
        <div className="color-row">
          <input
            className="swatch"
            type="color"
            value={style.background}
            onChange={(e) => setStyle({ background: e.target.value, transparent: false })}
            aria-label={t('background')}
          />
          <input
            className="text-input"
            value={style.background.toUpperCase()}
            onChange={(e) => {
              const v = e.target.value.trim()
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setStyle({ background: v, transparent: false })
            }}
          />
        </div>
        <div className="preset-colors" style={{ marginTop: 10 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`preset-color${!style.transparent && style.background === c ? ' is-active' : ''}`}
              style={
                c === 'transparent'
                  ? {
                      backgroundImage:
                        'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,#fff 25%,#fff 75%,#e2e8f0 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px',
                    }
                  : { background: c }
              }
              onClick={() =>
                c === 'transparent' ? setStyle({ transparent: true }) : setStyle({ background: c, transparent: false })
              }
              title={c}
            />
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Switch
            label={t('transparent')}
            checked={style.transparent}
            onChange={(v) => setStyle({ transparent: v })}
          />
        </div>
        {style.transparent && <div className="field-hint" style={{ marginTop: 8 }}>{t('transparentHint')}</div>}
      </section>

      <div className="divider" />

      <button type="button" className="btn" onClick={() => setStyle(DEFAULT_STYLE)}>
        {t('resetStyle')}
      </button>

      <div className="field-hint">
        边距 / 间距 / 圆角以 {BASE_WIDTH}px 宽为基准等比缩放，改变导出尺寸不会影响观感。
      </div>
    </>
  )
}
