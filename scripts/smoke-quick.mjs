/**
 * 5 项核心功能快速回归 smoke
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const samplesDir = join(projectRoot, 'samples')
const shotDir = join(projectRoot, '.smoke-quick')

function findChrome() {
  const candidates = [
    join(homedir(), '.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    join(homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  ]
  return candidates.find((p) => existsSync(p))
}
const CHROME = findChrome()
const PORT = 9335
const BASE_URL = 'http://127.0.0.1:4173/'

let msgId = 0
const pending = new Map()
const consoleErrors = []
const pageExceptions = []
function fail(m){ console.error(`\n✗ ${m}`); process.exitCode=1 }
function ok(m){ console.log(`  ✓ ${m}`) }
async function http(method, path) { return (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json() }
const wait = (ms) => new Promise(r => setTimeout(r, ms))
async function send(ws, method, params={}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => {
    pending.set(id, { res, rej })
    setTimeout(()=>{ if(pending.has(id)){ pending.delete(id); rej(new Error('CDP timeout: ' + method)) }}, 30000)
  })
}
function handleMessage(ws, raw) {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id)
    if (msg.error) rej(new Error(msg.error.message)); else res(msg.result); return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args?.map(a => a.value ?? a.description).join(' ') ?? '')
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageExceptions.push(msg.params.exceptionDetails?.exception?.description ?? 'unknown')
  }
}
async function evaluate(ws, expr) {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval err')
  return r.result?.value
}

async function main() {
  if (!CHROME) return fail('Chrome not found')
  if (!existsSync(samplesDir)) return fail('no samples')
  mkdirSync(shotDir, { recursive: true })
  const samples = readdirSync(samplesDir).filter(f => f.endsWith('.png')).map(f => join(samplesDir, f))

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
    '--user-data-dir=' + join(shotDir, 'profile'), 'about:blank',
  ], { stdio: 'ignore' })

  try {
    let ready = false
    for (let i = 0; i < 40 && !ready; i++) { try { await http('GET', '/json/version'); ready = true } catch { await wait(250) } }
    if (!ready) throw new Error('chrome not ready')

    const target = await http('PUT', '/json/new?' + encodeURIComponent(BASE_URL))
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    ws.onmessage = (e) => handleMessage(ws, e.data)
    await send(ws, 'Runtime.enable')
    await send(ws, 'Page.enable')
    await send(ws, 'DOM.enable')
    await wait(1200)

    console.log('\n[1] 五个页签全部可点')
    const tabCount = await evaluate(ws, `document.querySelectorAll('.sidebar-tab').length`)
    if (tabCount === 5) ok('渲染了 5 个页签'); else fail('页签数 ' + tabCount + ' != 5')
    const tabNames = await evaluate(ws, `[...document.querySelectorAll('.sidebar-tab')].map(t => t.textContent.trim()).join('|')`)
    console.log('  ↳', tabNames)
    if (!/素材库|Library/.test(tabNames)) fail('缺素材库 tab'); else ok('素材库 tab 存在')

    await evaluate(ws, `[...document.querySelectorAll('.sidebar-tab')].find(t => t.textContent.includes('素材库') || t.textContent.includes('Library')).click()`)
    await wait(500)
    const inAssets = await evaluate(ws, `!!document.querySelector('.asset-panel')`)
    if (inAssets) ok('切到素材库：面板出现')
    await evaluate(ws, `[...document.querySelectorAll('.sidebar-tab')].find(t => t.textContent.includes('布局') || t.textContent.includes('Layout')).click()`)
    await wait(500)
    const inLayout = await evaluate(ws, `!!document.querySelector('.count-grid')`)
    if (inLayout) ok('切回布局：count-grid 出现')

    console.log('\n[3] 多选批量上传（一次性选择 2 张）')
    const doc = await send(ws, 'DOM.getDocument', { depth: -1 })
    const mainInput = await send(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file][accept^="image"]' })
    if (mainInput.nodeId) {
      await send(ws, 'DOM.setFileInputFiles', { files: samples.slice(0, 2), nodeId: mainInput.nodeId })
      await wait(2000)
      const trayCount = await evaluate(ws, `document.querySelectorAll('.tray-item').length`)
      if (trayCount === 2) ok('托盘接收 2 张（多选批量工作）'); else fail('托盘数量 ' + trayCount + ' != 2')
    } else {
      fail('找不到主 input')
    }

    console.log('\n[4] 切到 4 张布局后画布重渲染')
    await evaluate(ws, `document.querySelectorAll('.count-cell')[3]?.click()`)
    await wait(500)
    const layoutCells = await evaluate(ws, `document.querySelectorAll('.layout-card').length`)
    if (layoutCells > 0) ok('4 张布局渲染出 ' + layoutCells + ' 种布局')

    console.log('\n[5] 控制台')
    const realErrs = consoleErrors.filter(e => !/favicon/i.test(e))
    if (pageExceptions.length > 0) fail('页面异常: ' + pageExceptions.join('|')); else ok('无未捕获异常')
    if (realErrs.length > 0) fail('console.error: ' + realErrs.join('|')); else ok('无 console.error')

    const shot = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, 'final.png'), Buffer.from(shot.data, 'base64'))
    ws.close()
    console.log('\n截图：' + shotDir)
  } catch (e) {
    fail('smoke 中断：' + e.message)
  } finally {
    chrome.kill()
    await wait(300)
  }
}
main()
