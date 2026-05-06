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
import '@casko/ui-elements/angle-input';
import '@casko/ui-elements/anchor-point-input';
import '@casko/ui-elements/background-colors';
import '@casko/ui-elements/circular-decoration-input';
import '@casko/ui-elements/circular-input';
import '@casko/ui-elements/circular-text-input';
import '@casko/ui-elements/transform-box';
import '@casko/ui-elements/drag-box';
import '@casko/ui-elements/drag-scroll';
import '@casko/ui-elements/fill-input';
import '@casko/ui-elements/number-aware-input';
import '@casko/ui-elements/range-thing';
import '@casko/ui-elements/stroke-input';
import '@casko/ui-elements/text-input';
import '@casko/ui-elements/token-aware-input';
```

## `background-colors`

`background-colors` converts a list of CSS colors into a PNG data URI and applies it as the element background image.

### Example

```html
<background-colors
  colors="#000,#fff,red"
  direction="horizontal"
  size="2"></background-colors>
```

```ts
const element = document.querySelector('background-colors');

if (element) {
  element.colors = ['#000', '#fff', 'red'];
  element.direction = 'vertical';
  element.size = 2;
}
```

### Public API

Attributes/properties:

- `colors`: CSV string or string array of CSS color values; blank and invalid values are ignored
- `direction`: `'horizontal' | 'vertical'`, default `'horizontal'`
- `size`: optional wrap size; horizontal sets the canvas width, vertical sets the canvas height

## `angle-input`

`angle-input` edits a numeric angle, turn ratio, or distributed number by dragging a handle around a circular path.

### Features

- `value` is numeric and wraps around a full circle by default for angles.
- `unit="degrees|radians|ratio|number"` controls the public value unit.
- `min` and `max` clamp the value to a partial range; ratio mode defaults to `0..1`, and number mode defaults to `0..distribution`.
- `distribution` controls the full-turn denominator in number mode; the default is `100`.
- `show-value-text` displays the current formatted value over the dial.
- `show-step-value-text` and `show-step-ticks` can display visual step markers around the dial.
- `direction="clockwise|counterclockwise"` controls visual direction.
- `start-angle` controls where value `0` appears on full circles and where the first range value appears on partial arcs.
- `arc-degrees` can render partial arcs such as `180` for a semicircle.
- Pointer dragging emits `angle-input-change` and commits on pointer release.
- Arrow keys adjust the value; `PageUp` and `PageDown` move by `10` steps, `Home` and `End` jump to bounds, `Shift` multiplies the step by `10`, and `Alt` divides it by `10`.
- `label` provides the accessible name and can be visible or title-only.

### Example

```html
<angle-input
  label="Rotation"
  value="45"
  unit="degrees"
  direction="clockwise"
  snap-step="15"></angle-input>

<angle-input
  label="Opacity turn"
  unit="ratio"
  value="0.25"
  step="0.05"
  snap-step="0.05"></angle-input>

<angle-input
  label="Progress"
  unit="number"
  value="40"
  distribution="100"
  step="5"
  snap-step="5"></angle-input>

<angle-input
  label="Volume steps"
  unit="number"
  value="3"
  distribution="10"
  data-list="[1,2,3,5,10]"
  data-list-mode="absolute"
  show-step-ticks
  show-step-value-text
  step-value-text-offset="8"></angle-input>

<angle-input
  label="Visible value"
  value="75"
  show-value-text
  display-unit="deg"
  value-text-offset="4"
  value-text-anchor="block-center-inline-end"></angle-input>

<angle-input
  label="Custom handle"
  value="45"
  handle-offset="8"
  handle-path="M 0 -7 L 6 6 L 0 3 L -6 6 Z"
  rotate-handle></angle-input>

<angle-input
  label="Semicircle"
  unit="number"
  value="50"
  min="0"
  max="100"
  arc-degrees="180"
  start-angle="180"></angle-input>
