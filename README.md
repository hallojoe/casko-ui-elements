# Casko UI Elements

Lit-based custom elements for selection, dragging, transforms, and number-aware text input.

## Install

```bash
npm install @casko/ui-elements
```

Register everything:

```ts
import { defineCaskoUiElements } from '@casko/ui-elements/define-all';

defineCaskoUiElements();
```

Or import individual elements:

```ts
import '@casko/ui-elements/selection-box';
import '@casko/ui-elements/transform-box';
import '@casko/ui-elements/drag-box';
import '@casko/ui-elements/number-aware-input';
```

## `selection-box`

`selection-box` manages the `selected` attribute on its direct child elements.

### Features

- Direct children are selectable by default.
- Children with `ignore` are skipped.
- `selection-mode="single"` selects one item at a time.
- `selection-mode="multiple"` enables multi-select behavior.
- `multi-select-key="none|shift|ctrl"` controls whether additive/toggle multi-select is plain-click or modifier-based.
- `drag-select` enables rectangle drag selection from empty space.
- `deselect-on-outside-click` clears selection when clicking empty wrapper space.
- Selection is finalized from pointer interactions, so drag gestures do not accidentally toggle selection.
- Drag-select measures each child's visible selection bounds instead of assuming the host rectangle.
- The element emits bubbled, composed `selection-box-change` and `selection-box-commit` events.

### Example

```html
<selection-box
  selection-mode="multiple"
  multi-select-key="none"
  drag-select
  deselect-on-outside-click>
  <div value="alpha" selected>Alpha</div>
  <div value="beta">Beta</div>
  <div value="gamma" ignore>Ignored</div>
</selection-box>
```

### Public API

Attributes/properties:

- `selection-mode`: `'single' | 'multiple'`, default `'single'`
- `multi-select-key`: `'none' | 'shift' | 'ctrl'`, default `'none'`
- `drag-select`: enables rectangle selection from empty space
- `deselect-on-outside-click`: clears selection when clicking empty wrapper space
- `disabled`: disables selection changes
- `value-attr`: attribute name used for event payload values, default `'value'`
- `selectedValues`: read-only property returning selected child values

Selection state:

- `selection-box` owns the `selected` attribute on the managed children.
- If multiple children start with `selected` in single mode, only the first one remains selected.
- In multiple mode, initial multiple selections are preserved.

Click behavior:

- `single`: click selects one item; clicking the selected item deselects it.
- `multiple` + `multi-select-key="none"`: plain click toggles only the clicked item.
- `multiple` + `multi-select-key="shift"`: plain click resets to one item, `Shift`+click toggles extras.
- `multiple` + `multi-select-key="ctrl"`: plain click resets to one item, `Ctrl`/`Command`+click toggles extras.

Drag behavior:

- `drag-select` only starts when the pointer goes down on empty space.
- Drag selection adds overlapping items to the current selection.
- While dragging, overlapping items receive a transient preview state.
- Dragging a selectable item does not trigger rectangle selection.
- `deselect-on-outside-click` clears the current selection from empty-space clicks.
- For shadow-DOM children, drag-select first checks `getSelectionBoundsRect()`, then `getSelectionBoundsElement()`, then `[data-selection-bounds]`, and finally falls back to the host bounds.

Keyboard behavior:

- Selectable direct children are made focusable when needed.
- `Tab` can move focus into managed items.
- Press `Space` on a focused item to select or deselect it with the current mode rules.
- Focused items receive a separate focus state so keyboard focus remains distinguishable from selection.

Events:

```ts
interface SelectionBoxItemDetail {
  element: HTMLElement;
  value: string | null;
  selected: boolean;
}

interface SelectionBoxChangeDetail {
  items: SelectionBoxItemDetail[];
  selectedItems: SelectionBoxItemDetail[];
  changedItems: SelectionBoxItemDetail[];
  mode: 'single' | 'multiple';
  source: 'click' | 'drag' | 'keyboard';
}
```

## `number-aware-input`

`number-aware-input` keeps track of numeric tokens inside free text and lets users step the active number with the keyboard or spinner controls.

