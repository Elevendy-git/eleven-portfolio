/* The cat and character share touch input; mouse eye movement stays inherited. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const cat = document.querySelector('.hero-cat');
  const sprite = cat?.querySelector('.hero-cat-sprite');
  const poster = cat?.querySelector('.hero-cat-poster');
  if (!cat || !sprite || !poster) return;
  const illustration = cat.closest('.hero-illo');
  const character = illustration?.querySelector('.hero-character');

  const manifestUrl = new URL('/assets/hero/cat-pointer/motion.json', location.href);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrap = angle => ((angle % 360) + 360) % 360;
  const deltaAngle = (from, to) => ((wrap(to) - wrap(from) + 540) % 360) - 180;
  let controller = null;
  let assetsPromise = null;
  let bootToken = 0;
  let visible = true;
  let activeTouch = null;
  let input = { active: false, x: 0, y: 0 };
  let tap = null;
  let lastTap = null;
  let lastPointerType = 'mouse';
  let navigating = false;

  function clearTaps() { tap = lastTap = null; }

  function openCatPilot() {
    if (navigating) return;
    navigating = true;
    clearTaps();
    releaseTouch();
    reset();
    location.assign('https://elevendy-git.github.io/orange-cat-pointer/pilot/');
  }

  function finishTap(event, type) {
    if (event.pointerId !== tap?.pointerId) return;
    const completed = tap;
    tap = null;
    const distance = Math.hypot(event.clientX - completed.x, event.clientY - completed.y);
    if (type !== 'pointerup' || completed.moved || distance > 10 || event.timeStamp - completed.time > 300) {
      lastTap = null;
      return;
    }
    const next = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    if (lastTap && next.time - lastTap.time <= 350 &&
        Math.hypot(next.x - lastTap.x, next.y - lastTap.y) <= 24) openCatPilot();
    else lastTap = next;
  }

  // Critically damp the angle before selecting one opaque sprite frame.
  function smoothDamp(current, target, velocity, smoothTime, dt) {
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const decay = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    const change = clamp(current - target, -720 * smoothTime, 720 * smoothTime);
    const limitedTarget = current - change;
    const temp = (velocity + omega * change) * dt;
    let nextVelocity = (velocity - omega * temp) * decay;
    let next = limitedTarget + (change + temp) * decay;
    if ((target - current > 0) === (next > target)) {
      next = target;
      nextVelocity = 0;
    }
    return [next, nextVelocity];
  }

  async function loadAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = (async () => {
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`Cat manifest: HTTP ${response.status}`);
      const manifest = await response.json();
      const mapping = manifest.pointerMapping;
      const dimensions = ['frameCount', 'columns', 'rows', 'cellWidth', 'cellHeight', 'atlasWidth', 'atlasHeight'];
      if (manifest.version !== 1 || manifest.type !== 'sprite-atlas' ||
          dimensions.some(key => !Number.isInteger(manifest[key]) || manifest[key] < 1) ||
          manifest.frameCount > manifest.columns * manifest.rows ||
          manifest.atlasWidth !== manifest.columns * manifest.cellWidth ||
          manifest.atlasHeight !== manifest.rows * manifest.cellHeight ||
          !Array.isArray(mapping?.anglesDegrees) || mapping.anglesDegrees.length !== manifest.frameCount ||
          mapping.anglesDegrees.some(angle => !Number.isFinite(angle)) ||
          !Number.isInteger(mapping.restFrame) || mapping.restFrame < 0 || mapping.restFrame >= manifest.frameCount ||
          ![mapping.headAnchor?.x, mapping.headAnchor?.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
        throw new Error('Invalid cat atlas or direction mapping');
      }
      const atlasUrl = new URL(manifest.asset, manifestUrl);
      if (atlasUrl.origin !== location.origin) throw new Error('The cat atlas must be local');
      const atlas = new Image();
      atlas.decoding = 'async';
      atlas.src = atlasUrl.href;
      await Promise.all([atlas.decode(), poster.decode()]);
      if (atlas.naturalWidth !== manifest.atlasWidth || atlas.naturalHeight !== manifest.atlasHeight) {
        throw new Error('Cat atlas dimensions do not match its manifest');
      }
      return { manifest, atlasUrl, atlas };
    })().catch(error => {
      assetsPromise = null;
      throw error;
    });
    return assetsPromise;
  }

  function createController(manifest) {
    const mapping = manifest.pointerMapping;
    const angles = mapping.anglesDegrees;
    const restAngle = angles[mapping.restFrame];
    const smoothTime = clamp(mapping.smoothTime || .11, .04, .5);
    let angle = restAngle;
    let velocity = 0;
    let frame = -1;
    let raf = 0;
    let lastTime = 0;
    let destroyed = false;
    let geometryDirty = true;
    let head = { x: 0, y: 0 };
    let eyeBounds;
    let eyeX = 0;
    let eyeY = 0;
    let ownsEyes = false;

    function clearEyes() {
      character?.style.removeProperty('--eye-x');
      character?.style.removeProperty('--eye-y');
      eyeX = eyeY = 0;
      ownsEyes = false;
    }

    function renderFrame(index) {
      if (index === frame) return;
      const column = index % manifest.columns;
      const row = Math.floor(index / manifest.columns);
      sprite.style.backgroundPosition = `${manifest.columns === 1 ? 0 : column / (manifest.columns - 1) * 100}% ${manifest.rows === 1 ? 0 : row / (manifest.rows - 1) * 100}%`;
      cat.dataset.frame = String(index);
      frame = index;
    }

    function nearestFrame(target) {
      let nearest = 0;
      let distance = Infinity;
      angles.forEach((sample, index) => {
        const candidate = Math.abs(deltaAngle(target, sample));
        if (candidate < distance) {
          nearest = index;
          distance = candidate;
        }
      });
      return nearest;
    }

    function schedule() {
      if (!raf && !destroyed && visible && !document.hidden) raf = requestAnimationFrame(tick);
    }

    function tick(now) {
      raf = 0;
      if (destroyed || !visible || document.hidden) { lastTime = 0; return; }
      if (geometryDirty) {
        const rect = cat.getBoundingClientRect();
        head = { x: rect.left + rect.width * mapping.headAnchor.x, y: rect.top + rect.height * mapping.headAnchor.y };
        eyeBounds = illustration?.getBoundingClientRect();
        geometryDirty = false;
      }
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
      lastTime = now;
      let target = restAngle;
      if (input.active) {
        const dx = input.x - head.x;
        const dy = input.y - head.y;
        if (Math.hypot(dx, dy) >= 6) target = Math.atan2(dy, dx) * 180 / Math.PI;
      }
      target = angle + deltaAngle(angle, target);
      [angle, velocity] = smoothDamp(angle, target, velocity, smoothTime, dt);
      renderFrame(nearestFrame(angle));
      let targetEyeX = 0;
      let targetEyeY = 0;
      if (activeTouch !== null && input.active && character && eyeBounds?.width && eyeBounds?.height) {
        ownsEyes = true;
        targetEyeX = 3.2 * (clamp((input.x - eyeBounds.left) / eyeBounds.width, 0, 1) * 2 - 1);
        targetEyeY = 2.4 * (clamp((input.y - eyeBounds.top) / eyeBounds.height, 0, 1) * 2 - 1);
      }
      const eyeEase = 1 - Math.exp(-10 * dt);
      eyeX += (targetEyeX - eyeX) * eyeEase;
      eyeY += (targetEyeY - eyeY) * eyeEase;
      const eyesMoving = Math.abs(targetEyeX - eyeX) > .03 || Math.abs(targetEyeY - eyeY) > .03;
      if (ownsEyes) {
        // Local values override the desktop runtime's inherited eye variables
        // only for a touch gesture, then return control after easing to rest.
        if (activeTouch === null && !eyesMoving) clearEyes();
        else {
          character.style.setProperty('--eye-x', `${eyeX.toFixed(2)}px`);
          character.style.setProperty('--eye-y', `${eyeY.toFixed(2)}px`);
        }
      }
      if (Math.abs(target - angle) > .01 || Math.abs(velocity) > .01 || eyesMoving) schedule();
      else { angle = wrap(angle); velocity = 0; lastTime = 0; }
    }

    renderFrame(mapping.restFrame);
    return {
      update() { geometryDirty = true; schedule(); },
      setVisible() {
        if (!visible || document.hidden) {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          lastTime = 0;
          clearEyes();
        }
        if (visible && !document.hidden) { geometryDirty = true; schedule(); }
      },
      destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); clearEyes(); },
    };
  }

  function setInput(next) { input = next; controller?.update(); }
  function reset() { setInput({ ...input, active: false }); }

  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && activeTouch === null) setInput({ active: true, x: event.clientX, y: event.clientY });
  }, { passive: true });
  window.addEventListener('pointerout', event => {
    if (event.pointerType === 'mouse' && event.relatedTarget === null) reset();
  });
  window.addEventListener('blur', () => { clearTaps(); releaseTouch(); reset(); });

  cat.addEventListener('dblclick', event => {
    // Touch and pen double taps are recognized below, without treating a drag
    // or a long press as a browser-generated double click.
    if (event.button === 0 && lastPointerType === 'mouse') openCatPilot();
  });

  cat.addEventListener('pointerdown', event => {
    lastPointerType = event.pointerType;
    if (event.pointerType === 'mouse') return;
    if (event.isPrimary === false || tap !== null || activeTouch !== null) { clearTaps(); return; }
    tap = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false };
    if (reducedMotion.matches) return;
    activeTouch = event.pointerId;
    cat.setPointerCapture(event.pointerId);
    setInput({ active: true, x: event.clientX, y: event.clientY });
  });
  cat.addEventListener('pointermove', event => {
    if (event.pointerId === tap?.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) {
      tap.moved = true;
      lastTap = null;
    }
    if (event.pointerId === activeTouch) setInput({ active: true, x: event.clientX, y: event.clientY });
  }, { passive: true });
  function releaseTouch() {
    if (activeTouch === null) return;
    const pointerId = activeTouch;
    activeTouch = null;
    if (cat.hasPointerCapture(pointerId)) cat.releasePointerCapture(pointerId);
    input = { ...input, active: false };
  }
  function releasePointer(event, type) {
    finishTap(event, type);
    if (event.pointerId !== activeTouch) return;
    releaseTouch();
    reset();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    cat.addEventListener(type, event => releasePointer(event, type));
  }

  const updateGeometry = () => controller?.update();
  window.addEventListener('resize', updateGeometry, { passive: true });
  window.addEventListener('scroll', updateGeometry, { passive: true });
  illustration?.addEventListener('animationend', updateGeometry);
  new ResizeObserver(updateGeometry).observe(cat);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    controller?.setVisible();
  }).observe(cat);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTaps(); releaseTouch(); }
    controller?.setVisible();
  });

  async function boot() {
    clearTaps();
    releaseTouch();
    const token = ++bootToken;
    controller?.destroy();
    controller = null;
    delete cat.dataset.ready;
    delete cat.dataset.frame;
    if (reducedMotion.matches) return;
    try {
      const { manifest, atlasUrl } = await loadAssets();
      if (token !== bootToken || reducedMotion.matches) return;
      sprite.style.backgroundImage = `url(${JSON.stringify(atlasUrl.href)})`;
      sprite.style.backgroundSize = `${manifest.columns * 100}% ${manifest.rows * 100}%`;
      controller = createController(manifest);
      cat.dataset.ready = 'true';
      controller.update();
    } catch (error) {
      if (token === bootToken) console.warn('Using the static cat image:', error.message);
    }
  }

  reducedMotion.addEventListener('change', boot);
  window.addEventListener('pagehide', () => { clearTaps(); releaseTouch(); ++bootToken; controller?.destroy(); });
  window.addEventListener('pageshow', event => { navigating = false; clearTaps(); if (event.persisted) void boot(); });
  void boot();
});