```

### Public API

Attributes/properties:

- `value`: current angle, turn ratio, or distributed number in the selected unit
- `unit`: `'degrees' | 'radians' | 'ratio' | 'number'`, default `'degrees'`
- `distribution`: full-turn denominator for number mode, default `100`
- `min` / `max`: optional numeric clamps in the selected unit; defaults are `0..360`, `0..Math.PI * 2`, `0..1`, or `0..distribution`
- `data-list`: optional numeric values in the selected unit; accepts a JavaScript array, JSON array, or comma-separated numbers, and overrides `min` / `max` with the first and last valid list values
- `data-list-mode`: `'sliding' | 'absolute'`, default `'sliding'`; `sliding` keeps normal numeric stepping inside the list range, while `absolute` snaps pointer input and keyboard navigation to list entries
- `show-value-text`: displays visible value text over the dial, default `false`
- `value-text`: optional visible text override; empty string uses the formatted current value
- `value-text-anchor`: value text anchor point, default `'block-center-inline-center'`
- `value-text-offset`: numeric outward offset from the value text anchor point, default `0`; does not affect center-center
- `show-step-value-text`: displays visual labels for step markers, default `false`
- `show-step-ticks`: displays visual radial ticks for step markers, default `false`
- `step-value-text-offset`: shared radial offset for all step labels, default `0`; labels align automatically from their angle so text grows away from the dial
- `hide-constrained-track`: when clamped or bounded, renders only the usable track arc, default `false`
- `display-unit`: optional visible unit text appended or prepended to visible value text, default `''`
- `display-unit-position`: `'before' | 'after'`, default `'after'`
- `hide-angle-line`: hides the line from the center to the handle, default `false`
- `hide-center-point`: hides the center point marker, default `false`
- `handle-path`: optional SVG path data for a custom handle centered on `0,0`; empty uses the default circular handle
- `handle-offset`: numeric radial offset for the handle, default `0`; positive values move it outward and negative values move it inward
- `rotate-handle`: rotates a custom path handle so an upward-pointing path points outward from the dial center, default `false`
- `direction`: `'clockwise' | 'counterclockwise'`, default `'clockwise'`
- `start-angle`: visual start angle in degrees, default `-90`; partial arcs map the effective range minimum to this angle
- `arc-degrees`: visual arc length in degrees, default `360`; set `180` for a semicircle, invalid or non-positive values fall back to `360`
- `step`: keyboard step in the selected unit; defaults to `1` degree, `Math.PI / 180` radians, `1 / 360` ratio, or `1` number unit
- `snap-step`: pointer drag snap amount in the selected unit; values less than or equal to `0` disable snapping
- `label`: accessible label text
- `label-display`: `'visible' | 'title'`, default `'visible'`
- `disabled`: disables pointer and keyboard changes

Events:

```ts
interface AngleInputChangeDetail {
  value: number;
  degrees: number;
  radians: number;
  distribution: number;
  unit: 'degrees' | 'radians' | 'ratio' | 'number';
  direction: 'clockwise' | 'counterclockwise';
  source: 'pointer' | 'keyboard';
}
```

- `angle-input-change`
- `angle-input-commit`

Track styling:

- `--angle-input-track-stroke` controls the background track color.
- `--angle-input-track-stroke-width` controls only the background track thickness; it does not make the track visible if the stroke color is transparent, invalid, or overridden.
- The value arc is rendered after the background track and covers the active portion.

## `range-thing`

`range-thing` renders multiple draggable handles along an SVG path and uses direct `range-item` children as the source of truth.

### Example

```html
<range-thing
  min="1"
  max="5"
  step="[1,2,3,4,5]"
  step-lock
  item-rule="even-odd"
  tick-path="M -4 0 L 4 0"
  animation="slide">
  <range-item value="0"><div>Ignored below min</div></range-item>
  <range-item value="1"><div>One</div></range-item>
  <range-item value="2" offset="12"><div>Two</div></range-item>
  <range-item value="4"><div>Four</div></range-item>
  <range-item
    value="5"
    handle-path="M 0 -6 L 5 5 L -5 5 Z"
    tick-path="M 0 -4 L 4 0 L 0 4 L -4 0 Z"><div>Five</div></range-item>
  <range-item value="6"><div>Ignored above max</div></range-item>
</range-thing>

<range-thing
  min="0"
  max="100"
  step="5"
  space-rule="pearl-necklace"
  item-rule="after"
  track-path="M 10 72 C 28 18, 44 18, 60 52 S 84 86, 90 34">
  <range-item value="15"><div>Alpha</div></range-item>
  <range-item value="45"><div>Beta</div></range-item>
  <range-item value="72"><div>Gamma</div></range-item>
