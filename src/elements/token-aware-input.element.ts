import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import {
  allowedValuesConverter,
  clampNumber,
  emitBubbledEvent,
  formatNumberToken,
  getActiveParsedToken,
  getCssPixelValue,
  getFiniteOptionalNumber,
  getPairLockedValue,
  getPairTokenIndex,
  getProposedValueFromBeforeInput,
  getSelectionWithinToken,
  getTokenPartCaret,
  getTokenStartCaret,
  normalizePatternInput,
  parseNumbers,
  replaceTokenValues,
  resolvePatternToken,
  sanitizePairLockMode,
  sanitizeReadonlyMode,
  sanitizeSuggestionMode,
  toMeasureHtml,
  type InputPairLockMode,
  type InputReadonlyMode,
  type InputSnapshot,
  type InputSuggestionMode,
  type NumberPart,
  type SpinnerDirection,
  type SpinnerPosition,
  type TokenReplacement,
} from './input-shared';

export type TokenAwareInputCause =
  | 'input'
  | 'selection'
  | 'step-up'
  | 'step-down'
  | 'spinner'
  | 'focus'
  | 'blur'
  | 'commit';

export type TokenAwareInputReadonlyMode = InputReadonlyMode;
export type TokenAwareInputPairLockMode = InputPairLockMode;
export type TokenAwareInputTokenMode = 'number' | 'values' | 'pattern-values';
export type TokenAwareInputSuggestionMode = InputSuggestionMode;
export type ParsedNumber = import('./input-shared').ParsedNumber;
export type ParsedValueToken = import('./input-shared').ParsedValueToken;
export type ParsedToken = import('./input-shared').ParsedToken;

export interface TokenAwareInputStateDetail {
  value: string;
  previousValue: string;
  numbers: ParsedToken[];
  activeNumber: ParsedToken | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  cause: TokenAwareInputCause;
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

const SPINNER_REPEAT_DELAY_MS = 320;
const SPINNER_REPEAT_INTERVAL_MS = 70;

@customElement('token-aware-input')
export class CaskoUiTokenAwareInputElement extends LitElement {
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

  @property({ type: String, attribute: 'readonly-mode', reflect: true })
  readonlyMode: TokenAwareInputReadonlyMode = 'none';

  @property({ type: Boolean, attribute: 'pair-lock', reflect: true })
  pairLock = false;

  @property({ type: String, attribute: 'pair-lock-mode', reflect: true })
  pairLockMode: TokenAwareInputPairLockMode = 'step';

  @property({
    attribute: 'allowed-values',
    converter: {
      fromAttribute: (value) => allowedValuesConverter(value),
      toAttribute: (value) => JSON.stringify(allowedValuesConverter(value)),
    },
  })
  allowedValues: string[] = [];

  @property({
    attribute: 'token-pattern',
    converter: {
      fromAttribute: (value) => value,
      toAttribute: (value) => (value instanceof RegExp ? value.source : value ?? null),
    },
  })
  tokenPattern: string | RegExp | null = null;

  @property({ type: String, attribute: 'suggestion-mode', reflect: true })
  suggestionMode: TokenAwareInputSuggestionMode = 'none';

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  @property({ type: Boolean, attribute: 'show-spinner', reflect: true })
  showSpinner = true;

  @query('#control')
  private controlElement?: TextControl;

  @query('#measure')
  private measureElement?: HTMLDivElement;

  private parsedNumbers: ParsedToken[] = [];
  private activeNumber: ParsedToken | null = null;
  private selectionStart: number | null = null;
  private selectionEnd: number | null = null;
  private spinnerPosition: SpinnerPosition = { top: 0, left: 0, visible: false };
  private isInternalValueUpdate = false;
  private hasFocus = false;
  private suggestionDropdownHidden = false;
  private suppressAutoFocusSelection = false;
  private previousCommittedValue = this.value;
  private spinnerRepeatTimeout?: number;
  private spinnerRepeatInterval?: number;
  private spinnerRepeatDirection?: SpinnerDirection;
  private pendingInputSnapshot?: InputSnapshot<ParsedToken>;

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
    this.#recomputeState('selection', this.value, false);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('disabled') && this.disabled) {
      this.#stopSpinnerRepeat(false);
      this.hasFocus = false;
      this.suggestionDropdownHidden = true;
      this.pendingInputSnapshot = undefined;
      this.spinnerPosition = { top: 0, left: 0, visible: false };
    }

