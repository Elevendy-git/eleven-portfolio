const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../scripts/language-switch.js'), 'utf8');

function storage(values, blocked) {
  return {
    getItem(key) { if (blocked) throw new Error('Storage unavailable'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage unavailable'); values.set(key, String(value)); },
    removeItem(key) { if (blocked) throw new Error('Storage unavailable'); values.delete(key); },
  };
}

function page({ url = 'http://localhost:5173/?from=portfolio#me', locale = 'zh', y = 1752,
  navigationType = 'navigate', local = new Map(), session = new Map(), blocked = false,
  activeTab = 'me', booting = false, loader = false, englishTop = 1700 } = {}) {
  const events = new Map();
  const frames = [];
  const timers = new Map();
  const observers = new Set();
  const navigations = [];
  const scrolls = [];
  let timerId = 0;
  let loaderVisible = loader;

  class Element {
    constructor(properties = {}) { Object.assign(this, properties); }
    closest() { return this.languageLink ? this : null; }
  }
  const parent = new Element({ offsetTop: 100, offsetParent: null });
  const at = (absoluteTop, height = 300) => new Element({
    offsetTop: absoluteTop - parent.offsetTop, offsetParent: parent, offsetHeight: height,
  });
  const shell = new Element({ dataset: { activeWork: activeTab } });
  const elements = new Map([
    ['.hero-quote', at(0, 700)], ['.tabs', at(800, 80)],
    ['.works-shell', shell],
    ['.experience-card.microsoft', at(locale === 'en' ? englishTop : 1600)],
    ['.experience-card.digital-china', at(2050)],
    ['.experience-card.delysium', at(2500)],
    ['.contact', at(3000)], ['.col > footer', at(3400, 80)],
  ]);
  const cards = [1, 2, 3, 4].map(number => {
    const card = at(1000 + number * 300, activeTab === 'products' ? 300 : 0);
    card.id = `product-0${number}`;
    elements.set(`#${card.id}`, card);
    return card;
  });
  const classes = new Set(booting ? ['is-booting'] : []);
  const document = {
    readyState: 'loading', cookie: '',
    documentElement: { lang: locale === 'en' ? 'en' : 'zh-CN', classList: { contains: key => classes.has(key) } },
    addEventListener(type, callback) {
      if (!events.has(type)) events.set(type, []);
      events.get(type).push(callback);
    },
    querySelector(selector) {
      if (selector === '.site-loader') return loaderVisible ? new Element() : null;
      return elements.get(selector) || null;
    },
    querySelectorAll() { return cards; },
  };
  const address = new URL(url);
  const location = {
    href: address.href, pathname: address.pathname, search: address.search,
    hash: address.hash, protocol: address.protocol,
    assign(target) { navigations.push({ method: 'assign', url: new URL(target, address).href }); },
    replace(target) { navigations.push({ method: 'replace', url: new URL(target, address).href }); },
  };
  const window = {
    scrollY: y, location,
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    scrollTo(options) { window.scrollY = options.top; scrolls.push(options.top); },
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  vm.runInNewContext(source, {
    document, window, location, Element, MutationObserver, URL,
    localStorage: storage(local, blocked), sessionStorage: storage(session, blocked),
    performance: { getEntriesByType: () => [{ type: navigationType }] },
  });

  function flushFrames() {
    for (let step = 0; frames.length && step < 20; step++) {
      const batch = frames.splice(0);
      for (const callback of batch) callback();
    }
    assert.equal(frames.length, 0, 'Animation frames should settle.');
  }
  function fire(type, event = {}) { for (const callback of events.get(type) || []) callback(event); }
  function mutate({ active, loading, isBooting } = {}) {
    if (active !== undefined) shell.dataset.activeWork = active;
    if (loading !== undefined) loaderVisible = loading;
    if (isBooting !== undefined) isBooting ? classes.add('is-booting') : classes.delete('is-booting');
    for (const observer of [...observers]) observer.callback();
    flushFrames();
  }
  function click(language, modifiers = {}) {
    const anchor = new Element({ languageLink: true, lang: language === 'en' ? 'en' : 'zh-CN',
      href: language === 'en' ? '/en/' : '/', target: '' });
    const event = { target: anchor, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...modifiers };
    fire('click', event);
    return { event, anchor };
  }
  return { local, session, document, window, navigations, scrolls, click, mutate,
    load() { document.readyState = 'complete'; fire('DOMContentLoaded'); flushFrames(); } };
}

// The language change preserves the source reading point before browser input
// can scroll a focused header link into view. English content can be taller.
const chinese = page();
const selectedEnglish = chinese.click('en');
assert.equal(selectedEnglish.event.prevented, true);
assert.deepEqual(chinese.navigations, [
  { method: 'assign', url: 'http://localhost:5173/en/?from=portfolio#me' },
]);
assert.match(chinese.document.cookie, /NEXT_LOCALE=en;/);
const positions = [...chinese.session.values()].map(value => JSON.parse(value));
assert.equal(positions.length, 1);
assert.equal(positions[0].y, 1752);
assert.equal(positions[0].anchor, '.experience-card.microsoft');

const english = page({ url: chinese.navigations[0].url, locale: 'en', y: 0,
  local: chinese.local, session: chinese.session, activeTab: 'products', booting: true, loader: true });
english.load();
assert.deepEqual(english.scrolls, [], 'Loading the English page must not restore prematurely.');
english.mutate({ isBooting: false });
assert.deepEqual(english.scrolls, [], 'The visible loader must finish.');
english.mutate({ loading: false });
assert.deepEqual(english.scrolls, [], 'The About panel must be active before restoration.');
english.mutate({ active: 'me' });
assert.deepEqual(english.scrolls, [1852], 'Restore the same position within the work-experience card.');
english.mutate({ active: 'me' });
assert.deepEqual(english.scrolls, [1852], 'Restoration must happen once.');
assert.equal(english.session.size, 0, 'The reading position is consumed after a successful navigation.');

const selectedChinese = english.click('zh');
assert.equal(selectedChinese.event.prevented, true);
assert.deepEqual(english.navigations, [
  { method: 'assign', url: 'http://localhost:5173/?from=portfolio#me' },
]);
assert.match(english.document.cookie, /NEXT_LOCALE=zh;/);

for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
  const browser = page();
  const result = browser.click('en', { [modifier]: true });
  assert.equal(result.event.prevented, false, `${modifier}: preserve native browser behavior.`);
  assert.equal(browser.navigations.length, 0, `${modifier}: do not redirect the current tab.`);
  assert.equal(result.anchor.href, 'http://localhost:5173/en/?from=portfolio#me');
}

const unavailableStorage = page({ blocked: true });
unavailableStorage.load();
unavailableStorage.click('en');
assert.deepEqual(unavailableStorage.navigations, [
  { method: 'assign', url: 'http://localhost:5173/en/?from=portfolio#me' },
], 'Storage restrictions must not block local language switching.');

// Discover remembered state by taking a real language action, rather than
// assuming the implementation's storage-key names.
const preferenceSource = page();
preferenceSource.click('en');
const newVisit = page({ local: preferenceSource.local });
assert.deepEqual(newVisit.navigations, [
  { method: 'replace', url: 'http://localhost:5173/en/?from=portfolio#me' },
], 'A new root visit follows the remembered English choice.');
const historyVisit = page({ local: preferenceSource.local, navigationType: 'back_forward' });
assert.deepEqual(historyVisit.navigations, [], 'Browser Back must retain its historical Chinese address.');
const chineseReload = page({ local: preferenceSource.local, navigationType: 'reload' });
assert.deepEqual(chineseReload.navigations, [], 'Reload must retain the explicitly opened Chinese address.');

// New and previously shared Vibecoding links must preserve the selected panel
// and wait for it to mount before restoring the language-switch position.
for (const hash of ['#vibecoding', '#skills']) {
  const source = page({ url: 'http://localhost:5173/?from=portfolio' + hash, activeTab: 'skills' });
  source.click('en');
  assert.equal(source.navigations[0].url, 'http://localhost:5173/en/?from=portfolio#vibecoding');
  const target = page({ url: source.navigations[0].url, locale: 'en', y: 0,
    local: source.local, session: source.session, activeTab: 'products' });
  target.load();
  assert.deepEqual(target.scrolls, [], 'Wait for the Vibecoding panel before restoring.');
  target.mutate({ active: 'skills' });
  assert.equal(target.scrolls.length, 1);

  const legacySession = new Map([['eleven-language-position', JSON.stringify({
    path: '/en/', hash: '#skills', y: 900, anchor: '.tabs', offset: 100,
  })]]);
  const migrated = page({ url: source.navigations[0].url, locale: 'en', y: 0,
    session: legacySession, activeTab: 'skills' });
  migrated.load();
  assert.deepEqual(migrated.scrolls, [900], 'An older saved hash must survive URL normalization.');
}

console.log('Passed: bilingual local routes, query/hash, 1752 px reading position, stable anchor, loader/tab readiness, native modified clicks, blocked storage, language preference, Back, and reload.');
