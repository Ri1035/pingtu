import { useState } from 'react'
import { Images, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { CollageStore } from '../hooks/useCollage'

interface Props {
  store: CollageStore
  onPickFiles: () => void
}

export function PhotoTray({ store, onPickFiles }: Props) {
  const { t } = useI18n()
  const { photos, slots, removePhoto, swapSlots, unusedCount, emptyCount, clearAll, setCount } = store
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="tray">
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
