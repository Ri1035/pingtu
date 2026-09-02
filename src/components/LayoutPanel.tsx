import type { CSSProperties } from 'react'
import type { GridLayout } from '../types'
import { COUNT_OPTIONS, getAreaNames, toGridTemplateAreas } from '../lib/layouts'
import { toCssGrid } from '../lib/geometry'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'

/** 布局缩略图：直接用 CSS Grid 渲染，与真实渲染共用同一份布局数据 */
function LayoutThumb({ layout, active }: { layout: GridLayout; active: boolean }) {
  const css = toCssGrid(layout)
  const names = getAreaNames(layout)
  const style: CSSProperties = {
    gridTemplateColumns: css.gridTemplateColumns,
    gridTemplateRows: css.gridTemplateRows,
    gridTemplateAreas: toGridTemplateAreas(layout),
  }
  return (
    <div className="layout-thumb" style={style}>
      {names.map((name) => (
        <div key={name} className="layout-cell" style={{ gridArea: name, opacity: active ? 1 : 0.9 }} />
      ))}
    </div>
  )
}

export function LayoutPanel({ store }: { store: CollageStore }) {
  const { t } = useI18n()
  const { count, setCount, layouts, layout, setLayoutIndex, layoutIndex } = store

  return (
    <>
      <section>
        <div className="section-title">{t('imageCount')}</div>
        <div className="count-grid">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`count-cell${n === count ? ' is-active' : ''}`}
              onClick={() => setCount(n)}
              aria-pressed={n === count}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="field-hint" style={{ marginTop: 8 }}>
          {t('imageCountHint')}
        </div>
      </section>

      <section>
        <div className="section-title">
          {t('layoutPreset')} · {t('layoutCount', layouts.length)}
        </div>
        <div className="layout-grid">
          {layouts.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`layout-card${index === layoutIndex ? ' is-active' : ''}`}
              onClick={() => setLayoutIndex(index)}
              title={item.name}
              aria-pressed={index === layoutIndex}
            >
              <LayoutThumb layout={item} active={index === layoutIndex} />
              <span className="layout-name">{item.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="field-hint">
        {t('currentLayout')}：{layout.name}
      </div>
    </>
  )
}
