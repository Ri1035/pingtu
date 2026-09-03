import type { CellRect, CellSizeScale, GridLayout, PhotoItem } from '../types'

/**
 * 网格几何求解
 * ------------------------------------------------------------------
 * 把「CSS Grid 描述」翻译成「像素矩形」。预览和导出调用的是同一个函数，
 * 只是传入的画布尺寸不同，因此天然保证所见即所得。
 */

export interface Track {
  value: number
  unit: 'fr' | 'px'
}

/** 解析轨道，如 '1fr 2fr' / '1.5fr 1fr' / '200px 1fr' */
export function parseTracks(input: string): Track[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token.endsWith('fr')) {
        return { value: parseFloat(token.slice(0, -2)) || 1, unit: 'fr' as const }
      }
      if (token.endsWith('px')) {
        return { value: parseFloat(token) || 0, unit: 'px' as const }
      }
      return { value: parseFloat(token) || 1, unit: 'fr' as const }
    })
}

/** 拆分 '列 / 行' 模板；缺省行时按区域行数补 1fr */
export function splitTemplate(gridTemplate: string, rowCount: number): { columns: string; rows: string } {
  const parts = gridTemplate.split('/')
  const columns = (parts[0] ?? '1fr').trim()
  const rows = (parts[1] ?? '').trim() || new Array(rowCount).fill('1fr').join(' ')
  return { columns, rows }
}

/** 轨道数量对不上时补齐，避免脏数据导致崩溃 */
function normalizeTracks(tracks: Track[], count: number): Track[] {
  if (count <= 0) return []
  const out = tracks.slice(0, count)
  while (out.length < count) out.push({ value: 1, unit: 'fr' })
  return out.map((t) => ({ value: Math.max(0, t.value), unit: t.unit }))
}

/** 把轨道分配成像素尺寸 */
function distribute(tracks: Track[], available: number): number[] {
  const pxTotal = tracks.reduce((sum, t) => sum + (t.unit === 'px' ? t.value : 0), 0)
  const frTotal = tracks.reduce((sum, t) => sum + (t.unit === 'fr' ? t.value : 0), 0)
  const free = Math.max(0, available - pxTotal)
  const unit = frTotal > 0 ? free / frTotal : 0
  return tracks.map((t) => (t.unit === 'px' ? t.value : t.value * unit))
}

export interface SolvedLayout {
  /** 格子名 → 像素矩形 */
  cells: Record<string, CellRect>
  /** 格子名，按行优先顺序（与照片填入顺序一致） */
  names: string[]
}

/**
 * 求解布局在给定内容区域内的所有格子矩形。
 * @param content 内容区域（已扣除画布外边距）
 * @param gap     格子之间的间距（像素）
 */
export function solveLayout(layout: GridLayout, content: CellRect, gap: number): SolvedLayout {
  const grid: string[][] = layout.areas.map((row) => row.trim().split(/\s+/).filter(Boolean))
  const rowCount = grid.length
  const colCount = grid.reduce((max, row) => Math.max(max, row.length), 0)

  if (rowCount === 0 || colCount === 0) return { cells: {}, names: [] }

  const { columns, rows } = splitTemplate(layout.gridTemplate, rowCount)
  const colSizes = distribute(
    normalizeTracks(parseTracks(columns), colCount),
    content.w - gap * (colCount - 1),
  )
  const rowSizes = distribute(
    normalizeTracks(parseTracks(rows), rowCount),
    content.h - gap * (rowCount - 1),
  )

  const colX: number[] = []
  let x = content.x
  for (let c = 0; c < colCount; c++) {
    colX.push(x)
    x += colSizes[c] + gap
  }
  const rowY: number[] = []
  let y = content.y
  for (let r = 0; r < rowCount; r++) {
    rowY.push(y)
    y += rowSizes[r] + gap
  }

  // 逐个合并同名格子
  const boxes = new Map<string, { r0: number; r1: number; c0: number; c1: number }>()
  const names: string[] = []
  grid.forEach((row, r) => {
    row.forEach((token, c) => {
      if (!names.includes(token)) names.push(token)
      const box = boxes.get(token)
      if (!box) {
        boxes.set(token, { r0: r, r1: r, c0: c, c1: c })
      } else {
        box.r0 = Math.min(box.r0, r)
        box.r1 = Math.max(box.r1, r)
        box.c0 = Math.min(box.c0, c)
        box.c1 = Math.max(box.c1, c)
      }
    })
  })

  const cells: Record<string, CellRect> = {}
  boxes.forEach((box, token) => {
    const left = colX[box.c0]
    const right = colX[box.c1] + colSizes[box.c1]
    const top = rowY[box.r0]
    const bottom = rowY[box.r1] + rowSizes[box.r1]
    cells[token] = { x: left, y: top, w: right - left, h: bottom - top }
  })

  return { cells, names }
}