</range-thing>
```

### Public API

Attributes/properties:

- `min` / `max`: numeric range, default `0..100`
- `step`: number or numeric list; a number controls increment size and a list defines allowed target values
- `step-lock`: snaps pointer movement to `step` targets, default `false`
- `track-path`: optional SVG path data; empty uses a horizontal line
- `handle-path`: optional default SVG handle path centered on `0,0`
- `tick-path`: optional default per-item tick path centered on `0,0`; empty uses a short perpendicular line tick
- `item-rule`: `'even-odd' | 'before' | 'after' | 'center'`, default `'center'`
- `crossing-rule`: `'none' | 'allow'`, default `'none'`
- `space-rule`: `'none' | 'pearl-necklace'`, default `'none'`
- `direction`: `'ltr' | 'rtl'`, default `'ltr'`
- `animation`: `'none' | 'slide'`, default `'none'`
- `disabled`: disables pointer and keyboard updates

`range-item` attributes:

- `value`: item value used for handle position
- `offset`: additional visual offset from the path normal, default `0`
- `handle-path`: optional per-item handle path override
- `tick-path`: optional per-item tick path override; when present it overrides the parent `tick-path`

Tick behavior:

- `range-thing` renders one tick per active `range-item`.
- Ticks follow the same value-to-path position as the handle.
- Child `tick-path` overrides the parent `tick-path`, matching `handle-path` precedence.
- Without a custom `tick-path`, the tick is rendered as a short line perpendicular to the current path tangent.

Events:

```ts
interface RangeThingChangeDetail {
  index: number;
  currentValue: number;
  allValues: number[];
  source: 'pointer' | 'keyboard';
}
```

- `range-thing-change`
- `range-thing-commit`

## `anchor-point-input`

`anchor-point-input` selects one of 9 CSS-logical anchor points from a compact SVG grid.

### Features

- `value` uses block/inline logical names such as `block-start-inline-start`.
- A dimmed dotted rectangle shows the anchor area and un-dims the selected handle.
- Pointer clicks select a handle immediately.
- Arrow keys move focus around the 3x3 grid; `Enter` and `Space` select the focused handle.
- `hold-trigger` can emit repeat trigger events while holding Space or pointer on an anchor.
- `handle-path` can replace the default dot with a custom SVG path.
- `label` provides the accessible name and can be visible or title-only.

### Example

```html
<anchor-point-input
  label="Transform origin"
  value="block-center-inline-center"></anchor-point-input>

<anchor-point-input
  label="Available anchors"
  value="block-center-inline-center"
  disabled-values="block-start-inline-start,block-end-inline-end"></anchor-point-input>

<anchor-point-input
  label="Hidden disabled anchors"
  disabled-values='["block-center-inline-start","block-center-inline-end"]'
  hide-disabled-anchors></anchor-point-input>

<anchor-point-input
  label="Navigation pad"
  hold-trigger
  hold-trigger-mode="any"
  handle-path="M 0 -5 L 4 4 L 0 2 L -4 4 Z"
  rotate-handle></anchor-point-input>
```

### Public API

Attributes/properties:

- `value`: selected anchor point, default `'block-center-inline-center'`
- `label`: accessible label text
- `label-display`: `'visible' | 'title'`, default `'visible'`
- `disabled-values`: disabled anchor values; accepts a JavaScript array, JSON array, or comma-separated values
- `hide-disabled-anchors`: hides disabled anchors visually and removes them from keyboard navigation, default `false`
- `hold-trigger`: emits repeated `anchor-point-input-trigger` events while an anchor is held, default `false`
- `hold-trigger-mode`: `'selected' | 'any'`, default `'selected'`
- `handle-path`: optional SVG path data for a custom handle centered on `0,0`; empty uses the default dot
- `rotate-handle`: rotates a custom path handle to point outward from center, default `false`
- `disabled`: disables pointer and keyboard changes

Value names:

```ts
type AnchorPointValue =
  | 'block-start-inline-start'
  | 'block-start-inline-center'
  | 'block-start-inline-end'
  | 'block-center-inline-start'
  | 'block-center-inline-center'
  | 'block-center-inline-end'
  | 'block-end-inline-start'
  | 'block-end-inline-center'
  | 'block-end-inline-end';
