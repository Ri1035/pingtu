/**
 * 布局数据自检脚本（针对官方数字矩阵布局库）
 * 用法：node scripts/check-layouts.mjs
 *
 * 校验 official-layouts.ts 中每一套布局矩阵：
 *   1. 矩阵中出现的数字必须是从 1 到 N 连续（N = 该张数的布局格子数）
 *   2. 相同数字的单元格必须构成矩形（否则无法合并成一个格子）
 *   3. 每个矩阵的格子数 = 声明的图片数量
 * 任何一条不满足都会导致渲染错乱，这里把它挡在开发阶段。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(here, '../src/lib/official-layouts.ts'), 'utf8')

// 从 TS 源码里定位 OFFICIAL_LAYOUTS 对象体，再用 JSON 兼容方式求值
const start = src.indexOf('OFFICIAL_LAYOUTS:')
const braceStart = src.indexOf('{', start)
// 手动匹配最外层大括号，得到对象字面量字符串
let depth = 0
let end = -1
for (let i = braceStart; i < src.length; i++) {
  const ch = src[i]
  if (ch === '{') depth++
  else if (ch === '}') {
    depth--
    if (depth === 0) {
      end = i + 1
      break
    }
  }
}
const body = src.slice(braceStart, end)
// 移除注释后求值（数据是纯数字数组，安全）
const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const layouts = eval(`(${cleaned})`)

let total = 0
let failed = 0

for (const [countStr, matrices] of Object.entries(layouts)) {
  const count = Number(countStr)
  for (const [idx, matrix] of matrices.entries()) {
    total++
    const errors = []
    const rowCount = matrix.length
    const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0)

    // 每行长度一致
    matrix.forEach((row, i) => {
      if (row.length !== colCount) {
        errors.push(`第 ${i + 1} 行 ${row.length} 列，应为 ${colCount} 列`)
      }
    })

    // 收集每个编号的包围盒，验证矩形 + 连续性
    const boxes = new Map()
    matrix.forEach((row, r) => {
      row.forEach((num, c) => {
        if (!Number.isInteger(num) || num < 1) {
          errors.push(`存在非法编号 ${num}`)
          return
        }
        const box = boxes.get(num)
        if (!box) boxes.set(num, { r0: r, r1: r, c0: c, c1: c, n: 1 })
        else {
          box.r0 = Math.min(box.r0, r)
          box.r1 = Math.max(box.r1, r)
          box.c0 = Math.min(box.c0, c)
          box.c1 = Math.max(box.c1, c)
          box.n++
        }
      })
    })

    boxes.forEach((box, num) => {
      const expected = (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1)
      if (box.n !== expected) {
        errors.push(`编号 ${num} 的格子不构成矩形`)
      }
    })

    // 编号必须从 1 到 N 连续
    const nums = [...boxes.keys()].sort((a, b) => a - b)
    for (let k = 0; k < nums.length; k++) {
      if (nums[k] !== k + 1) {
        errors.push(`编号不连续：期望 ${k + 1}，实际 ${nums[k]}`)
      }
    }

    // 格子数 = 图片数量
    if (boxes.size !== count) {
      errors.push(`格子数 ${boxes.size}，声明 ${count} 张`)
    }

    if (errors.length) {
      failed++
      console.error(`✗ count=${count} 布局#${idx + 1}：${errors.join('；')}`)
    }
  }
}

console.log(`\n校验完成：共 ${total} 套布局，${failed === 0 ? '全部通过 ✓' : failed + ' 套失败 ✗'}`)
process.exit(failed === 0 ? 0 : 1)
