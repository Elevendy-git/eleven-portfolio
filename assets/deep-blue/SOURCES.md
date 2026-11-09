# 深蓝社区素材来源

- 作者提供的原稿：[Portfolio · 深蓝社区](https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=2250-500)。
- 首张原稿右上角明确标注 **2024**，并标注 UI/UX、APP DESIGN。项目卡片及浮窗年份按此填写。
- 原稿封面说明作者负责从 0 到 1 的全部设计、视觉方向、需求沟通与落地，以及组件化和设计规范维护。卡片简介仅概括原稿中展示的兴趣选择、频道交流和动态分享。
- 通过用户已登录的 Figma 桌面端，分别导出 `1.深蓝社区 Cover` 至 `16.End` 的 16 个独立 frame 为 2× PNG，导出日期为 2026-11-07。每张原图均宽 2560px，未更改原设计内容。
- 原始 PNG 备份保存在 `work/deep-blue/frames-2x/`，处理计划为 `work/portfolio/deep-blue-export-plan.json`，统一处理脚本为 `work/portfolio/sync-project-assets.py`。

## 完整作品集

16 张图片按原有顺序整理为六组目录，相关页面连续展示：

1. 项目概览：封面。
2. 研究与机会：行业背景、竞品分析、设计机会点。
3. 架构与原型：产品架构、设计原型。
4. 设计规范与组件：设计规范、UI KIT。
5. 兴趣与频道：Pick 喜好、频道界面、文字房间、频道内搜索。
6. 动态与登录：动态广场、发动态、用户登录、End。

| 正式图片 | 原始 frame | 尺寸 |
| --- | --- | --- |
| `frame-01-2x.webp` | 1.深蓝社区 Cover | 2560 × 1440 |
| `frame-02-2x.webp` | 2.行业背景 | 2560 × 2482 |
| `frame-03-2x.webp` | 3.竞品分析 | 2560 × 2828 |
| `frame-04-2x.webp` | 4.设计机会点 | 2560 × 1878 |
| `frame-05-2x.webp` | 5.产品架构 | 2560 × 2280 |
| `frame-06-2x.webp` | 6.设计原型 | 2560 × 2816 |
| `frame-07-2x.webp` | 7.设计规范 | 2560 × 2982 |
| `frame-08-2x.webp` | 8.UI KIT | 2560 × 4446 |
| `frame-09-2x.webp` | 9.Pick 喜好 | 2560 × 1440 |
| `frame-10-2x.webp` | 10.频道界面 | 2560 × 3242 |
| `frame-11-2x.webp` | 11.文字房间 | 2560 × 3882 |
| `frame-12-2x.webp` | 12.频道内搜索 | 2560 × 5064 |
| `frame-13-2x.webp` | 13.动态广场 | 2560 × 3842 |
| `frame-14-2x.webp` | 14.发动态 | 2560 × 3642 |
| `frame-15-2x.webp` | 15.用户登录 | 2560 × 3042 |
| `frame-16-2x.webp` | 16.End | 2560 × 2376 |

正式作品集图片全部以无损 WebP 保存，原尺寸与透明度不变，总计 10,052,786 字节（约 9.59 MiB）。16 张正式图片均与原始 PNG 逐 RGBA 像素一致，核对结果记录于 `work/deep-blue/frames-2x/verification.json`。完整作品集按页面懒加载。

## 首页卡片封面

- 使用用户新指定的独立封面 frame `1.深蓝社区 Cover`，来源为 [Portfolio 封面选择](https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1268-33)。这是新提供的独立首页封面，与正文中同名的第一张 frame 分开保存。
- 2026-11-09 从用户已登录的 Figma 桌面端重新导出更新后的 16:10 封面：原设计尺寸为 1280 × 800，2× PNG 为 2560 × 1600。原始导出保存于 `work/portfolio/covers-16x10/source/1.深蓝社区 Cover.png`，并归档至 `work/deep-blue/frames-2x/card-cover-user-selected-16x10-2x.png`。
- `cover.webp` 为 1600 × 1000、16:10 比例、quality 95 的首页缩略素材，完整保留独立封面的内容，仅等比例缩小，无裁切、补色或额外 padding。
- `deep-blue-export-plan.json` 的 `cover.frame` 指向独立封面归档，`cover.box` 为完整 `[0, 0, 2560, 1600]` 范围；使用 `--cover-only work/portfolio/deep-blue-export-plan.json` 可以只重建封面和其核对记录，不重新处理 16 张正文图片。
- 完整作品集首图仍使用原正文中未经缩放的无损原图，正文内容和尺寸保持原样。
