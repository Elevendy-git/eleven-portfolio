/* Both language routes are local static pages. Keep the chosen tab and reading
   position when navigating, and respect the remembered language on a new visit. */
(() => {
  const preferenceKey = 'eleven-locale';
  const positionKey = 'eleven-language-position';
  const locale = document.documentElement?.lang.startsWith('en') ? 'en' : 'zh';

  function remember(language) {
    try { localStorage.setItem(preferenceKey, language); } catch {}
    document.cookie = `NEXT_LOCALE=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }

  try {
    const navigationType = performance.getEntriesByType('navigation')[0]?.type;
    if (location.pathname === '/' && navigationType === 'navigate' && localStorage.getItem(preferenceKey) === 'en') {
      location.replace('/en/' + location.search + location.hash);
    } else if (locale === 'en') remember('en');
  } catch {}

  function topOf(element) {
    let top = 0;
    for (; element; element = element.offsetParent) top += element.offsetTop;
    return top;
  }

  function savePosition(target) {
    const selectors = ['.hero-quote', '.tabs', ...Array.from(document.querySelectorAll('.pcard[id]'), card => `#${card.id}`),
      '.experience-card.microsoft', '.experience-card.digital-china', '.experience-card.delysium', '.contact', '.col > footer'];
    let anchor = null;
    let anchorTop = 0;
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element?.offsetHeight) continue;
      const top = topOf(element);
      if (top <= window.scrollY + 1 && top >= anchorTop) { anchor = selector; anchorTop = top; }
    }
    try {
      sessionStorage.setItem(positionKey, JSON.stringify({ path: target.pathname, hash: target.hash,
        y: window.scrollY, anchor, offset: window.scrollY - anchorTop }));
    } catch {}
  }

  document.addEventListener('click', event => {
    const anchor = event.target instanceof Element ? event.target.closest('.header-links a[lang][href]') : null;
    if (!anchor) return;
    const language = anchor.lang.startsWith('en') ? 'en' : 'zh';
    const target = new URL(language === 'en' ? '/en/' : '/', location.href);
    target.search = location.search;
    target.hash = location.hash;
    anchor.href = target.href;
    event.stopImmediatePropagation();
    remember(language);
    // Preserve native new-tab/window behavior for modified clicks.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === '_blank') return;
    event.preventDefault();
    if (language === locale) return;
    savePosition(target);
    location.assign(target.href);
  }, true);

  function restorePosition() {
    let position;
    try {
      const stored = sessionStorage.getItem(positionKey);
      if (!stored) return;
      position = JSON.parse(stored);
      sessionStorage.removeItem(positionKey);
    } catch { return; }
    if (position.path !== location.pathname || position.hash !== location.hash || !Number.isFinite(position.y)) return;
    let restored = false;
    let fallback;
    const observer = new MutationObserver(ready);
    function restore() {
      if (restored) return;
      restored = true;
      observer.disconnect();
      window.clearTimeout(fallback);
      // The hash-driven tab and the shared scrolling runtime have now mounted.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const element = position.anchor && document.querySelector(position.anchor);
        const top = element?.offsetHeight ? topOf(element) + position.offset : position.y;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }));
    }
    function ready() {
      const requestedTab = position.hash.slice(1);
      const activeTab = document.querySelector('.works-shell')?.dataset.activeWork;
      const tabReady = !['products', 'skills', 'me'].includes(requestedTab) || activeTab === requestedTab;
      if (!document.documentElement.classList.contains('is-booting') && !document.querySelector('.site-loader') && tabReady) restore();
    }
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-active-work'], childList: true, subtree: true });
    fallback = window.setTimeout(restore, 7500);
    window.requestAnimationFrame(ready);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restorePosition, { once: true });
  else restorePosition();
})();