```

Events:

```ts
interface AnchorPointInputChangeDetail {
  value: AnchorPointValue;
  block: 'start' | 'center' | 'end';
  inline: 'start' | 'center' | 'end';
  source: 'pointer' | 'keyboard';
}

interface AnchorPointInputTriggerDetail extends AnchorPointInputChangeDetail {
  triggerCount: number;
}
```

- `anchor-point-input-change`
- `anchor-point-input-commit`
- `anchor-point-input-trigger`

## `circular-input`

`circular-input` is a POC editor for simplified circular sector values. It renders dotted sector arcs and exposes handles for editing each sector's value, radius, and height.

### Example

```html
<circular-input id="sector-editor"></circular-input>

<circular-input
  id="sector-boundary-editor"
  allow-crossing="false"
  gap="8"
  border-radius="8"
  value-snap-step="5"
  rotate-snap-step="15"
  radius-snap-step="10"
  height-snap-step="5"
  value-handle-path="M 0 -6 L 5 5 L -5 5 Z"
  start-angle-handle-path="M 0 -6 L 5 5 L 0 2 L -5 5 Z"></circular-input>

<circular-input
  gap="10"
  border-radius="6"
  hidden-controls="radius,height"></circular-input>

<script type="module">
  const editor = document.querySelector('#sector-editor');

  editor.sectors = [
    { value: 24, radius: 108, height: 38, label: 'A' },
    { value: 32, radius: 128, height: 54, label: 'B' },
    { value: 18, radius: 94, height: 32, label: 'C' },
    { value: 26, radius: 118, height: 46, label: 'D' },
  ];

  editor.addEventListener('circular-input-change', (event) => {
    console.log(event.detail.sectors);
  });
</script>
```

Attributes/properties:

- `sectors`: `CircularInputSector[]`, assigned as a property; each sector has `value`, `radius`, `height`, and optional `label`
- `total-value`: total value used when value handles are dragged, default `100`
- `start-angle`: start angle in degrees, default `-90`; also editable with the outer rotation handle
- `allow-crossing`: retained for compatibility; boundary handles preserve sector order so total distribution remains stable
- `hidden-controls`: hides control types; accepts an array, JSON array, or comma-separated values from `'value' | 'radius' | 'height' | 'start-angle'`
- `gap`: global sector gap passed to `@casko/circular-sector`, default `0`; set as an attribute/property from outside the component
- `border-radius`: global rounded-corner value passed to `@casko/circular-sector`, default `0`; set as an attribute/property from outside the component
- `value-handle-path`, `radius-handle-path`, `height-handle-path`, `start-angle-handle-path`: optional SVG path data centered on `0,0`; empty uses the default circle for that handle type
- `keyboard-step`: keyboard step for value handles, default `1`
- `radius-step`: keyboard step for radius and height handles, default `5`
- `value-snap-step`: value-handle drag snap and keyboard step in total-value units, default `0`
- `rotate-snap-step`: start-angle drag snap and keyboard step in degrees, default `0`
- `radius-snap-step`: radius-handle drag snap and keyboard step, default `0`
- `height-snap-step`: height-handle drag snap and keyboard step, default `0`
- `disabled`: disables pointer and keyboard changes

Clicking or focusing a sector makes it active and renders that sector's radius and height handles last, which keeps overlapped handles reachable. Value handles are boundary based: every sector renders a handle at its start and end edge. The demo keeps `values`, `radiuses`, `heights`, `gap`, and `border-radius` in `number-aware-input` fields and uses `@casko/queues` `Rotation` to repeat shorter number lists across all sectors.

Events:

```ts
interface CircularInputSector {
  value: number;
  radius: number;
  height: number;
  label?: string;
}

interface CircularInputChangeDetail {
  sectors: CircularInputSector[];
  index: number;
  field: 'value' | 'radius' | 'height' | 'start-angle';
  source: 'pointer' | 'keyboard';
  gap: number;
  borderRadius: number;
  startAngle: number;
}
```

- `circular-input-change`
- `circular-input-commit`

## `circular-decoration-input`

`circular-decoration-input` renders circular sectors and edits the selected sector fill/stroke decoration.

### Example

```html
<circular-decoration-input
  id="sector-decoration"
  gap="8"
  border-radius="8"></circular-decoration-input>

