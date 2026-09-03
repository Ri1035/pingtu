import { createContext, useContext } from 'react'

export type Lang = 'zh' | 'en'

/** 文案值：普通字符串，或带一个数字参数的函数 */
type Value = string | ((n: number) => string)

/** 中文词表（也是 key 的唯一来源） */
const zh: Record<string, Value> = {
  appTitle: '拼图编辑器',
  appTagline: '本地处理 · 图片不上传',
  appVersion: 'v1.5.0',

  tabLayout: '布局',
  tabStyle: '样式',
  tabText: '文字',
  tabExport: '导出',
  tabAssets: '素材库',

  langSwitch: 'English',
  newProject: '新建',
  privacy: '图片全程在浏览器本地处理，不会上传到任何服务器',

  imageCount: '图片数量',
  imageCountHint: '选择要合并的图片张数（1 ~ 16）',
  layoutPreset: '布局',
  layoutCount: (n) => `${n} 种布局`,
  currentLayout: '当前布局',

  canvasRatio: '画布比例',
  ratioAuto: '自动',
  margin: '边距',
  gap: '间距',
  radius: '圆角',
  background: '背景色',
  transparent: '透明背景',
  transparentHint: '透明背景需导出 PNG 或 WebP；JPEG 会自动填充背景色',
  resetStyle: '恢复默认',

  exportFormat: '格式',
  exportQuality: '质量',
  exportWidth: '导出宽度',
  widthCustom: '自定义',
  outputSize: '输出尺寸',
  exportHint: '提高宽度可获得更清晰的成图，文件体积也会随之变大',
  download: '下载图片',
  downloading: '正在生成…',
  lastExport: '上次导出',

  addPhotos: '添加图片',
  addMore: '继续添加',
  dragHint: '拖拽 / 粘贴 / 点击上传',
  photoTray: '图片',
  autoFill: '自动填充',
  clearAll: '清空',
  unusedPhotos: (n) => `还有 ${n} 张未放入画布`,
  notEnoughPhotos: (n) => `还差 ${n} 张图片`,
  allFilled: '已全部填满',
  emptyState: '先添加几张图片吧',
  emptyStateHint: '或直接把图片拖到画布上 · 支持一次多选批量上传',

  clickToAdd: '点击上传',
  replace: '替换',
  remove: '删除',
  rotateLeft: '向左旋转',
  rotateRight: '向右旋转',
  flipH: '水平镜像',
  flipV: '垂直镜像',
  resetView: '复位构图',
  moveLeft: '前移',
  moveRight: '后移',
  swapHint: '再点另一个格子即可交换两张图片',
  panHint: '拖拽可平移，滚轮可缩放',

  // 单格调整
  cellEnlarge: '放大格子',
  cellShrink: '缩小格子',
  cellBorder: '边框',
  cellBorderWidth: '边框宽度',
  cellBorderColor: '边框颜色',
  cellBorderInward: '向内',
  cellBorderOutward: '向外',
  cellBorderCenter: '居中',
  borderPattern: '边框样式',
  patternSolid: '实线',
  patternDashed: '虚线',
  patternDotted: '点线',
  patternDouble: '双线',
  // 浮层素材
  addAsOverlay: '添加为浮层',
  overlayScale: '大小',
  overlayRotate: '旋转',
  overlayBorder: '边框',
  overlayDelete: '删除浮层',
  overlayHint: '拖拽浮层移动位置，选中后可用滑条或滚轮调整大小',

  zoom: '缩放',
  unsupportedWebp: '当前浏览器不支持 WebP，已自动改用 PNG',
  exportFailed: '导出失败',
  tooManyPhotos: (n) => `最多支持 ${n} 张图片`,
  addFailed: (n) => `有 ${n} 个文件无法导入`,
  fillFromTray: '按当前图片顺序填入画布',

  // —— 单图自由调整（无缝模式配套） ——
  fitScale: '缩放',
  fitCover: '铺满裁切',
  fitContain: '完整显示',
  centerPhoto: '居中',
  seamlessMode: '无缝拼图',
  seamlessModeOn: '已开启',
  seamlessHint: '图片之间及边缘不留任何间距或边框，紧密拼接',
  seamlessOffHint: '开启后间距 / 边距 / 圆角归零，可关闭恢复留白样式',

  addText: '添加文字',
  textList: '文字图层',
  noText: '还没有文字，点击上方按钮添加',
  textContent: '文字内容',
  textContentPlaceholder: '输入要叠加的文字…',
  textFont: '字体',
  textSize: '字号',
  textColor: '颜色',
  textBold: '粗体',
  textItalic: '斜体',
  textRotation: '旋转',
  textAlign: '对齐',
  alignLeft: '左对齐',
  alignCenter: '居中',
  alignRight: '右对齐',
  textLineHeight: '行距',
  textLetterSpacing: '字间距',
  textUnderline: '下划线',
  textStroke: '描边',
  textStrokeWidth: '描边宽度',
  textStrokeColor: '描边颜色',
  textShadow: '阴影',
  textShadowBlur: '阴影模糊',
  textShadowColor: '阴影颜色',
  textShadowOffsetX: '阴影水平偏移',
  textShadowOffsetY: '阴影垂直偏移',
  opacity: '不透明度',
  textDelete: '删除文字',
  textHint: '在画布上拖拽文字可调整位置',
  fontDetecting: '正在检测系统字体…',
  noFontDetected: '未检测到额外字体，将使用系统默认字体',

  // —— 素材库 ——
  assetUpload: '上传素材',
  assetScanFolder: '扫描文件夹',
  assetUploadHint: '支持多选或直接扫描文件夹，素材仅保存在本机浏览器（可反复使用）',
  assetFolderHint: '选择本地图片文件夹批量导入（浏览器刷新后需重新选择）',
  assetFolderScanDone: (n) => `已从文件夹导入 ${n} 张图片`,
  assetFolderNoImages: '文件夹中未找到支持的图片格式',
  assetLoading: '正在加载素材…',
  assetEmpty: '素材库还是空的',
  assetEditHint: '编辑素材',
  assetAddToCollage: '加入拼图',
  assetEdited: '已编辑',
  assetEditSave: '保存为新素材',
  assetEditNewText: '双击修改文字',
  assetEditAddText: '添加文字',
  assetEditAddSticker: '添加贴纸',
  assetEditSize: '大小',
  assetSaveDone: '已保存到素材库',
  assetDeleteConfirm: '删除该素材？',
  assetClearAllConfirm: '确定清空整个素材库吗？此操作不可撤销。',
  assetClearAll: '清空素材库',
  assetCleared: '素材库已清空',
  cancel: '取消',
  saving: '保存中…',
  chipFree: '自由',
  chip11: '1:1',
  chip43: '4:3',
  chip34: '3:4',
  chip169: '16:9',

  // —— 画布比例 ——
  ratio11: '1:1',
  ratio34: '3:4',
  ratio916: '9:16',
  ratio43: '4:3',
  ratio169: '16:9',
  ratioCustom: '自定义',
  customSize: '画布尺寸',
  customSizeHint: '直接指定画布像素宽高，替代上方比例选项',

  // —— 导出面板中文化 ——
  lossless: '无损',
  pngLosslessHint: 'PNG 为无损格式，质量固定',
  exportSizeHint: '导出后会显示实际文件大小',

  // —— 样式面板 ——
  styleHint: '边距 / 间距 / 圆角以 {base}px 宽为基准等比缩放，改变导出尺寸不会影响观感。',

  // —— 字体面板 ——
  fontGeneric: '通用',
}

