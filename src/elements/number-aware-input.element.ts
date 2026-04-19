import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

export type NumberAwareInputCause =
  | 'input'
  | 'selection'
  | 'step-up'
  | 'step-down'
  | 'spinner'
  | 'focus'
  | 'blur'
  | 'commit';

export interface ParsedNumber {
  raw: string;
  value: number;
  startIndex: number;
  length: number;
  endIndex: number;
  decimalSeparator: '.' | ',' | null;
  precision: number;
  step: number;
  integerStep: number;
  decimalStep: number;
  activePart: 'integer' | 'fraction' | null;
}

type NumberPart = 'integer' | 'fraction';

export interface NumberAwareInputStateDetail {
  value: string;
  previousValue: string;
  numbers: ParsedNumber[];
  activeNumber: ParsedNumber | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  cause: NumberAwareInputCause;
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

interface SpinnerPosition {
  top: number;
  left: number;
  visible: boolean;
}

type SpinnerDirection = 1 | -1;

const SPINNER_REPEAT_DELAY_MS = 320;
const SPINNER_REPEAT_INTERVAL_MS = 70;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toMeasureHtml(value: string): string {
  return escapeHtml(value).replaceAll(' ', '&nbsp;').replaceAll('\n', '<br>');
}

function getPrecision(value: number): number {
  const text = String(value);
  const exponentMatch = text.match(/e-(\d+)$/i);

  if (exponentMatch) {
    return Number(exponentMatch[1]);
  }

  const decimalIndex = text.indexOf('.');
  return decimalIndex === -1 ? 0 : text.length - decimalIndex - 1;
}

function getTokenPattern(decimalSeparator: '.' | ','): RegExp {
  const decimal = decimalSeparator === '.' ? '\\.' : ',';
  return new RegExp(`[+-]?(?:\\d+(?:${decimal}\\d+)?|${decimal}\\d+)`, 'g');
}

function parseNumbers(
  value: string,
  decimalSeparator: '.' | ',',
  integerStep: number,
  decimalStep: number,
  minValue?: number,
  maxValue?: number,
): ParsedNumber[] {
  const matcher = getTokenPattern(decimalSeparator);
  const numbers: ParsedNumber[] = [];

  for (const match of value.matchAll(matcher)) {
    const raw = match[0];
    const startIndex = match.index ?? 0;
    const normalized = decimalSeparator === ',' ? raw.replace(',', '.') : raw;
    const numericValue = Number(normalized);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    if (minValue !== undefined && numericValue < minValue) {
      continue;
    }

    if (maxValue !== undefined && numericValue > maxValue) {
      continue;
    }

    const precision = raw.includes(decimalSeparator) ? raw.split(decimalSeparator)[1]?.length ?? 0 : 0;
    numbers.push({
      raw,
      value: numericValue,
      startIndex,
      length: raw.length,
      endIndex: startIndex + raw.length,
      decimalSeparator: raw.includes(decimalSeparator) ? decimalSeparator : null,
      precision,
      step: precision > 0 ? decimalStep : integerStep,
      integerStep,
      decimalStep,
      activePart: null,
    });
  }

  return numbers;
}

function selectionOverlapsToken(
  selectionStart: number,
  selectionEnd: number,
  token: ParsedNumber,
): boolean {
  const overlapStart = Math.max(selectionStart, token.startIndex);
  const overlapEnd = Math.min(selectionEnd, token.endIndex);
  return overlapStart < overlapEnd;
}

function getActiveNumber(
  numbers: ParsedNumber[],
  selectionStart: number | null,
  selectionEnd: number | null,
): ParsedNumber | null {
  if (selectionStart === null || selectionEnd === null) {
    return null;
  }

  if (selectionStart === selectionEnd) {
    const caret = selectionStart;
    const token = numbers.find((entry) => caret >= entry.startIndex && caret <= entry.endIndex) ?? null;
    return token ? getTokenWithActivePart(token, caret) : null;
  }

  const overlapping = numbers.filter((token) => selectionOverlapsToken(selectionStart, selectionEnd, token));
  return overlapping.length === 1 ? getTokenWithActivePart(overlapping[0], selectionStart) : null;
}

function getTokenWithActivePart(token: ParsedNumber, caret: number): ParsedNumber {
  if (!token.decimalSeparator) {
    return {
      ...token,
      step: token.integerStep,
      activePart: 'integer',
    };
  }

  const decimalOffset = token.raw.indexOf(token.decimalSeparator);
  const decimalIndex = token.startIndex + decimalOffset;
  const activePart = caret <= decimalIndex ? 'integer' : 'fraction';

  return {
    ...token,
    step: activePart === 'fraction' ? token.decimalStep : token.integerStep,
    activePart,
  };
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumberToken(token: ParsedNumber, nextValue: number): string {
  const rounded = roundToPrecision(nextValue, Math.max(token.precision, getPrecision(token.step)));
  let nextText = token.precision > 0 ? rounded.toFixed(token.precision) : String(Math.round(rounded));

  if (token.decimalSeparator === ',') {
    nextText = nextText.replace('.', ',');
  }

  if (token.raw.startsWith('+') && !nextText.startsWith('-') && !nextText.startsWith('+')) {
    nextText = `+${nextText}`;
  }

  return nextText;
}

function getTokenPartCaret(token: ParsedNumber, part: NumberPart): number {
  if (!token.decimalSeparator || part === 'integer') {
    return token.startIndex;
  }

  const decimalOffset = token.raw.indexOf(token.decimalSeparator);
  return token.startIndex + decimalOffset + 1;
}

@customElement('number-aware-input')
export class CaskoUiNumberAwareInputElement extends LitElement {
  @property({ type: String })
  value = '';

  @property({ type: Boolean, reflect: true })
  multiline = false;

  @property({ type: String, attribute: 'decimal-separator' })
  decimalSeparator: '.' | ',' = '.';

  @property({ type: Number })
  step = 1;

  @property({ type: Number, attribute: 'step-decimal' })
  stepDecimal = 0.1;

  @property({ type: String })
  placeholder = '';

  @property({ type: Number })
  min = Number.NaN;

  @property({ type: Number })
  max = Number.NaN;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'show-spinner', reflect: true })
  showSpinner = true;