<script type="module">
  const editor = document.querySelector('#sector-decoration');

  editor.sectors = [
    { value: 24, radius: 112, height: 46, label: 'A' },
    { value: 32, radius: 124, height: 54, label: 'B' },
    { value: 18, radius: 96, height: 36, label: 'C' },
    { value: 26, radius: 132, height: 58, label: 'D' },
  ];

  editor.addEventListener('circular-decoration-input-change', (event) => {
    console.log(event.detail.selectedIndexes, event.detail.value);
  });
</script>
```

Attributes/properties:

- `sectors`: `CircularDecorationInputSector[]`, assigned as a property; each sector has `value`, `radius`, `height`, and optional `label`
- `value`: `CircularDecorationInputValue`, an array of `{ fill: FillInputValue, stroke: StrokeInputValue }` indexed to `sectors`
- `selectedIndexes`: selected sector indexes, assigned as a property
- `total-value`, `start-angle`, `gap`, and `border-radius`: circular layout settings matching `circular-input`
- `disabled` / `readonly`: prevent selection and editing
- `hide-on-select`: forwarded to the paint inputs, default `true`

Interaction:

- Click selects one sector.
- Click the selected sector again to deselect it.
- Shift/Ctrl/Cmd-click toggles sectors for multi-select.
- Arrow keys move sector focus; Enter/Space selects, and Escape clears selection.
- Fill/stroke forms are always visible below the circular control and disabled until at least one sector is selected.
- Multi-select editing shows default paint controls and applies edits to every selected sector.

Events:

```ts
interface CircularDecorationInputSectorDecoration {
  fill: FillInputValue;
  stroke: StrokeInputValue;
}

type CircularDecorationInputValue = CircularDecorationInputSectorDecoration[];
```

- `input`
- `circular-decoration-input-change`
- `circular-decoration-input-commit`
- `circular-decoration-input-selection-change`

## `circular-text-input`

`circular-text-input` renders circular sectors and edits text content and placement for selected sectors.

### Example

```html
<circular-text-input
  id="sector-text"
  gap="8"
  border-radius="8"></circular-text-input>

<script type="module">
  const editor = document.querySelector('#sector-text');

  editor.sectors = [
    { value: 24, radius: 112, height: 46, label: 'A' },
    { value: 32, radius: 124, height: 54, label: 'B' },
  ];

  editor.value = [
    {
      text: 'Alpha',
      mode: 'point',
      anchor: 'block-center-inline-center',
      offsetX: 0,
      offsetY: 0,
      radialOffset: 0,
    },
    {
      text: 'Beta',
      mode: 'path',
      anchor: 'block-start-inline-center',
      offsetX: 0,
      offsetY: 0,
      radialOffset: 0,
    },
  ];

  editor.addEventListener('circular-text-input-change', (event) => {
    console.log(event.detail.selectedIndexes, event.detail.value);
  });
</script>
```

Attributes/properties:

- `sectors`: array of `{ value, radius, height, label? }`
- `value`: `CircularTextInputValue`, an array of text settings indexed to `sectors`
- `selectedIndexes`: selected sector indexes, assigned as a property
- `total-value`, `start-angle`, `gap`, and `border-radius`: circular layout settings matching `circular-input`
- `disabled` / `readonly`: prevent selection and editing
- `hide-on-select`: forwarded to child text controls, default `true`

Value items:

```ts
interface CircularTextInputValueItem {
  text: string;
  mode: 'point' | 'path';
  anchor: AnchorPointValue;
  offsetX: number;
  offsetY: number;
  radialOffset: number;
  textAttributes: TextInputValue;
}
```

Interaction:

- Click selects one sector.
- Shift/Ctrl/Cmd-click toggles sectors for multi-select.
- Clicking empty SVG space or outside the component clears selection.
- Arrow keys move focus between sectors; `Home` / `End` jump to first or last.
- `Escape` clears selection.
- Multi-select shows the first selected sector settings and applies edits to all selected sectors.

Events:

- `input`
- `circular-text-input-change`
- `circular-text-input-commit`
- `circular-text-input-selection-change`

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
- Optional layer ordering can move selected direct children to the front or back of DOM paint order.
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
- `double-click-bring-to-front`: double-clicking a selected item moves the selected group to the front
- `disabled`: disables selection changes
- `value-attr`: attribute name used for event payload values, default `'value'`
- `selectedValues`: read-only property returning selected child values
- `bringSelectedToFront()`: moves selected direct children to the end of DOM order
- `sendSelectedToBack()`: moves selected direct children to the start of DOM order

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

Layer behavior:

- Layer order follows DOM order of selectable direct children.
- Front/back methods move selected items as a group and preserve their relative order.
- Ignored children are not selected or included in order event item lists.
- Order changes emit separate order events; selection events remain selection-only.

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

interface SelectionBoxOrderChangeDetail {
  items: SelectionBoxItemDetail[];
  selectedItems: SelectionBoxItemDetail[];
  movedItems: SelectionBoxItemDetail[];
  direction: 'front' | 'back';
  source: 'method' | 'double-click';
}
```

