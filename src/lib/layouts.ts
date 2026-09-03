import type { GridLayout } from '../types'
import { OFFICIAL_LAYOUTS } from './official-layouts'

/**
 * 布局模板库
 * ------------------------------------------------------------------
 * 数据来源：mergeimage.org 官方布局库（见 official-layouts.ts），
 * 以「数字矩阵」描述每个布局 —— 相同数字的相邻单元格合并为一个大格子。
 *
 * 本文件负责把数字矩阵转换成项目内部的 GridLayout 描述：
 *   columns: '1fr 1fr'      rows: '1fr 1fr'      areas: ['a b', 'c d']
 * 其中字母 a/b/c… 按格子编号（数字）顺序一一对应。
 *
 * 这样一份数据同时用于三处，保证「所见的缩略图 = 真实渲染结果」：
 *   1. 布局选择面板：直接用 CSS Grid 渲染缩略图
 *   2. 预览：几何求解器算出每个格子的像素矩形
 *   3. 导出：同一套求解器，只是画布尺寸不同
 *
 * 因为布局直接来自官方数据，因此与原站的布局完全一致；
 * 新增/调整布局只需改 official-layouts.ts，无需改任何逻辑代码。
 */

/**
 * 把官方数字矩阵转换成内部 GridLayout。
 * 数字 1..N 映射为字母 a..z，矩阵的行/列映射为 CSS Grid 的等分轨道。
 */
function matrixToLayout(matrix: number[][], count: number, index: number): GridLayout {
  const rowCount = matrix.length
  const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0)
  const columns = new Array(colCount).fill('1fr').join(' ')
  const rows = new Array(rowCount).fill('1fr').join(' ')

  // 数字 → 字母（a, b, c, …）；超出 26 个时用两位字母兜底（1~16 张不会触发）
  const numToLetter = (n: number): string => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    if (n <= 26) return letters[n - 1]
    return letters[Math.floor((n - 1) / 26) - 1] + letters[(n - 1) % 26]
  }

  const areas = matrix.map((row) => row.map(numToLetter).join(' '))

  return {
    id: `${count}-${index}`,
    name: `布局 ${index + 1}`,
    photoCount: count,
    gridTemplate: `${columns} / ${rows}`,
    areas,
    // 建议比例：以矩阵行列数近似，作为「自动」之外的兜底
    suggestRatio: `${colCount}/${rowCount}`,
  }
}

function buildOfficialLayouts(): GridLayout[] {
  const result: GridLayout[] = []
  for (const countStr of Object.keys(OFFICIAL_LAYOUTS)) {
    const count = Number(countStr)
    OFFICIAL_LAYOUTS[count].forEach((matrix, index) => {
      result.push(matrixToLayout(matrix, count, index))
    })
  }
  return result
}

export const GRID_LAYOUTS: GridLayout[] = buildOfficialLayouts()

/** 支持的图片数量范围（与原站一致：1 ~ 16） */
export const MIN_COUNT = 1
export const MAX_COUNT = 16

/** 可选的图片数量档位 */
export const COUNT_OPTIONS: number[] = Array.from(
  { length: MAX_COUNT - MIN_COUNT + 1 },
  (_, i) => MIN_COUNT + i,
)

/**
 * 校验每个布局是否合法：
 * - 格子数必须与声明的图片数量一致
 * - 同名格子必须能构成矩形（否则求解器无法算出包围盒）
 * 非法布局会在开发模式下打印告警，避免脏数据悄悄产生错乱的渲染。
 */
export function validateLayout(layout: GridLayout): string[] {
  const errors: string[] = []
  const rows = layout.areas.map((r) => r.trim().split(/\s+/))
  const cols = Math.max(...rows.map((r) => r.length))

  // 每行格子数必须一致
  rows.forEach((row, i) => {
    if (row.length !== cols) {
      errors.push(`第 ${i + 1} 行有 ${row.length} 格，应为 ${cols} 格`)
    }
  })

  // 同名格子必须构成矩形
  const boxes = new Map<string, { r0: number; r1: number; c0: number; c1: number; n: number }>()
  rows.forEach((row, r) => {
    row.forEach((token, c) => {
      const box = boxes.get(token)
      if (!box) {
        boxes.set(token, { r0: r, r1: r, c0: c, c1: c, n: 1 })
      } else {
        box.r0 = Math.min(box.r0, r)
        box.r1 = Math.max(box.r1, r)
        box.c0 = Math.min(box.c0, c)
        box.c1 = Math.max(box.c1, c)
        box.n += 1
      }
    })
  })
  boxes.forEach((box, token) => {
    const expected = (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1)
    if (box.n !== expected) {
      errors.push(`格子 "${token}" 不是矩形（无法合并）`)
    }
  })

  if (boxes.size !== layout.photoCount) {
    errors.push(`实际 ${boxes.size} 格，声明 ${layout.photoCount} 张`)
  }
  if (boxes.size === 0) errors.push('没有任何格子')
  return errors
}

/** 取某个图片数量下的全部布局；数量越界时退回最近档位 */
export function getLayoutsForCount(count: number): GridLayout[] {
  const clamped = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count)))
  return GRID_LAYOUTS.filter((l) => l.photoCount === clamped)
}

/** 取布局中的格子名（按行优先顺序，与照片填入顺序一致） */
export function getAreaNames(layout: GridLayout): string[] {
  const seen: string[] = []
  for (const row of layout.areas) {
    for (const token of row.trim().split(/\s+/)) {
      if (token && !seen.includes(token)) seen.push(token)
    }
  }
  return seen
}

/** 生成 CSS grid-template-areas 字符串，供缩略图 / 说明使用 */
export function toGridTemplateAreas(layout: GridLayout): string {
  return layout.areas.map((row) => `"${row.trim()}"`).join(' ')
}


