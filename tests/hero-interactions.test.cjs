const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../scripts/hero-interactions.js'), 'utf8');

function fixture({ reduceMotion = false } = {}) {
  const frames = new Map();
  const captures = new Set();
  const warnings = [];
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
        relatedTarget: null, prevented: false,
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
  vm.runInNewContext(source, {
    window, document, URL, Image, IntersectionObserver,
    ResizeObserver: class { observe() {} },
    location: new URL('https://example.test/'),
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
    cat, window, document, media, character, captures, frames, eyes, inherited, settle, ready,
    setVisible(value) { intersection([{ isIntersecting: value }]); },
    get requests() { return requests; },
  };
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

  console.log('Passed: touch gaze, captured drag, secondary pointers, release/cancel, mouse inheritance, reduced motion, and page lifecycle.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
