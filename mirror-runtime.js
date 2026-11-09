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

/* Keep the footer current when hydration restores or rebuilds its static text. */
(() => {
  let column;
  let footer;
  const footerObserver = new MutationObserver(syncFooter);
  const columnObserver = new MutationObserver(syncFooter);

  function syncFooter() {
    const currentColumn = document.querySelector('.col');
    if (currentColumn !== column) {
      columnObserver.disconnect();
      column = currentColumn;
      if (column) columnObserver.observe(column, { childList: true });
    }

    const currentFooter = document.querySelector('.col > footer');
    if (currentFooter !== footer) {
      footerObserver.disconnect();
      footer = currentFooter;
      if (footer) footerObserver.observe(footer, { childList: true, characterData: true, subtree: true });
    }
    if (!footer) return;

    const signature = footer.querySelector('span') || footer;
    const copyright = `© ${new Date().getFullYear()} Eleven`;
    if (signature.textContent !== copyright) signature.textContent = copyright;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncFooter, { once: true });
  else syncFooter();
  window.addEventListener('pageshow', syncFooter);
})();

/* Keep the signature centered between the background's horizontal grid lines. */
document.addEventListener('DOMContentLoaded', function () {
  const hero = document.querySelector('.hero-quote');
  const signature = hero?.querySelector('.sub');
  const grid = document.querySelector('.bg-grid');
  if (!signature || !grid) return;

  function alignSignature() {
    const rowHeight = parseFloat(getComputedStyle(grid).backgroundSize.split(' ')[1]) || 32;
    let top = 0;
    for (let element = signature; element; element = element.offsetParent) top += element.offsetTop;
    const center = top + signature.offsetHeight / 2;
    const rowCenter = Math.floor(center / rowHeight) * rowHeight + rowHeight / 2;
    signature.style.setProperty('--signature-grid-shift', `${rowCenter - center}px`);
  }

  alignSignature();
  new ResizeObserver(alignSignature).observe(hero);
  document.fonts.ready.then(alignSignature);
});

/* Pointer hover and keyboard focus have separate lifetimes. Dialogs restore
   focus for navigation without turning a pointer-opened card into a hover. */
(() => {
  let input = 'pointer';
  let hoveredCard = null;
  let focusedCard = null;
  let restoringFocus = false;

  function cardFor(target) {
    return target instanceof Element ? target.closest('.card-hitbox') : null;
  }

  function setHover(card) {
    if (hoveredCard === card) return;
    hoveredCard?.classList.remove('card-pointer-hover');
    hoveredCard = card;
    hoveredCard?.classList.add('card-pointer-hover');
  }

  function setKeyboardFocus(card) {
    if (focusedCard === card) return;
    focusedCard?.classList.remove('card-keyboard-focus');
    focusedCard = card;
    focusedCard?.classList.add('card-keyboard-focus');
  }

  function pointerHover(event) {
    setHover(event.pointerType === 'mouse' || event.pointerType === 'pen' ? cardFor(event.target) : null);
  }

  document.addEventListener('pointerover', pointerHover, { passive: true });
  document.addEventListener('pointermove', pointerHover, { passive: true });
  document.addEventListener('pointerout', (event) => {
    setHover(event.pointerType === 'mouse' || event.pointerType === 'pen' ? cardFor(event.relatedTarget) : null);
  }, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    input = 'pointer';
    setKeyboardFocus(null);
    pointerHover(event);
  }, { capture: true, passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    input = 'keyboard';
    setHover(null);
    setKeyboardFocus(cardFor(document.activeElement));
  }, true);
  document.addEventListener('focusin', (event) => {
    if (!restoringFocus) setKeyboardFocus(input === 'keyboard' ? cardFor(event.target) : null);
  });
  document.addEventListener('focusout', (event) => {
    if (!restoringFocus && cardFor(event.relatedTarget) !== focusedCard) setKeyboardFocus(null);
  });

  function clear() {
    setHover(null);
    setKeyboardFocus(null);
  }
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });

  window.portfolioCardInteractions = {
    suspend(trigger, event) {
      const keyboard = event.detail === 0 && input === 'keyboard';
      clear();
      return { keyboard };
    },
    restoreFocus(trigger, activation) {
      clear();
      if (!trigger?.isConnected) return;
      restoringFocus = true;
      try {
        trigger.focus({ preventScroll: true });
      } finally {
        restoringFocus = false;
      }
      setKeyboardFocus(activation?.keyboard ? cardFor(trigger) : null);
    },
  };
})();
