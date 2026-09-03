import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Field, Slider, Segmented, Switch } from './ui/Controls'
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
                  {f.generic ? ` (${t('fontGeneric')})` : ''}
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
              title={t('textBold')}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`btn${selected.italic ? ' btn-primary' : ''}`}
              onClick={() => updateText(selected.id, { italic: !selected.italic })}
              aria-pressed={selected.italic}
              title={t('textItalic')}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`btn${selected.underline ? ' btn-primary' : ''}`}
              onClick={() => updateText(selected.id, { underline: !selected.underline })}
              aria-pressed={selected.underline}
              title={t('textUnderline')}
            >
              <span style={{ textDecoration: 'underline' }}>U</span>
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

          <Field label={t('textAlign')}>
            <Segmented
              value={selected.align ?? 'center'}
              onChange={(v) => updateText(selected.id, { align: v })}
              options={[
                { value: 'left' as const, label: t('alignLeft') },
                { value: 'center' as const, label: t('alignCenter') },
                { value: 'right' as const, label: t('alignRight') },
              ]}
            />
          </Field>

          <Field label={t('textLineHeight')} value={`${(selected.lineHeight ?? 1.25).toFixed(2)}×`}>
            <Slider
              value={selected.lineHeight ?? 1.25}
              min={1}
              max={2.5}
              step={0.05}
              onChange={(v) => updateText(selected.id, { lineHeight: v })}
            />
          </Field>

          <Field label={t('textLetterSpacing')} value={`${selected.letterSpacing ?? 0}px`}>
            <Slider
              value={selected.letterSpacing ?? 0}
              min={-5}
              max={20}
              step={0.5}
              onChange={(v) => updateText(selected.id, { letterSpacing: v })}
            />
          </Field>

          <Field label={t('opacity')} value={`${Math.round((selected.opacity ?? 1) * 100)}%`}>
            <Slider
              value={selected.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateText(selected.id, { opacity: v })}
            />
          </Field>

          <div className="divider" />

          {/* 描边 */}
          <Switch
            checked={(selected.strokeWidth ?? 0) > 0}
            label={t('textStroke')}
            onChange={(on) => updateText(selected.id, { strokeWidth: on ? 2 : 0 })}
          />
          {(selected.strokeWidth ?? 0) > 0 && (
            <>
              <Field label={t('textStrokeWidth')} value={`${selected.strokeWidth}px`}>
                <Slider
                  value={selected.strokeWidth}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(v) => updateText(selected.id, { strokeWidth: v })}
                />
              </Field>
              <Field label={t('textStrokeColor')}>
                <div className="color-row">
                  <input
                    className="swatch"
                    type="color"
                    value={selected.strokeColor ?? '#111827'}
                    onChange={(e) => updateText(selected.id, { strokeColor: e.target.value })}
                    aria-label={t('textStrokeColor')}
                  />
                </div>
              </Field>
            </>
          )}

          {/* 阴影 */}
          <Switch
            checked={(selected.shadowBlur ?? 0) > 0}
            label={t('textShadow')}
            onChange={(on) => updateText(selected.id, { shadowBlur: on ? 8 : 0 })}
          />
          {(selected.shadowBlur ?? 0) > 0 && (
            <>
              <Field label={t('textShadowBlur')} value={`${selected.shadowBlur}px`}>
                <Slider
                  value={selected.shadowBlur}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => updateText(selected.id, { shadowBlur: v })}
                />
              </Field>
              <Field label={t('textShadowOffsetX')} value={`${selected.shadowOffsetX ?? 0}px`}>
                <Slider
                  value={selected.shadowOffsetX ?? 0}
                  min={-30}
                  max={30}
                  step={1}
                  onChange={(v) => updateText(selected.id, { shadowOffsetX: v })}
                />
              </Field>
              <Field label={t('textShadowOffsetY')} value={`${selected.shadowOffsetY ?? 0}px`}>
                <Slider
                  value={selected.shadowOffsetY ?? 0}
                  min={-30}
                  max={30}
                  step={1}
                  onChange={(v) => updateText(selected.id, { shadowOffsetY: v })}
                />
              </Field>
              <Field label={t('textShadowColor')}>
                <div className="color-row">
                  <input
                    className="swatch"
                    type="color"
                    value={selected.shadowColor ?? '#000000'}
                    onChange={(e) => updateText(selected.id, { shadowColor: e.target.value })}
                    aria-label={t('textShadowColor')}
                  />
                </div>
              </Field>
            </>
          )}

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
