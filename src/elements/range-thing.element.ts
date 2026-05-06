import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

export type RangeThingStep = number | number[];
export type RangeThingItemRule = 'even-odd' | 'before' | 'after' | 'center';
export type RangeThingCrossingRule = 'none' | 'allow';
export type RangeThingSpaceRule = 'none' | 'pearl-necklace';
export type RangeThingDirection = 'ltr' | 'rtl';
export type RangeThingAnimation = 'none' | 'slide';
export type RangeThingChangeSource = 'pointer' | 'keyboard';

export interface RangeThingChangeDetail {
  index: number;
  currentValue: number;
  allValues: number[];
  source: RangeThingChangeSource;
}

interface RangeThingItemState {
  element: CaskoUiRangeItemElement;
  value: number;
  handlePath: string;
  tickPath: string;
  offset: number;
}

interface RangeThingPoint {
  x: number;
  y: number;
}

interface RangeThingInteraction {
  pointerId: number;
  index: number;
  captureElement: HTMLElement;
  startedOnHandle: boolean;
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

interface RangeThingAnimationState {
  frameId: number;
  index: number;
}

const VIEW_BOX_SIZE = 100;
const DEFAULT_TRACK_PATH = 'M 8 50 L 92 50';
const DEFAULT_TICK_HALF_LENGTH = 5;
const POINTER_MOVE_TOLERANCE = 4;
const DEFAULT_ITEM_DISTANCE = 28;
const SNAP_EPSILON = 1e-6;

function parseStepValue(value: unknown): RangeThingStep {
  if (Array.isArray(value)) {
    const numbers = value
      .map((entry) => (typeof entry === 'number' ? entry : Number(String(entry).trim())))
      .filter((entry) => Number.isFinite(entry));
    return numbers.length > 0 ? numbers : 1;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 1;
  }

  if (typeof value !== 'string') {
    return 1;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 1;
  }

  if (trimmedValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedValue);
      return parseStepValue(parsed);
    } catch {
      return 1;
    }
  }

  if (trimmedValue.includes(',')) {
    return parseStepValue(trimmedValue.split(','));
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 1;
}

