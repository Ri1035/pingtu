import { useRef, useState } from 'react'
import { Images, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'

interface Props {
  store: CollageStore
  onPickFiles: () => void
  onFilesDropped: (files: FileList | File[]) => void
}

export function PhotoTray({ store, onPickFiles, onFilesDropped }: Props) {
  const { t } = useI18n()
  const { photos, slots, removePhoto, swapSlots, unusedCount, emptyCount, clearAll, setCount } = store
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)

  return (
    <div
      className={`tray${dropActive ? ' is-drop-active' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault()
        // 仅外部文件拖入时显示高亮；托盘内图片排序（text/plain）不触发
        const hasFiles = Array.from(e.dataTransfer?.types ?? []).includes('Files')
        if (!hasFiles) return
        dragDepth.current += 1
        setDropActive(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        const hasFiles = Array.from(e.dataTransfer?.types ?? []).includes('Files')
        if (!hasFiles) return
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDropActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDropActive(false)
        // 忽略托盘内图片拖拽排序（无文件拖入）
        if (e.dataTransfer?.files?.length) onFilesDropped(e.dataTransfer.files)
      }}
    >
      <div className="tray-side">
        <button type="button" className="btn btn-primary" onClick={onPickFiles}>
          <Upload size={15} />
          {photos.length > 0 ? t('addMore') : t('addPhotos')}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn-icon"
            title={t('fillFromTray')}
            disabled={photos.length === 0}
            onClick={() => setCount(Math.min(16, Math.max(1, photos.length)))}
          >
            <Sparkles size={15} />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-danger"
            title={t('clearAll')}
            disabled={photos.length === 0}
            onClick={clearAll}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="tray-empty">{t('dragHint')}</div>
      ) : (
        <div className="tray-list">
          {photos.map((photo, index) => {
            const unused = index >= slots.length
            return (
              <div
                key={photo.id}
                className={[
                  'tray-item',
                  unused ? 'is-unused' : '',
                  dragIndex === index ? 'is-dragging' : '',
                  overIndex === index ? 'is-drop-target' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                title={`${photo.name} · ${photo.width}×${photo.height}`}
                onDragStart={(e) => {
                  setDragIndex(index)
                  e.dataTransfer.effectAllowed = 'move'
                  try {
                    e.dataTransfer.setData('text/plain', String(index))
                  } catch {
                    /* 部分浏览器限制 setData，忽略即可 */
                  }
                }}
                onDragEnter={() => setOverIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex != null && dragIndex !== index) swapSlots(dragIndex, index)
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
              >
                {photo.thumb ? <img src={photo.thumb} alt={photo.name} /> : null}
                <span className="tray-index">{index + 1}</span>
                <button
                  type="button"
                  className="tray-remove"
                  title={t('remove')}
                  onClick={(e) => {
                    e.stopPropagation()
                    removePhoto(photo.id)
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="tray-side" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
        <div className="field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Images size={14} />
          {`${slots.filter(Boolean).length} / ${slots.length}`}
        </div>
        {unusedCount > 0 ? (
          <div className="field-hint">{t('unusedPhotos', unusedCount)}</div>
        ) : emptyCount > 0 ? (
          <div className="field-hint">{t('notEnoughPhotos', emptyCount)}</div>
        ) : (
          <div className="field-hint">{t('allFilled')}</div>
        )}
      </div>
    </div>
  )
}