### Features

- Detects numeric tokens inside plain text or multiline text.
- Arrow up/down and spinner controls step the active token.
- `pair-lock` can keep adjacent token pairs together while preserving their ratio during stepping.
- `pair-lock-mode="all"` extends that behavior to direct edits when explicitly wanted.
- `readonly-mode="text"` allows numeric-only editing and blocks arbitrary text characters.
- `readonly-mode="number"` allows text edits outside numeric tokens while protecting the numbers themselves.
- Existing `readonly` still works and maps to full readonly behavior.

### Example

```html
<number-aware-input
  value="100 200 40 80"
  pair-lock
  pair-lock-mode="step"
  step="5"
  readonly-mode="none"></number-aware-input>
```

### Public API

Attributes/properties:

- `value`: current text value
- `multiline`: renders a `<textarea>` instead of an `<input>`
- `decimal-separator`: `'.' | ','`, default `'.'`
- `step`: integer-step amount, default `1`
- `step-decimal`: fraction-step amount, default `0.1`
- `pair-lock`: enables pair-based numeric locking
- `pair-lock-mode`: `'step' | 'all'`, default `'step'`
- `readonly-mode`: `'none' | 'all' | 'text' | 'number'`, default `'none'`
- `readonly`: compatibility alias for `readonly-mode="all"`
- `show-spinner`: shows step controls for the active token
- `min` / `max`: optional numeric clamp for stepping

Pair-lock behavior:

- Pairing follows token order: `(1,2)`, `(3,4)`, `(5,6)`, and so on.
- Token 1 pairs with token 2, token 2 pairs with token 1, token 4 pairs with token 3, and so on.
- `pair-lock-mode="step"` affects arrow up/down and spinner presses only.
- `pair-lock-mode="all"` also applies pair updates to direct edits that change a parsed token.
- Integer and fraction caret parts still control the active token step size, but pairing happens per whole token.

Readonly behavior:

- `all`: blocks all editing and stepping.
- `text`: only allows digits, sign characters, the active decimal separator, and whitespace.
- `number`: allows text edits outside numeric tokens but blocks changes to the parsed numbers and disables numeric stepping.

## `token-aware-input`

`token-aware-input` edits constrained string tokens from a known list of values.

### Features

- `allowed-values` constrains the editable token to a known list of strings.
- `token-pattern` can define the full text shape and expose exactly one editable capture group.
- `suggestion-mode="dropdown"` can show allowed values in a popover menu instead of using spinners.
- `readonly` and `readonly-mode` are supported here as well.

### Example

```html
<token-aware-input
  value="Hello"
  allowed-values='["Hello","Hi","Hey"]'></token-aware-input>
```

Pattern-aware constrained token:

```html
<token-aware-input
  value="Viewport: 800x600"
  token-pattern="^Viewport: (800x600|1024x768)$"
  allowed-values='["800x600","1024x768"]'></token-aware-input>
```

Suggestion dropdown:

```html
<token-aware-input
  value="Greeting: Hello"
  token-pattern="^Greeting: (Hello|Hi|Hey)$"
  allowed-values='["Hello","Hi","Hey"]'
  suggestion-mode="dropdown"></token-aware-input>
```

### Public API

- `value`: current text value
- `multiline`: renders a `<textarea>` instead of an `<input>`
- `allowed-values`: list of allowed string token values
- `token-pattern`: full-value regex with exactly one editable capture group
- `suggestion-mode`: `'none' | 'dropdown'`, default `'none'`
- `readonly-mode`: `'none' | 'all' | 'text' | 'number'`, default `'none'`
- `readonly`: compatibility alias for `readonly-mode="all"`
- `show-spinner`: shows step controls for the active token when dropdown suggestions are not enabled

Token behavior:

- If `allowed-values` is present without `token-pattern`, the whole control value is the editable token.
- If both `allowed-values` and `token-pattern` are present, the full value must match the pattern and capture group 1 becomes the editable token.
- Allowed values are strings at the public API boundary.
- `token-pattern` must resolve exactly one editable capture group in v1.
- `suggestion-mode="dropdown"` hides spinners and shows the allowed values in a popover menu while the constrained token input is focused.