- `selection-box-change`
- `selection-box-commit`
- `selection-box-order-change`
- `selection-box-order-commit`

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
- `control-position`: `'default' | 'start' | 'end'`, default `'default'`; `default` follows the active token with the configured offset, while `start` and `end` pin the controls to the input edge
- `hide-on-select`: hides suggestion dropdowns after a suggestion is selected, default `true`
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

## `fill-input`

`fill-input` edits the common SVG fill attributes with compact controls.

### Features

- Color picker for `fill`.
- Numeric stepping for `fill-opacity`.
- Constrained dropdown token input for `fill-rule`.
- The public `value` object uses the SVG attribute names as keys.

### Example

```html
<fill-input
  fill="#0f5449"
  fill-opacity="0.8"
  fill-rule="evenodd"></fill-input>
```

### Public API

Attributes/properties:

- `value`: object with `fill`, `fill-opacity`, and `fill-rule`
- `fill`: color picker value in `#rrggbb` format
- `fill-opacity`: clamped number text from `0` to `1`, default `1`
- `fill-rule`: `'nonzero' | 'evenodd'`, default `'nonzero'`
- `disabled` / `readonly`: prevent editing
- `hide-on-select`: hides internal dropdowns after a suggestion is selected, default `true`

Events:

- `input`
- `fill-input-change`
- `fill-input-commit`

```ts
interface FillInputChangeDetail {
  value: FillInputValue;
  previousValue: FillInputValue;
  changedProperty: keyof FillInputValue;
  source: 'field';
}
```

## `text-input`

`text-input` edits SVG text layout and anchoring attributes.

### Features

- Numeric controls for rotation, baseline shift, and forced text length.
- Dropdown token inputs for anchor, baseline, and length adjustment options.
- Empty `textLength` means no forced text width.
- The public `value` object uses the SVG attribute names as keys.

### Example

```html
<text-input
  text-anchor="middle"
  dominant-baseline="middle"
  lengthAdjust="spacing"></text-input>
```

### Public API

Attributes/properties:

- `value`: object with `rotate`, `text-anchor`, `dominant-baseline`, `alignment-baseline`, `baseline-shift`, `lengthAdjust`, and `textLength`
- `rotate`: numeric rotation text
- `text-anchor`: `'start' | 'middle' | 'end'`, default `'start'`
- `dominant-baseline`: common SVG baseline value, default `'auto'`
- `alignment-baseline`: common SVG baseline value, default `'auto'`
- `baseline-shift`: numeric text or `'baseline' | 'sub' | 'super'`
- `lengthAdjust`: `'spacing' | 'spacingAndGlyphs'`, default `'spacing'`
- `textLength`: optional numeric text; empty means omitted
- `disabled`: keeps all controls visible but prevents edits and commit events
- `readonly`: prevents editing while preserving readonly focus behavior
- `hide-on-select`: hides internal dropdowns after a suggestion is selected, default `true`

Events:

- `input`
- `text-input-change`
- `text-input-commit`

```ts
interface TextInputChangeDetail {
  value: TextInputValue;
  previousValue: TextInputValue;
  changedProperty: keyof TextInputValue;
  source: 'field';
}
```

## `stroke-input`

`stroke-input` edits the common SVG stroke attributes with a compact preset-first UI.

### Features

- Dash `type` presets cover `solid`, `dashed`, `dotted`, `dash-dot`, and `custom`.
- Numeric fields use `number-aware-input`, so users can step values instead of retyping them.
- Choice fields use constrained token inputs instead of native selects.
- `stroke-dasharray` accepts `none` or a space/comma-separated number list.
- The public `value` object uses the SVG attribute names as keys.

