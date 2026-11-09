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