function toStepAttribute(value: RangeThingStep): string {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getStepPrecision(step: RangeThingStep): number {
  const entries = Array.isArray(step) ? step : [step];
  return entries.reduce((precision, entry) => {
    const text = String(entry);
    const decimalIndex = text.indexOf('.');
    return decimalIndex === -1 ? precision : Math.max(precision, text.length - decimalIndex - 1);
  }, 0);
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2;
}

@customElement('range-item')
export class CaskoUiRangeItemElement extends LitElement {
  @property({ type: Number, reflect: true })
  value = 0;

  @property({ type: Number, reflect: true })
  offset = 0;

  @property({ type: String, attribute: 'handle-path', reflect: true })
  handlePath = '';

  @property({ type: String, attribute: 'tick-path', reflect: true })
  tickPath = '';

  render() {
    return html`<slot></slot>`;
  }

  static styles = css`
    :host {
      display: none;
      position: absolute;
      left: var(--range-item-x, 0%);
      top: var(--range-item-y, 0%);
      transform: translate(-50%, -50%) translate(var(--range-item-offset-x, 0px), var(--range-item-offset-y, 0px));
      z-index: 1;
      pointer-events: none;
    }

    :host([data-range-thing-active]) {
      display: grid;
      place-items: center;
    }
  `;
}

@customElement('range-thing')
export class CaskoUiRangeThingElement extends LitElement {
  @property({ type: Number })
  min = 0;

  @property({ type: Number })
  max = 100;

  @property({
    converter: {
      fromAttribute: (value) => parseStepValue(value),
      toAttribute: (value) => toStepAttribute(parseStepValue(value)),
    },
  })
  step: RangeThingStep = 1;

  @property({ type: Boolean, attribute: 'step-lock' })
  stepLock = false;

  @property({ type: String, attribute: 'track-path' })
  trackPath = '';

  @property({ type: String, attribute: 'handle-path' })
  handlePath = '';

  @property({ type: String, attribute: 'tick-path' })
  tickPath = '';

  @property({ type: String, attribute: 'item-rule', reflect: true })
  itemRule: RangeThingItemRule = 'center';

  @property({ type: String, attribute: 'crossing-rule', reflect: true })
  crossingRule: RangeThingCrossingRule = 'none';

  @property({ type: String, attribute: 'space-rule', reflect: true })
  spaceRule: RangeThingSpaceRule = 'none';

  @property({ type: String, reflect: true })
  direction: RangeThingDirection = 'ltr';

  @property({ type: String, reflect: true })
  animation: RangeThingAnimation = 'none';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @query('.control')
  private controlElement?: HTMLDivElement;

  @query('.measure-path')
  private measurePathElement?: SVGPathElement;

  private childObserver?: MutationObserver;
  private interaction?: RangeThingInteraction;
  private pendingKeyboardCommit = false;
  private activeIndex = 0;
  private animationState?: RangeThingAnimationState;

  connectedCallback(): void {
    super.connectedCallback();
    this.childObserver = new MutationObserver(() => {
      this.requestUpdate();
      this.#syncSlottedItems();
    });
    this.childObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'offset', 'handle-path', 'tick-path'],
    });
  }

  disconnectedCallback(): void {
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.#cancelAnimation();
    super.disconnectedCallback();
  }

  protected updated(): void {
    this.#syncSlottedItems();
  }

  focus(options?: FocusOptions): void {
    this.controlElement?.focus(options);
  }

  render() {
    const activeItems = this.#getActiveItems();
    const normalizedActiveIndex = this.#getActiveIndex(activeItems.length);
    const effectiveTrackPath = this.#getEffectiveTrackPath();

    return html`
      <div
        class="field ${this.disabled ? 'disabled' : ''}">
        <div
          class="control"
          tabindex=${this.disabled ? -1 : 0}
          role="group"
          aria-label="Range thing"
          aria-disabled=${String(this.disabled)}
          @pointerdown=${this.#onPointerDown}
          @pointermove=${this.#onPointerMove}
          @pointerup=${this.#onPointerUp}
          @pointercancel=${this.#onPointerCancel}
          @lostpointercapture=${this.#onLostPointerCapture}
          @keydown=${this.#onKeyDown}
          @keyup=${this.#onKeyUp}>
          <svg class="canvas" viewBox=${`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`} aria-hidden="true">
            <path class="track" d=${effectiveTrackPath}></path>
            <path class="measure-path" d=${effectiveTrackPath}></path>
            ${activeItems.map((item) => this.#renderTick(item))}
            ${activeItems.map((item, index) => this.#renderHandle(item, index, normalizedActiveIndex))}
          </svg>
          <slot @slotchange=${this.#onSlotChange}></slot>
        </div>
      </div>
    `;
  }

  #renderHandle(item: RangeThingItemState, index: number, activeIndex: number) {
    const layout = this.#getLayoutForValue(item.value);
    const handlePath = item.handlePath.trim() || this.handlePath.trim();
    const isActive = index === activeIndex;

    if (handlePath.length > 0) {
      return svg`
        <path
          class=${`handle ${isActive ? 'active' : ''}`}
          d=${handlePath}
          data-handle-index=${String(index)}
          transform=${`translate(${layout.point.x} ${layout.point.y})`}></path>
      `;
    }

    return svg`
      <circle
        class=${`handle ${isActive ? 'active' : ''}`}
        data-handle-index=${String(index)}
        cx=${layout.point.x}
        cy=${layout.point.y}
        r="4"></circle>
    `;
  }

  #renderTick(item: RangeThingItemState) {
    const layout = this.#getLayoutForValue(item.value);
    const tickPath = item.tickPath.trim() || this.tickPath.trim();

    if (tickPath.length > 0) {
      return svg`
        <path
          class="tick"
          d=${tickPath}
          transform=${`translate(${layout.point.x} ${layout.point.y})`}></path>
      `;
    }

    return svg`
      <line
        class="tick"
        x1=${layout.point.x - layout.normal.x * DEFAULT_TICK_HALF_LENGTH}
        y1=${layout.point.y - layout.normal.y * DEFAULT_TICK_HALF_LENGTH}
        x2=${layout.point.x + layout.normal.x * DEFAULT_TICK_HALF_LENGTH}
        y2=${layout.point.y + layout.normal.y * DEFAULT_TICK_HALF_LENGTH}></line>
    `;
  }

  #onSlotChange = () => {
    this.requestUpdate();
    this.#syncSlottedItems();
  };

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;
    const captureElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    if (!captureElement) return;

    const activeItems = this.#getActiveItems();
    if (activeItems.length === 0) return;

    this.#cancelAnimation();
    captureElement.focus();
    captureElement.setPointerCapture(event.pointerId);

    const handleIndex = this.#getHandleIndexFromPath(event.composedPath());
    const index = handleIndex ?? this.#findNearestHandleIndexForLength(this.#getNearestLengthForEvent(event), activeItems);
    this.activeIndex = this.#getActiveIndex(activeItems.length, index);
    this.interaction = {
      pointerId: event.pointerId,
      index: this.activeIndex,
      captureElement,
      startedOnHandle: handleIndex !== null,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };

    if (handleIndex !== null) {
      this.#setValueFromPointer(event, this.activeIndex, 'pointer');
    }

    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent) => {
    const interaction = this.interaction;
    if (!interaction || interaction.pointerId !== event.pointerId) return;

    if (
      !interaction.moved &&
      Math.hypot(event.clientX - interaction.startClientX, event.clientY - interaction.startClientY) > POINTER_MOVE_TOLERANCE
    ) {
      interaction.moved = true;
    }

    if (!interaction.moved) return;
    this.#setValueFromPointer(event, interaction.index, 'pointer');
  };

  #onPointerUp = (event: PointerEvent) => {
    const interaction = this.interaction;
    if (!interaction || interaction.pointerId !== event.pointerId) return;

    this.interaction = undefined;
    this.#releasePointerCapture(interaction.captureElement, event.pointerId);

    if (!interaction.moved && !interaction.startedOnHandle) {
      const targetValue = this.#getValueFromLength(this.#getNearestLengthForEvent(event));
      if (this.animation === 'slide') {
        this.#animateToValue(interaction.index, targetValue);
      } else {
        this.#applyResolvedMove(interaction.index, targetValue, 'pointer');
        this.#emitCommit('pointer');
      }
      return;
    }

    this.#emitCommit('pointer');
  };

  #onPointerCancel = (event: PointerEvent) => {
    const interaction = this.interaction;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    this.interaction = undefined;
    this.#releasePointerCapture(interaction.captureElement, event.pointerId);
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    const interaction = this.interaction;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    this.interaction = undefined;
    this.#emitCommit('pointer');
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;
    const activeItems = this.#getActiveItems();
    if (activeItems.length === 0) return;

    const handledKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
    if (!handledKeys.includes(event.key)) return;

    const index = this.#getActiveIndex(activeItems.length);
    const values = activeItems.map((item) => item.value);
    const currentValue = values[index];
    const nextValue = this.#getKeyboardValue(event.key, currentValue);
    if (nextValue === undefined) return;

    event.preventDefault();
    this.pendingKeyboardCommit = true;
    this.activeIndex = index;
    this.#applyResolvedMove(index, nextValue, 'keyboard');
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.pendingKeyboardCommit) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
      return;
    }

    this.pendingKeyboardCommit = false;
    this.#emitCommit('keyboard');
  };

  #getKeyboardValue(key: string, currentValue: number): number | undefined {
    const range = this.#getRange();
    const step = this.#getNormalizedStep();
    const isForward =
      key === 'ArrowRight' || key === 'ArrowUp' || key === 'PageUp'
        ? this.direction === 'ltr'
        : key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown'
          ? this.direction !== 'ltr'
          : false;
    const isBackward =
      key === 'ArrowRight' || key === 'ArrowUp' || key === 'PageUp'
        ? this.direction !== 'ltr'
        : key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown'
          ? this.direction === 'ltr'
          : false;

    if (key === 'Home') {
      return range.min;
    }

    if (key === 'End') {
      return range.max;
    }

    if (Array.isArray(step)) {
      const currentIndex = this.#findNearestAllowedValueIndex(currentValue, step);
      const delta = key === 'PageUp' || key === 'PageDown' ? 10 : 1;
      if (isForward) {
        return step[Math.min(step.length - 1, currentIndex + delta)];
      }
      if (isBackward) {
        return step[Math.max(0, currentIndex - delta)];
      }
      return currentValue;
    }

    const baseStep = step > 0 ? step : 1;
    const multiplier = key === 'PageUp' || key === 'PageDown' ? 10 : 1;
    const direction = isForward ? 1 : isBackward ? -1 : 0;
    return currentValue + baseStep * multiplier * direction;
  }

  #setValueFromPointer(event: PointerEvent, index: number, source: RangeThingChangeSource) {
    const nextValue = this.#getValueFromLength(this.#getNearestLengthForEvent(event));
    this.#applyResolvedMove(index, nextValue, source);
  }

  #applyResolvedMove(index: number, targetValue: number, source: RangeThingChangeSource) {
    const activeItems = this.#getActiveItems();
    if (activeItems.length === 0 || index < 0 || index >= activeItems.length) {
      return;
    }

    const nextValues = activeItems.map((item) => item.value);
    const movedValue = this.#normalizeFreeValue(targetValue);

    if (this.crossingRule === 'allow') {
      nextValues[index] = this.#normalizeFinalValue(movedValue);
    } else if (this.spaceRule === 'pearl-necklace') {
      this.#applyPearlNecklace(nextValues, index, movedValue);
    } else {
      nextValues[index] = this.#clampAgainstNeighbors(nextValues, index, movedValue);
    }

    const finalValues = nextValues.map((value) => this.#normalizeFinalValue(value));
    const changed = finalValues.some((value, itemIndex) => !Object.is(value, activeItems[itemIndex].value));
    if (!changed) return;

    activeItems.forEach((item, itemIndex) => {
      item.element.value = finalValues[itemIndex];
      item.element.setAttribute('value', String(finalValues[itemIndex]));
    });

    this.activeIndex = index;
    this.requestUpdate();
    this.#emitChange(source);
  }

  #applyPearlNecklace(values: number[], index: number, targetValue: number) {
    const range = this.#getRange();
    const candidate = clamp(targetValue, range.min, range.max);
    const movingForward = candidate > values[index];
    const movingBackward = candidate < values[index];
    values[index] = candidate;

    if (!movingForward && !movingBackward) {
      return;
    }

    if (movingForward) {
      for (let itemIndex = index + 1; itemIndex < values.length; itemIndex += 1) {
        values[itemIndex] = Math.max(values[itemIndex], values[itemIndex - 1]);
      }
      for (let itemIndex = values.length - 1; itemIndex >= 0; itemIndex -= 1) {
        values[itemIndex] = Math.min(values[itemIndex], range.max);
        if (itemIndex > 0) {
          values[itemIndex - 1] = Math.min(values[itemIndex - 1], values[itemIndex]);
        }
      }
      return;
    }

    for (let itemIndex = index - 1; itemIndex >= 0; itemIndex -= 1) {
      values[itemIndex] = Math.min(values[itemIndex], values[itemIndex + 1]);
    }
    for (let itemIndex = 0; itemIndex < values.length; itemIndex += 1) {
      values[itemIndex] = Math.max(values[itemIndex], range.min);
      if (itemIndex + 1 < values.length) {
        values[itemIndex + 1] = Math.max(values[itemIndex + 1], values[itemIndex]);
      }
    }
  }

  #clampAgainstNeighbors(values: number[], index: number, value: number): number {
    if (this.crossingRule === 'allow') {
      return value;
    }

    const range = this.#getRange();
    const previous = index > 0 ? values[index - 1] : range.min;
    const next = index + 1 < values.length ? values[index + 1] : range.max;
    return clamp(value, previous, next);
  }

  #normalizeFreeValue(value: number): number {
    const range = this.#getRange();
    const clampedValue = clamp(value, range.min, range.max);
    if (this.stepLock) {
      return this.#snapValue(clampedValue);
    }
    return this.#roundValue(clampedValue);
  }

  #normalizeFinalValue(value: number): number {
    return this.stepLock ? this.#snapValue(value) : this.#roundValue(clamp(value, this.#getRange().min, this.#getRange().max));
  }

  #snapValue(value: number): number {
    const step = this.#getNormalizedStep();
    const range = this.#getRange();

    if (Array.isArray(step)) {
      if (step.length === 0) {
        return this.#roundValue(clamp(value, range.min, range.max));
      }
      return step.reduce((closest, entry) => {
        return Math.abs(entry - value) < Math.abs(closest - value) ? entry : closest;
      }, step[0]);
    }

    if (!(step > 0)) {
      return this.#roundValue(clamp(value, range.min, range.max));
    }

    const snapped = range.min + Math.round((value - range.min) / step) * step;
    return this.#roundValue(clamp(snapped, range.min, range.max));
  }

  #roundValue(value: number): number {
    return roundToPrecision(value, Math.max(6, getStepPrecision(this.#getNormalizedStep())));
  }

  #getNormalizedStep(): RangeThingStep {
    const range = this.#getRange();
    const parsedStep = parseStepValue(this.step);

    if (Array.isArray(parsedStep)) {
      return Array.from(
        new Set(
          parsedStep
            .map((entry) => clamp(entry, range.min, range.max))
            .filter((entry) => Number.isFinite(entry))
            .sort((left, right) => left - right),
        ),
      );
    }

    return parsedStep > 0 ? parsedStep : 1;
  }

  #findNearestAllowedValueIndex(value: number, allowedValues: number[]): number {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    allowedValues.forEach((entry, index) => {
      const distance = Math.abs(entry - value);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  #emitChange(source: RangeThingChangeSource) {
    this.#emitEvent('range-thing-change', this.#createDetail(source));
  }

  #emitCommit(source: RangeThingChangeSource) {
    this.#emitEvent('range-thing-commit', this.#createDetail(source));
  }

  #createDetail(source: RangeThingChangeSource): RangeThingChangeDetail {
    const activeItems = this.#getActiveItems();
    const index = this.#getActiveIndex(activeItems.length);
    const allValues = activeItems.map((item) => item.value);

    return {
      index,
      currentValue: allValues[index] ?? Number.NaN,
      allValues,
      source,
    };
  }

  #emitEvent<T>(eventName: string, detail: T) {
    this.dispatchEvent(
      new CustomEvent<T>(eventName, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  #getRange() {
    const min = Number.isFinite(this.min) ? this.min : 0;
    const max = Number.isFinite(this.max) ? this.max : 100;
    return min <= max ? { min, max } : { min: max, max: min };
  }

  #getRangeItems(): CaskoUiRangeItemElement[] {
    return Array.from(this.children).filter((child): child is CaskoUiRangeItemElement => child.tagName === 'RANGE-ITEM');
  }

  #getActiveItems(): RangeThingItemState[] {
    const range = this.#getRange();
    return this.#getRangeItems()
      .map((element) => ({
        element,
        value: typeof element.value === 'number' ? element.value : Number(element.getAttribute('value') ?? '0'),
        handlePath: element.handlePath ?? element.getAttribute('handle-path') ?? '',
        tickPath: element.tickPath ?? element.getAttribute('tick-path') ?? '',
        offset: typeof element.offset === 'number' ? element.offset : Number(element.getAttribute('offset') ?? '0'),
      }))
      .filter((item) => Number.isFinite(item.value) && item.value >= range.min && item.value <= range.max)
      .map((item) => ({
        ...item,
        value: this.#normalizeFinalValue(item.value),
        offset: Number.isFinite(item.offset) ? item.offset : 0,
      }));
  }

  #getEffectiveTrackPath(): string {
    const trackPath = this.trackPath.trim();
    return trackPath.length > 0 ? trackPath : DEFAULT_TRACK_PATH;
  }

  #syncSlottedItems() {
    const activeItems = this.#getActiveItems();
    const activeSet = new Set(activeItems.map((item) => item.element));
    const spacing = this.#getItemDistance();

    this.#getRangeItems().forEach((element) => {
      if (!activeSet.has(element)) {
        element.removeAttribute('data-range-thing-active');
        element.style.removeProperty('--range-item-x');
        element.style.removeProperty('--range-item-y');
        element.style.removeProperty('--range-item-offset-x');
        element.style.removeProperty('--range-item-offset-y');
        return;
      }

      const index = activeItems.findIndex((item) => item.element === element);
      const item = activeItems[index];
      const layout = this.#getLayoutForValue(item.value);
      const direction = this.#getItemDirection(index);
      const distance = direction === 0 ? item.offset : spacing * direction + item.offset;

      element.toggleAttribute('data-range-thing-active', true);
      element.style.setProperty('--range-item-x', `${(layout.point.x / VIEW_BOX_SIZE) * 100}%`);
      element.style.setProperty('--range-item-y', `${(layout.point.y / VIEW_BOX_SIZE) * 100}%`);
      element.style.setProperty('--range-item-offset-x', `${layout.normal.x * distance}px`);
      element.style.setProperty('--range-item-offset-y', `${layout.normal.y * distance}px`);
    });
  }

  #getLayoutForValue(value: number): { point: RangeThingPoint; normal: RangeThingPoint; length: number } {
    const path = this.measurePathElement;
    if (!path) {
      return {
        point: { x: VIEW_BOX_SIZE / 2, y: VIEW_BOX_SIZE / 2 },
        normal: { x: 0, y: -1 },
        length: 0,
      };
    }

    const totalLength = path.getTotalLength();
    const length = totalLength * this.#valueToRatio(value);
    const point = path.getPointAtLength(length);
    const tangent = this.#getTangentAtLength(length, totalLength);

    return {
      point: { x: point.x, y: point.y },
      normal: { x: -tangent.y, y: tangent.x },
      length,
    };
  }

  #getTangentAtLength(length: number, totalLength: number): RangeThingPoint {
    const path = this.measurePathElement;
    if (!path || totalLength <= 0) {
      return { x: 1, y: 0 };
    }

    const delta = Math.max(0.1, totalLength / 200);
    const previousPoint = path.getPointAtLength(Math.max(0, length - delta));
    const nextPoint = path.getPointAtLength(Math.min(totalLength, length + delta));
    const dx = nextPoint.x - previousPoint.x;
    const dy = nextPoint.y - previousPoint.y;
    const magnitude = Math.hypot(dx, dy) || 1;

    return {
      x: dx / magnitude,
      y: dy / magnitude,
    };
  }

  #valueToRatio(value: number): number {
    const range = this.#getRange();
    if (Math.abs(range.max - range.min) < SNAP_EPSILON) {
      return 0;
    }

    const normalized = (clamp(value, range.min, range.max) - range.min) / (range.max - range.min);
    return this.direction === 'rtl' ? 1 - normalized : normalized;
  }

  #ratioToValue(ratio: number): number {
    const range = this.#getRange();
    const normalizedRatio = this.direction === 'rtl' ? 1 - ratio : ratio;
    return range.min + normalizedRatio * (range.max - range.min);
  }

  #getNearestLengthForEvent(event: PointerEvent): number {
    const path = this.measurePathElement;
    const control = this.controlElement;
    if (!path || !control) {
      return 0;
    }

    const bounds = control.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return 0;
    }

    const localPoint = {
      x: ((event.clientX - bounds.left) / bounds.width) * VIEW_BOX_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * VIEW_BOX_SIZE,
    };

    return this.#getNearestLengthForPoint(localPoint);
  }

  #getNearestLengthForPoint(point: RangeThingPoint): number {
    const path = this.measurePathElement;
    if (!path) {
      return 0;
    }

    const totalLength = path.getTotalLength();
    if (totalLength <= 0) {
      return 0;
    }

    let bestLength = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    const samples = Math.max(50, Math.ceil(totalLength * 1.5));

    for (let index = 0; index <= samples; index += 1) {
      const length = (index / samples) * totalLength;
      const samplePoint = path.getPointAtLength(length);
      const distance = Math.hypot(samplePoint.x - point.x, samplePoint.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLength = length;
      }
    }

    let window = totalLength / samples;
    for (let pass = 0; pass < 5; pass += 1) {
      const start = Math.max(0, bestLength - window);
      const end = Math.min(totalLength, bestLength + window);
      for (let index = 0; index <= 12; index += 1) {
        const length = start + ((end - start) * index) / 12;
        const samplePoint = path.getPointAtLength(length);
        const distance = Math.hypot(samplePoint.x - point.x, samplePoint.y - point.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestLength = length;
        }
      }
      window /= 3;
    }

    return bestLength;
  }

  #getValueFromLength(length: number): number {
    const path = this.measurePathElement;
    if (!path) {
      return this.#getRange().min;
    }

    const totalLength = path.getTotalLength();
    if (totalLength <= 0) {
      return this.#getRange().min;
    }

    return this.#ratioToValue(clamp(length / totalLength, 0, 1));
  }

  #findNearestHandleIndexForLength(length: number, activeItems: RangeThingItemState[]): number {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    activeItems.forEach((item, index) => {
      const itemLength = this.#getLayoutForValue(item.value).length;
      const distance = Math.abs(itemLength - length);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return closestIndex;
  }

  #getHandleIndexFromPath(path: EventTarget[]): number | null {
    for (const entry of path) {
      if (!(entry instanceof Element)) continue;
      const rawValue = entry.getAttribute('data-handle-index');
      if (rawValue === null) continue;
      const index = Number(rawValue);
      return Number.isInteger(index) ? index : null;
    }

    return null;
  }

  #releasePointerCapture(captureElement: HTMLElement, pointerId: number) {
    if (captureElement.hasPointerCapture(pointerId)) {
      captureElement.releasePointerCapture(pointerId);
    }
  }

  #animateToValue(index: number, targetValue: number) {
    const activeItems = this.#getActiveItems();
    const startValue = activeItems[index]?.value;
    if (!Number.isFinite(startValue)) {
      this.#emitCommit('pointer');
      return;
    }

    this.#cancelAnimation();
    const startTime = performance.now();
    const duration = 220;

    const step = (timestamp: number) => {
      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      const nextValue = startValue + (targetValue - startValue) * eased;
      this.#applyResolvedMove(index, nextValue, 'pointer');

      if (progress >= 1) {
        this.animationState = undefined;
        this.#emitCommit('pointer');
        return;
      }

      this.animationState = {
        frameId: requestAnimationFrame(step),
        index,
      };
    };

    this.animationState = {
      frameId: requestAnimationFrame(step),
      index,
    };
  }

  #cancelAnimation() {
    if (!this.animationState) return;
    cancelAnimationFrame(this.animationState.frameId);
    this.animationState = undefined;
  }

  #getActiveIndex(length: number, preferredIndex = this.activeIndex): number {
    if (length <= 0) {
      return 0;
    }

    return clamp(preferredIndex, 0, length - 1);
  }

  #getItemDirection(index: number): -1 | 0 | 1 {
    switch (this.itemRule) {
      case 'before':
        return -1;
      case 'after':
        return 1;
      case 'even-odd':
        return index % 2 === 0 ? -1 : 1;
      case 'center':
      default:
        return 0;
    }
  }

  #getItemDistance(): number {
    const parsedValue = Number.parseFloat(getComputedStyle(this).getPropertyValue('--range-thing-item-distance'));
    return Number.isFinite(parsedValue) ? parsedValue : DEFAULT_ITEM_DISTANCE;
  }

  static styles = css`
    :host {
      display: inline-block;
      width: min(100%, 520px);
      min-width: 220px;
      --range-thing-track-stroke: rgba(0, 0, 0, 0.18);
      --range-thing-track-stroke-width: 3;
      --range-thing-handle-fill: #ffffff;
      --range-thing-handle-stroke: #0f5449;
      --range-thing-handle-stroke-width: 1.5;
      --range-thing-handle-active-fill: #d8682d;
      --range-thing-handle-active-stroke: #d8682d;
      --range-thing-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.18);
      --range-thing-item-distance: 28px;
      --range-thing-disabled-opacity: 0.5;
    }

    .field {
      display: grid;
      min-width: 0;
    }

    .control {
      position: relative;
      min-height: 140px;
      outline: none;
      touch-action: none;
      user-select: none;
    }

    .control:focus-visible {
      box-shadow: var(--range-thing-focus-ring);
      border-radius: 16px;
    }

    .disabled .control {
      opacity: var(--range-thing-disabled-opacity);
      cursor: default;
    }

    .canvas {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .track,
    .tick,
    .measure-path {
      fill: none;
      vector-effect: non-scaling-stroke;
    }

    .track {
      stroke: var(--range-thing-track-stroke);
      stroke-width: var(--range-thing-track-stroke-width);
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .measure-path {
      opacity: 0;
      pointer-events: none;
    }

    .tick {
      stroke: var(--range-thing-tick-stroke, rgba(15, 84, 73, 0.55));
      stroke-width: var(--range-thing-tick-stroke-width, 1.5);
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }

    .handle {
      fill: var(--range-thing-handle-fill);
      stroke: var(--range-thing-handle-stroke);
      stroke-width: var(--range-thing-handle-stroke-width);
      vector-effect: non-scaling-stroke;
      cursor: pointer;
      transition: fill 120ms ease, stroke 120ms ease;
    }

    .handle.active {
      fill: var(--range-thing-handle-active-fill);
      stroke: var(--range-thing-handle-active-stroke);
    }
  `;
}

export default CaskoUiRangeThingElement;

declare global {
  interface HTMLElementTagNameMap {
    'range-item': CaskoUiRangeItemElement;
    'range-thing': CaskoUiRangeThingElement;
  }
}
