const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../scripts/hero-interactions.js'), 'utf8');

function fixture({ reduceMotion = false } = {}) {
  const frames = new Map();
  const captures = new Set();
  const warnings = [];
  const navigations = [];
  let frameId = 0;
  let now = 0;
  let requests = 0;

  class Target {
    constructor() { this.events = new Map(); this.dataset = {}; }
    addEventListener(type, callback, options) {
      if (!this.events.has(type)) this.events.set(type, []);
      this.events.get(type).push({ callback, options });
    }
    fire(type, properties = {}) {
      const event = {
        target: this, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100,
        relatedTarget: null, button: 0, isPrimary: true, timeStamp: now, prevented: false,
        preventDefault() { this.prevented = true; },
        ...properties,
      };
      for (const { callback } of this.events.get(type) || []) callback(event);
      return event;
    }
  }

  function style() {
    const values = new Map();
    return {
      values,
      setProperty(name, value) { values.set(name, value); },
      removeProperty(name) { values.delete(name); },
    };
  }

  const character = { style: style() };
  const sprite = { style: style() };
  const poster = { decode: () => Promise.resolve() };
  const illustration = new Target();
  illustration.querySelector = selector => selector === '.hero-character' ? character : null;
  illustration.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  const cat = new Target();
  cat.querySelector = selector => ({ '.hero-cat-sprite': sprite, '.hero-cat-poster': poster })[selector] || null;
  cat.closest = selector => selector === '.hero-illo' ? illustration : null;
  cat.getBoundingClientRect = () => ({ left: 100, top: 100, width: 100, height: 100 });
  cat.setPointerCapture = id => captures.add(id);
  cat.hasPointerCapture = id => captures.has(id);
  cat.releasePointerCapture = id => {
    captures.delete(id);
    cat.fire('lostpointercapture', { pointerId: id });
  };

  const document = new Target();
  document.hidden = false;
  document.querySelector = selector => selector === '.hero-cat' ? cat : null;
  const window = new Target();
  const media = new Target();
  media.matches = reduceMotion;
  const manifest = {
    version: 1, type: 'sprite-atlas', asset: 'motion.webp', frameCount: 4,
    columns: 2, rows: 2, cellWidth: 10, cellHeight: 10, atlasWidth: 20, atlasHeight: 20,
    pointerMapping: { anglesDegrees: [0, 90, 180, 270], restFrame: 0, headAnchor: { x: .5, y: .5 } },
  };
  let intersection;
  class IntersectionObserver {
    constructor(callback) { intersection = callback; }
    observe() {}
  }
  class Image {
    naturalWidth = 20;
    naturalHeight = 20;
    decode() { return Promise.resolve(); }
  }
  const location = new URL('https://example.test/');
  location.assign = url => navigations.push(String(url));
  vm.runInNewContext(source, {
    window, document, URL, Image, IntersectionObserver,
    ResizeObserver: class { observe() {} },
    location,
    matchMedia: () => media,
    fetch: async () => { requests++; return { ok: true, json: async () => manifest }; },
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    console: { warn: (...args) => warnings.push(args) },
  });

  function settle() {
    for (let step = 0; frames.size && step < 500; step++) {
      const batch = [...frames.values()];
      frames.clear();
      now += 1000 / 60;
      for (const callback of batch) callback(now);
    }
    assert.equal(frames.size, 0, 'Animations should settle without an endless frame loop.');
  }
  async function ready() {
    for (let step = 0; step < 30 && !cat.dataset.ready && !media.matches; step++) await Promise.resolve();
    if (!media.matches) assert.equal(cat.dataset.ready, 'true', 'The atlas should finish loading.');
    assert.equal(warnings.length, 0);
    settle();
  }
  function eyes() {
    return {
      x: parseFloat(character.style.values.get('--eye-x')),
      y: parseFloat(character.style.values.get('--eye-y')),
    };
  }
  function inherited() {
    assert.equal(character.style.values.has('--eye-x'), false);
    assert.equal(character.style.values.has('--eye-y'), false);
  }
  document.fire('DOMContentLoaded');
  return {
    cat, window, document, media, character, captures, frames, navigations, eyes, inherited, settle, ready,
    setVisible(value) { intersection([{ isIntersecting: value }]); },
    get requests() { return requests; },
  };
}

function tap(page, { time, duration = 60, pointerId = 1, pointerType = 'touch', x = 130, y = 130 } = {}) {
  const pointer = { pointerId, pointerType, clientX: x, clientY: y };
  page.cat.fire('pointerdown', { ...pointer, timeStamp: time });
  page.cat.fire('pointerup', { ...pointer, timeStamp: time + duration });
  page.cat.fire('click', { ...pointer, detail: 1, timeStamp: time + duration });
}