### Example

```html
<stroke-input
  type="dashed"
  stroke="#0f5449"
  stroke-width="3"
  stroke-linecap="round"
  vector-effect="non-scaling-stroke"></stroke-input>
```

### Public API

Attributes/properties:

- `value`: object with `stroke`, `stroke-width`, `stroke-opacity`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, `stroke-dasharray`, `stroke-dashoffset`, and `vector-effect`
- `type`: `'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'custom'`, default `'solid'`
- `stroke`: color picker value in `#rrggbb` format
- `stroke-width`: non-negative number text, default `2`
- `stroke-opacity`: clamped number text from `0` to `1`, default `1`
- `stroke-linecap`: `'butt' | 'round' | 'square'`, default `'butt'`
- `stroke-linejoin`: `'miter' | 'round' | 'bevel'`, default `'miter'`
- `stroke-miterlimit`: non-negative number text, default `4`
- `stroke-dasharray`: `none` or number list, default `none`
- `stroke-dashoffset`: non-negative number text, default `0`
- `vector-effect`: `'none' | 'non-scaling-stroke'`, default `'none'`
- `disabled`: keeps all controls visible but prevents edits and commit events
- `readonly`: prevents editing while preserving readonly focus behavior
- `hide-on-select`: hides internal dropdowns after a suggestion is selected, default `true`

Events:

- `input`
- `stroke-input-change`
- `stroke-input-commit`

```ts
interface StrokeInputChangeDetail {
  value: StrokeInputValue;
  previousValue: StrokeInputValue;
  changedProperty: keyof StrokeInputValue | 'type';
  source: 'field' | 'preset';
}
```

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
- `hide-on-select`: hides the suggestion dropdown after a suggestion is selected, default `true`
- `readonly-mode`: `'none' | 'all' | 'text' | 'number'`, default `'none'`
- `readonly`: compatibility alias for `readonly-mode="all"`
- `show-spinner`: shows step controls for the active token when dropdown suggestions are not enabled

Token behavior:

- If `allowed-values` is present without `token-pattern`, the whole control value is the editable token.
- If both `allowed-values` and `token-pattern` are present, the full value must match the pattern and capture group 1 becomes the editable token.
- Allowed values are strings at the public API boundary.
- `token-pattern` must resolve exactly one editable capture group in v1.
- `suggestion-mode="dropdown"` hides spinners and shows the allowed values in a popover menu while the constrained token input is focused.

## `drag-scroll`

`drag-scroll` provides click-and-drag or touch-drag panning for oversized content.

### Features

- Uses pointer events, so the same panning interaction works with mouse, touch, and pen input.
- Keeps drag tracking alive with pointer capture while the pointer stays down.
- `nochilddrag` can reserve drag start for the container itself and ignore pointerdown on child content.
- Leaves the slotted content layout entirely up to the consumer.

### Example

```html
<drag-scroll>
  <div style="width: 1200px; min-height: 320px;">Wide canvas</div>
</drag-scroll>
```

With `nochilddrag`:

```html
<drag-scroll nochilddrag>
  <div style="width: 1200px; min-height: 320px;">Only empty container space starts panning</div>
</drag-scroll>
```

### Public API

- `nochilddrag`: when present, starting a pointer gesture on child content does not begin drag-to-scroll

## Browser Support

This package currently targets current evergreen desktop and mobile browsers with native ES modules and modern DOM/CSS features.

- Build target: `ES2022`
- Distribution format: ESM only
- Primary targets: current Chrome, Edge, Firefox, Safari, iOS Safari, and Chrome for Android
- Interactions rely on modern features such as pointer events, `beforeinput`, `:focus-visible`, and `color-mix()`

If you need wider or older browser coverage, test your exact support matrix before shipping and add app-level fallbacks where needed.

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
- In `transform-box`, this gate follows the `selected` state on the transform box itself, so wrapper-managed selection works without extra wiring.

#### `snap-step`

Use `snap-step` to snap move and resize dragging to a grid from the stage origin.