const en: Record<string, Value> = {
  appTitle: 'Collage Editor',
  appTagline: 'Runs locally · never uploaded',
  appVersion: 'v1.5.0',

  tabLayout: 'Layout',
  tabStyle: 'Style',
  tabText: 'Text',
  tabExport: 'Export',
  tabAssets: 'Library',

  langSwitch: '中文',
  newProject: 'New',
  privacy: 'Everything happens in your browser — images are never uploaded',

  imageCount: 'Photo count',
  imageCountHint: 'Pick how many photos to merge (1 – 16)',
  layoutPreset: 'Layout',
  layoutCount: (n) => `${n} layouts`,
  currentLayout: 'Current layout',

  canvasRatio: 'Canvas ratio',
  ratioAuto: 'Auto',
  margin: 'Margin',
  gap: 'Spacing',
  radius: 'Radius',
  background: 'Background',
  transparent: 'Transparent',
  transparentHint: 'Transparency needs PNG or WebP; JPEG fills the background color',
  resetStyle: 'Reset',

  exportFormat: 'Format',
  exportQuality: 'Quality',
  exportWidth: 'Width',
  widthCustom: 'Custom',
  outputSize: 'Output size',
  exportHint: 'A larger width means a sharper image and a bigger file',
  download: 'Download',
  downloading: 'Rendering…',
  lastExport: 'Last export',

  addPhotos: 'Add photos',
  addMore: 'Add more',
  dragHint: 'Drag, paste or click to upload',
  photoTray: 'Photos',
  autoFill: 'Auto fill',
  clearAll: 'Clear',
  unusedPhotos: (n) => `${n} photo(s) not on canvas`,
  notEnoughPhotos: (n) => `${n} more photo(s) needed`,
  allFilled: 'All slots filled',
  emptyState: 'Add a few photos to get started',
  emptyStateHint: 'or drag photos onto the canvas — multi-select batch upload supported',

  clickToAdd: 'Click to upload',
  replace: 'Replace',
  remove: 'Remove',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  flipH: 'Flip horizontal',
  flipV: 'Flip vertical',
  resetView: 'Reset framing',
  moveLeft: 'Move earlier',
  moveRight: 'Move later',
  swapHint: 'Click another cell to swap the two photos',
  panHint: 'Drag to pan · scroll to zoom',

  // Cell adjustment
  cellEnlarge: 'Enlarge cell',
  cellShrink: 'Shrink cell',
  cellBorder: 'Border',
  cellBorderWidth: 'Border width',
  cellBorderColor: 'Border color',
  cellBorderInward: 'Inward',
  cellBorderOutward: 'Outward',
  cellBorderCenter: 'Center',
  borderPattern: 'Border style',
  patternSolid: 'Solid',
  patternDashed: 'Dashed',
  patternDotted: 'Dotted',
  patternDouble: 'Double',
  // Overlay asset
  addAsOverlay: 'Add as overlay',
  overlayScale: 'Size',
  overlayRotate: 'Rotate',
  overlayBorder: 'Border',
  overlayDelete: 'Delete overlay',
  overlayHint: 'Drag the overlay to move it; use the slider or scroll wheel to resize',

  zoom: 'Zoom',
  unsupportedWebp: 'WebP is not supported here — falling back to PNG',
  exportFailed: 'Export failed',
  tooManyPhotos: (n) => `Up to ${n} photos supported`,
  addFailed: (n) => `${n} file(s) could not be imported`,
  fillFromTray: 'Fill the canvas in the current photo order',

  // —— Per-photo adjustment (seamless mode) ——
  fitScale: 'Scale',
  fitCover: 'Fill crop',
  fitContain: 'Fit full',
  centerPhoto: 'Center',
  seamlessMode: 'Seamless',
  seamlessModeOn: 'On',
  seamlessHint: 'No gaps or borders between or around photos — flush tiling',
  seamlessOffHint: 'Zeroes spacing / margin / radius while on; turn off to restore framed style',

  addText: 'Add text',
  textList: 'Text layers',
  noText: 'No text yet — click the button above to add',
  textContent: 'Text',
  textContentPlaceholder: 'Type text to overlay…',
  textFont: 'Font',
  textSize: 'Size',
  textColor: 'Color',
  textBold: 'Bold',
  textItalic: 'Italic',
  textRotation: 'Rotate',
  textAlign: 'Align',
  alignLeft: 'Left',
  alignCenter: 'Center',
  alignRight: 'Right',
  textLineHeight: 'Line spacing',
  textLetterSpacing: 'Letter spacing',
  textUnderline: 'Underline',
  textStroke: 'Outline',
  textStrokeWidth: 'Outline width',
  textStrokeColor: 'Outline color',
  textShadow: 'Shadow',
  textShadowBlur: 'Shadow blur',
  textShadowColor: 'Shadow color',
  textShadowOffsetX: 'Shadow offset X',
  textShadowOffsetY: 'Shadow offset Y',
  opacity: 'Opacity',
  textDelete: 'Delete text',
  textHint: 'Drag text on the canvas to reposition it',
  fontDetecting: 'Detecting system fonts…',
  noFontDetected: 'No extra fonts found — using system defaults',

  // —— Asset library ——
  assetUpload: 'Upload asset',
  assetScanFolder: 'Scan folder',
  assetUploadHint: 'Multi-select or scan a folder. Assets stay in this browser and can be reused',
  assetFolderHint: 'Pick a local image folder to batch import (re-select is needed after refresh)',
  assetFolderScanDone: (n) => `Imported ${n} images from folder`,
  assetFolderNoImages: 'No supported image formats found in the folder',
  assetLoading: 'Loading assets…',
  assetEmpty: 'Your asset library is empty',
  assetEditHint: 'Edit asset',
  assetAddToCollage: 'Add to collage',
  assetEdited: 'Edited',
  assetEditSave: 'Save as new asset',
  assetEditNewText: 'Double-click to edit text',
  assetEditAddText: 'Add text',
  assetEditAddSticker: 'Add sticker',
  assetEditSize: 'Size',
  assetSaveDone: 'Saved to library',
  assetDeleteConfirm: 'Delete this asset?',
  assetClearAllConfirm: 'Clear the entire asset library? This cannot be undone.',
  assetClearAll: 'Clear all assets',
  assetCleared: 'Asset library cleared',
  cancel: 'Cancel',
  saving: 'Saving…',
  chipFree: 'Free',
  chip11: '1:1',
  chip43: '4:3',
  chip34: '3:4',
  chip169: '16:9',

  // —— Canvas ratios ——
  ratio11: '1:1',
  ratio34: '3:4',
  ratio916: '9:16',
  ratio43: '4:3',
  ratio169: '16:9',
  ratioCustom: 'Custom',
  customSize: 'Canvas size',
  customSizeHint: 'Set exact canvas width & height in pixels (overrides the ratio)',

  // —— Export panel ——
  lossless: 'Lossless',
  pngLosslessHint: 'PNG is lossless, quality is fixed',
  exportSizeHint: 'Actual file size will be shown after export',

  // —— Style panel ——
  styleHint: 'Margin / spacing / radius are scaled proportionally based on {base}px width; changing export size does not affect the look.',

  // —— Font panel ——
  fontGeneric: 'Generic',
}

const DICTS: Record<Lang, Record<string, Value>> = { zh, en }

export interface I18n {
  lang: Lang
  /** 取文案，支持形如 t('layoutCount', 12) 的动态参数 */
  t: (key: string, arg?: number) => string
  setLang: (lang: Lang) => void
}

export function makeI18n(lang: Lang, setLang: (l: Lang) => void): I18n {
  const dict = DICTS[lang] ?? DICTS.zh
  const t = (key: string, arg?: number): string => {
    const value = dict[key]
    if (typeof value === 'function') return value(arg ?? 0)
    if (typeof value === 'string') return value
    return DICTS.zh[key] as string
  }
  return { lang, t, setLang }
}

const fallback = makeI18n('zh', () => {})

export const I18nContext = createContext<I18n>(fallback)

export function useI18n(): I18n {
  return useContext(I18nContext)
}

export const LANG_STORAGE_KEY = 'merge-image:lang'
