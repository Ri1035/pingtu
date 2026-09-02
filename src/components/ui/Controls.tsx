import type { ReactNode } from 'react'

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

export function NumberInput({ value, min, max, onChange }: NumberInputProps) {
  return (
    <input
      className="text-input"
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const next = Number(e.target.value)
        if (!Number.isFinite(next)) return
        onChange(Math.min(max, Math.max(min, Math.round(next))))
      }}
    />
  )
}
