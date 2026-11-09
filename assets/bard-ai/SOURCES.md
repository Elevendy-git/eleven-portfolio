# Bard AI 素材来源

- 作者提供的原稿：[Bard AI](https://www.figma.com/design/mBp3DgYZ1sL6R9EzcIwIH6/Bard-AI?node-id=799-110)。
- 原稿标题为「Bard AI —— AI工具整合平台」，标注「2024 UI/UX」。卡片项目名称、年份和工作范围均据此填写。
- 通过用户已登录的 Figma 桌面端分别导出 `1.Bard AI` 至 `4.Bard AI` 四个 frame 为 2× PNG，导出日期为 2026-11-07。原始文件每张宽 2560px，未更改原设计内容。
- 原始 PNG 备份位于 `work/bard-ai/frames-2x/`；处理计划位于 `work/portfolio/bard-ai-export-plan.json`，统一处理脚本为 `work/portfolio/sync-project-assets.py`。

## 完整作品集

四张原图按原有顺序整理为四个目录项：

1. 项目概览与设计系统：项目背景、用户画像、设计目标、功能结构、颜色、图标与组件规范。
2. 登录 · 首页与应用详情：账号登录、首页浏览与 AI 应用详情。
3. 搜索 · 发现与内容发布：搜索、发现资讯和发布文章。
4. AI 对话 · 设置与深色模式：AI 对话、设置与深色模式页面。

| 文件 | 尺寸 | 格式 |
| --- | --- | --- |
| `frame-01-2x.png` | 2560 × 16530 | 无损 PNG |
| `frame-02-2x.webp` | 2560 × 13294 | 无损 WebP |
| `frame-03-2x.webp` | 2560 × 11150 | 无损 WebP |
| `frame-04-2x.webp` | 2560 × 11558 | 无损 WebP |

正式图片合计 29,633,103 字节（约 28.26 MiB），不缩放、不使用有损压缩。第一张高度超过 WebP 16383px 限制，因此保留为 PNG。四张正式图片与原始导出逐 RGBA 像素一致，核对结果记录于 `work/bard-ai/frames-2x/verification.json`。作品集图片按章节懒加载。

## 卡片封面与项目图标

- `cover.webp`：裁取 `1.Bard AI.png` 顶部 `[128, 0, 2432, 1440]` 区域，以 16:10 比例保存为 1600 × 1000 WebP（quality 95）。以顶部 16:9 hero 为基础裁去左右空边，形成 16:10 双手机构图，去除下方标题区的渐变条，未重绘画面。
- 桌面和手机卡片均使用相同 16:10 比例，可完整显示封面文件，不需要额外裁切。手机规格的静态核对图为 `work/bard-ai/cover-mobile-check.jpg`，实际浏览器布局由主任务核对。
- `project-mark.webp`：从第一张原稿的 `[140, 1920, 340, 2120]` 区域裁取的早期图标，现已废弃，改用下方作者指定 logo 节点的导出。旧文件仅保留作过程记录。
- 封面与图标是首页缩略素材；完整作品集仍使用上述无损高清原图。

## 作者指定的项目 logo

- 原稿节点：[Bard AI · logo](https://www.figma.com/design/mBp3DgYZ1sL6R9EzcIwIH6/Bard-AI?node-id=801-70)，节点 ID `801:70`。
- 用户已登录的 Figma 桌面端正常导出该节点为 2× PNG，原始文件完整保存于 `work/bard-ai/logo-original-2x.png`。实际导出尺寸为 2391 × 2234，包含浅蓝圆形主体及原有阴影、光晕。
- 正式素材为 `logo.png`，512 × 477，透明 RGBA PNG。原始 alpha 范围为 0–255；只按 alpha 非零边界 `[36, 36, 2354, 2197]` 裁去完全透明的外边距，所有非零 alpha 像素均保留在缩放前的图像内。
- 使用预乘 alpha 的 Lanczos 缩小到最大 512px，再保存 PNG，避免透明边缘出现黑边或白边。浅蓝圆形主体、阴影及光晕均保留，没有抠除或重绘。
- 白底与灰格透明核对图分别为 `work/bard-ai/logo-proof-white.png` 和 `work/bard-ai/logo-proof-checker.png`；`logo-proof.png` 同时展示两种背景及 40/44/48/52px 宽的品牌位预览。
- 元数据与处理记录见 `work/bard-ai/logo-verification.json`。建议在卡片上使用约 48–52px 宽、自动高度，并保留原色与透明背景。
