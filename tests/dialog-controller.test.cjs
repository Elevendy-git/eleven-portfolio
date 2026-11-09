const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../scripts/dialog-controller.js'), 'utf8');

function fixture({ interactions = true, cursorFails = false } = {}) {
  const pending = [];
  const restored = [];
  const scrolls = [];
  const classes = new Set(['has-cursor-fx']);
  const closeButton = new EventTarget();
  const cursor = {
    open: false, attributes: new Map(), shows: 0, hides: 0,
    setAttribute(key, value) { this.attributes.set(key, value); },
    removeAttribute(key) { this.attributes.delete(key); },
    matches() { return this.open; },
    showPopover() { if (cursorFails) throw new Error('Popover unavailable'); this.open = true; this.shows++; },
    hidePopover() { this.open = false; this.hides++; },
  };
  class Dialog extends EventTarget {
    open = false;
    dataset = {};
    failOpening = false;
    close() { if (!this.open) return; this.open = false; pending.push(() => this.dispatchEvent(new Event('close'))); }
    showModal() { if (this.failOpening) throw new Error('Cannot open'); this.open = true; }
    querySelector() { return closeButton; }
    getBoundingClientRect() { return { left: 100, top: 100, right: 900, bottom: 700 }; }
  }
  const dialog = new Dialog();
  const window = {
    scrollX: 12, scrollY: 640,
    scrollTo(position) { scrolls.push(position); },
    ...(interactions ? { portfolioCardInteractions: {
      suspend(trigger, event) { return { keyboard: event.detail === 0 }; },
      restoreFocus(trigger, activation) { restored.push({ trigger, activation }); },
    } } : {}),
  };
  const document = {
    documentElement: { classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
    } },
    querySelector: () => cursor,
  };
  vm.runInNewContext(source, { window, document });
  let closes = 0;
  const controller = window.createDialogController(dialog, { className: 'reader', onClose() { closes++; } });
  const trigger = { isConnected: true, focus(options) { restored.push({ trigger: this, options }); } };
  function flush() { while (pending.length) pending.shift()(); }
  function fire(type, { target = dialog, x = 20, y = 20, id = 1, button = 0, key } = {}) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      target: { value: target }, clientX: { value: x }, clientY: { value: y },
      pointerId: { value: id }, button: { value: button },
      key: { value: key },
    });
    dialog.dispatchEvent(event);
    return event;
  }
  return { dialog, window, cursor, classes, restored, scrolls, trigger, controller, closeButton,
    fire, flush, get closes() { return closes; } };
}

// A reader opened by either input type preserves the matching focus return
// behavior, plus its original scroll position, when the close button is used.
for (const detail of [0, 1]) {
  const page = fixture();
  assert.equal(page.controller.open(page.trigger, { detail }), true);
  assert.equal(page.dialog.dataset.dialogInput, detail === 0 ? 'keyboard' : 'pointer');
  assert.equal(page.controller.open({}, { detail }), false, 'An open reader cannot replace its owner.');
  assert.equal(page.cursor.open, true);
  page.window.scrollY = 1800;
  page.closeButton.dispatchEvent(new Event('click'));
  page.flush();
  assert.equal(page.closes, 1);
  assert.equal(page.restored[0].trigger, page.trigger);
  assert.equal(page.restored[0].activation.keyboard, detail === 0);
  assert.equal(page.scrolls[0].top, 640);
  assert.equal(page.scrolls[0].left, 12);
  assert.equal(page.classes.has('reader-open'), false);
  assert.equal(page.cursor.open, false);
  assert.equal(page.cursor.attributes.has('popover'), false);
  assert.equal(page.dialog.dataset.dialogInput, undefined);
}

// Touch/pointer autofocus must not inherit Safari's keyboard focus ring.
// Switching to a keyboard inside the reader must still reveal the focus.
{
  const page = fixture();
  page.controller.open(page.trigger, { detail: 1 });
  page.fire('keydown', { key: 'Shift' });
  assert.equal(page.dialog.dataset.dialogInput, 'pointer');
  page.fire('keydown', { key: 'Tab' });
  assert.equal(page.dialog.dataset.dialogInput, 'keyboard');
  page.fire('pointerdown', { x: 200, y: 200 });
  assert.equal(page.dialog.dataset.dialogInput, 'pointer');
  page.fire('cancel'); page.flush();
}