async function main() {
  // Follow the captured finger across both axes, including outside the cat.
  // A second finger or a mouse event must not replace the active touch.
  {
    const page = fixture();
    await page.ready();
    page.inherited();
    const down = page.cat.fire('pointerdown', { clientX: 0, clientY: 0 });
    assert.equal(down.prevented, false, 'The interaction must not cancel native page gestures.');
    assert.deepEqual([...page.captures], [1], 'Only the cat owns pointer capture.');
    page.settle();
    assert.ok(page.eyes().x < -3 && page.eyes().y < -2);
    const move = page.cat.fire('pointermove', { clientX: 300, clientY: 300 });
    assert.equal(move.prevented, false);
    page.settle();
    assert.ok(page.eyes().x > 3 && page.eyes().x <= 3.2);
    assert.ok(page.eyes().y > 2 && page.eyes().y <= 2.4);
    const before = page.eyes();
    page.cat.fire('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 });
    page.cat.fire('pointermove', { pointerId: 2, clientX: 0, clientY: 0 });
    page.window.fire('pointermove', { pointerType: 'mouse', clientX: 0, clientY: 0 });
    page.cat.fire('pointerup', { pointerId: 2 });
    page.settle();
    assert.deepEqual(page.eyes(), before);
    assert.deepEqual([...page.captures], [1]);
    page.cat.fire('pointerup'); page.settle(); page.inherited();
    assert.equal(page.captures.size, 0);
    assert.equal(page.cat.events.get('pointermove')[0].options.passive, true);
    assert.equal(page.window.events.has('pointerdown'), false, 'No page-wide touch capture is installed.');
  }

  // Every gesture end returns ownership to the inherited desktop eye runtime.
  for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const page = fixture();
    await page.ready();
    page.cat.fire('pointerdown', { clientX: 0, clientY: 200 }); page.settle();
    assert.ok(Number.isFinite(page.eyes().x));
    page.cat.fire(ending); page.settle(); page.inherited();
    assert.equal(page.captures.size, 0, ending + ' must release the captured finger.');
    page.cat.fire('pointerdown', { pointerId: 2, clientX: 200, clientY: 0 }); page.settle();
    assert.ok(page.eyes().x > 0, 'A subsequent finger can start a fresh interaction.');
  }

  // Mouse motion still steers the cat without writing local eye variables.
  {
    const page = fixture();
    await page.ready();
    page.window.fire('pointermove', { pointerType: 'mouse', clientX: 0, clientY: 200 });
    page.cat.fire('pointerdown', { pointerType: 'mouse' });
    page.settle(); page.inherited();
    assert.equal(page.captures.size, 0);
    page.window.fire('pointerout', { pointerType: 'mouse' }); page.settle(); page.inherited();
  }

  // Reduced motion disables capture and clears an interaction immediately if
  // the preference changes while the finger is down.
  {
    const disabled = fixture({ reduceMotion: true });
    await disabled.ready();
    disabled.cat.fire('pointerdown', { clientX: 0, clientY: 0 }); disabled.settle();
    disabled.inherited();
    assert.equal(disabled.captures.size, 0);
    assert.equal(disabled.requests, 0);
    const page = fixture();
    await page.ready();
    page.cat.fire('pointerdown', { clientX: 0, clientY: 0 }); page.settle();
    page.media.matches = true; page.media.fire('change'); page.settle(); page.inherited();
    assert.equal(page.captures.size, 0);
    page.media.matches = false; page.media.fire('change'); await page.ready(); page.inherited();
  }

  // Leaving the page or hiding it cannot leave captured input or local gaze
  // values behind. Visibility resume and bfcache resume start from rest.
  for (const ending of ['blur', 'hidden', 'pagehide']) {
    const page = fixture();
    await page.ready();
    page.cat.fire('pointerdown', { clientX: 0, clientY: 0 }); page.settle();
    if (ending === 'hidden') {
      page.document.hidden = true; page.document.fire('visibilitychange');
    } else page.window.fire(ending);
    page.settle(); page.inherited();
    assert.equal(page.captures.size, 0);
    if (ending === 'hidden') {
      page.document.hidden = false; page.document.fire('visibilitychange'); page.settle(); page.inherited();
    } else if (ending === 'pagehide') {
      page.window.fire('pageshow', { persisted: true }); await page.ready(); page.inherited();
    }
  }

  const pilot = 'https://elevendy-git.github.io/orange-cat-pointer/pilot/';

  // Native mouse double-click opens the pilot; ordinary and secondary clicks
  // leave the portfolio in place.
  {
    const page = fixture();
    await page.ready();
    page.cat.fire('click', { pointerType: 'mouse', detail: 1 });
    page.cat.fire('dblclick', { pointerType: 'mouse', button: 2 });
    assert.deepEqual(page.navigations, []);
    page.cat.fire('dblclick', { pointerType: 'mouse', button: 0 });
    assert.deepEqual(page.navigations, [pilot]);
  }

  // A short second tap near the first opens the same destination on touch and
  // pen input. A synthesized native double-click must not navigate twice.
  for (const pointerType of ['touch', 'pen']) {
    const page = fixture();
    await page.ready();
    tap(page, { time: 100, pointerType });
    assert.deepEqual(page.navigations, [], 'One tap is not a navigation gesture.');
    tap(page, { time: 280, pointerType, pointerId: 2, x: 142, y: 140 });
    assert.deepEqual(page.navigations, [pilot], pointerType + ' double-tap opens the pilot.');
    page.cat.fire('dblclick', { pointerType, timeStamp: 345 });
    assert.deepEqual(page.navigations, [pilot], 'Native double-click synthesis cannot open it twice.');
    assert.equal(page.captures.size, 0, 'Navigation must not leave a captured finger behind.');
  }

  // Long presses, distant taps, or a drag that returns to its start cannot be
  // mistaken for the second tap.
  for (const gesture of ['long press', 'late tap', 'distant tap', 'drag']) {
    const page = fixture();
    await page.ready();
    tap(page, { time: 100 });
    if (gesture === 'long press') tap(page, { time: 280, duration: 350 });
    else if (gesture === 'late tap') tap(page, { time: 700 });
    else if (gesture === 'distant tap') tap(page, { time: 280, x: 170, y: 170 });
    else {
      page.cat.fire('pointerdown', { timeStamp: 280, clientX: 130, clientY: 130 });
      page.cat.fire('pointermove', { timeStamp: 300, clientX: 160, clientY: 130 });
      page.cat.fire('pointermove', { timeStamp: 320, clientX: 130, clientY: 130 });
      page.cat.fire('pointerup', { timeStamp: 340, clientX: 130, clientY: 130 });
    }
    page.cat.fire('dblclick', { pointerType: 'mouse', timeStamp: 750 });
    assert.deepEqual(page.navigations, [], gesture + ' must not open the pilot.');
    assert.equal(page.captures.size, 0);
  }

  // A canceled or interrupted gesture clears the pending tap, so the next
  // ordinary tap starts fresh rather than completing a double-tap.
  for (const interruption of ['pointercancel', 'lostpointercapture', 'second finger', 'blur', 'hidden', 'pagehide']) {
    const page = fixture();
    await page.ready();
    tap(page, { time: 100 });
    if (interruption === 'second finger') {
      page.cat.fire('pointerdown', { timeStamp: 280, clientX: 130, clientY: 130 });
      page.cat.fire('pointerdown', { pointerId: 2, isPrimary: false, timeStamp: 290 });
      page.cat.fire('pointerup', { pointerId: 2, timeStamp: 300 });
      page.cat.fire('pointerup', { timeStamp: 310, clientX: 130, clientY: 130 });
    } else if (interruption === 'pointercancel' || interruption === 'lostpointercapture') {
      page.cat.fire('pointerdown', { timeStamp: 280, clientX: 130, clientY: 130 });
      page.cat.fire(interruption, { timeStamp: 300 });
    } else if (interruption === 'hidden') {
      page.document.hidden = true; page.document.fire('visibilitychange');
      page.document.hidden = false; page.document.fire('visibilitychange');
    } else {
      page.window.fire(interruption);
      if (interruption === 'pagehide') {
        page.window.fire('pageshow', { persisted: true });
        await page.ready();
      }
    }
    tap(page, { time: 350, pointerId: 3 });
    assert.deepEqual(page.navigations, [], interruption + ' must discard the pending first tap.');
  }

  // Reduced-motion users retain navigation without any pointer capture or
  // animation. Returning through browser Back allows another double-tap.
  {
    const page = fixture({ reduceMotion: true });
    await page.ready();
    tap(page, { time: 100 }); tap(page, { time: 280, pointerId: 2 });
    assert.deepEqual(page.navigations, [pilot]);
    assert.equal(page.captures.size, 0);
    assert.equal(page.requests, 0);
    page.window.fire('pagehide');
    page.window.fire('pageshow', { persisted: true });
    await page.ready();
    tap(page, { time: 1000, pointerId: 3 }); tap(page, { time: 1180, pointerId: 4 });
    assert.deepEqual(page.navigations, [pilot, pilot]);
  }

  console.log('Passed: touch gaze, drag/reset, double-click/double-tap navigation, gesture rejection, reduced motion, and page lifecycle.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