  @query('#control')
  private controlElement?: TextControl;

  @query('#measure')
  private measureElement?: HTMLDivElement;

  private parsedNumbers: ParsedNumber[] = [];
  private activeNumber: ParsedNumber | null = null;
  private selectionStart: number | null = null;
  private selectionEnd: number | null = null;
  private spinnerPosition: SpinnerPosition = { top: 0, left: 0, visible: false };
  private isInternalValueUpdate = false;
  private hasFocus = false;
  private suppressAutoFocusSelection = false;
  private previousCommittedValue = this.value;
  private spinnerRepeatTimeout?: number;
  private spinnerRepeatInterval?: number;
  private spinnerRepeatDirection?: SpinnerDirection;

  connectedCallback(): void {
    super.connectedCallback();
    this.#recomputeState('selection');
  }

  disconnectedCallback(): void {
    this.#stopSpinnerRepeat(false);
    this.controlElement?.removeEventListener('scroll', this.#onControlScroll);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.controlElement?.addEventListener('scroll', this.#onControlScroll, { passive: true });
    this.#syncControlValue();
    this.#recomputeState('selection');
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('value') ||
      changedProperties.has('decimalSeparator') ||
      changedProperties.has('step') ||
      changedProperties.has('stepDecimal') ||
      changedProperties.has('min') ||
      changedProperties.has('max')
    ) {
      this.#syncControlValue();
      this.#recomputeState(changedProperties.has('value') && !this.isInternalValueUpdate ? 'input' : 'selection');
      this.isInternalValueUpdate = false;
    }

    if (changedProperties.has('multiline')) {
      this.controlElement?.removeEventListener('scroll', this.#onControlScroll);
      this.updateComplete.then(() => {
        this.controlElement?.addEventListener('scroll', this.#onControlScroll, { passive: true });
        this.#syncControlValue();
        this.#recomputeState('selection');
      });
    }

    this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  focus(options?: FocusOptions): void {
    this.controlElement?.focus(options);
  }

  render() {
    const control = this.multiline
      ? html`
          <textarea
            id="control"
            class="control textarea"
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            spellcheck="false"
            @input=${this.#onInput}
            @change=${this.#onNativeChange}
            @pointerdown=${this.#onControlPointerDown}
            @keydown=${this.#onKeyDown}
            @keyup=${this.#onSelectionEvent}
            @click=${this.#onSelectionEvent}
            @select=${this.#onSelectionEvent}
            @focus=${this.#onFocus}
            @blur=${this.#onBlur}></textarea>
        `
      : html`
          <input
            id="control"
            class="control input"
            type="text"
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            spellcheck="false"
            @input=${this.#onInput}
            @change=${this.#onNativeChange}
            @pointerdown=${this.#onControlPointerDown}
            @keydown=${this.#onKeyDown}
            @keyup=${this.#onSelectionEvent}
            @click=${this.#onSelectionEvent}
            @select=${this.#onSelectionEvent}
            @focus=${this.#onFocus}
            @blur=${this.#onBlur} />
        `;

    return html`
      <div class="field">
        ${control}
        ${this.#renderSpinner()}
        <div id="measure" class="measure" aria-hidden="true"></div>
      </div>
    `;
  }

  #renderSpinner() {
    if (
      !this.showSpinner ||
      !this.spinnerPosition.visible ||
      !this.activeNumber ||
      !this.hasFocus ||
      this.disabled ||
      this.readonly
    ) {
      return nothing;
    }

    return html`
      <div
        class="spinner"
        style=${`top:${this.spinnerPosition.top}px;left:${this.spinnerPosition.left}px;`}>
        <button
          type="button"
          class="spinner-button"
          aria-label="Increase active number"
          @mousedown=${this.#preventControlBlur}
          @pointerdown=${this.#onSpinnerIncreasePointerDown}
          @pointerup=${this.#onSpinnerPointerUp}
          @pointercancel=${this.#onSpinnerPointerUp}
          @pointerleave=${this.#onSpinnerPointerLeave}>
          +
        </button>
        <button
          type="button"
          class="spinner-button"
          aria-label="Decrease active number"
          @mousedown=${this.#preventControlBlur}
          @pointerdown=${this.#onSpinnerDecreasePointerDown}
          @pointerup=${this.#onSpinnerPointerUp}
          @pointercancel=${this.#onSpinnerPointerUp}
          @pointerleave=${this.#onSpinnerPointerLeave}>
          -
        </button>
      </div>
    `;
  }

  #syncControlValue() {
    if (!this.controlElement) {
      return;
    }

    if (this.controlElement.value !== this.value) {
      this.controlElement.value = this.value;
    }
  }

  #sanitizeDecimalSeparator(): '.' | ',' {
    return this.decimalSeparator === ',' ? ',' : '.';
  }