## `transform-box`

`transform-box` provides move, resize, rotate, and optional keyboard nudging for slotted content.

### Common usage

```html
<transform-box
  x="120"
  y="80"
  width="180"
  height="130"
  rotation="-8"
  selected
  show-side-handles
  movable
  resizable
  rotatable>
  <div>Tile content</div>
</transform-box>
```

### Important integration properties

#### `selection-controlled`

Use `selection-controlled` when some outer element, such as `selection-box`, should own the `selected` state.

Without it, `transform-box` updates its own selection on pointer/focus/blur. With it, the host still reacts to movement, resize, and rotate interactions, but selection must be driven externally.

Example:

```html
<selection-box selection-mode="multiple" multi-select-key="shift">
  <transform-box
    value="promo-tile"
    selection-controlled
    move-requires-selection
    selected
    movable
    resizable
    rotatable>
    <div>Promo Tile</div>
  </transform-box>
</selection-box>
```

#### `move-requires-selection`

Use `move-requires-selection` when an outer selection manager should decide whether a box may start moving.

- Default: `false`
- When `true`, pointerdown on an unselected item will not start a move gesture.
- This is especially useful with `selection-controlled` inside `selection-box`, where the first click should select and a later drag should move.

#### `showControlsWhenUnselected`

`showControlsWhenUnselected` controls whether the outline and handles stay visible while the box is not selected.

- Default: `true`
- Set to `false` to keep the content visible but hide the border/handles until selection returns

When setting this from plain HTML, prefer a property assignment in JavaScript if you need `false`:

```ts
const box = document.querySelector('transform-box');
box.showControlsWhenUnselected = false;
```

This is especially useful in selection-managed canvases where you want inactive items to stay visible without always showing resize/rotate chrome.

### Events

- `transform-box-select`
- `transform-box-change`
- `transform-box-commit`

## `drag-box`

`drag-box` provides move-only positioning for slotted content.

### Important integration properties

#### `move-requires-selection`

Use `move-requires-selection` when `drag-box` participates in a larger selection-managed stage.

- Default: `false`
- When `true`, an unselected `drag-box` ignores move pointerdown gestures.
- This lets wrappers such as `selection-box` own the first click without the item sliding away.

`drag-box` also exposes its visible box as the selection bounds target, so `selection-box` drag-select can measure the real draggable rectangle instead of the full host.

## Styling

Selection visuals and transform visuals are exposed through CSS custom properties.

Examples:

```css
selection-box {
  --selection-box-selected-outline: none;
  --selection-box-selected-background: rgba(216, 104, 45, 0.12);
  --selection-box-selected-shadow:
    inset 0 0 0 2px rgba(216, 104, 45, 0.92),
    0 0 0 1px rgba(216, 104, 45, 0.16);
  --selection-box-preview-shadow:
    inset 0 0 0 2px rgba(59, 130, 246, 0.9),
    0 0 0 1px rgba(59, 130, 246, 0.18);
  --selection-box-drag-outline: 1px solid rgba(216, 104, 45, 0.8);
  --selection-box-drag-background: rgba(216, 104, 45, 0.12);
}

transform-box {
  --transform-box-selected-color: #d8682d;
  --transform-box-outline-color: rgba(216, 104, 45, 0.78);
  --transform-box-background: rgba(216, 104, 45, 0.08);
}
```

## Demo

Run the demo locally:

```bash
npm run dev
```

The demo includes:

- standalone `number-aware-input`
- whole-value constrained token cycling
- pattern-aware constrained token examples
- suggestion dropdown token selection
- pair-locked numeric stepping
- partial readonly modes for text-only and number-only protection
- standalone `selection-box`
- `multiple` mode with plain click toggle and modifier-based multi-select
- drag-select enabled rectangle selection
- standalone `drag-box`
- standalone `transform-box`
- a combined stage where `selection-box`, `drag-box`, and `transform-box` work together with selection-first movement
