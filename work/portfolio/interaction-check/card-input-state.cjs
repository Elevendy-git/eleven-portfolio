const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const documentEvents = new Map();
const windowEvents = new Map();
function classes() {
  const values = new Set();
  return { add: (...items) => items.forEach(i => values.add(i)), remove: (...items) => items.forEach(i => values.delete(i)), contains: i => values.has(i) };
}
class Element {
  constructor(card = null) { this.card = card; this.classList = classes(); this.isConnected = true; }
  closest(selector) { return selector === '.card-hitbox' ? this.card : null; }
  focus(options) { document.activeElement = this; this.focusOptions = options; fire('focusin', { target: this }); }
}
const document = {
  readyState: 'loading', activeElement: null, hidden: false,
  addEventListener: (type, listener) => { if (!documentEvents.has(type)) documentEvents.set(type, []); documentEvents.get(type).push(listener); },
  querySelector: () => null,
};
const window = { addEventListener: (type, listener) => { if (!windowEvents.has(type)) windowEvents.set(type, []); windowEvents.get(type).push(listener); } };
const source = fs.readFileSync('mirror-runtime.js', 'utf8');
vm.runInNewContext(source, { document, window, Element, MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} }, URL, location: { href: 'http://localhost/' } });
function fire(type, properties = {}) { for (const listener of documentEvents.get(type) || []) listener(properties); }
function key(key) { fire('keydown', { key, metaKey: false, ctrlKey: false, altKey: false }); }
function pointer(type, target, pointerType = 'mouse', relatedTarget = null) { fire(type, { target, pointerType, relatedTarget }); }
const api = window.portfolioCardInteractions;
const card = new Element(); card.card = card;
const trigger = new Element(card);
const otherCard = new Element(); otherCard.card = otherCard;
const otherTrigger = new Element(otherCard);

// A pointer activation can close via the close button OR Escape without
// retaining keyboard/hover styles, while focus returns for next navigation.
for (const closeWithKeyboard of [false, true]) {
  pointer('pointerover', trigger);
  assert.equal(card.classList.contains('card-pointer-hover'), true);
  pointer('pointerdown', trigger);
  trigger.focus();
  const activation = api.suspend(trigger, { detail: 1 });
  assert.equal(card.classList.contains('card-pointer-hover'), false);
  if (closeWithKeyboard) key('Escape');
  api.restoreFocus(trigger, activation);
  assert.equal(document.activeElement, trigger);
  assert.equal(trigger.focusOptions.preventScroll, true);
  assert.equal(card.classList.contains('card-keyboard-focus'), false);
  assert.equal(card.classList.contains('card-pointer-hover'), false);
  pointer('pointermove', trigger);
  assert.equal(card.classList.contains('card-pointer-hover'), true);
  pointer('pointerout', trigger, 'mouse', null);
  assert.equal(card.classList.contains('card-pointer-hover'), false);
}

// Keyboard openings retain their visible return focus even if the modal
// itself is later closed with a pointer.
key('Tab'); trigger.focus();
assert.equal(card.classList.contains('card-keyboard-focus'), true);
const keyboardActivation = api.suspend(trigger, { detail: 0 });
pointer('pointerdown', new Element());
api.restoreFocus(trigger, keyboardActivation);
assert.equal(card.classList.contains('card-keyboard-focus'), true);
assert.equal(document.activeElement, trigger);
key('Tab'); otherTrigger.focus();
assert.equal(card.classList.contains('card-keyboard-focus'), false);
assert.equal(otherCard.classList.contains('card-keyboard-focus'), true);

// Touch and pen have different hover semantics; touch never leaves a hover
// or focus treatment, and moving between cards clears the old hover.
pointer('pointerdown', trigger, 'touch'); trigger.focus();
const touchActivation = api.suspend(trigger, { detail: 1 });
api.restoreFocus(trigger, touchActivation);
assert.equal(card.classList.contains('card-pointer-hover'), false);
assert.equal(card.classList.contains('card-keyboard-focus'), false);
pointer('pointermove', trigger, 'touch');
assert.equal(card.classList.contains('card-pointer-hover'), false);
pointer('pointerover', trigger, 'pen');
assert.equal(card.classList.contains('card-pointer-hover'), true);
pointer('pointerover', otherTrigger);
assert.equal(card.classList.contains('card-pointer-hover'), false);
assert.equal(otherCard.classList.contains('card-pointer-hover'), true);
for (const listener of windowEvents.get('blur') || []) listener();
assert.equal(otherCard.classList.contains('card-pointer-hover'), false);
trigger.isConnected = false;
api.restoreFocus(trigger, keyboardActivation);
assert.equal(card.classList.contains('card-keyboard-focus'), false);
console.log('Passed: mouse/modal-close, mouse/Escape-close, keyboard return focus, touch, pen, switching cards, window blur, detached trigger.');
