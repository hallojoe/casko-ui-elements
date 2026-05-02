import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, queryAll, state } from 'lit/decorators.js';

export type AnchorPointBlock = 'start' | 'center' | 'end';
export type AnchorPointInline = 'start' | 'center' | 'end';
export type AnchorPointInputChangeSource = 'pointer' | 'keyboard';
export type AnchorPointInputHandleShape = 'circle' | 'rect';
export type AnchorPointInputHoldTriggerMode = 'selected' | 'any';
export type AnchorPointInputLabelDisplay = 'visible' | 'title';
export type AnchorPointValue =
  | 'block-start-inline-start'
  | 'block-start-inline-center'
  | 'block-start-inline-end'
  | 'block-center-inline-start'
  | 'block-center-inline-center'
  | 'block-center-inline-end'
  | 'block-end-inline-start'
  | 'block-end-inline-center'
  | 'block-end-inline-end';

export interface AnchorPointInputChangeDetail {
  value: AnchorPointValue;
  block: AnchorPointBlock;
  inline: AnchorPointInline;
  source: AnchorPointInputChangeSource;
}

export interface AnchorPointInputTriggerDetail extends AnchorPointInputChangeDetail {
  triggerCount: number;
}

interface AnchorPointOption {
  value: AnchorPointValue;
  block: AnchorPointBlock;
  inline: AnchorPointInline;
  x: number;
  y: number;
  label: string;
}

interface AnchorPointTriggerState {
  value: AnchorPointValue;
  source: AnchorPointInputChangeSource;
  triggerCount: number;
  delayId?: number;
  intervalId?: number;
}

const VIEW_BOX_SIZE = 100;
const GUIDE_START = 20;
const GUIDE_CENTER = 50;
const GUIDE_END = 80;
const DEFAULT_VALUE: AnchorPointValue = 'block-center-inline-center';
const HOLD_TRIGGER_DELAY = 400;
const HOLD_TRIGGER_INTERVAL = 80;

const BLOCK_VALUES: AnchorPointBlock[] = ['start', 'center', 'end'];
const INLINE_VALUES: AnchorPointInline[] = ['start', 'center', 'end'];

const ANCHOR_POINT_OPTIONS: AnchorPointOption[] = BLOCK_VALUES.flatMap((block, blockIndex) =>
  INLINE_VALUES.map((inline, inlineIndex) => ({
    value: `block-${block}-inline-${inline}` as AnchorPointValue,
    block,
    inline,
    x: [GUIDE_START, GUIDE_CENTER, GUIDE_END][inlineIndex],
    y: [GUIDE_START, GUIDE_CENTER, GUIDE_END][blockIndex],
    label: `Block ${block}, inline ${inline}`,
  })),
);

function isAnchorPointValue(value: unknown): value is AnchorPointValue {
  return typeof value === 'string' && ANCHOR_POINT_OPTIONS.some((option) => option.value === value);
}

function disabledValuesConverter(value: unknown): AnchorPointValue[] {
  const parseEntry = (entry: unknown) => {
    const candidate = typeof entry === 'string' ? entry.trim() : String(entry).trim();
    return isAnchorPointValue(candidate) ? candidate : undefined;
  };

  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(parseEntry).filter((entry): entry is AnchorPointValue => entry !== undefined)));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    return Array.isArray(parsed) ? disabledValuesConverter(parsed) : [];
  } catch {
    return disabledValuesConverter(trimmedValue.split(','));
  }
}

@customElement('anchor-point-input')
export class CaskoUiAnchorPointInputElement extends LitElement {
  @property({ type: String })
  value: AnchorPointValue = DEFAULT_VALUE;

  @property({ type: String })
  label = '';

  @property({ type: String, attribute: 'label-display', reflect: true })
  labelDisplay: AnchorPointInputLabelDisplay = 'visible';

  @property({ type: String, attribute: 'handle-shape', reflect: true })
  handleShape: AnchorPointInputHandleShape = 'circle';

  @property({ type: String, attribute: 'handle-path' })
  handlePath = '';

  @property({ type: Boolean, attribute: 'rotate-handle' })
  rotateHandle = false;

  @property({ type: Boolean, attribute: 'hold-trigger' })
  holdTrigger = false;

  @property({ type: String, attribute: 'hold-trigger-mode', reflect: true })
  holdTriggerMode: AnchorPointInputHoldTriggerMode = 'selected';

