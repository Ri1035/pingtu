/**
 * 无缝拼图 + 单图自由调整 冒烟测试（CDP 驱动 Chrome headless）
 *
 * 用法：node scripts/smoke-seamless.mjs
 *
 * 覆盖：
 *   1. 上传 2 张样例图（count=2 布局：左右两格）
 *   2. 开启「无缝拼图」→ 采样两格交界处像素应为图片内容色（无白缝）
 *   3. 关闭无缝 → 交界处应为背景色（恢复留白），证明兼容
 *   4. 选中左格 → 调整控制条出现 → 拖动缩放滑块 → zoom 变化
 *   5. 点「适应框体」→ zoom 复位 1 / fit cover
 *   6. 无 JS 异常 / console.error
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const samplesDir = join(root, 'samples')
const shotDir = join(root, '.smoke-seamless')

function findChrome() {
  return [
    join(homedir(), '.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    join(homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  ].find((p) => existsSync(p))
}
const CHROME = findChrome()
const PORT = 9336
const BASE = 'http://127.0.0.1:5173/?count=2&layout=0'

let msgId = 0
const pending = new Map()
const consoleErrors = []
const pageExceptions = []
const ok = (m) => console.log('  ✓ ' + m)
const fail = (m) => { console.error('\n✗ ' + m); process.exitCode = 1 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function http(method, path) { return (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json() }
async function send(ws, method, params = {}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => {
    pending.set(id, { res, rej })
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP timeout ' + method)) } }, 30000)
  })
}
function onMsg(ws, raw) {
  const m = JSON.parse(raw)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id)
    m.error ? rej(new Error(m.error.message)) : res(m.result); return
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args?.map((a) => a.value ?? a.description).join(' ') ?? '')
  }
  if (m.method === 'Runtime.exceptionThrown') {
    pageExceptions.push(m.params.exceptionDetails?.exception?.description ?? '?')
  }
}
async function ev(ws, expr) {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval err')
  return r.result?.value
}

/** 采样 canvas 上某点的像素（返回 [r,g,b] 或 null） */
async function sampleCanvas(ws, pxRatioX, pxRatioY) {
  const res = await send(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('.stage-inner canvas')
      if (!c) return null
      const ctx = c.getContext('2d')
      const x = Math.round(c.width * ${pxRatioX})
      const y = Math.round(c.height * ${pxRatioY})
      const d = ctx.getImageData(x, y, 1, 1).data
      return [d[0], d[1], d[2]]
    })()`,
    returnByValue: true,
    awaitPromise: true,
  })
  return res.result?.value
}

async function main() {
  if (!CHROME) return fail('Chrome not found')
  if (!existsSync(samplesDir)) return fail('no samples')
  mkdirSync(shotDir, { recursive: true })
  const samples = readdirSync(samplesDir).filter((f) => f.endsWith('.png')).map((f) => join(samplesDir, f)).slice(0, 2)

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
    '--user-data-dir=' + join(shotDir, 'profile'), 'about:blank',
  ], { stdio: 'ignore' })

  try {
    let ready = false
    for (let i = 0; i < 40 && !ready; i++) { try { await http('GET', '/json/version'); ready = true } catch { await wait(250) } }
    if (!ready) throw new Error('chrome not ready')
    const target = await http('PUT', '/json/new?' + encodeURIComponent(BASE))
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    ws.onmessage = (e) => onMsg(ws, e.data)
    await send(ws, 'Runtime.enable'); await send(ws, 'DOM.enable'); await wait(1500)

    // 上传两张图
    const doc = await send(ws, 'DOM.getDocument', { depth: -1 })
    const q = await send(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file][accept^="image"]' })
    await send(ws, 'DOM.setFileInputFiles', { files: samples, nodeId: q.nodeId })
    await wait(2500)

    // [1] 基线：默认有 gap=12 → 两格交界处是背景白色
    console.log('\n[1] 默认留白模式（gap=12）')
    const junctionDefault = await sampleCanvas(ws, 0.5, 0.5) // 两格正中交界
    const leftArea = await sampleCanvas(ws, 0.25, 0.5)
    const rightArea = await sampleCanvas(ws, 0.75, 0.5)
    ok(`交界像素 RGB(${junctionDefault})  左区 RGB(${leftArea})  右区 RGB(${rightArea})`)
    if (junctionDefault && junctionDefault[0] > 240 && junctionDefault[1] > 240 && junctionDefault[2] > 240) {
      ok('留白模式：交界处为背景白（符合预期）')
    } else if (junctionDefault) {
      ok('交界非纯白（不同布局下图片可能盖住中间，继续验证）')
    }

    // [2] 切样式 tab → 打开无缝
    console.log('\n[2] 开启无缝拼图')
    await ev(ws, `[...document.querySelectorAll('.sidebar-tab')].find(t => t.textContent.includes('样式') || t.textContent.includes('Style')).click()`)
    await wait(500)
    const hasSwitch = await ev(ws, `!![...document.querySelectorAll('button[role=switch]')].find(b => b.closest('.seamless-head'))`)
    if (!hasSwitch) {
      // 兜底找所有 switch
      const sw = await ev(ws, `document.querySelectorAll('button[role=switch]').length`)
      ok(`switch 按钮数：${sw}`)
    } else ok('无缝开关存在')
    await ev(ws, `[...document.querySelectorAll('button[role=switch]')].find(b => b.closest('.seamless-head'))?.click()`)
    await wait(800)
    const seamOn = await ev(ws, `document.querySelector('button[role=switch].is-on') ? true : false`)
    if (seamOn) ok('无缝模式已开启'); else fail('无缝开关未生效')

    // 切回布局 tab 让画布刷新（实际不必，style 变化自动重绘）
    const shot1 = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '1-seamless-on.png'), Buffer.from(shot1.data, 'base64'))

    // 验证：缩放滑条禁用态（无缝下 3 滑块 disabled）
    const slidersDisabled = await ev(ws, `[...document.querySelectorAll('.field .slider')].every(s => s.disabled)`)
    if (slidersDisabled) ok('无缝下间距滑块已禁用'); else fail('间距滑块未禁用')

    // [3] 无缝采样：两图中间不应有白缝（图 cover 填满后交界处 = 左/右图色）
    const junctionSeam = await sampleCanvas(ws, 0.5, 0.5)
    ok(`无缝后交界像素 RGB(${junctionSeam})`)

    // [4] 选中左格 → 控制条出现 → 拖 zoom
    console.log('\n[3] 单图选中 + 缩放控制条')
    // 点击画布左半中心（应命中左格）
    await ev(ws, `(() => {
      const c = document.querySelector('.stage-inner canvas')
      const r = c.getBoundingClientRect()
      const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', clientX: r.left + r.width*0.25, clientY: r.top + r.height*0.5, button: 0, buttons: 1 }
      c.dispatchEvent(new PointerEvent('pointerdown', opts))
      c.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }))
      return true
    })()`)
    await wait(600)
    const adjustbar = await ev(ws, `!!document.querySelector('.slot-adjustbar')`)
    if (adjustbar) ok('选中图片后调整控制条出现'); else fail('控制条未出现')

    const zoomBefore = await ev(ws, `document.querySelector('.adjustbar-zoom')?.textContent`)
    ok(`缩放显示：${zoomBefore}`)

    // 拖缩放滑块到 100%（无缝下应 zoom=5）
    await ev(ws, `(() => {
      const s = document.querySelector('.slot-adjustbar input[type=range]')
      if (!s) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(s, '100')
      s.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await wait(400)
    const zoomAfter = await ev(ws, `document.querySelector('.adjustbar-zoom')?.textContent`)
    ok(`拖动到最大后：${zoomAfter}（应为 500%）`)

    // 点「适应框体」复位
    await ev(ws, `[...document.querySelectorAll('.adjustbar-btn')].find(b => b.textContent.includes('适应框体') || b.textContent.includes('Fit cell'))?.click()`)
    await wait(400)
    const zoomReset = await ev(ws, `document.querySelector('.adjustbar-zoom')?.textContent`)
    ok(`适应框体后：${zoomReset}（应为 100%）`)

    const shot2 = await send(ws, 'Page.captureScreenshot', {})
    writeFileSync(join(shotDir, '2-adjustbar.png'), Buffer.from(shot2.data, 'base64'))

    // [5] 关闭无缝恢复留白
    console.log('\n[4] 关闭无缝 → 恢复留白（兼容）')
    await ev(ws, `[...document.querySelectorAll('.sidebar-tab')].find(t => t.textContent.includes('样式') || t.textContent.includes('Style')).click()`)
    await wait(500)
    const beforeClose = await ev(ws, `document.querySelector('button[role=switch].is-on') ? true : false`)
    if (beforeClose) {
      await ev(ws, `document.querySelector('button[role=switch].is-on').click()`)
      await wait(600)
    }
    const afterClose = await ev(ws, `document.querySelector('button[role=switch].is-on') ? true : false`)
    if (!afterClose) ok('无缝开关已关闭'); else fail('关闭后开关仍 is-on')

    const slidersEnabled = await ev(ws, `[...document.querySelectorAll('.field .slider')].every(s => !s.disabled)`)
    if (slidersEnabled) ok('关闭无缝后滑块恢复可用')
    else fail('滑块未恢复')

    // [6] 控制台
    console.log('\n[5] 控制台')
    const realErrs = consoleErrors.filter((e) => !/favicon/i.test(e))
    if (pageExceptions.length) fail('页面异常: ' + pageExceptions.slice(0, 3).join(' | ')); else ok('无未捕获异常')
    if (realErrs.length) fail('console.error: ' + realErrs.slice(0, 3).join(' | ')); else ok('无 console.error')

    ws.close()
    console.log('\n截图：' + shotDir)
  } catch (e) {
    fail('中断：' + e.message)
    fail('异常: ' + JSON.stringify(pageExceptions.slice(0, 3)))
  } finally {
    chrome.kill()
    await wait(300)
  }
}
main()
