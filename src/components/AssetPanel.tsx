import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, Pencil, Plus, Trash2, Upload, ImagePlus } from 'lucide-react'
import { useI18n } from '../i18n'
import type { AssetItem } from '../types'
import type { AssetStore } from '../hooks/useAssets'
import { AssetEditor } from './AssetEditor'
import { formatBytes } from '../lib/image'

interface Props {
  assetStore: AssetStore
  /** 把图片文件加入拼图托盘 */
  onAddFileToCollage: (file: File) => void
}

/** 解码 Blob 为 HTMLImageElement */
function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解码失败'))
    }
    img.src = url
  })
}

export function AssetPanel({ assetStore, onAddFileToCollage }: Props) {
  const { t } = useI18n()
  const { assets, loading, error, clearError, addAssetFromBlob, saveEditedAsset, removeAsset } = assetStore
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ asset: AssetItem; img: HTMLImageElement } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // 初始为空态时提示可上传
  const openUpload = useCallback(() => {
    const input = fileInputRef.current
    if (!input) return
    input.value = ''
    input.click()
  }, [])

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          await addAssetFromBlob(file, file.name)
        }
      } finally {
        setBusy(false)
      }
    },
    [addAssetFromBlob],
  )

  const openEditor = useCallback(
    async (asset: AssetItem) => {
      try {
        const img = await blobToImage(asset.blob)
        setEditing({ asset, img })
      } catch {
        /* 解码失败则不打开 */
      }
    },
    [],
  )

  const handleSaveEdited = useCallback(
    async (blob: Blob) => {
      const saved = await saveEditedAsset(blob, editing?.asset.name ?? 'asset')
      if (saved) showToast(t('assetSaveDone'))
      setEditing(null)
    },
    [saveEditedAsset, editing, showToast, t],
  )

  // 若素材被删除或刷新后不存在，关闭编辑器
  useEffect(() => {
    if (editing && !assets.some((a) => a.id === editing.asset.id)) {
      setEditing(null)
    }
  }, [assets, editing])

  return (
    <div className="asset-panel">
      <div className="asset-panel-head">
        <button type="button" className="btn btn-primary btn-lg" onClick={openUpload} disabled={busy}>
          <Upload size={15} />
          {t('assetUpload')}
        </button>
        <div className="field-hint" style={{ textAlign: 'center', marginTop: 6 }}>
          {t('assetUploadHint')}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="asset-error">
          <span>{error}</span>
          <button type="button" className="btn btn-icon" onClick={clearError} title={t('cancel')}>
            ×
          </button>
        </div>
      )}

      <div className="asset-grid-wrap">
        {loading && assets.length === 0 ? (
          <div className="asset-empty">{t('assetLoading')}</div>
        ) : assets.length === 0 ? (
          <div className="asset-empty">
            <FolderOpen size={28} />
            <p>{t('assetEmpty')}</p>
            <button type="button" className="btn" onClick={openUpload}>
              <Plus size={14} />
              {t('assetUpload')}
            </button>
          </div>
        ) : (
          <div className="asset-grid">
            {assets.map((asset) => (
              <div key={asset.id} className="asset-card">
                <div className="asset-thumb" onClick={() => void openEditor(asset)} title={t('assetEditHint')}>
                  <img src={asset.thumb} alt={asset.name} loading="lazy" />
                  {asset.origin === 'edited' && <span className="asset-badge">{t('assetEdited')}</span>}
                </div>
                <div className="asset-meta" title={asset.name}>
                  <span className="asset-name">{asset.name}</span>
                  <span className="asset-sub">
                    {asset.width}×{asset.height} · {formatBytes(asset.size)}
                  </span>
                </div>
                <div className="asset-actions">
                  <button type="button" className="btn btn-icon" title={t('assetEditHint')} onClick={() => void openEditor(asset)}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon"
                    title={t('assetAddToCollage')}
                    onClick={() => {
                      const file = new File([asset.blob], asset.name, { type: asset.blob.type || 'image/png' })
                      onAddFileToCollage(file)
                    }}
                  >
                    <ImagePlus size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-danger"
                    title={t('remove')}
                    onClick={() => {
                      if (window.confirm(t('assetDeleteConfirm'))) void removeAsset(asset.id)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AssetEditor
          asset={editing.asset}
          sourceImage={editing.img}
          onSave={(blob) => void handleSaveEdited(blob)}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className="asset-toast">{toast}</div>}
    </div>
  )
}
