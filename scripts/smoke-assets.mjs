/**
 * 素材库端到端冒烟测试（通过 CDP 驱动 Chrome）
 *
 * 用法：node scripts/smoke-assets.mjs
 *
 * 覆盖：
 *   1. 切到「素材库」页签，确认面板渲染、无 JS 报错
 *   2. 上传样例图 → 素材卡出现（IndexedDB 持久化）
 *   3. 打开素材编辑器 → 添加文字图层 → 保存为新素材
 *   4. 列表出现「已编辑」新素材，原素材仍在
 *   5. 「加入拼图」按钮把素材写入图片队列
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const samplesDir = join(projectRoot, 'samples')
const shotDir = join(projectRoot, '.smoke-assets')

function findChrome() {
  const candidates = [
    join(homedir(), '.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    join(homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  ]
  return candidates.find((p) => existsSync(p))
}

const CHROME = findChrome()
const PORT = 9334
const BASE_URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/'

let msgId = 0
const pending = new Map()
const consoleErrors = []
const pageExceptions = []

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exitCode = 1
}
function ok(msg) {
  console.log(`  ✓ ${msg}`)
}

async function http(method, path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { method })
  return res.json()
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
async function send(ws, method, params = {}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => {
    pending.set(id, { res, rej })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        rej(new Error(`CDP 超时：${method}`))
      }
    }, 30000)
  })
}
function handleMessage(ws, raw) {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) rej(new Error(msg.error.message))
    else res(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ') ?? '')
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageExceptions.push(msg.params.exceptionDetails?.exception?.description ?? '未知异常')
  }
}
async function evaluate(ws, expression) {
  const res = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'evaluate 异常')
  return res.result?.value
}

async function main() {
  if (!CHROME || !existsSync(CHROME)) return fail(`找不到 Chrome：${CHROME}`)
  if (!existsSync(samplesDir)) return fail(`缺少样例目录：${samplesDir}`)

  rmSync(shotDir, { recursive: true, force: true })
  mkdirSync(join(shotDir, 'downloads'), { recursive: true })
  const sampleFiles = readdirSync(samplesDir).filter((f) => f.endsWith('.png')).map((f) => join(samplesDir, f))
  console.log(`样例图片：${sampleFiles.length} 张`)

  const chrome = spawn(
    CHROME,
    [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
      '--user-data-dir=' + join(shotDir, 'profile'), 'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    let ready = false
    for (let i = 0; i < 40 && !ready; i++) {
      try {
        await http('GET', '/json/version')
        ready = true
      } catch {
        await wait(250)
      }
    }
    if (!ready) throw new Error('Chrome 调试端口未就绪')

    const target = await http('PUT', `/json/new?${encodeURIComponent(BASE_URL)}`)
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.onopen = res
      ws.onerror = rej
    })
    ws.onmessage = (e) => handleMessage(ws, e.data)
    await send(ws, 'Runtime.enable')
    await send(ws, 'Page.enable')
    await send(ws, 'DOM.enable')
    await wait(1500)

    // [1] 切换到「素材库」页签（按文本匹配，不依赖索引）
    console.log('\n[1] 切到素材库页签')
    await evaluate(ws, `[...document.querySelectorAll('.sidebar-tab')].find(el => el.textContent.includes('素材库') || el.textContent.includes('Library')).click()`)
    await wait(800)
    const panelExists = await evaluate(ws, `!!document.querySelector('.asset-panel')`)
    if (panelExists) ok('素材库面板已渲染')
    else fail('素材库面板未渲染')

    // 截图
    let shot = await send(ws, 'Page.captureScreenshot', {})
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(shotDir, '1-assets-empty.png'), Buffer.from(shot.data, 'base64'))

    // [2] 上传素材
    console.log('\n[2] 上传素材')
    const doc = await send(ws, 'DOM.getDocument', { depth: -1 })
    const q = await send(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.asset-panel input[type=file]' })
    if (q.nodeId) {
      await send(ws, 'DOM.setFileInputFiles', { files: sampleFiles.slice(0, 2), nodeId: q.nodeId })
      await wait(1800)
      const cards = await evaluate(ws, `document.querySelectorAll('.asset-card').length`)
      if (cards >= 2) ok(`上传后素材卡：${cards} 张`)
      else fail(`素材卡数量异常：${cards}`)
    } else {
      fail('找不到素材库上传 input')
    }
    shot = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '2-assets-uploaded.png'), Buffer.from(shot.data, 'base64'))

    // [3] 打开编辑器 → 加文字 → 保存
    console.log('\n[3] 素材编辑器（加文字 + 保存新素材）')
    await evaluate(ws, `document.querySelector('.asset-card .asset-thumb').click()`)
    await wait(1200)
    const editorOpen = await evaluate(ws, `!!document.querySelector('.asset-editor')`)
    if (editorOpen) ok('编辑器已打开')
    else fail('编辑器未打开')

    // 加文字图层
    const textBtns = await evaluate(ws, `[...document.querySelectorAll('.asset-editor-tools .btn-icon')].filter(b => b.title.includes('文字') || b.title.includes('text')).length`)
    await evaluate(ws, `[...document.querySelectorAll('.asset-editor-tools .btn-icon')].find(b => b.title.includes('文字') || b.title.includes('Add text')).click()`)
    await wait(500)
    const propPanel = await evaluate(ws, `!!document.querySelector('.asset-editor-props')`)
    if (propPanel) ok('文字属性面板出现')
    else fail('文字属性面板未出现')
    // 输入文字内容
    await evaluate(ws, `(() => {
      const input = document.querySelector('.asset-editor-props input.text-input')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, 'Hello 测试')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await wait(400)
    shot = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '3-editor-text.png'), Buffer.from(shot.data, 'base64'))

    // 保存
    await evaluate(ws, `[...document.querySelectorAll('.asset-editor-actions .btn')].find(b => b.textContent.includes('保存为新素材') || b.textContent.includes('Save as new')).click()`)
    await wait(1800)
    const editorClosed = await evaluate(ws, `!document.querySelector('.asset-editor')`)
    if (editorClosed) ok('保存后编辑器已关闭')
    else fail('编辑器未关闭')
    const cardCount = await evaluate(ws, `document.querySelectorAll('.asset-card').length`)
    if (cardCount >= 3) ok(`保存后素材卡：${cardCount} 张（原 2 + 新 1）`)
    else fail(`素材卡数量异常：${cardCount}`)
    const editedBadge = await evaluate(ws, `document.querySelectorAll('.asset-badge').length`)
    if (editedBadge >= 1) ok('出现「已编辑」徽标')
    else fail('未见「已编辑」徽标')
    shot = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '4-after-save.png'), Buffer.from(shot.data, 'base64'))

    // [4] 加入拼图
    console.log('\n[4] 素材 → 加入拼图')
    await evaluate(ws, `document.querySelector('.asset-card .asset-actions .btn-icon:nth-child(2)').click()`)
    await wait(800)
    const trayCount = await evaluate(ws, `document.querySelectorAll('.tray-item').length`)
    if (trayCount >= 1) ok(`托盘已收到素材：${trayCount} 项`)
    else fail('托盘未收到素材')

    // [5] 控制台
    console.log('\n[5] 控制台检查')
    const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e))
    if (pageExceptions.length > 0) fail(`页面异常：${pageExceptions.join(' | ')}`)
    else ok('无未捕获异常')
    if (realErrors.length > 0) fail(`console.error：${realErrors.join(' | ')}`)
    else ok('无 console.error')

    shot = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '5-final.png'), Buffer.from(shot.data, 'base64'))
    ws.close()
    console.log(`\n截图目录：${shotDir}`)
  } catch (error) {
    fail(`素材库冒烟测试中断：${error.message}`)
    fail(`已采集异常：${JSON.stringify(pageExceptions)}`)
  } finally {
    chrome.kill()
    await wait(300)
  }
}

main()
