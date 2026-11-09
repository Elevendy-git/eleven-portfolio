(() => {
  "use strict";

  const triggerSelector = "[data-experience-open]";
  const isEnglish = document.documentElement.lang.startsWith("en");
  const experiencesZh = {
    microsoft: {
      title: `<span class="microsoft-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
            <span>微软 <span lang="en">Microsoft</span></span>`,
      meta: `<span>产品设计师</span>
            <span>2024.11 — 至今</span>`,
      content: `
        <section class="experience-detail">
          <h3 lang="en">Bing App</h3>
          <p class="experience-detail-subtitle">核心体验与本地化 AI 设计</p>
          <ul>
            <li>围绕首页信息流、搜索建议和控制中心，重构信息层级与关键操作路径，跟进 iOS、Android 双端设计走查与研发验收。</li>
            <li>面向中国市场设计 AI 日报、AI 总结等本地化功能，覆盖 AI 内容呈现、深浅色模式及异常状态。</li>
            <li>参与体育速览卡片及自定义、Rewards 首页与「推荐有奖」功能设计，迭代内容发现、权益展示和活动参与路径。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3 lang="en">Copilot Mac</h3>
          <p class="experience-detail-subtitle">AI 交互与组件库搭建</p>
          <ul>
            <li>从 0 到 1 搭建组件库与交互规范，定义主窗口、Mini Window、对话框和 Toast 等组件及状态，沉淀响应式布局、加载与异常处理规则。</li>
            <li>负责 Settings V2 信息架构、思考过程展示及离线、消息发送失败等体验设计，参与 Deep Research、Cowork 关键场景迭代与实现走查。</li>
            <li>基于 Figma AI 构建高保真交互原型，验证组件复用与设计方案；在 VS Code 中修复 UI 样式与交互细节，独立提交 <strong>30+ 个修复 PR</strong>，并跟进评审与合并。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3 lang="en">Societas</h3>
          <p class="experience-detail-subtitle">任务型 AI Agent</p>
          <ul>
            <li>负责相关功能的需求梳理与交互设计，围绕任务入口、执行过程与结果呈现梳理关键流程。</li>
            <li>结合首次使用反馈和体验走查，识别操作阻塞、状态反馈等问题，与产品、研发协作推进方案迭代、问题跟进与设计验收。</li>
          </ul>
        </section>
      `,
    },
    "digital-china": {
      title: `<span>神州数码</span>`,
      meta: `<span>北京神州数码有限公司</span><span>UI/UX 设计师</span><span>2023.05 — 2024.11</span>`,
      content: `
        <section class="experience-detail">
          <h3>官网与活动体验</h3>
          <p class="experience-detail-subtitle">神州控股官网 · 数云原力大会</p>
          <ul>
            <li>主导神州控股官网与数云原力大会两个大型项目的 UI/UX 设计。</li>
            <li>负责产品流程分析与优化，以及 Web 端和移动端设计。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>数据产品与业务应用</h3>
          <p class="experience-detail-subtitle">数据大屏与中台界面</p>
          <ul>
            <li>承接其它业务的交互与 UI 设计需求，覆盖物流仓储数据大屏的设计与迭代、政企平台数据中台应用界面。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>AIGC 视觉创意</h3>
          <p class="experience-detail-subtitle">宣传内容与品牌展示</p>
          <ul>
            <li>结合 Midjourney、ChatGPT 等 AIGC 工具，完成网页 Banner、活动海报、新媒体推广素材及品牌展示内容的视觉创意。</li>
            <li>根据企业活动和商业需求制定视觉方向，利用 AI 提升创意探索效率，并完成后期视觉优化与交付。</li>
          </ul>
        </section>
      `,
    },
    delysium: {
      title: `<span>魔方尔斯特</span>`,
      meta: `<span>北京魔方尔斯特科技有限公司</span><span>UI/UX 设计师</span><span>2022.05 — 2023.05</span>`,
      content: `
        <section class="experience-detail">
          <h3>产品体验设计</h3>
          <p class="experience-detail-subtitle">Delysium</p>
          <ul>
            <li>主要负责 Delysium 的 UI/UX 设计。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>用户研究与交互</h3>
          <p class="experience-detail-subtitle">市场调查与用户需求</p>
          <ul>
            <li>协助产品经理开展市场调查与用户研究，根据数据挖掘用户痛点，从用户角度构思交互和 UI 方案。</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>研发协作与交付</h3>
          <p class="experience-detail-subtitle">设计文档与落地走查</p>
          <ul>
            <li>累计输出切图、标注、动效说明 <strong>20余份</strong>，以及交互文档、走查报告 <strong>30余份</strong>。</li>
            <li>设计完成后跟进研发落地，对照高保真设计确保视觉一致，完成前端样式测试并跟进设计实现。</li>
          </ul>
        </section>
      `,
    },
  };

  const experiencesEn = {
    microsoft: {
      title: `<span class="microsoft-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
            <span lang="en">Microsoft</span>`,
      meta: `<span>Product Designer</span>
            <span>Nov 2024 — Present</span>`,
      content: `
        <section class="experience-detail">
          <h3 lang="en">Bing App</h3>
          <p class="experience-detail-subtitle">Core experiences and localized AI features</p>
          <ul>
            <li>Restructured the information hierarchy and key user flows across the home feed, search suggestions and Control Center. Conducted design reviews and verified implementation on both iOS and Android.</li>
            <li>Designed localized features for the Chinese market, including AI daily briefings and AI summaries, covering AI content presentation, light and dark modes, and error states.</li>
            <li>Contributed to sports glance cards and customization, the Rewards home page and referral rewards. Iterated on content discovery, benefit presentation and campaign participation flows.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3 lang="en">Copilot Mac</h3>
          <p class="experience-detail-subtitle">AI interactions and component library</p>
          <ul>
            <li>Built a component library and interaction guidelines from the ground up. Defined components and states for the main window, Mini Window, dialogs and toasts, alongside rules for responsive layouts, loading and error handling.</li>
            <li>Designed the Settings V2 information architecture, reasoning process presentation, and offline and message failure experiences. Contributed to key Deep Research and Cowork flows, and reviewed their implementation.</li>
            <li>Built high-fidelity interactive prototypes with Figma AI to validate component reuse and design solutions. Fixed UI styling and interaction details in VS Code, independently submitting <strong>30+ fix PRs</strong> and following them through review and merge.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3 lang="en">Societas</h3>
          <p class="experience-detail-subtitle">Task-oriented AI agent</p>
          <ul>
            <li>Clarified feature requirements and designed interactions across task entry points, execution and results.</li>
            <li>Used first-use feedback and design reviews to identify blocked actions and unclear state feedback. Worked with product and engineering on iterations, issue follow-up and implementation reviews.</li>
          </ul>
        </section>
      `,
    },
    "digital-china": {
      title: `<span lang="en">Digital China</span>`,
      meta: `<span>Digital China, Beijing</span><span>UI/UX Designer</span><span>May 2023 — Nov 2024</span>`,
      content: `
        <section class="experience-detail">
          <h3>Website and event experiences</h3>
          <p class="experience-detail-subtitle">Digital China Holdings website · Shuyun Yuanli Conference</p>
          <ul>
            <li>Led UI/UX design for two major projects: the Digital China Holdings website and the Shuyun Yuanli Conference.</li>
            <li>Analyzed and improved product flows, and designed the web and mobile experiences.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>Data products and business applications</h3>
          <p class="experience-detail-subtitle">Data dashboards and platform interfaces</p>
          <ul>
            <li>Handled interaction and UI design requests across other business areas, including logistics and warehouse data dashboards, as well as data platform interfaces for government and enterprise applications.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>AI-assisted visual design</h3>
          <p class="experience-detail-subtitle">Promotional content and brand presentation</p>
          <ul>
            <li>Used tools such as Midjourney and ChatGPT to create visual concepts for web banners, event posters, social media campaigns and brand presentations.</li>
            <li>Set visual directions based on event and business needs, used AI to accelerate creative exploration, and refined and delivered the final visuals.</li>
          </ul>
        </section>
      `,
    },
    delysium: {
      title: `<span lang="en">Mofang First</span>`,
      meta: `<span>Mofang First, Beijing</span><span>UI/UX Designer</span><span>May 2022 — May 2023</span>`,
      content: `
        <section class="experience-detail">
          <h3>Product experience design</h3>
          <p class="experience-detail-subtitle">Delysium</p>
          <ul>
            <li>Primarily responsible for Delysium's UI/UX design.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>User research and interaction design</h3>
          <p class="experience-detail-subtitle">Market research and user needs</p>
          <ul>
            <li>Supported the product manager with market and user research. Used data to identify user pain points and develop interaction and UI solutions from the user's perspective.</li>
          </ul>
        </section>
        <section class="experience-detail">
          <h3>Engineering collaboration and delivery</h3>
          <p class="experience-detail-subtitle">Design documentation and implementation reviews</p>
          <ul>
            <li>Delivered <strong>20+ sets</strong> of assets, annotations and motion specifications, along with <strong>30+ interaction documents and design review reports</strong>.</li>
            <li>Followed designs through development, checked visual consistency against high-fidelity designs, tested front-end styling and reviewed the implementation.</li>
          </ul>
        </section>
      `,
    },
  };
  const experiences = isEnglish ? experiencesEn : experiencesZh;
  const closeLabel = isEnglish ? "Close work experience details" : "关闭工作经历详情";

  const root = document.documentElement;
  let dialog = null;
  let returnFocus = null;
  let returnActivation = null;
  let savedScroll = null;
  let backdropPointerId = null;
  let backdropClickReady = false;
  let modalCursor = null;

  function liftCursor() {
    const cursor = document.querySelector(".cursor-fx");
    if (
      !root.classList.contains("has-cursor-fx") ||
      !cursor ||
      typeof cursor.showPopover !== "function"
    ) return;

    cursor.setAttribute("popover", "manual");
    try {
      cursor.showPopover();
      modalCursor = cursor;
      root.classList.add("experience-dialog-cursor-active");
    } catch {
      cursor.removeAttribute("popover");
    }
  }

  function restoreCursor() {
    root.classList.remove("experience-dialog-cursor-active");
    if (!modalCursor) return;
    if (modalCursor.matches(":popover-open")) modalCursor.hidePopover();
    modalCursor.removeAttribute("popover");
    modalCursor = null;
  }

  function isOutsideDialog(event) {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  }

  function restorePage() {
    // A close event is queued; a newly reopened dialog owns the return focus.
    if (dialog?.open) return;
    restoreCursor();
    root.classList.remove("experience-dialog-open");
    backdropPointerId = null;
    backdropClickReady = false;

    const trigger = returnFocus;
    const activation = returnActivation;
    const position = savedScroll;
    returnFocus = null;
    returnActivation = null;
    savedScroll = null;

    if (window.portfolioCardInteractions) {
      window.portfolioCardInteractions.restoreFocus(trigger, activation);
    } else if (trigger && trigger.isConnected) {
      trigger.focus({ preventScroll: true });
    }
    if (position) {
      window.scrollTo({
        left: position.x,
        top: position.y,
        behavior: "instant",
      });
    }
  }

  function createDialog() {
    const element = document.createElement("dialog");
    element.id = "experience-dialog";
    element.className = "experience-dialog";
    element.setAttribute("aria-labelledby", "experience-dialog-title");
    element.setAttribute("aria-describedby", "experience-dialog-meta");
    element.innerHTML = `
      <header class="experience-dialog-header">
        <div class="experience-dialog-heading">
          <h2 class="experience-dialog-title" id="experience-dialog-title"></h2>
          <div class="experience-dialog-meta" id="experience-dialog-meta"></div>
        </div>
        <button class="experience-dialog-close" type="button" aria-label="${closeLabel}" autofocus><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M6 6 18 18 M18 6 6 18"/></svg></button>
      </header>
      <div class="experience-dialog-content" tabindex="0"></div>
    `;

    element.addEventListener("close", restorePage);
    element.addEventListener("cancel", (event) => {
      event.preventDefault();
      element.close();
    });
    element
      .querySelector(".experience-dialog-close")
      .addEventListener("click", () => element.close());

    element.addEventListener("pointerdown", (event) => {
      backdropClickReady = false;
      backdropPointerId =
        event.button === 0 &&
        event.target === element &&
        isOutsideDialog(event)
          ? event.pointerId
          : null;
    });
    element.addEventListener("pointerup", (event) => {
      backdropClickReady =
        backdropPointerId === event.pointerId &&
        event.target === element &&
        isOutsideDialog(event);
      backdropPointerId = null;
    });
    element.addEventListener("pointercancel", () => {
      backdropPointerId = null;
      backdropClickReady = false;
    });
    element.addEventListener("click", (event) => {
      const shouldClose =
        backdropClickReady &&
        event.target === element &&
        isOutsideDialog(event);
      backdropClickReady = false;
      if (shouldClose) element.close();
    });

    document.body.append(element);
    return element;
  }

  function configureDialog(key) {
    const experience = experiences[key];
    dialog.id = "experience-dialog-" + key;
    dialog.dataset.experience = key;
    dialog.querySelector("#experience-dialog-title").innerHTML = experience.title;
    dialog.querySelector("#experience-dialog-meta").innerHTML = experience.meta;
    dialog.querySelector(".experience-dialog-content").innerHTML = experience.content;
  }

  document.addEventListener("click", (event) => {
    const trigger =
      event.target instanceof Element
        ? event.target.closest(triggerSelector)
        : null;
    if (
      !trigger ||
      trigger.matches(":disabled") ||
      !Object.prototype.hasOwnProperty.call(experiences, trigger.dataset.experienceOpen)
    ) return;

    event.preventDefault();
    if (!dialog) dialog = createDialog();
    if (dialog.open) return;
    configureDialog(trigger.dataset.experienceOpen);

    returnFocus = trigger;
    returnActivation = window.portfolioCardInteractions?.suspend(trigger, event);
    savedScroll = { x: window.scrollX, y: window.scrollY };
    root.classList.add("experience-dialog-open");
    try {
      dialog.showModal();
      liftCursor();
      dialog.querySelector(".experience-dialog-content").scrollTop = 0;
    } catch (error) {
      restorePage();
      throw error;
    }
  });
})();