- Default: `0`
- Values less than or equal to `0` disable snapping.
- Snapping only affects pointer move and resize dragging, not rotate or other movement.

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
- Set `selected` on the `drag-box` when some outer element owns selection state.

#### `snap-step`

Use `snap-step` to snap dragged positions to the nearest multiple of a grid step from the host origin.

- Default: `0`
- Values less than or equal to `0` disable snapping.
- Snapped positions are still clamped to bounds when `clamp-to-bounds` is enabled.
- `transform-box` exposes the same attribute and passes it through to its internal `drag-box` for move dragging.

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

angle-input {
  --angle-input-size: 160px;
  --angle-input-track-stroke: rgba(15, 84, 73, 0.22);
  --angle-input-value-stroke: #0f5449;
  --angle-input-handle-fill: #fff;
  --angle-input-handle-stroke: #0f5449;
  --angle-input-focus-ring: 0 0 0 4px rgba(37, 99, 235, 0.2);
  --angle-input-value-text-color: #17322d;
  --angle-input-value-text-font: 600 0.8rem/1.2 "Segoe UI", sans-serif;
  --angle-input-value-text-background: transparent;
  --angle-input-value-text-padding: 0;
  --angle-input-value-text-radius: 4px;
  --angle-input-value-text-offset-x: 0px;
  --angle-input-value-text-offset-y: 0px;
  --angle-input-step-tick-length: 6;
  --angle-input-step-tick-stroke: rgba(15, 84, 73, 0.7);
  --angle-input-step-tick-stroke-width: 1.5;
  --angle-input-step-tick-opacity: 1;
  --angle-input-step-value-text-color: #17322d;
  --angle-input-step-value-text-font: 600 0.65rem/1.2 "Segoe UI", sans-serif;
  --angle-input-step-value-text-background: transparent;
  --angle-input-step-value-text-padding: 0;
  --angle-input-step-value-text-radius: 4px;
  --angle-input-step-value-text-offset-x: 0px;
  --angle-input-step-value-text-offset-y: 0px;
}

anchor-point-input {
  --anchor-point-input-size: 120px;
  --anchor-point-input-guide-stroke: rgba(15, 84, 73, 0.3);
  --anchor-point-input-handle-fill: rgba(15, 84, 73, 0.18);
  --anchor-point-input-active-handle-fill: #0f5449;
  --anchor-point-input-disabled-handle-fill: rgba(15, 84, 73, 0.12);
  --anchor-point-input-disabled-handle-stroke: rgba(15, 84, 73, 0.28);
  --anchor-point-input-disabled-handle-opacity: 0.22;
  --anchor-point-input-focus-ring: 0 0 0 4px rgba(37, 99, 235, 0.2);
}

circular-input {
  --circular-input-size: 320px;
  --circular-input-sector-stroke: rgba(15, 84, 73, 0.35);
  --circular-input-line-stroke: rgba(15, 84, 73, 0.28);
  --circular-input-handle-fill: #ffffff;
  --circular-input-handle-stroke-width: 2;
  --circular-input-value-handle-fill: #0f5449;
  --circular-input-value-handle-stroke-width: 2;
  --circular-input-radius-handle-fill: #ffffff;
  --circular-input-radius-handle-stroke: #0f5449;
  --circular-input-radius-handle-stroke-width: 2;
  --circular-input-height-handle-fill: #ffffff;
  --circular-input-height-handle-stroke: #d8682d;
  --circular-input-height-handle-stroke-width: 2;
  --circular-input-start-angle-handle-fill: #d8682d;
  --circular-input-start-angle-handle-stroke-width: 2;
  --circular-input-focus-ring-stroke-width: 3;
}
```

## Demo

Run the demo locally:

```bash
npm run dev
```

The demo includes:

- standalone `drag-scroll` with pointer and touch panning
- standalone `number-aware-input`
- whole-value constrained token cycling
- pattern-aware constrained token examples
- suggestion dropdown token selection
- pair-locked numeric stepping
- partial readonly modes for text-only and number-only protection
- standalone `selection-box`
- standalone `anchor-point-input`
- standalone `circular-input` POC
- `multiple` mode with plain click toggle and modifier-based multi-select
- drag-select enabled rectangle selection
- standalone `drag-box`
- standalone `transform-box`
- a combined stage where `selection-box`, `drag-box`, and `transform-box` work together with selection-first movement and layer ordering
