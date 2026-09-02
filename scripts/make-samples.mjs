/**
 * 生成测试用样例图片（纯 Node 实现，不依赖任何图形库）
 * 用法：node scripts/make-samples.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../samples')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** 生成一张带渐变的 RGB PNG */
function makePng(width, height, hueA, hueB, label) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  let p = 0
  for (let y = 0; y < height; y++) {
    raw[p++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const t = (x / width) * 0.6 + (y / height) * 0.4
      const [r, g, b] = mix(hueA, hueB, t)
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(resolve(outDir, label), png)
  console.log(`${label}  ${width}×${height}  ${(png.length / 1024).toFixed(0)}KB`)
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))
}

const RED = [239, 68, 68]
const BLUE = [37, 99, 235]
const GREEN = [16, 185, 129]
const AMBER = [245, 158, 11]
const VIOLET = [139, 92, 246]
const CYAN = [6, 182, 212]

makePng(1200, 800, RED, AMBER, 'sample-1.png')
makePng(800, 1200, BLUE, VIOLET, 'sample-2.png')
makePng(1000, 1000, GREEN, CYAN, 'sample-3.png')
makePng(1400, 700, VIOLET, RED, 'sample-4.png')

console.log(`\n输出目录：${outDir}`)
