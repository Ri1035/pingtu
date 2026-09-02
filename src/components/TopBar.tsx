import { Images, Languages, ShieldCheck, RotateCcw } from 'lucide-react'
import { useI18n } from '../i18n'

interface Props {
  onReset: () => void
  onToggleLang: () => void
}

export function TopBar({ onReset, onToggleLang }: Props) {
  const { t } = useI18n()

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Images size={17} />
        </span>
        <span className="brand-text">
          <span className="brand-title">{t('appTitle')}</span>
          <span className="brand-sub">{t('appTagline')}</span>
        </span>
      </div>

      <div className="topbar-spacer" />

      <span className="topbar-note">
        <ShieldCheck size={14} />
        {t('privacy')}
      </span>

      <button type="button" className="btn btn-ghost" onClick={onToggleLang} title={t('langSwitch')}>
        <Languages size={15} />
        {t('langSwitch')}
      </button>

      <button type="button" className="btn" onClick={onReset} title={t('newProject')}>
        <RotateCcw size={15} />
        {t('newProject')}
      </button>
    </header>
  )
}
