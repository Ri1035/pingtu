import type { WatermarkConfig } from '../types'

/**
 * 水印配置与内置模板。
 * 模板只提供「预设参数组合」，点击后用户仍可继续微调每一项。
 */

/** 默认水印：关闭，平铺文字 */
export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  type: 'text',
  mode: 'tile',
  text: '',
  fontFamily: 'sans-serif',
  fontSize: 42,
  color: '#111827',
  opacity: 0.16,
  rotation: -30,
  spacing: 130,
  x: 0.5,
  y: 0.5,
  imageScale: 0.25,
}

export interface WatermarkTemplate {
  /** 模板 id，也是 i18n key suffix */
  id: string
  /** 预设参数（会 patch 到当前配置上） */
  patch: Partial<WatermarkConfig>
}

/**
 * 内置水印模板：
 * - 平铺文字：斜向平铺、低透明度的版权水印
 * - 居中文字：画面正中间的醒目文字
 * - 右下角文字：角落的署名水印
 * - 平铺图片：图片 logo 斜向平铺
 * - 居中图片：画面正中间的图片 logo
 */
export const WATERMARK_TEMPLATES: WatermarkTemplate[] = [
  {
    id: 'textTile',
    patch: { type: 'text', mode: 'tile', rotation: -30, opacity: 0.16, fontSize: 42, spacing: 130, imageScale: 0.12 },
  },
  {
    id: 'textCenter',
    patch: { type: 'text', mode: 'single', rotation: 0, opacity: 0.45, fontSize: 72, x: 0.5, y: 0.5 },
  },
  {
    id: 'textCorner',
    patch: { type: 'text', mode: 'single', rotation: 0, opacity: 0.55, fontSize: 40, x: 0.93, y: 0.94 },
  },
  {
    id: 'imageTile',
    patch: { type: 'image', mode: 'tile', rotation: -25, opacity: 0.25, imageScale: 0.12, spacing: 48 },
  },
  {
    id: 'imageCenter',
    patch: { type: 'image', mode: 'single', rotation: 0, opacity: 0.5, imageScale: 0.25, x: 0.5, y: 0.5 },
  },
]