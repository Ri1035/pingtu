import { useState, type ReactNode } from 'react'

interface FieldProps {
  label: string
  value?: string
  hint?: string
  children: ReactNode
}

export function Field({ label, value, hint, children }: FieldProps) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {value != null && <span className="field-value">{value}</span>}
      </div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
}

export function Slider({ value, min, max, step = 1, disabled, onChange }: SliderProps) {
  return (
    <input
      className="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="seg" role="tablist">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={`seg-item${opt.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <div className="switch-row">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`switch${checked ? ' is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

interface NumberInputProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

/**
 * 数字输入框。
 * 编辑期间用本地草稿字符串承接键盘输入，允许清空 / 逐位输入；
 * 仅在「失焦 / 回车」时才取整并夹到 [min, max]。
 * 避免旧实现「每敲一个键就夹取一次」——清空会瞬间被夹到最小值，
 * 导致没法自由输入（如想输 1200 却被拼成 1002 → 10020 → 8000）。
 */
export function NumberInput({ value, min, max, onChange }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    setDraft(null)
    const next = Number(raw)
    // 空值 / 非法输入：放弃本次编辑，显示回原值
    if (raw.trim() === '' || !Number.isFinite(next)) return
    onChange(Math.min(max, Math.max(min, Math.round(next))))
  }

  return (
    <input
      className="text-input"
      type="number"
      value={draft ?? String(value)}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}