  #getStepValue(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
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

  #createDetail(previousValue: string, cause: NumberAwareInputCause): NumberAwareInputStateDetail {
    return {
      value: this.value,
      previousValue,
      numbers: [...this.parsedNumbers],
      activeNumber: this.activeNumber ? { ...this.activeNumber } : null,
      selectionStart: this.selectionStart,
      selectionEnd: this.selectionEnd,
      cause,
    };
  }

  #getMinValue(): number | undefined {
    return Number.isFinite(this.min) ? this.min : undefined;
  }

  #getMaxValue(): number | undefined {
    return Number.isFinite(this.max) ? this.max : undefined;
  }

  #recomputeState(cause: NumberAwareInputCause, previousValue = this.value) {
    const decimalSeparator = this.#sanitizeDecimalSeparator();
    const step = this.#getStepValue(this.step, 1);
    const stepDecimal = this.#getStepValue(this.stepDecimal, 0.1);
    const minValue = this.#getMinValue();
    const maxValue = this.#getMaxValue();

    this.parsedNumbers = parseNumbers(this.value, decimalSeparator, step, stepDecimal, minValue, maxValue);
    this.activeNumber = getActiveNumber(this.parsedNumbers, this.selectionStart, this.selectionEnd);
    this.#emitEvent('number-aware-input-state-change', this.#createDetail(previousValue, cause));
    this.requestUpdate();
  }

  #updateSelectionFromControl() {
    this.selectionStart = this.controlElement?.selectionStart ?? null;
    this.selectionEnd = this.controlElement?.selectionEnd ?? null;
  }

  #queueSelectionSync(cause: NumberAwareInputCause) {
    queueMicrotask(() => {
      this.#updateSelectionFromControl();
      this.#recomputeState(cause);
      void this.updateComplete.then(() => this.#updateSpinnerPosition());
    });
  }

  #onInput = (event: Event) => {
    const input = event.currentTarget as TextControl;
    const previousValue = this.value;

    this.isInternalValueUpdate = true;
    this.value = input.value;
    this.#updateSelectionFromControl();
    this.#recomputeState('input', previousValue);
  };

  #onNativeChange = () => {
    this.#emitCommit('commit');
  };

  #onFocus = () => {
    this.hasFocus = true;
    if (!this.suppressAutoFocusSelection) {
      this.#focusFirstNumber();
    }

    this.#updateSelectionFromControl();
    this.#recomputeState('focus');
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
    this.suppressAutoFocusSelection = false;
  };

  #onBlur = () => {
    this.hasFocus = false;
    this.suppressAutoFocusSelection = false;
    this.#updateSelectionFromControl();
    this.#recomputeState('blur');
    this.#emitCommit('blur');
  };

  #onSelectionEvent = () => {
    this.#queueSelectionSync('selection');
  };

  #onControlScroll = () => {
    this.#updateSpinnerPosition();
  };

  #onControlPointerDown = () => {
    this.suppressAutoFocusSelection = true;
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled || this.readonly) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === 'Tab') {
      if (this.parsedNumbers.length === 0) {
        return;
      }

      const moved = this.#moveActiveNumber(event.shiftKey ? -1 : 1);
      if (!moved) {
        return;
      }

      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      this.#updateSelectionFromControl();
      this.activeNumber = getActiveNumber(this.parsedNumbers, this.selectionStart, this.selectionEnd);

      if (!this.activeNumber) {
        return;
      }

      event.preventDefault();
      this.#stepActiveNumber(event.key === 'ArrowUp' ? 1 : -1, event.key === 'ArrowUp' ? 'step-up' : 'step-down');
      return;
    }

    if (event.key === 'Enter' && !this.multiline) {
      this.#emitCommit('commit');
    }
  };

  #focusFirstNumber() {
    const control = this.controlElement;
    if (!control) {
      return;
    }

    const firstNumber = this.parsedNumbers[0];
    if (!firstNumber) {
      return;
    }

    this.#setCaretToTokenPart(firstNumber, 'integer');
  }

  #moveActiveNumber(direction: 1 | -1): boolean {
    const control = this.controlElement;
    if (!control || this.parsedNumbers.length === 0) {
      return false;
    }

    this.#updateSelectionFromControl();
    const activeNumber = getActiveNumber(this.parsedNumbers, this.selectionStart, this.selectionEnd);

    if (activeNumber?.decimalSeparator) {
      if (direction === -1 && activeNumber.activePart === 'fraction') {
        this.#setCaretToTokenPart(activeNumber, 'integer');
        return true;
      }

      if (direction === 1 && activeNumber.activePart === 'integer') {
        this.#setCaretToTokenPart(activeNumber, 'fraction');
        return true;
      }
    }

    const currentIndex = activeNumber
      ? this.parsedNumbers.findIndex((token) => token.startIndex === activeNumber.startIndex)
      : -1;
    const fallbackIndex = direction > 0 ? 0 : this.parsedNumbers.length - 1;
    const nextIndex =
      currentIndex === -1
        ? fallbackIndex
        : Math.max(0, Math.min(this.parsedNumbers.length - 1, currentIndex + direction));

    if (currentIndex !== -1 && nextIndex === currentIndex) {
      return false;
    }

    const nextToken = this.parsedNumbers[nextIndex];
    const nextPart: NumberPart =
      nextToken.decimalSeparator && direction === -1 ? 'fraction' : 'integer';

    control.focus();
    this.#setCaretToTokenPart(nextToken, nextPart);
    return true;
  }

  #setCaretToTokenPart(token: ParsedNumber, part: NumberPart) {
    const control = this.controlElement;
    if (!control) {
      return;
    }

    const caret = getTokenPartCaret(token, part);
    control.setSelectionRange(caret, caret);
    this.selectionStart = caret;
    this.selectionEnd = caret;
    this.#recomputeState('selection');
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  #preventControlBlur = (event: MouseEvent) => {
    event.preventDefault();
  };

  #onSpinnerStepUp = () => {
    this.#stepActiveNumber(1, 'spinner');
    this.#emitCommit('commit');
  };

  #onSpinnerStepDown = () => {
    this.#stepActiveNumber(-1, 'spinner');
    this.#emitCommit('commit');
  };

  #onSpinnerIncreasePointerDown = (event: PointerEvent) => {
    this.#startSpinnerRepeat(event, 1);
  };

  #onSpinnerDecreasePointerDown = (event: PointerEvent) => {
    this.#startSpinnerRepeat(event, -1);
  };

  #onSpinnerPointerUp = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLElement | null;
    if (button?.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }

    this.#stopSpinnerRepeat(true);
  };

  #onSpinnerPointerLeave = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLElement | null;
    if ((event.buttons & 1) !== 1 || !button?.matches(':hover')) {
      this.#stopSpinnerRepeat(true);
    }
  };

  #startSpinnerRepeat(event: PointerEvent, direction: SpinnerDirection) {
    if (this.disabled || this.readonly || !this.activeNumber) {
      return;
    }

    const button = event.currentTarget as HTMLElement | null;
    button?.setPointerCapture(event.pointerId);
    this.#stopSpinnerRepeat(false);
    this.spinnerRepeatDirection = direction;
    this.#stepActiveNumber(direction, 'spinner');

    this.spinnerRepeatTimeout = window.setTimeout(() => {
      if (!this.spinnerRepeatDirection) {
        return;
      }

      this.spinnerRepeatInterval = window.setInterval(() => {
        if (!this.spinnerRepeatDirection) {
          return;
        }

        this.#stepActiveNumber(this.spinnerRepeatDirection, 'spinner');
      }, SPINNER_REPEAT_INTERVAL_MS);
    }, SPINNER_REPEAT_DELAY_MS);
  }

  #stopSpinnerRepeat(emitCommit: boolean) {
    if (this.spinnerRepeatTimeout !== undefined) {
      window.clearTimeout(this.spinnerRepeatTimeout);
      this.spinnerRepeatTimeout = undefined;
    }

    if (this.spinnerRepeatInterval !== undefined) {
      window.clearInterval(this.spinnerRepeatInterval);
      this.spinnerRepeatInterval = undefined;
    }

    const hadRepeatDirection = this.spinnerRepeatDirection !== undefined;
    this.spinnerRepeatDirection = undefined;

    if (emitCommit && hadRepeatDirection) {
      this.#emitCommit('commit');
    }
  }

  #stepActiveNumber(direction: 1 | -1, cause: 'step-up' | 'step-down' | 'spinner') {
    const token = this.activeNumber;
    const control = this.controlElement;

    if (!token || !control) {
      return;
    }

    const previousValue = this.value;
    const unclampedNextValue = token.value + token.step * direction;
    const minValue = this.#getMinValue();
    const maxValue = this.#getMaxValue();
    const nextNumericValue = Math.min(
      maxValue ?? unclampedNextValue,
      Math.max(minValue ?? unclampedNextValue, unclampedNextValue),
    );
    const replacement = formatNumberToken(token, nextNumericValue);

    if (replacement === token.raw) {
      return;
    }

    const nextValue =
      this.value.slice(0, token.startIndex) + replacement + this.value.slice(token.endIndex);
    const nextPart: NumberPart =
      token.decimalSeparator && token.activePart === 'fraction' ? 'fraction' : 'integer';

    this.isInternalValueUpdate = true;
    this.value = nextValue;
    this.previousCommittedValue = previousValue;
    control.value = nextValue;
    control.focus();
    const reparsedNextToken = parseNumbers(
      nextValue,
      this.#sanitizeDecimalSeparator(),
      this.#getStepValue(this.step, 1),
      this.#getStepValue(this.stepDecimal, 0.1),
      minValue,
      maxValue,
    ).find((entry) => entry.startIndex === token.startIndex);

    if (reparsedNextToken) {
      const nextCaret = getTokenPartCaret(reparsedNextToken, nextPart);
      this.selectionStart = nextCaret;
      this.selectionEnd = nextCaret;
      control.setSelectionRange(nextCaret, nextCaret);
    }

    this.#recomputeState(cause, previousValue);
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  #emitCommit(cause: NumberAwareInputCause) {
    const detail = this.#createDetail(this.previousCommittedValue, cause);
    this.previousCommittedValue = this.value;
    this.#emitEvent('number-aware-input-commit', detail);
  }

  #setSpinnerPosition(nextPosition: SpinnerPosition) {
    if (
      this.spinnerPosition.top === nextPosition.top &&
      this.spinnerPosition.left === nextPosition.left &&
      this.spinnerPosition.visible === nextPosition.visible
    ) {
      return;
    }

    this.spinnerPosition = nextPosition;
    this.requestUpdate();
  }

  #updateSpinnerPosition() {
    const token = this.activeNumber;
    const control = this.controlElement;
    const measure = this.measureElement;

    if (
      !token ||
      !control ||
      !measure ||
      !this.showSpinner ||
      !this.hasFocus ||
      this.disabled ||
      this.readonly
    ) {
      this.#setSpinnerPosition({ top: 0, left: 0, visible: false });
      return;
    }

    const computed = getComputedStyle(control);
    const controlRect = control.getBoundingClientRect();
    const hostRect = this.getBoundingClientRect();
    const paddingLeft = parseFloat(computed.paddingLeft || '0');
    const paddingRight = parseFloat(computed.paddingRight || '0');
    const paddingTop = parseFloat(computed.paddingTop || '0');
    const textWidth = Math.max(0, control.clientWidth - paddingLeft - paddingRight);

    measure.style.width = `${textWidth}px`;
    measure.style.font = computed.font;
    measure.style.fontSize = computed.fontSize;
    measure.style.fontFamily = computed.fontFamily;
    measure.style.fontWeight = computed.fontWeight;
    measure.style.fontStyle = computed.fontStyle;
    measure.style.letterSpacing = computed.letterSpacing;
    measure.style.lineHeight = computed.lineHeight;
    measure.style.whiteSpace = this.multiline ? 'pre-wrap' : 'pre';
    measure.style.wordBreak = this.multiline ? 'break-word' : 'normal';
    measure.style.overflowWrap = this.multiline ? 'break-word' : 'normal';
    measure.scrollTop = control.scrollTop;
    measure.scrollLeft = control.scrollLeft;

    const before = toMeasureHtml(this.value.slice(0, token.startIndex));
    const current = toMeasureHtml(token.raw);
    const after = toMeasureHtml(this.value.slice(token.endIndex));

    measure.innerHTML = `<span id="before">${before}</span><span id="token">${current}</span><span>${after}</span>`;

    const tokenRect = measure.querySelector('#token')?.getBoundingClientRect();
    const measureRect = measure.getBoundingClientRect();

    if (!tokenRect) {
      this.#setSpinnerPosition({ top: 0, left: 0, visible: false });
      return;
    }

    const spinnerWidth = 32;
    const spinnerHeight = 60;
    const relativeLeft =
      tokenRect.right - measureRect.left + paddingLeft - control.scrollLeft + 8;
    const relativeTop =
      tokenRect.top - measureRect.top + paddingTop - control.scrollTop + tokenRect.height / 2 - spinnerHeight / 2;
    const maxLeft = Math.max(0, controlRect.width - spinnerWidth - 4);
    const maxTop = Math.max(0, controlRect.height - spinnerHeight - 4);

    this.#setSpinnerPosition({
      left: Math.min(maxLeft, Math.max(4, relativeLeft)),
      top: Math.min(maxTop, Math.max(4, relativeTop)),
      visible: controlRect.width > 0 && hostRect.width > 0,
    });
  }

  static styles = css`
    :host {
      display: inline-block;
      width: 100%;
      min-width: 0;
      --number-aware-input-border: rgba(20, 56, 50, 0.18);
      --number-aware-input-border-focus: #0f5449;
      --number-aware-input-background: #ffffff;
      --number-aware-input-color: #17322d;
      --number-aware-input-spinner-background: rgba(15, 84, 73, 0.96);
      --number-aware-input-spinner-color: #ffffff;
      --number-aware-input-spinner-shadow: 0 10px 24px rgba(15, 84, 73, 0.2);
      --number-aware-input-radius: 14px;
      --number-aware-input-padding-y: 12px;
      --number-aware-input-padding-x: 14px;
      --number-aware-input-font: 400 1rem/1.45 "Segoe UI", sans-serif;
    }

    .field {
      position: relative;
      width: 100%;
    }

    .control {
      width: 100%;
      border-radius: var(--number-aware-input-radius);
      border: 1px solid var(--number-aware-input-border);
      background: var(--number-aware-input-background);
      color: var(--number-aware-input-color);
      padding: var(--number-aware-input-padding-y) var(--number-aware-input-padding-x);
      font: var(--number-aware-input-font);
      resize: vertical;
      outline: none;
      box-sizing: border-box;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }

    .control:focus {
      border-color: var(--number-aware-input-border-focus);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--number-aware-input-border-focus) 16%, transparent);
    }

    .input {
      min-height: 48px;
    }

    .textarea {
      min-height: 120px;
      line-height: 1.5;
    }

    .control:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }

    .spinner {
      position: absolute;
      width: 28px;
      display: grid;
      gap: 4px;
      z-index: 2;
    }

    .spinner-button {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 10px;
      background: var(--number-aware-input-spinner-background);
      color: var(--number-aware-input-spinner-color);
      box-shadow: var(--number-aware-input-spinner-shadow);
      font: 700 0.95rem/1 sans-serif;
      cursor: pointer;
      padding: 0;
    }

    .spinner-button:focus-visible {
      outline: 2px solid white;
      outline-offset: 1px;
    }

    .measure {
      position: absolute;
      inset: 0 auto auto 0;
      visibility: hidden;
      pointer-events: none;
      box-sizing: border-box;
      padding: 0;
      overflow: hidden;
      white-space: pre-wrap;
    }

    .measure span {
      white-space: inherit;
    }
  `;
}

export default CaskoUiNumberAwareInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'number-aware-input': CaskoUiNumberAwareInputElement;
  }
}