// Selection drags, secondary buttons, canceled pointers, and unrelated
// pointer releases must never count as a click on the backdrop.
for (const gesture of [
  p => { p.fire('click'); },
  p => { p.fire('pointerdown', { target: {} }); p.fire('pointerup'); p.fire('click'); },
  p => { p.fire('pointerdown'); p.fire('pointerup', { x: 200, y: 200 }); p.fire('click'); },
  p => { p.fire('pointerdown', { id: 1 }); p.fire('pointerup', { id: 2 }); p.fire('click'); },
  p => { p.fire('pointerdown', { button: 2 }); p.fire('pointerup'); p.fire('click'); },
  p => { p.fire('pointerdown'); p.fire('pointercancel'); p.fire('pointerup'); p.fire('click'); },
]) {
  const page = fixture();
  page.controller.open(page.trigger, { detail: 1 });
  gesture(page);
  page.flush();
  assert.equal(page.dialog.open, true, 'Only a complete backdrop gesture should close the reader.');
  page.fire('pointerdown'); page.fire('pointerup'); page.fire('click'); page.flush();
  assert.equal(page.dialog.open, false);
  assert.equal(page.closes, 1);
}

// Native close events arrive later. Closing and immediately reopening must
// keep the new reader active and restore focus to its new trigger at the end.
{
  const page = fixture();
  const secondTrigger = { isConnected: true };
  page.controller.open(page.trigger, { detail: 1 });
  page.dialog.close();
  page.controller.open(secondTrigger, { detail: 0 });
  page.flush();
  assert.equal(page.closes, 0);
  assert.equal(page.restored.length, 0);
  assert.equal(page.classes.has('reader-open'), true);
  assert.equal(page.cursor.shows, 2);
  assert.equal(page.cursor.hides, 1, 'Reopening lifts the cursor above the new modal.');
  const cancel = page.fire('cancel');
  assert.equal(cancel.defaultPrevented, true);
  page.flush();
  assert.equal(page.closes, 1);
  assert.equal(page.restored[0].trigger, secondTrigger);
  page.dialog.dispatchEvent(new Event('close'));
  assert.equal(page.closes, 1, 'Repeated close events must not invalidate content or restore focus twice.');
}

// Opening failures must undo the scroll lock and focus suspension immediately.
for (const afterOpenFails of [false, true]) {
  const page = fixture();
  page.dialog.failOpening = !afterOpenFails;
  assert.throws(() => page.controller.open(page.trigger, { detail: 1 }, () => {
    if (afterOpenFails) throw new Error('Cannot render');
  }));
  page.flush();
  assert.equal(page.dialog.open, false);
  assert.equal(page.classes.has('reader-open'), false);
  assert.equal(page.cursor.open, false);
  assert.equal(page.restored.length, 1);
  assert.equal(page.closes, 1);
}

// Popover support and the card helper are enhancements. The reader still
// opens, closes with Escape, and returns native focus when they are unavailable.
{
  const page = fixture({ interactions: false, cursorFails: true });
  page.controller.open(page.trigger, { detail: 1 });
  assert.equal(page.dialog.open, true);
  assert.equal(page.cursor.attributes.has('popover'), false);
  page.fire('cancel'); page.flush();
  assert.equal(page.restored[0].trigger, page.trigger);
  assert.equal(page.restored[0].options.preventScroll, true);
  page.trigger.isConnected = false;
  page.controller.open(page.trigger, { detail: 1 });
  page.dialog.close(); page.flush();
  assert.equal(page.restored.length, 1, 'Detached triggers are not focused.');
}

console.log('Passed: dialog input return, backdrop gestures, queued reopen, Escape, opening failures, cursor fallback, and detached triggers.');
