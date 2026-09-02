/**
 * 端到端冒烟测试（通过 CDP 直接驱动 Chrome，不依赖任何测试框架）
 *
 * 用法：node scripts/smoke.mjs
 *
 * 覆盖的主流程：
 *   1. 打开编辑器，确认无 JS 报错
 *   2. 上传样例图片，确认画布真的画出了内容（采样像素，而不是只看 DOM）
 *   3. 切换图片数量与布局，确认重新渲染正常
 *   4. 切换到「导出」面板并下载，确认产物文件真实落盘且尺寸正确
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const samplesDir = join(projectRoot, 'samples')
const shotDir = join(projectRoot, '.smoke')
const downloadDir = join(shotDir, 'downloads')

/** 定位 Chrome：优先 agent-browser 下载的，其次系统安装的 */
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
const PORT = 9333
const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:4173/'

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
  return new Promise((resolvePromise, reject) => {
    pending.set(id, { resolvePromise, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP 超时：${method}`))
      }
    }, 30000)
  })
}

function handleMessage(ws, raw) {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    const { resolvePromise, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(`${msg.error.message}`))
    else resolvePromise(msg.result)
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
  const res = await send(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? 'evaluate 抛异常')
  }
  return res.result?.value
}

async function main() {
  if (!existsSync(CHROME)) {
    fail(`找不到 Chrome：${CHROME}`)
    return
  }
  if (!existsSync(samplesDir)) {
    fail(`找不到样例图片目录：${samplesDir}，先运行 node scripts/make-samples.mjs`)
    return
  }

  rmSync(shotDir, { recursive: true, force: true })
  mkdirSync(downloadDir, { recursive: true })

  const sampleFiles = readdirSync(samplesDir)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => join(samplesDir, f))

  console.log(`样例图片：${sampleFiles.length} 张`)

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1440,900',
      '--user-data-dir=' + join(shotDir, 'profile'),
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    // 等待调试端口就绪
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

    const target = await http('PUT', `/json/new?${encodeURIComponent(BASE_URL + '?count=2&layout=0')}`)
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.onopen = res
      ws.onerror = rej
    })
    ws.onmessage = (e) => handleMessage(ws, e.data)

    await send(ws, 'Runtime.enable')
    await send(ws, 'Page.enable')
    await send(ws, 'Log.enable')
    await send(ws, 'Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })

    console.log('\n[1] 首屏加载')
    await wait(1200)
    const title = await evaluate(ws, 'document.querySelector(".brand-title")?.textContent ?? ""')
    const canvasInfo = await evaluate(
      ws,
      `(() => { const c = document.querySelector(".stage-canvas canvas"); return c ? {w: c.width, h: c.height} : null })()`,
    )
    if (!canvasInfo || canvasInfo.w === 0) fail('画布未渲染出来')
    else ok(`标题「${title}」，画布 ${canvasInfo.w}×${canvasInfo.h}（含 DPR）`)

    const layoutCards = await evaluate(ws, 'document.querySelectorAll(".layout-card").length')
    if (layoutCards < 5) fail(`布局面板只渲染出 ${layoutCards} 个布局`)
    else ok(`布局面板渲染 ${layoutCards} 个布局`)

    console.log('\n[2] 上传两张图片')
    const dom = await send(ws, 'DOM.getDocument', { depth: -1 })
    const { nodeId } = await send(ws, 'DOM.querySelector', { nodeId: dom.root.nodeId, selector: 'input[type=file]' })
    if (!nodeId) throw new Error('找不到文件选择框')
    await send(ws, 'DOM.setFileInputFiles', { files: sampleFiles.slice(0, 2), nodeId })
    await wait(1500)

    const trayCount = await evaluate(ws, 'document.querySelectorAll(".tray-item").length')
    if (trayCount !== 2) fail(`托盘里有 ${trayCount} 张图，期望 2 张`)
    else ok('托盘出现 2 张缩略图')

    // 采样画布像素：确认不是空白，且左右两格颜色不同（说明两张图都画上去了）
    const pixels = await evaluate(
      ws,
      `(() => {
        const c = document.querySelector(".stage-canvas canvas")
        const ctx = c.getContext("2d")
        const pick = (fx, fy) => {
          const d = ctx.getImageData(Math.round(c.width*fx), Math.round(c.height*fy), 1, 1).data
          return [d[0], d[1], d[2], d[3]]
        }
        return { left: pick(0.25, 0.5), right: pick(0.75, 0.5), mid: pick(0.5, 0.5) }
      })()`,
    )
    const opaque = pixels.left[3] === 255 && pixels.right[3] === 255
    const distinct =
      Math.abs(pixels.left[0] - pixels.right[0]) +
        Math.abs(pixels.left[1] - pixels.right[1]) +
        Math.abs(pixels.left[2] - pixels.right[2]) >
      30
    if (!opaque) fail(`画布像素不透明，实际 ${JSON.stringify(pixels)}`)
    else if (!distinct) fail(`左右两格颜色几乎一致，可能只画了一张图：${JSON.stringify(pixels)}`)
    else ok(`双图渲染正确（左 ${pixels.left.slice(0, 3)} / 右 ${pixels.right.slice(0, 3)}）`)

    console.log('\n[3] 切换为 4 张 + 选第 2 个布局')
    await send(ws, 'DOM.setFileInputFiles', { files: sampleFiles.slice(2, 4), nodeId })
    await wait(1200)
    await evaluate(ws, `document.querySelectorAll(".count-cell")[3].click()`)
    await wait(400)
    await evaluate(ws, `document.querySelectorAll(".layout-card")[1].click()`)
    await wait(900)
    const url = await evaluate(ws, 'location.search')
    const pix4 = await evaluate(
      ws,
      `(() => {
        const c = document.querySelector(".stage-canvas canvas")
        const ctx = c.getContext("2d")
        const d = ctx.getImageData(Math.round(c.width*0.2), Math.round(c.height*0.2), 1, 1).data
        return [d[0], d[1], d[2], d[3]]
      })()`,
    )
    if (!url.includes('count=4')) fail(`URL 未同步图片数量：${url}`)
    else ok(`URL 已同步：${url}`)
    if (pix4[3] !== 255) fail('切换布局后画布未绘制内容')
    else ok('四图布局渲染正常')

    await send(ws, 'Page.captureScreenshot', {}).then(async (res) => {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(shotDir, 'editor-4.png'), Buffer.from(res.data, 'base64'))
    })

    console.log('\n[4] 调整样式：边距 / 间距 / 圆角 / 比例')
    await evaluate(ws, `document.querySelectorAll(".sidebar-tab")[1].click()`) // 样式
    await wait(300)
    await evaluate(ws, `document.querySelectorAll(".ratio-btn")[5].click()`) // 16:9
    await wait(200)
    const setSlider = async (idx, value) => {
      await evaluate(
        ws,
        `(() => {
          const s = document.querySelectorAll(".slider")[${idx}]
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          setter.call(s, ${value})
          s.dispatchEvent(new Event("input", { bubbles: true }))
        })()`,
      )
    }
    await setSlider(0, 40) // 边距
    await setSlider(1, 20) // 间距
    await setSlider(2, 30) // 圆角
    await wait(700)
    const styleState = await evaluate(ws, `JSON.parse(localStorage.getItem("merge-image:settings")).style`)
    if (styleState.margin !== 40 || styleState.gap !== 20 || styleState.radius !== 30) {
      fail(`样式未生效：${JSON.stringify(styleState)}`)
    } else {
      ok(`样式已生效并持久化：${JSON.stringify(styleState)}`)
    }
    // 圆角生效后，画布左上角应当是背景色，而不是图片
    const corner = await evaluate(
      ws,
      `(() => {
        const c = document.querySelector(".stage-canvas canvas")
        const ctx = c.getContext("2d")
        const d = ctx.getImageData(Math.round(c.width*0.09), Math.round(c.height*0.05), 1, 1).data
        return [d[0], d[1], d[2], d[3]]
      })()`,
    )
    ok(`边距区域采样 ${corner.slice(0, 3)}（应为背景色）`)

    console.log('\n[5] 导出 PNG / JPEG / WebP')
    await evaluate(ws, `document.querySelectorAll(".sidebar-tab")[3].click()`) // 导出（标签页索引 3）
    await wait(300)

    const clickDownload = async () => {
      await evaluate(ws, `document.querySelector(".btn-primary.btn-lg").click()`)
    }
    const waitForDownload = async (before) => {
      for (let i = 0; i < 60; i++) {
        const files = readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload') && !before.has(f))
        if (files.length > 0) {
          const name = files[0]
          const full = join(downloadDir, name)
          const size = statSync(full).size
          if (size > 0) return { name, size, full }
        }
        await wait(250)
      }
      return null
    }

    for (const [label, segIndex] of [
      ['PNG', 0],
      ['JPEG', 1],
      ['WebP', 2],
    ]) {
      const before = new Set(readdirSync(downloadDir))
      await evaluate(ws, `document.querySelectorAll(".seg-item")[${segIndex}].click()`)
      await wait(200)
      await clickDownload()
      const result = await waitForDownload(before)
      if (!result) fail(`${label} 未产出文件`)
      else ok(`${label} → ${result.name}（${(result.size / 1024).toFixed(0)} KB）`)
    }

    console.log('\n[6] 控制台检查')
    if (pageExceptions.length > 0) {
      fail(`页面抛出异常：\n    ${pageExceptions.join('\n    ')}`)
    } else {
      ok('无未捕获异常')
    }
    const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e))
    if (realErrors.length > 0) {
      fail(`控制台报错：\n    ${realErrors.join('\n    ')}`)
    } else {
      ok('无 console.error')
    }

    await send(ws, 'Page.captureScreenshot', {}).then(async (res) => {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(shotDir, 'editor-final.png'), Buffer.from(res.data, 'base64'))
    })

    ws.close()
    console.log(`\n截图目录：${shotDir}`)
  } catch (error) {
    fail(`冒烟测试中断：${error.message}`)
    fail(`已采集的异常：${JSON.stringify(pageExceptions)}`)
  } finally {
    chrome.kill()
    await wait(300)
  }

  if (!process.exitCode) console.log('\n全部通过 ✓')
}

main()