  @property({
    attribute: 'disabled-values',
    converter: {
      fromAttribute: (value) => disabledValuesConverter(value),
      toAttribute: (value) => JSON.stringify(disabledValuesConverter(value)),
    },
  })
  disabledValues: AnchorPointValue[] = [];

  @property({ type: Boolean, attribute: 'hide-disabled-anchors' })
  hideDisabledAnchors = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @state()
  private focusedValue: AnchorPointValue = DEFAULT_VALUE;

  @queryAll('.anchor-button')
  private anchorButtons?: NodeListOf<HTMLButtonElement>;

  private triggerState?: AnchorPointTriggerState;

  connectedCallback(): void {
    super.connectedCallback();
    this.#normalizeCurrentValue();
    this.#normalizeDisabledValues();
    this.focusedValue = this.value;
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('value')) {
      this.#normalizeCurrentValue();
      this.focusedValue = this.value;
    }

    if (changedProperties.has('handleShape')) {
      this.#normalizeHandleShape();
    }

    if (changedProperties.has('holdTriggerMode')) {
      this.#normalizeHoldTriggerMode();
    }

    if (changedProperties.has('disabledValues') || changedProperties.has('hideDisabledAnchors')) {
      this.#normalizeDisabledValues();
      if (this.#isDisabledValue(this.focusedValue)) {
        this.focusedValue = this.#getFallbackFocusValue();
      }
    }

