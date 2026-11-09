# 神州数码作品集素材

- 作者提供的 Figma：https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1875-5823
- 原始文件：Portfolio 内 `1.Digital China`、`2.Digital China`、`3.Digital China` 三个 frame，通过用户已登录的 Figma 桌面端分别以 2× PNG 导出。
- 处理日期：2026-11-07。
- 网站入口按用户要求命名为“神州数码”；原稿首屏标题为“神州控股官网界面优化”，并标注“2023 UIUX”。原稿文字与视觉内容完整保留。

## 阅读顺序

| Frame | 原始像素尺寸 | 目录名称 | 内容 |
| --- | --- | --- | --- |
| 1.Digital China.png | 2560 × 7200 | 项目概览与设计规范 | 项目标题、改版目标、栅格系统、字体与颜色规范、图标设计 |
| 2.Digital China.png | 2560 × 17086 | 官网页面设计 | 导航优化、桌面与移动首页、架构优化、其他页面、商城页 |
| 3.Digital China.png | 2560 × 1440 | AI 内容生成 | 原稿中的六组 AI 内容视觉 |

正式作品集图片不裁切、不缩放，保留 2× 原始尺寸；使用无损 WebP，超过 WebP 16383px 高度限制的第二张使用 PNG。编码后按 RGBA 逐像素核对。原始 PNG 保存于 `work/digital-china/frames-2x/`，核对结果见该目录的 `verification.json`。

## 卡片封面

`cover.webp` 使用用户指定的独立封面 frame `1.神州控股官网`，来源为 [Portfolio 封面选择](https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1268-33)，该 frame 当前节点为 `6378:29`。2026-11-09 从用户已登录的 Figma 桌面端重新导出更新后的 16:10 封面：原设计尺寸为 1280 × 800，2× PNG 为 2560 × 1600。原始导出保存于 `work/portfolio/covers-16x10/source/1.神州控股官网.png`，并归档至 `work/digital-china/frames-2x/card-cover-user-selected-16x10-2x.png`。

首页缩略图保留完整 16:10 画面，仅等比例缩小至 1600 × 1000px，以 quality 95 WebP 保存，无裁切、补色或额外 padding。封面仅用于首页缩略展示；正文三张图保持原有完整内容和尺寸。

处理配置为 `work/portfolio/digital-china-export-plan.json`，素材同步脚本为 `work/portfolio/sync-project-assets.py`。

## 官方品牌 logo

- 官方主体：神州数码集团（Digital China Group），网站入口 `https://www.digitalchina.com/`，股票代码 000034.SZ。
- 实际资源来源：神州数码集团官方招聘站 `https://digitalchina.zhiye.com/`。该页面标题和 `tenantInfo.Alias` 均为“神州数码集团”；`tenantInfo.LogoUrl` 及站点配置的 `Logo` 引用同一图片。
- 官方图片 URL：`https://stcms.beisen.com/image/120146/e325f39030aa4bb9a246f586bf0999ec_o.png`。
- 获取日期：2026-11-07。原图为 1727 × 626px 带透明通道 PNG，保存在 `work/digital-china/official-logo-original.png`，SHA-256 为 `7bca494d9bce10ab7e4c54c24e9d6099def3b278d84ce37bacc0f722004cad5d`。
- `logo.png`：只按透明通道边界 `[19, 33, 1708, 594]` 去除外部空白，1689 × 561px，保留中文、英文与完整图形，无重绘、调色或缩放。
- `logo-mark.png`：从同一官方原图的 `[0, 0, 765, 626]` 取出图形标，再仅去除透明边界，732 × 561px。用于首页较小的品牌图标位；需要完整品牌文字时用 `logo.png`。
- 预览：`work/digital-china/review/official-logo-preview.jpg`。
- 入口品牌遵循用户指定的“神州数码”；原作品集中“神州控股”文字保持原稿。此 logo 来源为神州数码集团，未混用神州控股（DC Holdings）资源。
