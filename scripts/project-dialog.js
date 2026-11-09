(() => {
  "use strict";

  const isEnglish = document.documentElement.lang.startsWith("en");
  const ui = isEnglish ? {
    close: "Close portfolio",
    contents: "Contents",
    chooseSection: "Choose a portfolio chapter",
    directory: "Portfolio contents",
    content: "Portfolio content",
    loading: "Opening portfolio…",
    loadFailed: "The portfolio could not be loaded.",
    imageFailed: "This page could not be loaded.",
    retry: "Reload",
    viewFigma: "View in Figma",
    manifestFailed: "Could not load the portfolio contents",
    emptySections: "The portfolio contents are empty",
    invalidSections: "Invalid portfolio contents",
    emptyPages: "The portfolio has no pages",
    invalidImages: "Invalid portfolio image data",
    portfolio: (title) => title + " portfolio",
    closePortfolio: (title) => "Close " + title + " portfolio",
    projectDirectory: (title) => title + " portfolio contents",
    projectContent: (title) => title + " portfolio content",
    page: (number) => ` · Page ${number}`,
  } : {
    close: "关闭作品集",
    contents: "目录",
    chooseSection: "选择作品集章节",
    directory: "作品集目录",
    content: "作品集内容",
    loading: "正在打开作品集…",
    loadFailed: "作品集暂时没有加载出来。",
    imageFailed: "这一页暂时没有加载出来。",
    retry: "重新加载",
    viewFigma: "在 Figma 中查看",
    manifestFailed: "作品集目录加载失败",
    emptySections: "作品集目录为空",
    invalidSections: "作品集目录格式错误",
    emptyPages: "作品集页面为空",
    invalidImages: "作品集图片格式错误",
    portfolio: (title) => title + " 作品集",
    closePortfolio: (title) => "关闭 " + title + " 作品集",
    projectDirectory: (title) => title + " 作品集目录",
    projectContent: (title) => title + " 作品集内容",
    page: (number) => ` · 第 ${number} 页`,
  };
  // Only the surrounding reader is translated; exported portfolio images
  // and their manifest paths remain shared by both language versions.
  const englishChapters = {
    delysium: {
      overview: "Project Overview",
      "sso-process": "Account Login · Research & Flows",
      "sso-design": "Account Login · UI Design",
      dma: "DMA · Website Design",
      marketplace: "Marketplace · Asset Management",
      "design-system": "404 & Design System",
    },
    "digital-china": {
      "overview-and-system": "Project Overview & Design Guidelines",
      "website-design": "Website Design",
      "ai-content": "AI Content Generation",
    },
    "deep-blue": {
      overview: "Project Overview",
      research: "Research & Opportunities",
      architecture: "Information Architecture & Prototypes",
      "design-system": "Design Guidelines & Components",
      channels: "Interests & Channels",
      social: "Social Feed & Login",
    },
    "bard-ai": {
      overview: "Project Overview & Design System",
      "core-experience": "Login · Home & App Details",
      "discovery-content": "Search · Discover & Publishing",
      "chat-settings": "AI Chat · Settings & Dark Mode",
    },
  };

  function sectionTitle(config, section) {
    return isEnglish ? englishChapters[config.id]?.[section.id] || section.title : section.title;
  }

  const projects = {
    delysium: {
      id: "delysium",
      title: "Delysium",
      period: "2022 — 2023",
      figmaUrl: "https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1961-5487",
    },
    "digital-china": {
      id: "digital-china",
      title: isEnglish ? "Digital China" : "神州数码",
      figmaUrl: "https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=1875-5823",
    },
    "deep-blue": {
      id: "deep-blue",
      title: isEnglish ? "Deep Blue Community" : "深蓝社区",
      figmaUrl: "https://www.figma.com/design/8HdZmBq2w1oBD00XlrxQVk/Portfolio?node-id=2250-500",
    },
    "bard-ai": {
      id: "bard-ai",
      title: "Bard AI",
      figmaUrl: "https://www.figma.com/design/mBp3DgYZ1sL6R9EzcIwIH6/Bard-AI?node-id=799-110",
    },
  };
  const manifestCache = new Map();
  const manifestRequests = new Map();
  const triggerSelector = "[data-project-open]";
  let dialog;
  let viewer;
  let directory;
  let mobileDirectory;
  let project;
  let manifest;
  let controller;
  let loadingToken = 0;

  function setActiveSection(id) {
    const section = manifest?.sections.find((item) => item.id === id);
    if (!section) return;
    directory.querySelectorAll("[data-project-section]").forEach((button) => {
      const active = button.dataset.projectSection === id;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    });
    mobileDirectory.value = id;
  }

  function updateActiveFromScroll() {
    if (!manifest || viewer.getAttribute("aria-busy") === "true") return;
    const sections = viewer.querySelectorAll(".project-portfolio-section");
    let active = sections[0];
    // Allow for fractional image heights at the exact chapter boundary.
    for (const section of sections) {
      if (section.offsetTop <= viewer.scrollTop + 2) active = section;
      else break;
    }
    // A short final chapter cannot always align with the top of the viewer.
    if (viewer.scrollTop > 0 && viewer.scrollTop + viewer.clientHeight >= viewer.scrollHeight - 2) {
      active = sections[sections.length - 1];
    }
    if (active) setActiveSection(active.dataset.sectionId);
  }

  function goToSection(id) {
    const target = viewer.querySelector("#project-section-" + id);
    if (!target) return;
    viewer.scrollTo({
      top: target.offsetTop,
      left: viewer.scrollLeft,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(target.offsetTop - viewer.scrollTop) > viewer.clientHeight * 2 ? "instant" : "smooth",
    });
    setActiveSection(id);
  }

  function createDialog() {
    const element = document.createElement("dialog");
    element.id = "project-dialog";
    element.className = "project-dialog";
    element.innerHTML = `
      <button class="project-dialog-close" data-dialog-close type="button" aria-label="${ui.close}" autofocus>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6 18 18 M18 6 6 18"/></svg>
      </button>
      <div class="project-dialog-mobile-nav" hidden>
        <label for="project-dialog-section-select">${ui.contents}</label>
        <select id="project-dialog-section-select" aria-label="${ui.chooseSection}"></select>
      </div>
      <div class="project-dialog-body">
        <aside class="project-dialog-sidebar">
          <div class="project-dialog-heading">
            <h2 id="project-dialog-title"></h2>
            <p hidden></p>
          </div>
          <nav class="project-dialog-directory" aria-label="${ui.directory}"></nav>
        </aside>
        <div class="project-dialog-viewer" tabindex="0" aria-label="${ui.content}"></div>
      </div>
    `;
    document.body.append(element);
    dialog = element;
    viewer = element.querySelector(".project-dialog-viewer");
    directory = element.querySelector(".project-dialog-directory");
    mobileDirectory = element.querySelector("#project-dialog-section-select");
    controller = window.createDialogController(element, {
      className: "project-dialog",
      onClose() {
        ++loadingToken;
        manifest = null;
      },
    });
    directory.addEventListener("click", (event) => {
      const target = event.target.closest("[data-project-section]");
      if (target) goToSection(target.dataset.projectSection);
    });
    mobileDirectory.addEventListener("change", () => goToSection(mobileDirectory.value));
    viewer.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    return element;
  }

  function configureDialog(config, period = config.period || "") {
    dialog.dataset.projectId = config.id;
    dialog.setAttribute("aria-label", ui.portfolio(config.title));
    dialog.querySelector("#project-dialog-title").textContent = config.title;
    const dates = dialog.querySelector(".project-dialog-heading p");
    dates.textContent = period;
    dates.hidden = !period;
    dialog.querySelector(".project-dialog-close").setAttribute("aria-label", ui.closePortfolio(config.title));
    directory.setAttribute("aria-label", ui.projectDirectory(config.title));
    mobileDirectory.setAttribute("aria-label", ui.chooseSection);
    viewer.setAttribute("aria-label", ui.projectContent(config.title));
  }

  async function getManifest(config) {
    if (manifestCache.has(config.id)) return manifestCache.get(config.id);
    if (!manifestRequests.has(config.id)) {
      const request = fetch(`/assets/${config.id}/portfolio-manifest.json`)
        .then((response) => {
          if (!response.ok) throw new Error(ui.manifestFailed);
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data.sections) || !data.sections.length) throw new Error(ui.emptySections);
          const ids = new Set();
          for (const section of data.sections) {
            if (!section || typeof section.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(section.id) || ids.has(section.id) || typeof section.title !== "string") throw new Error(ui.invalidSections);
            const images = section.pages === undefined ? [section] : section.pages;
            if (!Array.isArray(images) || !images.length) throw new Error(ui.emptyPages);
            for (const image of images) {
              const validPath = image && typeof image.src === "string" && image.src.startsWith(`/assets/${config.id}/`) && !image.src.includes("..");
              if (!validPath || !(image.width > 0) || !(image.height > 0)) throw new Error(ui.invalidImages);
            }
            ids.add(section.id);
          }
          manifestCache.set(config.id, data);
          return data;
        })
        .finally(() => { manifestRequests.delete(config.id); });
      manifestRequests.set(config.id, request);
    }
    return manifestRequests.get(config.id);
  }

  function imageFailed(section, image) {
    section.classList.add("has-image-error");
    let error = section.querySelector(".project-image-error");
    if (!error) {
      error = document.createElement("div");
      error.className = "project-image-error";
      const message = document.createElement("p");
      message.textContent = ui.imageFailed;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = ui.retry;
      retry.addEventListener("click", () => {
        error.remove();
        section.classList.remove("has-image-error");
        const src = image.getAttribute("src");
        image.removeAttribute("src");
        image.src = src;
      });
      error.append(message, retry);
      section.append(error);
    }
  }

  function renderPortfolio(data, config) {
    manifest = data;
    configureDialog(config, typeof data.period === "string" ? data.period.trim() : config.period || "");
    directory.replaceChildren();
    mobileDirectory.replaceChildren();
    const pages = document.createElement("div");
    pages.className = "project-portfolio-pages";
    data.sections.forEach((item, index) => {
      const chapterTitle = sectionTitle(config, item);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.projectSection = item.id;
      const number = document.createElement("span");
      number.className = "project-section-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const title = document.createElement("span");
      title.textContent = chapterTitle;
      button.append(number, title);
      directory.append(button);
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${String(index + 1).padStart(2, "0")} · ${chapterTitle}`;
      mobileDirectory.append(option);
      const section = document.createElement("section");
      section.className = "project-portfolio-section";
      section.id = "project-section-" + item.id;
      section.dataset.sectionId = item.id;
      section.setAttribute("aria-label", chapterTitle);
      const images = item.pages || [item];
      images.forEach((imageData, pageIndex) => {
        const page = document.createElement("div");
        page.className = "project-portfolio-page";
        const image = document.createElement("img");
        image.alt = chapterTitle + (images.length > 1 ? ui.page(pageIndex + 1) : "") + " · " + ui.portfolio(config.title);
        image.width = Number(imageData.width);
        image.height = Number(imageData.height);
        image.loading = index === 0 && pageIndex === 0 ? "eager" : "lazy";
        image.decoding = "async";
        image.addEventListener("load", () => {
          page.classList.add("is-loaded");
          page.classList.remove("has-image-error");
          page.querySelector(".project-image-error")?.remove();
          if (section.querySelectorAll(".project-portfolio-page.is-loaded").length === images.length) section.classList.add("is-loaded");
        });
        image.addEventListener("error", () => imageFailed(page, image));
        image.src = imageData.src;
        page.append(image);
        section.append(page);
      });
      pages.append(section);
    });
    viewer.replaceChildren(pages);
    dialog.querySelector(".project-dialog-mobile-nav").hidden = false;
    viewer.setAttribute("aria-busy", "false");
    viewer.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setActiveSection(data.sections[0].id);

  }

  async function loadPortfolio() {
    const requestedProject = project;
    const token = ++loadingToken;
    manifest = null;
    directory.replaceChildren();
    mobileDirectory.replaceChildren();
    dialog.querySelector(".project-dialog-mobile-nav").hidden = true;
    viewer.setAttribute("aria-busy", "true");
    viewer.scrollTo({ top: 0, left: 0, behavior: "instant" });
    viewer.innerHTML = `<div class="project-dialog-state" role="status"><span class="project-dialog-spinner" aria-hidden="true"></span><p>${ui.loading}</p></div>`;
    try {
      const data = await getManifest(requestedProject);
      if (token === loadingToken && dialog.open && project === requestedProject) renderPortfolio(data, requestedProject);
    } catch {
      if (token !== loadingToken || !dialog.open || project !== requestedProject) return;
      viewer.setAttribute("aria-busy", "false");
      viewer.innerHTML = `<div class="project-dialog-state" role="status"><p>${ui.loadFailed}</p><button type="button" class="project-dialog-retry">${ui.retry}</button><a href="${requestedProject.figmaUrl}" target="_blank" rel="noopener noreferrer">${ui.viewFigma} <span aria-hidden="true">↗</span></a></div>`;
      viewer.querySelector(".project-dialog-retry").addEventListener("click", loadPortfolio);
    }
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest(triggerSelector) : null;
    if (!trigger || trigger.matches(":disabled")) return;
    if (!Object.hasOwn(projects, trigger.dataset.projectOpen)) return;
    const config = projects[trigger.dataset.projectOpen];
    event.preventDefault();
    event.stopPropagation();
    if (!dialog) createDialog();
    if (dialog.open) return;
    project = config;
    configureDialog(config);
    controller.open(trigger, event, loadPortfolio);
  }, true);
})();
