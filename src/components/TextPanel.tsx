import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Field, Slider } from './ui/Controls'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'
import { detectFonts, type FontInfo } from '../lib/fonts'

interface Props {
  store: CollageStore
  selectedTextId: string | null
  onSelectText: (id: string | null) => void
}

const PRESET_TEXT_COLORS = ['#111827', '#ffffff', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#db2777']

export function TextPanel({ store, selectedTextId, onSelectText }: Props) {
  const { t } = useI18n()
  const { texts, addText, updateText, removeText } = store
  const [fonts, setFonts] = useState<FontInfo[] | null>(null)
  const [fontError, setFontError] = useState(false)

  useEffect(() => {
    let alive = true
    detectFonts()
      .then((list) => {
        if (alive) setFonts(list)
      })
      .catch(() => {
        if (alive) setFontError(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const selected = texts.find((item) => item.id === selectedTextId) ?? null

  const handleAdd = () => {
    const item = addText({ content: '' })
    onSelectText(item.id)
  }

  return (
    <>
      <button type="button" className="btn btn-primary btn-lg" onClick={handleAdd}>
        <Plus size={16} />
        {t('addText')}
      </button>

      {texts.length === 0 ? (
        <div className="field-hint" style={{ textAlign: 'center', padding: '16px 0' }}>
          {t('noText')}
        </div>
      ) : (
        <div className="text-list">
          {texts.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`text-list-item${item.id === selectedTextId ? ' is-active' : ''}`}
              onClick={() => onSelectText(item.id === selectedTextId ? null : item.id)}
            >
              <span
                className="text-list-preview"
                style={{
                  fontFamily: `"${item.fontFamily}", sans-serif`,
                  fontWeight: item.bold ? 700 : 400,
                  fontStyle: item.italic ? 'italic' : 'normal',
                  color: item.color,
                }}
              >
                {item.content || t('textContentPlaceholder')}
              </span>
              <span
                className="text-list-del"
                title={t('textDelete')}
                onClick={(e) => {
                  e.stopPropagation()
                  removeText(item.id)
                  if (selectedTextId === item.id) onSelectText(null)
                }}
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="divider" />

          <Field label={t('textContent')}>
            <textarea
              className="text-input text-area"
              rows={3}
              value={selected.content}
              placeholder={t('textContentPlaceholder')}
              onChange={(e) => updateText(selected.id, { content: e.target.value })}
            />
          </Field>

          <Field label={t('textFont')}>
            <select
              className="text-input"
              value={selected.fontFamily}
              onChange={(e) => updateText(selected.id, { fontFamily: e.target.value })}
            >
              {fonts == null && !fontError && <option value={selected.fontFamily}>{t('fontDetecting')}</option>}
              {fontError && <option value={selected.fontFamily}>{t('noFontDetected')}</option>}
              {fonts?.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}", sans-serif` }}>
                  {f.family}
                  {f.generic ? ` (${t('ratioAuto')})` : ''}
                </option>
              ))}
            </select>
            {selected.fontFamily && (
              <div
                className="font-preview"
                style={{ fontFamily: `"${selected.fontFamily}", sans-serif` }}
              >
                字体预览 Font Preview 123
              </div>
            )}
          </Field>

          <Field label={t('textSize')} value={`${selected.fontSize}px`}>
            <Slider
              value={selected.fontSize}
              min={8}
              max={240}
              onChange={(v) => updateText(selected.id, { fontSize: v })}
            />
          </Field>

          <Field label={t('textColor')}>
            <div className="color-row">
              <input
                className="swatch"
                type="color"
                value={selected.color}
                onChange={(e) => updateText(selected.id, { color: e.target.value })}
                aria-label={t('textColor')}
              />
              <div className="preset-colors" style={{ marginTop: 0 }}>
                {PRESET_TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`preset-color${selected.color === c ? ' is-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => updateText(selected.id, { color: c })}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </Field>

          <div className="text-toggle-row">
            <button
              type="button"
              className={`btn${selected.bold ? ' btn-primary' : ''}`}
              onClick={() => updateText(selected.id, { bold: !selected.bold })}
              aria-pressed={selected.bold}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`btn${selected.italic ? ' btn-primary' : ''}`}
              onClick={() => updateText(selected.id, { italic: !selected.italic })}
              aria-pressed={selected.italic}
            >
              <em>I</em>
            </button>
          </div>

          <Field label={t('textRotation')} value={`${selected.rotation}°`}>
            <Slider
              value={selected.rotation}
              min={-180}
              max={180}
              onChange={(v) => updateText(selected.id, { rotation: v })}
            />
          </Field>

          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              removeText(selected.id)
              onSelectText(null)
            }}
          >
            <Trash2 size={15} />
            {t('textDelete')}
          </button>
        </>
      )}

      {texts.length > 0 && <div className="field-hint">{t('textHint')}</div>}
    </>
  )
}
