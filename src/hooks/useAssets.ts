import { useCallback, useEffect, useState } from 'react'
import type { AssetItem } from '../types'
import { getAssetBackend, newAssetId, type AssetRecord } from '../lib/assetStore'

/**
 * 素材库状态管理
 * 封装「列表加载 / 上传 / 删除 / 保存编辑产物」，
 * 通过注入的存储后端（默认 IndexedDB）持久化。
 */

/** 读取 Blob 为 HTMLImageElement（已解码就绪，可直接 drawImage） */
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

function makeThumbnail(img: HTMLImageElement, max = 400): string {
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * ratio))
  const h = Math.max(1, Math.round(img.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, w, h)
  try {
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return ''
  }
}

/** 把图片文件（或 Blob）生成缩略图 dataURL + 宽高 */
async function analyzeImage(
  blob: Blob,
): Promise<{ img: HTMLImageElement; thumb: string; width: number; height: number }> {
  const img = await blobToImage(blob)
  return {
    img,
    thumb: makeThumbnail(img),
    width: img.naturalWidth,
    height: img.naturalHeight,
  }
}

export function useAssets() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAssetBackend()
      .list()
      .then((items) => {
        if (!cancelled) setAssets(items)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载素材库失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  /** 把 Blob 保存为素材（用户上传） */
  const addAssetFromBlob = useCallback(
    async (blob: Blob, name: string): Promise<AssetItem | null> => {
      try {
        const { thumb, width, height } = await analyzeImage(blob)
        const record: AssetRecord = {
          id: newAssetId(),
          name,
          blob,
          thumb,
          width,
          height,
          size: blob.size,
          createdAt: Date.now(),
          origin: 'upload',
        }
        const saved = await getAssetBackend().save(record)
        refresh()
        return saved
      } catch (e) {
        setError(e instanceof Error ? e.message : '素材保存失败')
        return null
      }
    },
    [refresh],
  )

  /** 保存修图产物为新素材（origin=edited，保留原素材） */
  const saveEditedAsset = useCallback(
    async (blob: Blob, baseName: string): Promise<AssetItem | null> => {
      try {
        const { thumb, width, height } = await analyzeImage(blob)
        const dot = baseName.lastIndexOf('.')
        const stem = dot > 0 ? baseName.slice(0, dot) : baseName
        const record: AssetRecord = {
          id: newAssetId(),
          name: `${stem}-edit.png`,
          blob,
          thumb,
          width,
          height,
          size: blob.size,
          createdAt: Date.now(),
          origin: 'edited',
        }
        const saved = await getAssetBackend().save(record)
        refresh()
        return saved
      } catch (e) {
        setError(e instanceof Error ? e.message : '素材保存失败')
        return null
      }
    },
    [refresh],
  )

  const removeAsset = useCallback(async (id: string) => {
    try {
      await getAssetBackend().remove(id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '素材删除失败')
    }
  }, [])

  /** 清空错误提示 */
  const clearError = useCallback(() => setError(null), [])

  return {
    assets,
    loading,
    error,
    refresh,
    clearError,
    addAssetFromBlob,
    saveEditedAsset,
    removeAsset,
  }
}

export type AssetStore = ReturnType<typeof useAssets>