/** 应用单个格子的缩放（左上角不动，只改宽高） */
export function scaleCellRect(cell: CellRect, scale?: CellSizeScale): CellRect {
  if (!scale) return cell
  return { ...cell, w: cell.w * scale.w, h: cell.h * scale.h }
}

/** 返回应用了单格缩放后的全部格子矩形 */
export function resolveCells(
  cells: Record<string, CellRect>,
  sizes?: Record<string, CellSizeScale>,
): Record<string, CellRect> {
  if (!sizes) return cells
  const out: Record<string, CellRect> = {}
  for (const [name, cell] of Object.entries(cells)) out[name] = scaleCellRect(cell, sizes[name])
  return out
}

/** 判断某个格子是否被调整过大小（缩放 ≠ 1） */
export function isCellResized(scale?: CellSizeScale): boolean {
  return !!scale && (Math.abs(scale.w - 1) > 1e-6 || Math.abs(scale.h - 1) > 1e-6)
}

/**
 * 「自动」比例：让每个格子尽量贴近它所放照片的原始比例。
 *
 * 推导：格子 i 的宽高比为 (cw_i · W') / (ch_i · H')，希望它等于照片比例 a_i，
 * 即内容区宽高比 W'/H' ≈ a_i · ch_i / cw_i。
 * 对多张图取几何平均，得到整体最协调的内容比例。
 */
export function computeContentRatio(layout: GridLayout, slots: (PhotoItem | null)[]): number {
  const { cells, names } = solveLayout(layout, { x: 0, y: 0, w: 1000, h: 1000 }, 0)
  const values: number[] = []

  names.forEach((name, index) => {
    const photo = slots[index]
    const cell = cells[name]
    if (!photo || !cell || cell.w <= 0 || cell.h <= 0) return
    if (photo.width <= 0 || photo.height <= 0) return
    const photoAspect = photo.width / photo.height
    values.push((photoAspect * cell.h) / cell.w)
  })

  if (values.length === 0) return parseRatio(layout.suggestRatio)

  // 几何平均：对极端值比算术平均更稳健
  const logMean = values.reduce((sum, v) => sum + Math.log(v), 0) / values.length
  const raw = Math.exp(logMean)
  // 夹在合理区间，避免出现过于狭长的画布
  return Math.min(8, Math.max(0.125, raw))
}

/** 解析 '16/9' → 1.777；非法输入返回 fallback */
export function parseRatio(ratio: string, fallback = 4 / 3): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(ratio)
  if (!m) return fallback
  const w = parseFloat(m[1])
  const h = parseFloat(m[2])
  if (!w || !h) return fallback
  return w / h
}

/**
 * 由「内容区比例」反推「整张画布比例」。
 * 外边距是画在内容之外的，所以两者并不相等：
 *   (W - 2m) / (W/R - 2m) = R_content   →   R = W / ((W - 2m)/R_content + 2m)
 */
export function canvasRatioFromContent(contentRatio: number, width: number, margin: number): number {
  const inner = Math.max(1, width - 2 * margin)
  return width / (inner / contentRatio + 2 * margin)
}

/**
 * 转成浏览器可直接使用的 CSS Grid 属性，用于渲染布局缩略图。
 * 注意：数据里 gridTemplate 的约定是「列 / 行」，与 CSS 简写的「行 / 列」相反，
 * 所以这里拆开分别赋值，避免踩反。
 */
export function toCssGrid(layout: GridLayout): {
  gridTemplateColumns: string
  gridTemplateRows: string
  gridTemplateAreas: string
} {
  const { columns, rows } = splitTemplate(layout.gridTemplate, layout.areas.length)
  return {
    gridTemplateColumns: columns,
    gridTemplateRows: rows,
    gridTemplateAreas: layout.areas.map((row) => `"${row.trim()}"`).join(' '),
  }
}