    if (
      changedProperties.has('value') ||
      changedProperties.has('decimalSeparator') ||
      changedProperties.has('step') ||
      changedProperties.has('stepDecimal') ||
      changedProperties.has('allowedValues') ||
      changedProperties.has('tokenPattern') ||
      changedProperties.has('min') ||
      changedProperties.has('max')
    ) {
      this.#recomputeState(
        changedProperties.has('value') && !this.isInternalValueUpdate ? 'input' : 'selection',
        this.value,
        false,
      );
      this.isInternalValueUpdate = false;
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('value') ||
      changedProperties.has('decimalSeparator') ||
      changedProperties.has('step') ||
      changedProperties.has('stepDecimal') ||
      changedProperties.has('allowedValues') ||
      changedProperties.has('tokenPattern') ||
      changedProperties.has('min') ||
      changedProperties.has('max')
    ) {
      this.#syncControlValue();
    }

    if (changedProperties.has('multiline')) {
      this.controlElement?.removeEventListener('scroll', this.#onControlScroll);
      this.updateComplete.then(() => {
        this.controlElement?.addEventListener('scroll', this.#onControlScroll, { passive: true });
        this.#syncControlValue();
        this.#recomputeState('selection', this.value, false);
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
            ?readonly=${this.#getReadonlyMode() === 'all'}
            spellcheck="false"
            @beforeinput=${this.#onBeforeInput}
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
            ?readonly=${this.#getReadonlyMode() === 'all'}
            spellcheck="false"
            @beforeinput=${this.#onBeforeInput}
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
        ${this.#renderSuggestionDropdown()}
        <div id="measure" class="measure" aria-hidden="true"></div>
      </div>
    `;
  }

  #renderSpinner() {
    if (
      this.#usesSuggestionDropdown() ||
      !this.showSpinner ||
      !this.spinnerPosition.visible ||
      !this.activeNumber ||
      !this.hasFocus ||
      this.disabled ||
      this.#isStepperBlocked()
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

  #renderSuggestionDropdown() {
    if (!this.#shouldShowSuggestionDropdown()) {
      return nothing;
    }

    const allowedValues = this.#getAllowedValues();
    const activeValue = this.activeNumber?.mode === 'number' ? null : this.activeNumber?.value;

    return html`
      <div class="suggestions" role="listbox" aria-label="Token suggestions">
        ${allowedValues.map((value) => html`
          <button
            type="button"
            class="suggestion-item ${value === activeValue ? 'active' : ''}"
            role="option"
            aria-selected=${String(value === activeValue)}
            @mousedown=${this.#preventControlBlur}
            @click=${() => this.#selectSuggestionValue(value)}>
            ${value}
          </button>
        `)}
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

  #getReadonlyMode(): TokenAwareInputReadonlyMode {
    return this.readonly ? 'all' : sanitizeReadonlyMode(this.readonlyMode);
  }

  #getPairLockMode(): TokenAwareInputPairLockMode {
    return sanitizePairLockMode(this.pairLockMode);
  }

  #getSuggestionMode(): TokenAwareInputSuggestionMode {
    return sanitizeSuggestionMode(this.suggestionMode);
  }

  #getAllowedValues(): string[] {
    return allowedValuesConverter(this.allowedValues);
  }

  #getTokenPattern(): RegExp | null {
    return normalizePatternInput(this.tokenPattern);
  }

  #getConfiguredTokenMode(): TokenAwareInputTokenMode {
    const allowedValues = this.#getAllowedValues();
    const tokenPattern = this.#getTokenPattern();

    if (allowedValues.length === 0) {
      return 'number';
    }

    return tokenPattern ? 'pattern-values' : 'values';
  }

  #usesNumericMode(): boolean {
    return this.#getConfiguredTokenMode() === 'number';
  }

  #usesSuggestionDropdown(): boolean {
    return !this.#usesNumericMode() && this.#getSuggestionMode() === 'dropdown';
  }

  #shouldShowSuggestionDropdown(): boolean {
    return (
      this.#usesSuggestionDropdown() &&
      this.hasFocus &&
      !this.suggestionDropdownHidden &&
      !this.disabled &&
      this.#getReadonlyMode() !== 'all' &&
      this.#getAllowedValues().length > 0 &&
      !!this.activeNumber &&
      this.activeNumber.mode !== 'number'
    );
  }

  #isStepperBlocked(): boolean {
    const readonlyMode = this.#getReadonlyMode();
    return this.disabled || readonlyMode === 'all' || (readonlyMode === 'number' && this.#usesNumericMode());
  }

  #isTextEditingBlocked(): boolean {
    return this.disabled || this.#getReadonlyMode() === 'all';
  }

  #containsOnlyReadonlyTextCharacters(value: string): boolean {
    const decimalSeparator = this.#sanitizeDecimalSeparator();
    const escapedDecimalSeparator = decimalSeparator === '.' ? '\\.' : ',';
    const allowedPattern = new RegExp(`^[\\d\\s+\\-${escapedDecimalSeparator}]*$`);
    return allowedPattern.test(value);
  }

  #parseAllNumbers(value: string): ParsedNumber[] {
    return parseNumbers(
      value,
      this.#sanitizeDecimalSeparator(),
      this.#getStepValue(this.step, 1),
      this.#getStepValue(this.stepDecimal, 0.1),
    );
  }

  #parseValueToken(value: string): ParsedValueToken[] {
    const allowedValues = this.#getAllowedValues();

    if (allowedValues.length === 0) {
      return [];
    }

    return [
      {
        raw: value,
        value,
        startIndex: 0,
        length: value.length,
        endIndex: value.length,
        mode: 'values',
        activePart: null,
        allowedIndex: allowedValues.indexOf(value),
      },
    ];
  }

  #parsePatternValueToken(value: string): ParsedValueToken[] {
    const allowedValues = this.#getAllowedValues();
    const tokenPattern = this.#getTokenPattern();

    if (allowedValues.length === 0 || !tokenPattern) {
      return [];
    }

    const resolvedToken = resolvePatternToken(value, tokenPattern);
    if (!resolvedToken) {
      return [];
    }

    return [
      {
        raw: resolvedToken.raw,
        value: resolvedToken.raw,
        startIndex: resolvedToken.startIndex,
        length: resolvedToken.raw.length,
        endIndex: resolvedToken.endIndex,
        mode: 'pattern-values',
        activePart: null,
        allowedIndex: allowedValues.indexOf(resolvedToken.raw),
      },
    ];
  }

  #parseTokens(value: string): ParsedToken[] {
    switch (this.#getConfiguredTokenMode()) {
      case 'values':
        return this.#parseValueToken(value);
      case 'pattern-values':
        return this.#parsePatternValueToken(value);
      case 'number':
      default:
        return this.#parseAllNumbers(value);
    }
  }

  #isAcceptedConstrainedValue(nextValue: string): boolean {
    const allowedValues = this.#getAllowedValues();
    if (allowedValues.length === 0) {
      return true;
    }

    if (this.#getConfiguredTokenMode() === 'values') {
      return allowedValues.includes(nextValue);
    }

    const parsedToken = this.#parsePatternValueToken(nextValue)[0];
    return Boolean(parsedToken && parsedToken.allowedIndex !== -1);
  }

  #hasSameNumericTokens(previousValue: string, nextValue: string): boolean {
    const previousNumbers = this.#parseAllNumbers(previousValue);
    const nextNumbers = this.#parseAllNumbers(nextValue);

    if (previousNumbers.length !== nextNumbers.length) {
      return false;
    }

    return previousNumbers.every(
      (token, index) =>
        token.raw === nextNumbers[index].raw &&
        token.decimalSeparator === nextNumbers[index].decimalSeparator,
    );
  }

  #isAcceptedInputValue(nextValue: string, previousValue: string): boolean {
    if (!this.#usesNumericMode()) {
      if (!this.#isAcceptedConstrainedValue(nextValue)) {
        return false;
      }
    }

    switch (this.#getReadonlyMode()) {
      case 'all':
        return nextValue === previousValue;
      case 'text':
        return this.#containsOnlyReadonlyTextCharacters(nextValue);
      case 'number':
        return this.#usesNumericMode() ? this.#hasSameNumericTokens(previousValue, nextValue) : true;
      default:
        return true;
    }
  }

  #findTokenIndex(token: ParsedToken | null, numbers = this.parsedNumbers): number {
    if (!token) {
      return -1;
    }

    return numbers.findIndex((entry) => entry.startIndex === token.startIndex);
  }

  #createInputSnapshot(): InputSnapshot<ParsedToken> {
    const numbers = [...this.parsedNumbers];
    const activeTokenIndex = this.#findTokenIndex(this.activeNumber, numbers);
    return {
      value: this.value,
      numbers,
      activeTokenIndex,
    };
  }

  #replaceActiveTokenValue(token: ParsedToken, replacement: string) {
    const control = this.controlElement;
    if (!control) {
      return;
    }

    const previousValue = this.value;
    const nextValue = replaceTokenValues(this.value, [
      {
        tokenIndex: this.#findTokenIndex(token),
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        replacement,
      },
    ]);

    if (nextValue === previousValue) {
      return;
    }

    this.isInternalValueUpdate = true;
    this.value = nextValue;
    this.previousCommittedValue = previousValue;
    control.value = nextValue;
    control.focus();

    const reparsedNextToken = this.#parseTokens(nextValue)[0];
    if (reparsedNextToken) {
      this.selectionStart = reparsedNextToken.startIndex;
      this.selectionEnd = reparsedNextToken.endIndex;
      control.setSelectionRange(reparsedNextToken.startIndex, reparsedNextToken.endIndex);
    }

    this.#recomputeState('input', previousValue);
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.#emitCommit('commit');
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  #syncPairLockedDirectEdit(
    nextValue: string,
    snapshot: InputSnapshot<ParsedToken>,
    selectionStart: number | null,
    selectionEnd: number | null,
  ) {
    if (
      !this.#usesNumericMode() ||
      !this.pairLock ||
      this.#getPairLockMode() !== 'all' ||
      snapshot.activeTokenIndex === -1
    ) {
      return null;
    }

    const pairTokenIndex = getPairTokenIndex(snapshot.activeTokenIndex, snapshot.numbers.length);

    if (pairTokenIndex === -1) {
      return null;
    }

    const nextNumbers = this.#parseAllNumbers(nextValue);

    if (
      nextNumbers.length !== snapshot.numbers.length ||
      snapshot.activeTokenIndex >= nextNumbers.length ||
      pairTokenIndex >= nextNumbers.length
    ) {
      return null;
    }

    const previousActiveToken = snapshot.numbers[snapshot.activeTokenIndex];
    const nextActiveToken = nextNumbers[snapshot.activeTokenIndex];
    const previousPairToken = snapshot.numbers[pairTokenIndex];
    const nextPairToken = nextNumbers[pairTokenIndex];

    if (
      previousActiveToken?.mode !== 'number' ||
      !nextActiveToken ||
      previousPairToken?.mode !== 'number' ||
      !nextPairToken
    ) {
      return null;
    }

    if (
      previousActiveToken.raw === nextActiveToken.raw ||
      previousPairToken.raw !== nextPairToken.raw
    ) {
      return null;
    }

    const nextPairValue = getPairLockedValue(
      previousActiveToken,
      nextActiveToken.value,
      previousPairToken,
    );
    const pairReplacement = formatNumberToken(nextPairToken, nextPairValue);

    if (pairReplacement === nextPairToken.raw) {
      return null;
    }

    const adjustedValue = replaceTokenValues(nextValue, [
      {
        tokenIndex: pairTokenIndex,
        startIndex: nextPairToken.startIndex,
        endIndex: nextPairToken.endIndex,
        replacement: pairReplacement,
      },
    ]);

    const adjustedNumbers = this.#parseAllNumbers(adjustedValue);
    const adjustedActiveToken = adjustedNumbers[snapshot.activeTokenIndex];

    if (!adjustedActiveToken) {
      return {
        value: adjustedValue,
        selectionStart,
        selectionEnd,
      };
    }

    const offsets = getSelectionWithinToken(selectionStart, selectionEnd, nextActiveToken);
    const nextSelectionStart = adjustedActiveToken.startIndex + Math.min(offsets.startOffset, adjustedActiveToken.length);
    const nextSelectionEnd = adjustedActiveToken.startIndex + Math.min(offsets.endOffset, adjustedActiveToken.length);

    return {
      value: adjustedValue,
      selectionStart: nextSelectionStart,
      selectionEnd: nextSelectionEnd,
    };
  }

  #createDetail(previousValue: string, cause: TokenAwareInputCause): TokenAwareInputStateDetail {
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
    return getFiniteOptionalNumber(this.min);
  }

  #getMaxValue(): number | undefined {
    return getFiniteOptionalNumber(this.max);
  }

  #recomputeState(cause: TokenAwareInputCause, previousValue = this.value, requestUpdate = true) {
    this.parsedNumbers = this.#parseTokens(this.value);
    this.activeNumber = getActiveParsedToken(this.parsedNumbers, this.selectionStart, this.selectionEnd);
    emitBubbledEvent(this, 'token-aware-input-state-change', this.#createDetail(previousValue, cause));
    if (requestUpdate) {
      this.requestUpdate();
    }
  }

  #updateSelectionFromControl() {
    this.selectionStart = this.controlElement?.selectionStart ?? null;
    this.selectionEnd = this.controlElement?.selectionEnd ?? null;
  }

  #queueSelectionSync(cause: TokenAwareInputCause) {
    queueMicrotask(() => {
      this.#updateSelectionFromControl();
      this.#recomputeState(cause);
      void this.updateComplete.then(() => this.#updateSpinnerPosition());
    });
  }

  #onInput = (event: Event) => {
    if (this.disabled) {
      event.stopPropagation();
      this.#syncControlValue();
      return;
    }

    const input = event.currentTarget as TextControl;
    const previousValue = this.value;
    const initialNextValue = input.value;
    this.#showSuggestionDropdown();

    if (!this.#isAcceptedInputValue(initialNextValue, previousValue)) {
      input.value = previousValue;

      if (this.selectionStart !== null && this.selectionEnd !== null) {
        input.setSelectionRange(this.selectionStart, this.selectionEnd);
      }

      this.#syncControlValue();
      this.#recomputeState('selection');
      return;
    }

    let nextValue = initialNextValue;
    let nextSelectionStart = input.selectionStart;
    let nextSelectionEnd = input.selectionEnd;
    const pairLockResult = this.#syncPairLockedDirectEdit(
      nextValue,
      this.pendingInputSnapshot ?? this.#createInputSnapshot(),
      nextSelectionStart,
      nextSelectionEnd,
    );

    if (pairLockResult) {
      nextValue = pairLockResult.value;
      nextSelectionStart = pairLockResult.selectionStart;
      nextSelectionEnd = pairLockResult.selectionEnd;
      input.value = nextValue;

      if (nextSelectionStart !== null && nextSelectionEnd !== null) {
        input.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      }
    }

    this.isInternalValueUpdate = true;
    this.value = nextValue;
    this.selectionStart = nextSelectionStart;
    this.selectionEnd = nextSelectionEnd;
    this.#recomputeState('input', previousValue);
    this.pendingInputSnapshot = undefined;
  };

  #onNativeChange = () => {
    if (this.disabled) {
      return;
    }

    this.#emitCommit('commit');
  };

  #onFocus = () => {
    if (this.disabled) {
      return;
    }

    this.hasFocus = true;
    this.#showSuggestionDropdown();
    if (!this.suppressAutoFocusSelection) {
      this.#focusFirstNumber();
    }

    this.#updateSelectionFromControl();
    this.#recomputeState('focus');
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
    this.suppressAutoFocusSelection = false;
  };

  #onBlur = () => {
    if (this.disabled) {
      return;
    }

    this.hasFocus = false;
    this.suppressAutoFocusSelection = false;
    this.#updateSelectionFromControl();
    this.#recomputeState('blur');
    this.#emitCommit('blur');
  };

  #onSelectionEvent = () => {
    if (this.disabled) {
      return;
    }

    this.#queueSelectionSync('selection');
  };

  #selectSuggestionValue(value: string) {
    const token = this.activeNumber;
    if (!token || token.mode === 'number' || this.disabled) {
      return;
    }

    this.#replaceActiveTokenValue(token, value);

    if (this.hideOnSelect) {
      this.suggestionDropdownHidden = true;
      this.requestUpdate();
    }
  }

  #onControlScroll = () => {
    this.#updateSpinnerPosition();
  };

  #onControlPointerDown = () => {
    if (this.disabled) {
      return;
    }

    this.suppressAutoFocusSelection = true;
    this.#showSuggestionDropdown();
  };

  #onBeforeInput = (event: InputEvent) => {
    if (this.#isTextEditingBlocked()) {
      event.preventDefault();
      return;
    }

    const control = this.controlElement;
    if (!control) {
      return;
    }

    this.#showSuggestionDropdown();
    this.#updateSelectionFromControl();
    this.activeNumber = getActiveParsedToken(this.parsedNumbers, this.selectionStart, this.selectionEnd);
    this.pendingInputSnapshot = this.#createInputSnapshot();
    const proposedValue = getProposedValueFromBeforeInput(control, event);

    if (proposedValue === null) {
      return;
    }

    if (!this.#isAcceptedInputValue(proposedValue, this.value)) {
      event.preventDefault();
    }
  };

  #showSuggestionDropdown(): void {
    if (this.disabled) {
      return;
    }

    if (!this.suggestionDropdownHidden) {
      return;
    }

    this.suggestionDropdownHidden = false;
    this.requestUpdate();
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled || this.#getReadonlyMode() === 'all') {
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
      if (this.#isStepperBlocked()) {
        return;
      }

      this.#updateSelectionFromControl();
      this.activeNumber = getActiveParsedToken(this.parsedNumbers, this.selectionStart, this.selectionEnd);

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

    const firstToken = this.parsedNumbers[0];
    if (!firstToken) {
      return;
    }

    this.#setSelectionToToken(firstToken, firstToken.mode === 'number' ? 'integer' : undefined);
  }

  #moveActiveNumber(direction: 1 | -1): boolean {
    const control = this.controlElement;
    if (!control || this.parsedNumbers.length === 0) {
      return false;
    }

    this.#updateSelectionFromControl();
    const activeNumber = getActiveParsedToken(this.parsedNumbers, this.selectionStart, this.selectionEnd);

    if (activeNumber?.mode === 'number' && activeNumber.decimalSeparator) {
      if (direction === -1 && activeNumber.activePart === 'fraction') {
        this.#setSelectionToToken(activeNumber, 'integer');
        return true;
      }

      if (direction === 1 && activeNumber.activePart === 'integer') {
        this.#setSelectionToToken(activeNumber, 'fraction');
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
    const nextPart: NumberPart | undefined =
      nextToken.mode === 'number' && nextToken.decimalSeparator && direction === -1
        ? 'fraction'
        : nextToken.mode === 'number'
          ? 'integer'
          : undefined;

    control.focus();
    this.#setSelectionToToken(nextToken, nextPart);
    return true;
  }

  #setSelectionToToken(token: ParsedToken, part?: NumberPart) {
    const control = this.controlElement;
    if (!control) {
      return;
    }

    const caret = token.mode === 'number' && part ? getTokenPartCaret(token, part) : getTokenStartCaret(token);
    control.setSelectionRange(caret, caret);
    this.selectionStart = caret;
    this.selectionEnd = caret;
    this.#recomputeState('selection');
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  #preventControlBlur = (event: MouseEvent) => {
    if (this.disabled) {
      return;
    }

    event.preventDefault();
  };

  #onSpinnerStepUp = () => {
    if (this.disabled) {
      return;
    }

    this.#stepActiveNumber(1, 'spinner');
    this.#emitCommit('commit');
  };

  #onSpinnerStepDown = () => {
    if (this.disabled) {
      return;
    }

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
    if (this.#isStepperBlocked() || !this.activeNumber) {
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

    if (emitCommit && hadRepeatDirection && !this.disabled) {
      this.#emitCommit('commit');
    }
  }

  #stepActiveNumber(direction: 1 | -1, cause: 'step-up' | 'step-down' | 'spinner') {
    const token = this.activeNumber;
    const control = this.controlElement;

    if (!token || !control || this.#isStepperBlocked()) {
      return;
    }

    if (token.mode !== 'number') {
      this.#stepActiveValueToken(token, direction, cause);
      return;
    }

    const previousValue = this.value;
    const minValue = this.#getMinValue();
    const maxValue = this.#getMaxValue();
    const activeTokenIndex = this.#findTokenIndex(token);

    if (activeTokenIndex === -1) {
      return;
    }

    const nextNumericValue = clampNumber(token.value + token.step * direction, minValue, maxValue);
    const replacements: TokenReplacement[] = [
      {
        tokenIndex: activeTokenIndex,
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        replacement: formatNumberToken(token, nextNumericValue),
      },
    ];

    if (this.pairLock) {
      const pairedTokenIndex = getPairTokenIndex(activeTokenIndex, this.parsedNumbers.length);

      if (pairedTokenIndex !== -1) {
        const pairedToken = this.parsedNumbers[pairedTokenIndex];
        if (pairedToken?.mode === 'number') {
          const nextPairedValue = clampNumber(
            getPairLockedValue(token, nextNumericValue, pairedToken),
            minValue,
            maxValue,
          );

          replacements.push({
            tokenIndex: pairedTokenIndex,
            startIndex: pairedToken.startIndex,
            endIndex: pairedToken.endIndex,
            replacement: formatNumberToken(pairedToken, nextPairedValue),
          });
        }
      }
    }

    if (replacements.every((replacement) => {
      const currentToken = this.parsedNumbers[replacement.tokenIndex];
      return currentToken && replacement.replacement === currentToken.raw;
    })) {
      return;
    }

    const nextValue = replaceTokenValues(this.value, replacements);
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
    )[activeTokenIndex];

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

  #stepActiveValueToken(
    token: ParsedValueToken,
    direction: 1 | -1,
    cause: 'step-up' | 'step-down' | 'spinner',
  ) {
    const control = this.controlElement;
    if (!control) {
      return;
    }

    const allowedValues = this.#getAllowedValues();
    if (allowedValues.length === 0 || token.allowedIndex === -1) {
      return;
    }

    const previousValue = this.value;
    const nextAllowedIndex = (token.allowedIndex + direction + allowedValues.length) % allowedValues.length;
    const replacement = allowedValues[nextAllowedIndex];

    if (replacement === token.raw) {
      return;
    }

    const nextValue = replaceTokenValues(this.value, [
      {
        tokenIndex: this.#findTokenIndex(token),
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        replacement,
      },
    ]);

    this.isInternalValueUpdate = true;
    this.value = nextValue;
    this.previousCommittedValue = previousValue;
    control.value = nextValue;
    control.focus();

    const reparsedNextToken = this.#parseTokens(nextValue)[0];
    if (reparsedNextToken) {
      const offsets = getSelectionWithinToken(this.selectionStart, this.selectionEnd, token);
      const nextSelectionStart =
        reparsedNextToken.startIndex + Math.min(offsets.startOffset, reparsedNextToken.length);
      const nextSelectionEnd =
        reparsedNextToken.startIndex + Math.min(offsets.endOffset, reparsedNextToken.length);
      this.selectionStart = nextSelectionStart;
      this.selectionEnd = nextSelectionEnd;
      control.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    }

    this.#recomputeState(cause, previousValue);
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    void this.updateComplete.then(() => this.#updateSpinnerPosition());
  }

  #emitCommit(cause: TokenAwareInputCause) {
    if (this.disabled) {
      return;
    }

    const detail = this.#createDetail(this.previousCommittedValue, cause);
    this.previousCommittedValue = this.value;
    emitBubbledEvent(this, 'token-aware-input-commit', detail);
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
      this.#isStepperBlocked()
    ) {
      this.#setSpinnerPosition({ top: 0, left: 0, visible: false });
      return;
    }

    const computed = getComputedStyle(control);
    const hostComputed = getComputedStyle(this);
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

    const spinnerButtonSize = getCssPixelValue(
      hostComputed.getPropertyValue('--token-aware-input-spinner-button-size'),
      28,
    );
    const spinnerGap = getCssPixelValue(
      hostComputed.getPropertyValue('--token-aware-input-spinner-gap'),
      4,
    );
    const spinnerOffset = getCssPixelValue(
      hostComputed.getPropertyValue('--token-aware-input-spinner-offset'),
      8,
    );
    const spinnerInset = getCssPixelValue(
      hostComputed.getPropertyValue('--token-aware-input-spinner-inset'),
      4,
    );
    const spinnerWidth = spinnerButtonSize;
    const spinnerHeight = spinnerButtonSize * 2 + spinnerGap;
    const relativeLeft =
      tokenRect.right - measureRect.left + paddingLeft - control.scrollLeft + spinnerOffset;
    const relativeTop =
      tokenRect.top - measureRect.top + paddingTop - control.scrollTop + tokenRect.height / 2 - spinnerHeight / 2;
    const maxLeft = Math.max(0, controlRect.width - spinnerWidth - spinnerInset);
    const maxTop = Math.max(0, controlRect.height - spinnerHeight - spinnerInset);

    this.#setSpinnerPosition({
      left: Math.min(maxLeft, Math.max(spinnerInset, relativeLeft)),
      top: Math.min(maxTop, Math.max(spinnerInset, relativeTop)),
      visible: controlRect.width > 0 && hostRect.width > 0,
    });
  }

  static styles = css`
    :host {
      display: inline-block;
      width: var(--token-aware-input-width, 100%);
      min-width: 0;
      --token-aware-input-border: rgba(20, 56, 50, 0.18);
      --token-aware-input-border-focus: #0f5449;
      --token-aware-input-background: #ffffff;
      --token-aware-input-color: #17322d;
      --token-aware-input-placeholder-color: rgba(23, 50, 45, 0.52);
      --token-aware-input-focus-ring-size: 3px;
      --token-aware-input-focus-ring-opacity: 16%;
      --token-aware-input-spinner-background: rgba(15, 84, 73, 0.96);
      --token-aware-input-spinner-color: #ffffff;
      --token-aware-input-spinner-shadow: 0 10px 24px rgba(15, 84, 73, 0.2);
      --token-aware-input-spinner-button-size: 19px;
      --token-aware-input-spinner-gap: 0;
      --token-aware-input-spinner-radius: 0;
      --token-aware-input-spinner-offset: 8px;
      --token-aware-input-spinner-inset: 4px;
      --token-aware-input-suggestions-max-height: 180px;
      --token-aware-input-suggestions-background: #ffffff;
      --token-aware-input-suggestions-border: rgba(20, 56, 50, 0.12);
      --token-aware-input-suggestions-shadow: 0 10px 24px rgba(20, 56, 50, 0.1);
      --token-aware-input-suggestions-gap: 0;
      --token-aware-input-suggestions-padding: 0;
      --token-aware-input-suggestion-item-radius: 0;
      --token-aware-input-suggestion-item-padding: 8px 10px;
      --token-aware-input-suggestion-hover: rgba(15, 84, 73, 0.06);
      --token-aware-input-suggestion-active: rgba(15, 84, 73, 0.1);
      --token-aware-input-radius: 8px;
      --token-aware-input-padding-y: .4rem;
      --token-aware-input-padding-x: .55rem;
      --token-aware-input-input-min-height: 35px;
      --token-aware-input-textarea-min-height: 120px;
      --token-aware-input-textarea-line-height: 1.5;
      --token-aware-input-font: 400 1rem/1.45 "Segoe UI", sans-serif;
    }

    .field {
      position: relative;
      width: 100%;
    }

    .control {
      width: var(--token-aware-input-control-width, 100%);
      border-radius: var(--token-aware-input-radius);
      border: 1px solid var(--token-aware-input-border);
      background: var(--token-aware-input-background);
      color: var(--token-aware-input-color);
      padding: var(--token-aware-input-padding-y) var(--token-aware-input-padding-x);
      font: var(--token-aware-input-font);
      resize: vertical;
      outline: none;
      box-sizing: border-box;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }

    .control:focus {
      border-color: var(--token-aware-input-border-focus);
      box-shadow:
        0 0 0 var(--token-aware-input-focus-ring-size)
        color-mix(
          in srgb,
          var(--token-aware-input-border-focus) var(--token-aware-input-focus-ring-opacity),
          transparent
        );
    }

    .control::placeholder {
      color: var(--token-aware-input-placeholder-color);
    }

    .input {
      min-height: var(--token-aware-input-input-min-height);
    }

    .textarea {
      min-height: var(--token-aware-input-textarea-min-height);
      line-height: var(--token-aware-input-textarea-line-height);
    }

    .control:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }

    .spinner {
      position: absolute;
      width: var(--token-aware-input-spinner-button-size);
      display: grid;
      gap: var(--token-aware-input-spinner-gap);
      z-index: 2;
    }

    .spinner-button {
      width: var(--token-aware-input-spinner-button-size);
      height: var(--token-aware-input-spinner-button-size);
      border: 0;
      border-radius: var(--token-aware-input-spinner-radius);
      background: var(--token-aware-input-spinner-background);
      color: var(--token-aware-input-spinner-color);
      box-shadow: var(--token-aware-input-spinner-shadow);
      font: 700 0.95rem/1 sans-serif;
      cursor: pointer;
      padding: 0;
    }

    .spinner-button:focus-visible {
      outline: 2px solid white;
      outline-offset: 1px;
    }

    .suggestions {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      display: grid;
      gap: var(--token-aware-input-suggestions-gap);
      max-height: var(--token-aware-input-suggestions-max-height);
      overflow: auto;
      padding: var(--token-aware-input-suggestions-padding);
      border: 1px solid var(--token-aware-input-suggestions-border);
      border-radius: calc(var(--token-aware-input-radius) - 2px);
      background: var(--token-aware-input-suggestions-background);
      box-shadow: var(--token-aware-input-suggestions-shadow);
      z-index: 3;
    }

    .suggestion-item {
      width: 100%;
      border: 0;
      border-radius: var(--token-aware-input-suggestion-item-radius);
      background: transparent;
      color: var(--token-aware-input-color);
      font: 400 0.95rem/1.35 "Segoe UI", sans-serif;
      text-align: left;
      padding: var(--token-aware-input-suggestion-item-padding);
      cursor: pointer;
    }

    .suggestion-item:hover {
      background: var(--token-aware-input-suggestion-hover);
    }

    .suggestion-item.active {
      background: var(--token-aware-input-suggestion-active);
      font-weight: 500;
    }

    .suggestion-item:focus-visible {
      outline: 2px solid var(--token-aware-input-border-focus);
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

export default CaskoUiTokenAwareInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'token-aware-input': CaskoUiTokenAwareInputElement;
  }
}
