# Delysium official logo

- File: `delysium-logo-official.svg`
- Official page: https://www.delysium.com/
- Original asset URL: https://www.delysium.com/_nuxt/logo.i_DOnjDp.svg
- Retrieved: 2026-11-07
- Format: original SVG, 108 × 53; `viewBox="0 0 108 53"`.
- Appearance: white emblem and wordmark on a transparent background. Intended for dark backgrounds. A CSS `filter: brightness(0)` can display this monochrome logo on a light background without modifying the original file.
- Original asset preserved unchanged.

The asset was referenced by the official site's header and footer. It is used here to identify the portfolio project.

## 作品集内容与卡片封面

- 作者提供的 Figma 作品集：https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1961-5487
- 原始封面：https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=6371-270
- 通过用户已登录的 Figma 桌面端正常导出 PNG，原稿保存于 work/delysium。没有更改原设计内容。
- 作品集分别选取 `1.Delysium` 至 `7.Delysium` 七个 frame，以 2× PNG 导出。每张宽 2560px，完整保留原 frame 的内容与边界，避免整个 section 的长边限制导致等比缩小。
- 网站素材不缩放、不使用有损压缩。5 张使用无损 WebP，两个高度超过 WebP 16383px 限制的 frame 使用 PNG；像素与原始导出逐张核对一致。正式图片合计约 30.1 MiB，按章节懒加载。
- 七张 PNG 原始导出保存在 `work/delysium/frames-2x/`；`verification.json` 记录尺寸、体积与像素核对结果。旧 section 导出保留作过程记录，网站已改用新素材。
- cover-character.webp、cover-wordmark.webp：从用户原封面裁切，仅用于卡片重新排版。人物及3D模型非作品集作者创作的说明保留于完整作品集首屏。

## Derived emblem assets

- `delysium-mark-white.png`: 143 × 321 PNG with transparency.
- `delysium-mark-black.png`: same silhouette and alpha; monochrome black variant for light backgrounds.
- Derived from the official SVG above by rendering at 10× and cropping only the standalone emblem on the left. No paths were redrawn; the official SVG remains unchanged.
- Raster crop bounds at 10×: x=10…152, y=100…420. At the SVG's original coordinate scale the emblem occupies roughly x=1…15.3, y=10…42.1.
- The full SVG drawing occupies roughly x=1…107, y=10…42.1. Its 108×53 canvas contains a tall emblem plus a horizontally set wordmark, so placing the full logo into a 40px square slot makes the wordmark only about 5px tall. Use the cropped emblem in such slots.
- Recommended rendered emblem size in a 40px brand slot: height 36–40px and automatic width (about 16–18px); the narrow shape is intentional.
