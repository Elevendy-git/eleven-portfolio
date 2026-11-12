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
    videoFailed: "This video could not be loaded.",
    retry: "Reload",
    viewFigma: "View in Figma",
    manifestFailed: "Could not load the portfolio contents",
    emptySections: "The portfolio contents are empty",
    invalidSections: "Invalid portfolio contents",
    emptyPages: "The portfolio has no pages",
    invalidMedia: "Invalid portfolio media data",
    placeholder: "Content coming soon",
    videoPlaceholder: "Video coming soon",
    pauseVideos: "Pause all videos",
    playVideos: "Play all videos",
    portfolio: (title) => title + " portfolio",
    closePortfolio: (title) => "Close " + title + " portfolio",
    projectDirectory: (title) => title + " portfolio contents",
    projectContent: (title) => title + " portfolio content",
    page: (number) => ` · Page ${number}`,
    video: (title) => title + " prototype demo",
  } : {
    close: "关闭作品集",
    contents: "目录",
    chooseSection: "选择作品集章节",
    directory: "作品集目录",
    content: "作品集内容",
    loading: "正在打开作品集…",
    loadFailed: "作品集暂时没有加载出来。",
    imageFailed: "这一页暂时没有加载出来。",
    videoFailed: "这段视频暂时没有加载出来。",
    retry: "重新加载",
    viewFigma: "在 Figma 中查看",
    manifestFailed: "作品集目录加载失败",
    emptySections: "作品集目录为空",
    invalidSections: "作品集目录格式错误",
    emptyPages: "作品集页面为空",
    invalidMedia: "作品集媒体格式错误",
    placeholder: "内容待补充",
    videoPlaceholder: "视频待补充",
    pauseVideos: "暂停全部视频",
    playVideos: "播放全部视频",
    portfolio: (title) => title + " 作品集",
    closePortfolio: (title) => "关闭 " + title + " 作品集",
    projectDirectory: (title) => title + " 作品集目录",
    projectContent: (title) => title + " 作品集内容",
    page: (number) => ` · 第 ${number} 页`,
    video: (title) => title + " 交互演示",
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
    "bing-app": {
      id: "bing-app",
      title: "Bing App",
      singleSection: true,
    },
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
  let videoObserver;
  const videoRows = new Map();
  let loadingToken = 0;

  function stopPortfolioVideos() {
    videoObserver?.disconnect();
    videoRows.forEach((row) => row.setActive(false));
    videoRows.clear();
    viewer.querySelectorAll("video").forEach((video) => {
      video.autoplay = false;
      video.pause();
    });
  }

  function observePortfolioVideos() {
    const videos = Array.from(viewer.querySelectorAll("video")).filter((video) => !video.closest(".project-video-row"));
    if (!videos.length) return;
    videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(({ target: video, isIntersecting, intersectionRatio }) => {
        if (dialog.open && viewer.contains(video) && isIntersecting && intersectionRatio >= .5) {
          video.autoplay = true;
          video.play().catch(() => {});
        } else {
          video.autoplay = false;
          video.pause();
        }
      });
    }, { root: viewer, threshold: [0, .5] });
    videos.forEach((video) => videoObserver.observe(video));
  }

  function setActiveSection(id, restartVideos = false) {
    const section = manifest?.sections.find((item) => item.id === id);
    if (!section) return;
    if (project.singleSection) {
      viewer.querySelectorAll(".project-portfolio-section").forEach((panel) => {
        panel.hidden = panel.dataset.sectionId !== id;
      });
    }
    directory.querySelectorAll("[data-project-section]").forEach((button) => {
      const active = button.dataset.projectSection === id;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    });
    mobileDirectory.value = id;
    videoRows.forEach((row, sectionId) => row.setActive(sectionId === id, restartVideos && sectionId === id));
  }

  function updateActiveFromScroll() {
    if (!manifest || project.singleSection || viewer.getAttribute("aria-busy") === "true") return;
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
    if (project.singleSection) {
      setActiveSection(id, true);
      viewer.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    viewer.scrollTo({
      top: target.offsetTop,
      left: viewer.scrollLeft,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(target.offsetTop - viewer.scrollTop) > viewer.clientHeight * 2 ? "instant" : "smooth",
    });
    setActiveSection(id, true);
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
        stopPortfolioVideos();
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
      const request = fetch(`/assets/${config.id}/portfolio-manifest.json`, { cache: "no-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(ui.manifestFailed);
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data.sections) || !data.sections.length) throw new Error(ui.emptySections);
          const groups = new Set();
          if (data.groups !== undefined) {
            if (!Array.isArray(data.groups) || !data.groups.length) throw new Error(ui.invalidSections);
            for (const group of data.groups) {
              if (!group || typeof group.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(group.id) || groups.has(group.id) || typeof group.title !== "string" || !group.title.trim()) throw new Error(ui.invalidSections);
              groups.add(group.id);
            }
          }
          const ids = new Set();
          for (const section of data.sections) {
            if (!section || typeof section.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(section.id) || ids.has(section.id) || typeof section.title !== "string") throw new Error(ui.invalidSections);
            if (data.groups !== undefined ? !groups.has(section.group) : section.group !== undefined) throw new Error(ui.invalidSections);
            ids.add(section.id);
            if (section.layout !== undefined && section.layout !== "media-row") throw new Error(ui.invalidSections);
            if (section.placeholder === true) continue;
            const media = section.pages === undefined ? [section] : section.pages;
            if (!Array.isArray(media) || !media.length) throw new Error(ui.emptyPages);
            const validPath = (path) => typeof path === "string" && path.startsWith(`/assets/${config.id}/`) && !path.includes("..");
            for (const item of media) {
              if (!item || !Number.isInteger(item.width) || item.width < 1 || !Number.isInteger(item.height) || item.height < 1) throw new Error(ui.invalidMedia);
              if (section.layout === "media-row" && (!["video", "placeholder"].includes(item.type) || item.width !== media[0].width || item.height !== media[0].height)) throw new Error(ui.invalidMedia);
              if (item.type === "placeholder" && section.layout === "media-row") continue;
              if (!validPath(item.src) || (item.type !== undefined && !["image", "video"].includes(item.type))) throw new Error(ui.invalidMedia);
              if (item.type === "video" && !validPath(item.poster)) throw new Error(ui.invalidMedia);
            }
          }
          manifestCache.set(config.id, data);
          return data;
        })
        .finally(() => { manifestRequests.delete(config.id); });
      manifestRequests.set(config.id, request);
    }
    return manifestRequests.get(config.id);
  }

  function mediaFailed(page, media, message = ui.imageFailed) {
    page.classList.add("has-media-error");
    let error = page.querySelector(".project-media-error");
    if (!error) {
      error = document.createElement("div");
      error.className = "project-media-error";
      error.setAttribute("role", "status");
      const description = document.createElement("p");
      description.textContent = message;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = ui.retry;
      retry.addEventListener("click", () => {
        error.remove();
        page.classList.remove("has-media-error");
        if (media instanceof HTMLVideoElement) {
          media.load();
          const row = videoRows.get(media.closest(".project-portfolio-section")?.dataset.sectionId);
          if (row) row.sync();
          else media.play().catch(() => {});
        } else {
          const src = media.getAttribute("src");
          media.removeAttribute("src");
          media.src = src;
        }
      });
      error.append(description, retry);
      page.append(error);
    }
  }

  function createVideoHeading(title) {
    const heading = document.createElement("div");
    heading.className = "project-video-heading";
    const text = document.createElement("h3");
    text.textContent = title;
    heading.append(text);
    return heading;
  }

  function createPortfolioVideo(data, page, title) {
    const video = document.createElement("video");
    video.className = "project-portfolio-video";
    video.width = data.width;
    video.height = data.height;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.tabIndex = -1;
    video.preload = "none";
    video.poster = data.poster;
    video.setAttribute("aria-label", ui.video(title));
    video.addEventListener("loadeddata", () => {
      page.classList.add("is-loaded");
      page.classList.remove("has-media-error");
      page.querySelector(".project-media-error")?.remove();
    });
    video.addEventListener("error", () => mediaFailed(page, video, ui.videoFailed));
    video.src = data.src;
    return video;
  }

  function createVideoGroup(videos, title) {
    let active = false;
    let userPaused = false;
    let playBlocked = false;
    let playRequest = 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-video-toggle";
    const update = () => {
      const paused = userPaused || playBlocked;
      const label = `${paused ? ui.playVideos : ui.pauseVideos} · ${title}`;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = paused
        ? '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5a.5.5 0 0 1 .75-.43l9 5.5a.5.5 0 0 1 0 .86l-9 5.5a.5.5 0 0 1-.75-.43z"/></svg>'
        : '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3" height="12" rx=".6"/><rect x="10" y="2" width="3" height="12" rx=".6"/></svg>';
    };
    const sync = () => {
      const request = ++playRequest;
      const shouldPlay = dialog.open && active && !userPaused;
      playBlocked = false;
      update();
      const requests = videos.map((video) => {
        video.autoplay = shouldPlay;
        if (shouldPlay) return video.play();
        video.pause();
      });
      if (shouldPlay) Promise.allSettled(requests).then((results) => {
        if (request !== playRequest || !dialog.open || !active || userPaused) return;
        if (results.every((result) => result.status === "rejected")) {
          playBlocked = true;
          update();
        }
      });
    };
    button.addEventListener("click", () => {
      userPaused = playBlocked ? false : !userPaused;
      sync();
    });
    update();
    return {
      button,
      sync,
      setActive(nextActive, restart = false) {
        if (active === nextActive && !restart) return;
        if (nextActive) userPaused = false;
        active = nextActive;
        update();
        sync();
      },
    };
  }

  function createVideoRow(media, title, sectionId) {
    const stage = document.createElement("div");
    stage.className = "project-video-stage project-video-row";
    stage.append(createVideoHeading(title));
    const content = document.createElement("div");
    content.className = "project-video-content";
    const gallery = document.createElement("div");
    gallery.className = "project-video-gallery";
    gallery.tabIndex = 0;
    gallery.setAttribute("role", "group");
    gallery.setAttribute("aria-label", ui.video(title));
    const grid = document.createElement("div");
    grid.className = "project-video-grid";
    grid.style.setProperty("--project-video-columns", media.length);
    grid.style.setProperty("--project-video-ratio", media[0].width / media[0].height);
    const videos = [];
    media.forEach((data, index) => {
      const slot = document.createElement("div");
      slot.className = "project-portfolio-page project-video-slot";
      if (data.type === "placeholder") {
        slot.classList.add("is-loaded");
        const placeholder = document.createElement("div");
        placeholder.className = "project-video-placeholder";
        placeholder.textContent = ui.videoPlaceholder;
        slot.append(placeholder);
      } else {
        const video = createPortfolioVideo(data, slot, `${title} ${index + 1}`);
        videos.push(video);
        slot.append(video);
      }
      grid.append(slot);
    });
    gallery.append(grid);
    content.append(gallery);
    if (videos.length) {
      const group = createVideoGroup(videos, title);
      videoRows.set(sectionId, group);
      content.append(group.button);
    }
    stage.append(content);
    return stage;
  }

  function renderPortfolio(data, config) {
    manifest = data;
    configureDialog(config, typeof data.period === "string" ? data.period.trim() : config.period || "");
    directory.replaceChildren();
    mobileDirectory.replaceChildren();
    const pages = document.createElement("div");
    pages.className = "project-portfolio-pages";
    const groups = new Map();
    (data.groups || []).forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "project-directory-group";
      const heading = document.createElement("h3");
      heading.id = "project-group-" + group.id;
      heading.textContent = group.title;
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-labelledby", heading.id);
      wrapper.append(heading);
      directory.append(wrapper);
      const options = document.createElement("optgroup");
      options.label = group.title;
      mobileDirectory.append(options);
      groups.set(group.id, { ...group, wrapper, options, count: 0 });
    });
    data.sections.forEach((item, index) => {
      const chapterTitle = sectionTitle(config, item);
      const group = groups.get(item.group);
      const chapterNumber = String(group ? ++group.count : index + 1).padStart(2, "0");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.projectSection = item.id;
      button.setAttribute("aria-controls", "project-section-" + item.id);
      const number = document.createElement("span");
      number.className = "project-section-number";
      number.textContent = chapterNumber;
      const title = document.createElement("span");
      title.textContent = chapterTitle;
      button.append(number, title);
      (group?.wrapper || directory).append(button);
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = group ? `${group.shortTitle || group.title} · ${chapterTitle}` : `${chapterNumber} · ${chapterTitle}`;
      (group?.options || mobileDirectory).append(option);
      const section = document.createElement("section");
      section.className = "project-portfolio-section";
      section.id = "project-section-" + item.id;
      section.dataset.sectionId = item.id;
      section.hidden = config.singleSection && index !== 0;
      section.setAttribute("aria-label", chapterTitle);
      if (item.placeholder === true) {
        const placeholder = document.createElement("div");
        placeholder.className = "project-content-placeholder";
        const heading = document.createElement("h3");
        heading.textContent = chapterTitle;
        const message = document.createElement("p");
        message.className = "project-placeholder-message";
        message.textContent = ui.placeholder;
        const preview = document.createElement("img");
        preview.src = "/assets/placeholders/project-cover.svg";
        preview.alt = "";
        preview.width = 1600;
        preview.height = 1000;
        placeholder.append(heading, message, preview);
        section.append(placeholder);
        pages.append(section);
        return;
      }
      const media = item.pages || [item];
      if (item.layout === "media-row") {
        section.append(createVideoRow(media, chapterTitle, item.id));
        pages.append(section);
        return;
      }
      media.forEach((mediaData, pageIndex) => {
        const page = document.createElement("div");
        page.className = "project-portfolio-page";
        if (mediaData.type === "video") {
          page.classList.add("project-video-stage");
          page.append(createVideoHeading(chapterTitle), createPortfolioVideo(mediaData, page, chapterTitle));
          section.append(page);
          return;
        }
        const image = document.createElement("img");
        image.alt = chapterTitle + (media.length > 1 ? ui.page(pageIndex + 1) : "") + " · " + ui.portfolio(config.title);
        image.width = Number(mediaData.width);
        image.height = Number(mediaData.height);
        image.loading = index === 0 && pageIndex === 0 ? "eager" : "lazy";
        image.decoding = "async";
        image.addEventListener("load", () => {
          page.classList.add("is-loaded");
          page.classList.remove("has-media-error");
          page.querySelector(".project-media-error")?.remove();
          if (section.querySelectorAll(".project-portfolio-page.is-loaded").length === media.length) section.classList.add("is-loaded");
        });
        image.addEventListener("error", () => mediaFailed(page, image));
        image.src = mediaData.src;
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
    observePortfolioVideos();

  }

  async function loadPortfolio() {
    const requestedProject = project;
    const token = ++loadingToken;
    stopPortfolioVideos();
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
      viewer.innerHTML = `<div class="project-dialog-state" role="status"><p>${ui.loadFailed}</p><button type="button" class="project-dialog-retry">${ui.retry}</button>${requestedProject.figmaUrl ? `<a href="${requestedProject.figmaUrl}" target="_blank" rel="noopener noreferrer">${ui.viewFigma} <span aria-hidden="true">↗</span></a>` : ""}</div>`;
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
