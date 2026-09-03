import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, FolderSearch, Pencil, Plus, Trash2, Upload, ImagePlus } from 'lucide-react'
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
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ asset: AssetItem; img: HTMLImageElement } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scannedCount, setScannedCount] = useState(0)

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

  const openFolder = useCallback(() => {
    const input = folderInputRef.current
    if (!input) return
    input.value = ''
    input.click()
  }, [])

  // 判断是否为支持的图片格式
  function isImageFile(file: File): boolean {
    const type = file.type
    // 支持所有主流图片格式
    return (
      type === 'image/jpeg' ||
      type === 'image/jpg' ||
      type === 'image/png' ||
      type === 'image/gif' ||
      type === 'image/webp' ||
      type === 'image/bmp' ||
      type === 'image/svg+xml' ||
      type === 'image/tiff' ||
      type === 'image/heic' ||
      type === 'image/heif' ||
      type === 'image/avif' ||
      type.startsWith('image/')
    )
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy(true)
      setScanning(true)
      let added = 0
      let skipped = 0
      try {
        setScannedCount(0)
        for (const file of Array.from(files)) {
          if (isImageFile(file)) {
            await addAssetFromBlob(file, file.name)
            added++
            setScannedCount(added)
          } else {
            skipped++
          }
        }
        if (added > 0) {
          showToast(t('assetFolderScanDone', added))
        } else if (skipped > 0) {
          showToast(t('assetFolderNoImages'))
        }
      } finally {
        setBusy(false)
        setScanning(false)
      }
    },
    [addAssetFromBlob, showToast, t],
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
        <div className="asset-buttons">
          <button type="button" className="btn btn-primary btn-lg" onClick={openUpload} disabled={busy || scanning}>
            <Upload size={15} />
            {t('assetUpload')}
          </button>
          <button type="button" className="btn btn-lg" onClick={openFolder} disabled={busy || scanning}>
            <FolderSearch size={15} />
            {t('assetScanFolder')}
            {scanning && ` (${scannedCount})`}
          </button>
        </div>
        <div className="field-hint" style={{ textAlign: 'center', marginTop: 6 }}>
          {t('assetUploadHint')}
        </div>
        <div className="field-hint" style={{ textAlign: 'center', marginTop: 2 }}>
          {t('assetFolderHint')}
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
        <input
           ref={folderInputRef}
           type="file"
           accept="image/*"
           hidden
           {...({ webkitdirectory: '', directory: '', mozdirectory: '' } as any)}
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