    if (changedProperties.has('disabled') && this.disabled) {
      this.focusedValue = this.value;
      this.#stopHoldTrigger();
    }
  }

  disconnectedCallback(): void {
    this.#stopHoldTrigger();
    super.disconnectedCallback();
  }

  focus(options?: FocusOptions): void {
    this.#focusButton(this.#getFocusableValue(this.focusedValue), options);
  }

  render() {
    const selectedOption = this.#getOption(this.value);
    const displayLabel = this.#getLabelDisplay() === 'visible' && this.label.trim().length > 0;
    const renderSelectedMark = !(this.hideDisabledAnchors && this.#isDisabledValue(selectedOption.value));

    return html`
      <div class="field ${this.disabled ? 'disabled' : ''}">
        ${displayLabel ? html`<div class="label">${this.label}</div>` : nothing}
        <div
          class="control"
          role="radiogroup"
          aria-label=${this.label || 'Anchor point'}
          aria-disabled=${String(this.disabled)}>
          <svg
            class="guide"
            viewBox=${`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
            aria-hidden="true">
            <rect
              class="guide-rect"
              x=${GUIDE_START}
              y=${GUIDE_START}
              width=${GUIDE_END - GUIDE_START}
              height=${GUIDE_END - GUIDE_START}></rect>
            <line class="guide-line" x1=${GUIDE_CENTER} y1=${GUIDE_START} x2=${GUIDE_CENTER} y2=${GUIDE_END}></line>
            <line class="guide-line" x1=${GUIDE_START} y1=${GUIDE_CENTER} x2=${GUIDE_END} y2=${GUIDE_CENTER}></line>
            <circle
              class="selected-mark ${renderSelectedMark ? '' : 'hidden'}"
              cx=${selectedOption.x}
              cy=${selectedOption.y}
              r="4"></circle>
          </svg>
          ${ANCHOR_POINT_OPTIONS.map((option) => this.#renderAnchorButton(option))}
        </div>
      </div>
    `;
  }

  #renderAnchorButton(option: AnchorPointOption) {
    if (this.hideDisabledAnchors && this.#isDisabledValue(option.value)) {
      return nothing;
    }

    const selected = option.value === this.value;
    const focused = option.value === this.focusedValue;
    const disabled = this.disabled || this.#isDisabledValue(option.value);

    return html`
      <button
        class="anchor-button ${this.#isDisabledValue(option.value) ? 'anchor-disabled' : ''}"
        style=${`--anchor-point-x: ${option.x}%; --anchor-point-y: ${option.y}%;`}
        type="button"
        role="radio"
        aria-label=${option.label}
        aria-checked=${String(selected)}
        aria-disabled=${String(disabled)}
        title=${option.label}
        tabindex=${!this.disabled && !disabled && focused ? 0 : -1}
        ?disabled=${disabled}
        data-value=${option.value}
        @focus=${() => {
          if (!this.#isDisabledValue(option.value)) {
            this.focusedValue = option.value;
          }
        }}
        @click=${() => this.#selectValue(option.value, 'pointer')}
        @pointerdown=${(event: PointerEvent) => this.#onAnchorPointerDown(event, option.value)}
        @pointerup=${this.#onAnchorPointerEnd}
        @pointercancel=${this.#onAnchorPointerEnd}
        @lostpointercapture=${this.#onAnchorPointerEnd}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}>
        ${this.#renderAnchorHandle(option)}
      </button>
    `;
  }

  #renderAnchorHandle(option: AnchorPointOption) {
    const handlePath = this.handlePath.trim();
    if (!handlePath) {
      return html`<span class="anchor-dot" aria-hidden="true"></span>`;
    }

    const rotation = this.rotateHandle ? this.#getHandleRotation(option) : 0;
    const transform = rotation === 0 ? 'translate(50 50)' : `translate(50 50) rotate(${rotation})`;

    return html`
      <svg class="anchor-path" viewBox="0 0 100 100" aria-hidden="true">
        <path class="anchor-path-handle" d=${handlePath} transform=${transform}></path>
      </svg>
    `;
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;

    const currentButton = event.currentTarget as HTMLButtonElement;
    const currentValue = this.#getValueFromButton(currentButton);
    if (!currentValue) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.key === ' ' && !event.repeat) {
        this.#startHoldTrigger(currentValue, 'keyboard');
      }
      this.#selectValue(currentValue, 'keyboard');
      return;
    }

    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextValue = this.#getKeyboardFocusValue(currentValue, event.key);
    this.focusedValue = nextValue;
    this.updateComplete.then(() => this.#focusButton(nextValue));
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (event.key === ' ') {
      this.#stopHoldTrigger();
    }
  };

  #onAnchorPointerDown(event: PointerEvent, value: AnchorPointValue) {
    if (this.disabled || this.#isDisabledValue(value)) return;

    const button = event.currentTarget as HTMLButtonElement;
    button.setPointerCapture(event.pointerId);
    this.#startHoldTrigger(value, 'pointer');
  }

  #onAnchorPointerEnd = () => {
    this.#stopHoldTrigger();
  };

  #selectValue(value: AnchorPointValue, source: AnchorPointInputChangeSource) {
    if (this.disabled) return;

    const normalizedValue = this.#normalizeValue(value);
    if (this.#isDisabledValue(normalizedValue)) return;

    this.focusedValue = normalizedValue;
    if (normalizedValue === this.value) return;

    this.value = normalizedValue;
    const detail = this.#createDetail(source);
    this.#emitEvent('anchor-point-input-change', detail);
    this.#emitEvent('anchor-point-input-commit', detail);
  }

  #getKeyboardFocusValue(value: AnchorPointValue, key: string): AnchorPointValue {
    const enabledOptions = this.#getEnabledOptions();
    if (enabledOptions.length === 0) {
      return this.focusedValue;
    }

    const option = this.#getOption(value);
    const blockIndex = BLOCK_VALUES.indexOf(option.block);
    const inlineIndex = INLINE_VALUES.indexOf(option.inline);

    if (key === 'Home') {
      return enabledOptions[0].value;
    }

    if (key === 'End') {
      return enabledOptions[enabledOptions.length - 1].value;
    }

    const nextBlockIndex =
      key === 'ArrowUp' ? Math.max(0, blockIndex - 1) : key === 'ArrowDown' ? Math.min(2, blockIndex + 1) : blockIndex;
    const nextInlineIndex =
      key === 'ArrowLeft'
        ? Math.max(0, inlineIndex - 1)
        : key === 'ArrowRight'
          ? Math.min(2, inlineIndex + 1)
          : inlineIndex;

    const targetValue = ANCHOR_POINT_OPTIONS[nextBlockIndex * INLINE_VALUES.length + nextInlineIndex].value;
    return this.#getNearestEnabledValueOnAxis(value, targetValue, key, enabledOptions);
  }

  #focusButton(value: AnchorPointValue, options?: FocusOptions) {
    const button = Array.from(this.anchorButtons ?? []).find((element) => this.#getValueFromButton(element) === value);
    button?.focus(options);
  }

  #getValueFromButton(button: HTMLButtonElement): AnchorPointValue | undefined {
    const value = button.dataset.value;
    return this.#isValidValue(value) ? value : undefined;
  }

  #normalizeCurrentValue() {
    const normalizedValue = this.#normalizeValue(this.value);
    if (normalizedValue !== this.value) {
      this.value = normalizedValue;
    }
  }

  #normalizeValue(value: unknown): AnchorPointValue {
    return this.#isValidValue(value) ? value : DEFAULT_VALUE;
  }

  #isValidValue(value: unknown): value is AnchorPointValue {
    return isAnchorPointValue(value);
  }

  #getOption(value: AnchorPointValue): AnchorPointOption {
    return ANCHOR_POINT_OPTIONS.find((option) => option.value === this.#normalizeValue(value)) ?? ANCHOR_POINT_OPTIONS[4];
  }

  #normalizeDisabledValues() {
    const normalizedValues = disabledValuesConverter(this.disabledValues);
    if (
      normalizedValues.length !== this.disabledValues.length ||
      normalizedValues.some((value, index) => value !== this.disabledValues[index])
    ) {
      this.disabledValues = normalizedValues;
    }
  }

  #isDisabledValue(value: AnchorPointValue): boolean {
    return disabledValuesConverter(this.disabledValues).includes(value);
  }

  #getEnabledOptions(): AnchorPointOption[] {
    return ANCHOR_POINT_OPTIONS.filter((option) => !this.#isDisabledValue(option.value));
  }

  #getFallbackFocusValue(): AnchorPointValue {
    if (!this.#isDisabledValue(this.value)) {
      return this.value;
    }

    return this.#getEnabledOptions()[0]?.value ?? this.value;
  }

  #getFocusableValue(value: AnchorPointValue): AnchorPointValue {
    return this.#isDisabledValue(value) ? this.#getFallbackFocusValue() : value;
  }

  #getNearestEnabledValue(
    targetValue: AnchorPointValue,
    key: string,
    enabledOptions: AnchorPointOption[],
  ): AnchorPointValue {
    if (!this.#isDisabledValue(targetValue)) {
      return targetValue;
    }

    const targetIndex = ANCHOR_POINT_OPTIONS.findIndex((option) => option.value === targetValue);
    const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;

    for (let offset = 1; offset < ANCHOR_POINT_OPTIONS.length; offset += 1) {
      const index = targetIndex + direction * offset;
      const option = ANCHOR_POINT_OPTIONS[index];
      if (option && enabledOptions.some((enabledOption) => enabledOption.value === option.value)) {
        return option.value;
      }
    }

    return enabledOptions[0].value;
  }

  #getNearestEnabledValueOnAxis(
    currentValue: AnchorPointValue,
    targetValue: AnchorPointValue,
    key: string,
    enabledOptions: AnchorPointOption[],
  ): AnchorPointValue {
    if (!this.#isDisabledValue(targetValue)) {
      return targetValue;
    }

    const currentOption = this.#getOption(currentValue);
    const targetOption = this.#getOption(targetValue);
    const enabledValues = new Set(enabledOptions.map((option) => option.value));

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const inlineIndex = INLINE_VALUES.indexOf(currentOption.inline);
      const targetBlockIndex = BLOCK_VALUES.indexOf(targetOption.block);
      const direction = key === 'ArrowUp' ? -1 : 1;
      for (let blockIndex = targetBlockIndex; blockIndex >= 0 && blockIndex < BLOCK_VALUES.length; blockIndex += direction) {
        const value = `block-${BLOCK_VALUES[blockIndex]}-inline-${INLINE_VALUES[inlineIndex]}` as AnchorPointValue;
        if (enabledValues.has(value)) {
          return value;
        }
      }
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const blockIndex = BLOCK_VALUES.indexOf(currentOption.block);
      const targetInlineIndex = INLINE_VALUES.indexOf(targetOption.inline);
      const direction = key === 'ArrowLeft' ? -1 : 1;
      for (
        let inlineIndex = targetInlineIndex;
        inlineIndex >= 0 && inlineIndex < INLINE_VALUES.length;
        inlineIndex += direction
      ) {
        const value = `block-${BLOCK_VALUES[blockIndex]}-inline-${INLINE_VALUES[inlineIndex]}` as AnchorPointValue;
        if (enabledValues.has(value)) {
          return value;
        }
      }
    }

    return currentValue;
  }

  #startHoldTrigger(value: AnchorPointValue, source: AnchorPointInputChangeSource) {
    if (!this.holdTrigger || this.disabled || this.#isDisabledValue(value) || !this.#canTriggerValue(value)) {
      return;
    }

    this.#stopHoldTrigger();
    this.triggerState = {
      value,
      source,
      triggerCount: 0,
    };

    this.#emitTrigger();
    this.triggerState.delayId = window.setTimeout(() => {
      if (!this.triggerState) return;
      this.#emitTrigger();
      this.triggerState.intervalId = window.setInterval(() => this.#emitTrigger(), HOLD_TRIGGER_INTERVAL);
    }, HOLD_TRIGGER_DELAY);
  }

  #stopHoldTrigger() {
    if (!this.triggerState) return;

    if (this.triggerState.delayId !== undefined) {
      window.clearTimeout(this.triggerState.delayId);
    }

    if (this.triggerState.intervalId !== undefined) {
      window.clearInterval(this.triggerState.intervalId);
    }

    this.triggerState = undefined;
  }

  #emitTrigger() {
    if (!this.triggerState || this.disabled || this.#isDisabledValue(this.triggerState.value)) {
      this.#stopHoldTrigger();
      return;
    }

    this.triggerState.triggerCount += 1;
    this.#emitEvent('anchor-point-input-trigger', this.#createTriggerDetail(this.triggerState));
  }

  #canTriggerValue(value: AnchorPointValue): boolean {
    const mode = this.#getHoldTriggerMode();
    return mode === 'any' || value === this.value;
  }

  #createDetail(source: AnchorPointInputChangeSource): AnchorPointInputChangeDetail {
    const option = this.#getOption(this.value);

    return {
      value: option.value,
      block: option.block,
      inline: option.inline,
      source,
    };
  }

  #createTriggerDetail(state: AnchorPointTriggerState): AnchorPointInputTriggerDetail {
    const option = this.#getOption(state.value);

    return {
      value: option.value,
      block: option.block,
      inline: option.inline,
      source: state.source,
      triggerCount: state.triggerCount,
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

  #getLabelDisplay(): AnchorPointInputLabelDisplay {
    return this.labelDisplay === 'title' ? 'title' : 'visible';
  }

  #normalizeHandleShape() {
    const normalizedShape = this.#getHandleShape();
    if (normalizedShape !== this.handleShape) {
      this.handleShape = normalizedShape;
    }
  }

  #getHandleShape(): AnchorPointInputHandleShape {
    return this.handleShape === 'rect' ? 'rect' : 'circle';
  }

  #normalizeHoldTriggerMode() {
    const normalizedMode = this.#getHoldTriggerMode();
    if (normalizedMode !== this.holdTriggerMode) {
      this.holdTriggerMode = normalizedMode;
    }
  }

  #getHoldTriggerMode(): AnchorPointInputHoldTriggerMode {
    return this.holdTriggerMode === 'any' ? 'any' : 'selected';
  }

  #getHandleRotation(option: AnchorPointOption): number {
    const vectorX = option.inline === 'start' ? -1 : option.inline === 'end' ? 1 : 0;
    const vectorY = option.block === 'start' ? -1 : option.block === 'end' ? 1 : 0;
    if (vectorX === 0 && vectorY === 0) {
      return 0;
    }

    return (Math.atan2(vectorY, vectorX) * 180) / Math.PI + 90;
  }

  static styles = css`
    :host {
      display: inline-block;
      min-width: 0;
      --anchor-point-input-size: 48px;
      --anchor-point-input-guide-stroke: rgba(15, 84, 73, 0.3);
      --anchor-point-input-guide-stroke-width: 1;
      --anchor-point-input-handle-size: 8px;
      --anchor-point-input-handle-fill: rgba(15, 84, 73, 0.18);
      --anchor-point-input-handle-stroke: rgba(15, 84, 73, 0.44);
      --anchor-point-input-active-handle-fill: #0f5449;
      --anchor-point-input-active-handle-stroke: #0f5449;
      --anchor-point-input-disabled-handle-fill: var(--anchor-point-input-handle-fill);
      --anchor-point-input-disabled-handle-stroke: var(--anchor-point-input-handle-stroke);
      --anchor-point-input-disabled-handle-opacity: 0.22;
      --anchor-point-input-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.9);
      --anchor-point-input-label-color: #17322d;
      --anchor-point-input-label-font: 600 0.92rem/1.3 "Segoe UI", sans-serif;
      --anchor-point-input-disabled-opacity: 0.48;
    }

    .field {
      display: inline-grid;
      gap: 10px;
      justify-items: center;
      min-width: 0;
    }

    .label {
      color: var(--anchor-point-input-label-color);
      font: var(--anchor-point-input-label-font);
      text-align: center;
    }

    .control {
      position: relative;
      width: var(--anchor-point-input-size);
      aspect-ratio: 1;
      border-radius: 4px;
      touch-action: manipulation;
      user-select: none;
    }

    .control:focus-within {
      box-shadow: var(--anchor-point-input-focus-ring);
    }

    .guide {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .guide-rect,
    .guide-line {
      fill: none;
      stroke: var(--anchor-point-input-guide-stroke);
      stroke-width: var(--anchor-point-input-guide-stroke-width);
      stroke-dasharray: 3 4;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .selected-mark {
      fill: var(--anchor-point-input-active-handle-fill);
      opacity: 0.12;
    }

    .hidden {
      display: none;
    }

    .anchor-button {
      appearance: none;
      position: absolute;
      left: var(--anchor-point-x);
      top: var(--anchor-point-y);
      width: var(--anchor-point-input-handle-size);
      height: var(--anchor-point-input-handle-size);
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      transform: translate(-50%, -50%);
      outline: none;
    }

    :host([handle-shape='rect']) .anchor-button {
      border-radius: 0;
    }

    .anchor-button:focus-visible {
      //box-shadow: var(--anchor-point-input-focus-ring);
    }

    .anchor-dot {
      display: block;
      width: 100%;
      height: 100%;
      border: 2px solid var(--anchor-point-input-handle-stroke);
      border-radius: inherit;
      background: var(--anchor-point-input-handle-fill);
      opacity: 0.48;
      transition:
        background 140ms ease,
        border-color 140ms ease,
        opacity 140ms ease,
        transform 140ms ease;
    }

    .anchor-path {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    .anchor-path-handle {
      fill: var(--anchor-point-input-handle-fill);
      stroke: var(--anchor-point-input-handle-stroke);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      transition:
        fill 140ms ease,
        stroke 140ms ease,
        opacity 140ms ease,
        transform 140ms ease;
    }

    .anchor-button:hover .anchor-dot,
    .anchor-button:focus-visible .anchor-dot,
    .anchor-button[aria-checked='true'] .anchor-dot {
      opacity: 1;
    }

    .anchor-button:hover .anchor-path-handle,
    .anchor-button:focus-visible .anchor-path-handle,
    .anchor-button[aria-checked='true'] .anchor-path-handle {
      opacity: 1;
    }

    .anchor-button[aria-checked='true'] .anchor-dot {
      border-color: var(--anchor-point-input-active-handle-stroke);
      background: var(--anchor-point-input-active-handle-fill);
      transform: scale(1.1);
    }

    .anchor-button[aria-checked='true'] .anchor-path-handle {
      fill: var(--anchor-point-input-active-handle-fill);
      stroke: var(--anchor-point-input-active-handle-stroke);
    }

    .anchor-button.anchor-disabled {
      cursor: default;
    }

    .anchor-button.anchor-disabled .anchor-dot,
    .anchor-button.anchor-disabled:hover .anchor-dot,
    .anchor-button.anchor-disabled:focus-visible .anchor-dot,
    .anchor-button.anchor-disabled[aria-checked='true'] .anchor-dot {
      border-color: var(--anchor-point-input-disabled-handle-stroke);
      background: var(--anchor-point-input-disabled-handle-fill);
      opacity: var(--anchor-point-input-disabled-handle-opacity);
      transform: none;
    }

    .anchor-button.anchor-disabled .anchor-path-handle,
    .anchor-button.anchor-disabled:hover .anchor-path-handle,
    .anchor-button.anchor-disabled:focus-visible .anchor-path-handle,
    .anchor-button.anchor-disabled[aria-checked='true'] .anchor-path-handle {
      fill: var(--anchor-point-input-disabled-handle-fill);
      stroke: var(--anchor-point-input-disabled-handle-stroke);
      opacity: var(--anchor-point-input-disabled-handle-opacity);
    }

    .disabled {
      opacity: var(--anchor-point-input-disabled-opacity);
    }

    .disabled .anchor-button {
      cursor: default;
    }
  `;
}

export default CaskoUiAnchorPointInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'anchor-point-input': CaskoUiAnchorPointInputElement;
  }
}
