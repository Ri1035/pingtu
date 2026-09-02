import type { AssetItem } from '../types'

/**
 * 素材存储抽象层
 * ------------------------------------------------------------------
 * UI 层只依赖 `AssetBackend` 接口。当前实现为浏览器 IndexedDB
 * （本地持久化，符合「图片不上传」的隐私承诺，容量可达数百 MB）。
 *
 * 为日后接入云端素材预留扩展位：
 *   实现同样的 `AssetBackend` 接口（list / save / remove）即可无缝替换，
 *   UI 层零改动。示例：CloudAssetBackend 内部调用自有服务器 API。
 *
 * 如需切换，把下方 `createDefaultBackend()` 的返回值换掉即可。
 */

/** 一条素材的完整持久化记录（IndexedDB 中存 Blob 原文） */
export interface AssetRecord {
  id: string
  name: string
  blob: Blob
  thumb: string
  width: number
  height: number
  size: number
  createdAt: number
  origin: 'upload' | 'edited'
}

export interface AssetBackend {
  /** 列出全部素材（按创建时间倒序） */
  list(): Promise<AssetItem[]>
  /** 保存一条素材，返回带 id 的完整记录 */
  save(record: AssetRecord): Promise<AssetItem>
  /** 删除素材 */
  remove(id: string): Promise<void>
  /** 后端能力描述（用于 UI 提示/调试） */
  readonly label: string
}

// ---------------- IndexedDB 实现 ----------------

const DB_NAME = 'pingtu-assets'
const DB_VERSION = 1
const STORE_NAME = 'assets'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('打开素材库失败'))
  })
  return dbPromise
}

function toAssetItem(record: AssetRecord): AssetItem {
  return {
    id: record.id,
    name: record.name,
    blob: record.blob,
    thumb: record.thumb,
    width: record.width,
    height: record.height,
    size: record.size,
    createdAt: record.createdAt,
    origin: record.origin,
  }
}

class IndexedDBAssetBackend implements AssetBackend {
  readonly label = '本机 IndexedDB（本地持久化）'

  async list(): Promise<AssetItem[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        const records = (req.result as AssetRecord[]).sort((a, b) => b.createdAt - a.createdAt)
        resolve(records.map(toAssetItem))
      }
      req.onerror = () => reject(req.error ?? new Error('读取素材库失败'))
    })
  }

  async save(record: AssetRecord): Promise<AssetItem> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(record)
      tx.oncomplete = () => resolve(toAssetItem(record))
      tx.onerror = () => reject(tx.error ?? new Error('保存素材失败'))
    })
  }

  async remove(id: string): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('删除素材失败'))
    })
  }
}

// ---------------- 导出 ----------------

/** 当前使用的后端实例（切换云后端时替换此处实现即可） */
let backend: AssetBackend | null = null

export function getAssetBackend(): AssetBackend {
  if (!backend) backend = new IndexedDBAssetBackend()
  return backend
}

/** 仅为调试/预留：允许测试注入假后端 */
export function _setAssetBackendForTest(next: AssetBackend | null): void {
  backend = next
}

let seed = 0
function uid(): string {
  seed += 1
  return `a${Date.now().toString(36)}${seed.toString(36)}`
}

/** 生成一条素材 id */
export function newAssetId(): string {
  return uid()
}
