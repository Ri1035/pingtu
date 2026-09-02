/**
 * 系统字体探测
 * ------------------------------------------------------------------
 * 浏览器出于安全考虑不提供「列出所有已安装字体」的 API，
 * 业界通用做法是：用 Canvas 测量同一段文本在不同 font-family 下的渲染宽度，
 * 若宽度与默认字体不同，则认为该字体已安装。
 *
 * 这里维护一份常见字体候选清单（中英文均覆盖），
 * 在需要时异步探测，返回「确实可用」的字体列表，供字体选择器使用。
 */

/** 候选字体清单：常见的系统预装字体（Windows / macOS / Linux / 移动端） */
const CANDIDATES: string[] = [
  // 无衬线
  'Arial',
  'Arial Black',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Roboto',
  'Open Sans',
  'Lato',
  'Ubuntu',
  'Candara',
  'Calibri',
  'Gill Sans',
  'Impact',
  'Comic Sans MS',
  'Lucida Sans Unicode',
  // 衬线
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Cambria',
  'Palatino Linotype',
  'Book Antiqua',
  'Lucida Console',
  'Courier New',
  'Consolas',
  'Monaco',
  'Menlo',
  // 中文
  'SimSun',
  'SimHei',
  'Microsoft YaHei',
  'Microsoft JhengHei',
  'PingFang SC',
  'PingFang TC',
  'Hiragino Sans GB',
  'Heiti SC',
  'WenQuanYi Micro Hei',
  'Noto Sans SC',
  'Noto Serif SC',
  'FangSong',
  'KaiTi',
  'STSong',
  'STHeiti',
  'STKaiti',
  'STFangsong',
  'LiSu',
  'YouYuan',
  'DFKai-SB',
]

/** 通用回退（保证始终可用） */
const GENERIC_FALLBACKS = ['sans-serif', 'serif', 'monospace']

export interface FontInfo {
  family: string
  /** 是否通用族（sans-serif 等），这类没有真实字体名，单独分组 */
  generic: boolean
}

let cache: FontInfo[] | null = null
let pending: Promise<FontInfo[]> | null = null

/** 测量文本在指定字体下的渲染宽度 */
function measureWidth(family: string): number {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  // 使用一段同时包含中英文、标点、数字的文本，提高区分度
  const probe = 'AaBbCcXxWw 0123456789 拼图编辑器字体测试'
  ctx.font = `24px "${family}", sans-serif`
  return ctx.measureText(probe).width
}

/** 探测单个字体是否已安装（对比其与默认字体的宽度差异） */
function isInstalled(family: string, baselineWidth: number): boolean {
  // 通用族本身不是「安装的字体」，跳过
  if (GENERIC_FALLBACKS.includes(family)) return false
  try {
    const width = measureWidth(family)
    // 宽度差异超过阈值（0.5px）即认为该字体真实可用
    return Math.abs(width - baselineWidth) > 0.5
  } catch {
    return false
  }
}

/**
 * 探测系统可用字体。
 * 结果按「真实字体 + 通用族」组织，缓存避免重复探测。
 */
export async function detectFonts(): Promise<FontInfo[]> {
  if (cache) return cache
  if (pending) return pending

  pending = (async () => {
    // 分批探测，避免一次性阻塞主线程
    const installed: FontInfo[] = []
    const baselineWidth = measureWidth('sans-serif')

    for (const family of CANDIDATES) {
      if (isInstalled(family, baselineWidth)) {
        installed.push({ family, generic: false })
      }
      // 每探测若干字体就让出主线程，避免卡顿
      if (installed.length % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    const result: FontInfo[] = [
      ...installed,
      ...GENERIC_FALLBACKS.map((f) => ({ family: f, generic: true })),
    ]
    cache = result
    return result
  })()

  return pending
}

/** 探测结果是否已就绪 */
export function isFontCacheReady(): boolean {
  return cache !== null
}
