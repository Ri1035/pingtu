import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, SlidersHorizontal, Download, Type } from 'lucide-react'
import { I18nContext, LANG_STORAGE_KEY, makeI18n, useI18n, type Lang } from './i18n'
import { useCollage } from './hooks/useCollage'
import { TopBar } from './components/TopBar'
import { LayoutPanel } from './components/LayoutPanel'
import { StylePanel } from './components/StylePanel'
import { TextPanel } from './components/TextPanel'
import { ExportPanel } from './components/ExportPanel'
import { CollageStage } from './components/CollageStage'
import { PhotoTray } from './components/PhotoTray'
import { buildFilename, downloadBlob, renderToBlob, supportsWebp } from './lib/export'
import { ACCEPT_ATTR } from './lib/image'

type Tab = 'layout' | 'style' | 'text' | 'export'

export function App() {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') return saved
    } catch {
      /* 忽略隐私模式下的读取失败 */
    }
    return 'zh'
  })

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      /* 忽略写入失败 */
    }
  }, [])

  const i18n = useMemo(() => makeI18n(lang, setLang), [lang, setLang])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  return (
    <I18nContext.Provider value={i18n}>
      <Editor />
    </I18nContext.Provider>
  )
}

function Editor() {
  const { t, lang, setLang } = useI18n()
  const store = useCollage()

  const [tab, setTab] = useState<Tab>('layout')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ size: number; width: number; height: number } | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceIndexRef = useRef<number | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    if (store.notice) {
      showToast(store.notice)
      store.setNotice(null)
    }
  }, [store.notice, store.setNotice, showToast])

  // —— 文件选择 ——
  const openPicker = useCallback((replaceIndex?: number) => {
    replaceIndexRef.current = replaceIndex ?? null
    const input = fileInputRef.current
    if (!input) return
    input.value = ''
    input.click()
  }, [])

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      const replaceIndex = replaceIndexRef.current
      replaceIndexRef.current = null
      if (replaceIndex != null) {
        await store.replacePhotoAt(replaceIndex, files[0])
      } else {
        await store.addFiles(files)
      }
    },
    [store],
  )

  const handleDropped = useCallback(
    async (files: FileList | File[]) => {
      await store.addFiles(files)
    },
    [store],
  )

  // —— 粘贴上传 ——
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files
      if (items && items.length > 0) {
        e.preventDefault()
        void store.addFiles(items)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [store])

  // —— 导出 ——
  const handleExport = useCallback(async () => {
    if (store.filledCount === 0) return
    setBusy(true)
    try {
      let options = store.exportOptions
      if (options.format === 'webp' && !(await supportsWebp())) {
        showToast(t('unsupportedWebp'))
        options = { ...options, format: 'png' }
      }
      const result = await renderToBlob(store.scene, options)
      downloadBlob(result.blob, buildFilename(options.format, result.width))
      setLastResult({ size: result.blob.size, width: result.width, height: result.height })
    } catch (error) {
      showToast(`${t('exportFailed')}：${error instanceof Error ? error.message : ''}`)
    } finally {
      setBusy(false)
    }
  }, [store, showToast, t])

  const handleReset = useCallback(() => {
    store.clearAll()
    setLastResult(null)
    setSelectedTextId(null)
  }, [store])

  const tabs: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'layout', label: t('tabLayout'), icon: LayoutGrid },
    { key: 'style', label: t('tabStyle'), icon: SlidersHorizontal },
    { key: 'text', label: t('tabText'), icon: Type },
    { key: 'export', label: t('tabExport'), icon: Download },
  ]

  return (
    <div className="app">
      <TopBar onReset={handleReset} onToggleLang={() => setLang(lang === 'zh' ? 'en' : 'zh')} />

      <div className="app-body">
        <aside className="sidebar">
          <nav className="sidebar-tabs">
            {tabs.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-tab${tab === item.key ? ' is-active' : ''}`}
                  onClick={() => setTab(item.key)}
                  aria-selected={tab === item.key}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="sidebar-body">
            {tab === 'layout' && <LayoutPanel store={store} />}
            {tab === 'style' && <StylePanel store={store} />}
            {tab === 'text' && (
              <TextPanel store={store} selectedTextId={selectedTextId} onSelectText={setSelectedTextId} />
            )}
            {tab === 'export' && (
              <ExportPanel store={store} busy={busy} lastResult={lastResult} onExport={handleExport} />
            )}
          </div>
        </aside>

        <main className="stage">
          <CollageStage
            store={store}
            onPickFiles={openPicker}
            onFilesDropped={handleDropped}
            selectedTextId={selectedTextId}
            onSelectText={setSelectedTextId}
          />
          <PhotoTray store={store} onPickFiles={() => openPicker()} />
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={handleInputChange}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
