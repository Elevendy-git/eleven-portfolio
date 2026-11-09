# Eleven 作品集网站

入口为 `index.html`，浏览器标题为 `Eleven.doc`。首页保留人物眼睛跟随鼠标、猫咪转向、首屏加载和滚动动效。内容分为“项目”“Vibecoding”“关于我”。

在此目录启动静态服务器：

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

然后打开 http://127.0.0.1:5173/ 。无需安装依赖。

GitHub 仓库为 `Elevendy-git/eleven-portfolio`。仓库包含可直接运行的中英文网站、正式素材和维护脚本；`work/` 中的原始导出与过程截图保留在本地，由 `.gitignore` 排除。重新处理 Figma 素材时，需准备原始导出，并在 Python 环境中安装 Pillow；日常预览和双语页面生成仅需 Python 标准库。

文件说明：

- `index.html`：首页结构、内容及匹配的客户端加载数据。
- `personal-overrides.css`：个人化样式与响应式布局。
- `en/index.html`：本站英文页，与中文版共用素材、样式和动效。
- `i18n/en.json`：英文首页文案和客户端翻译词典。
- `i18n.css`：英文标题、首屏和手机导航的排版适配。
- `work/i18n/build-site.py`：从中文首页和英文词典生成匹配的英文 HTML 与客户端初始化数据。
- `mirror-runtime.js`：站内语言切换、语言偏好和阅读位置恢复、签名位置对齐、页脚年份同步，以及卡片鼠标悬停与键盘焦点状态。
- `card-interaction.css`：最后加载的卡片交互样式，关闭浮窗后清除鼠标触发的悬停效果，保留键盘焦点提示。
- `hero-cat-runtime.js`：猫咪跟随鼠标与触摸交互。
- `experience-dialog.js`、`experience-dialog.css`：工作经历卡片及详情浮窗。
- `delysium-card.css`：首张 Delysium 项目卡的封面与品牌位适配。
- `portfolio-cards.css`：项目封面、品牌位及响应式适配；项目和 Vibecoding 卡片的编号位于文字侧，奇数右对齐、偶数左对齐。
- `project-dialog.js`、`project-dialog.css`：四个项目共用的作品集阅读浮层，按卡片加载对应内容，含目录、关闭后的焦点和滚动位置恢复。
- `assets/`：当前网站素材；人物当前姿势的源图也保留在 `assets/hero/`。
- `assets/delysium/`：官方 logo、封面裁切素材和完整作品集 7 个原始 frame，组织为 6 个章节；`SOURCES.md` 记录来源，`portfolio-manifest.json` 控制阅读顺序与目录。
- `assets/digital-china/`、`assets/deep-blue/`、`assets/bard-ai/`：神州数码、深蓝社区和 Bard AI 的封面与作品集素材，分别来自 3、16、4 个原始 frame；各自的 `portfolio-manifest.json` 控制图片顺序与章节分组。
- `assets/vibecoding/`：Vibecoding 项目的封面占位素材。
- `_next/static/`：网站运行所需的共享脚本和样式，不可单独删除。

网站基于 Oil 公开首页的本地还原继续修改。项目区依次展示 Delysium、神州数码、深蓝社区和 Bard AI 四张卡，已删除多余项目卡片。整卡点击打开对应的近全屏作品集阅读浮层。Vibecoding 已替换为 3 张项目占位卡片，待补充实际作品。中文地址为 `/`，英文地址为 `/en/`；中 / EN 按钮在本站切换，保留当前栏目和阅读位置，并记住语言偏好。浏览器后退、前进仍遵循页面历史。

修改首页中文内容、`i18n/en.json` 或共享脚本/样式后，运行 `python3 work/i18n/build-site.py` 同步英文页和资源缓存版本。脚本检查未翻译的中文，并同步静态 HTML、国际化词典、语言路由与 Next Flight 数据，保证刷新和客户端初始化使用同一份内容。作品集浮窗目录及状态文案在 `project-dialog.js` 中维护，工作经历详情的双语内容在 `experience-dialog.js` 中维护。两种语言使用相同的 Figma 导出图片。

四个作品集均使用从作者 Figma 原稿逐 frame 导出的高清图片，保留原有排版，相关页面归入同一章节。Delysium 的 7 个 frame 组织为 6 章，NFT 交互与页面内容并入第五章「Marketplace · 资产管理」。四个项目使用同样的侧栏浮窗：桌面不设横向 header，项目名和目录集中在左侧，图片占满可用高度；年份在项目数据提供时显示。手机仅保留一行下拉目录和关闭按钮，浮窗不显示设计角色副标题和章节总计。

作品集是本地内容版本，Figma 更新后需重新导出同步。原始导出和视觉验证记录保存在 `work/` 对应项目目录，Delysium 的既有记录在 `work/delysium/`。

页脚显示“© 当前年份 Eleven”，年份随设备实际年份更新；本地运行时会在页面加载、返回页面及页脚重新渲染时同步文案。
