import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emitBubbledEvent } from './input-shared';
import './number-aware-input.element';
import './token-aware-input.element';

export type TextInputAnchor = 'start' | 'middle' | 'end';
export type TextInputDominantBaseline =
  | 'auto'
  | 'middle'
  | 'central'
  | 'hanging'
  | 'text-before-edge'
  | 'text-after-edge'
  | 'alphabetic'
  | 'ideographic'
  | 'mathematical';
export type TextInputAlignmentBaseline = TextInputDominantBaseline | 'baseline';
export type TextInputLengthAdjust = 'spacing' | 'spacingAndGlyphs';
export type TextInputChangeSource = 'field';
export type TextInputChangedProperty = keyof TextInputValue;

export interface TextInputValue {
  'rotate': string;
  'text-anchor': TextInputAnchor;
  'dominant-baseline': TextInputDominantBaseline;
  'alignment-baseline': TextInputAlignmentBaseline;
  'baseline-shift': string;
  'lengthAdjust': TextInputLengthAdjust;
  'textLength': string;
}

export interface TextInputChangeDetail {
  value: TextInputValue;
  previousValue: TextInputValue;
  changedProperty: TextInputChangedProperty;
  source: TextInputChangeSource;
}

type TextInputValueInput = Partial<TextInputValue> | null | undefined;

const TEXT_ANCHOR_VALUES: TextInputAnchor[] = ['start', 'middle', 'end'];
const DOMINANT_BASELINE_VALUES: TextInputDominantBaseline[] = [
  'auto',
  'middle',
  'central',
  'hanging',
  'text-before-edge',
  'text-after-edge',
  'alphabetic',
  'ideographic',
  'mathematical',
];
const ALIGNMENT_BASELINE_VALUES: TextInputAlignmentBaseline[] = ['baseline', ...DOMINANT_BASELINE_VALUES];
const BASELINE_SHIFT_VALUES = ['baseline', 'sub', 'super'];
const LENGTH_ADJUST_VALUES: TextInputLengthAdjust[] = ['spacing', 'spacingAndGlyphs'];
const TEXT_PROPERTY_NAMES = [
  'rotate',
  'textAnchor',
  'dominantBaseline',
  'alignmentBaseline',
  'baselineShift',
  'lengthAdjust',
  'textLength',
] as const;

const DEFAULT_VALUE: TextInputValue = {
  'rotate': '0',
  'text-anchor': 'middle',
  'dominant-baseline': 'middle',
  'alignment-baseline': 'baseline',
  'baseline-shift': '0',
  'lengthAdjust': 'spacing',
  'textLength': '',
};

function cloneValue(value: TextInputValue): TextInputValue {
  return { ...value };
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeNumberText(value: unknown, fallback: string, allowEmpty = false): string {
  const text = sanitizeString(value, fallback);

  if (allowEmpty && text === '') {
    return '';
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? String(parsed) : fallback;
}

function sanitizeBaselineShift(value: unknown, fallback: string): string {
  const text = sanitizeString(value, fallback);

  if (BASELINE_SHIFT_VALUES.includes(text)) {
    return text;
  }

  return sanitizeNumberText(text, fallback);
}

function sanitizeChoice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function sanitizeValue(value: TextInputValueInput): TextInputValue {
  return {
    'rotate': sanitizeNumberText(value?.['rotate'], DEFAULT_VALUE['rotate']),
    'text-anchor': sanitizeChoice(value?.['text-anchor'], TEXT_ANCHOR_VALUES, DEFAULT_VALUE['text-anchor']),
    'dominant-baseline': sanitizeChoice(
      value?.['dominant-baseline'],
      DOMINANT_BASELINE_VALUES,
      DEFAULT_VALUE['dominant-baseline'],
    ),
    'alignment-baseline': sanitizeChoice(
      value?.['alignment-baseline'],
      ALIGNMENT_BASELINE_VALUES,
      DEFAULT_VALUE['alignment-baseline'],
    ),
    'baseline-shift': sanitizeBaselineShift(value?.['baseline-shift'], DEFAULT_VALUE['baseline-shift']),
    'lengthAdjust': sanitizeChoice(value?.['lengthAdjust'], LENGTH_ADJUST_VALUES, DEFAULT_VALUE['lengthAdjust']),
    'textLength': sanitizeNumberText(value?.['textLength'], DEFAULT_VALUE['textLength'], true),
  };
}

@customElement('text-input')
export class CaskoUiTextInputElement extends LitElement {
  @property({ type: String, reflect: true })
  rotate = DEFAULT_VALUE['rotate'];

  @property({ type: String, attribute: 'text-anchor', reflect: true })
  textAnchor: TextInputAnchor = DEFAULT_VALUE['text-anchor'];

  @property({ type: String, attribute: 'dominant-baseline', reflect: true })
  dominantBaseline: TextInputDominantBaseline = DEFAULT_VALUE['dominant-baseline'];

  @property({ type: String, attribute: 'alignment-baseline', reflect: true })
  alignmentBaseline: TextInputAlignmentBaseline = DEFAULT_VALUE['alignment-baseline'];

  @property({ type: String, attribute: 'baseline-shift', reflect: true })
  baselineShift = DEFAULT_VALUE['baseline-shift'];

  @property({ type: String, attribute: 'lengthAdjust', reflect: true })
  lengthAdjust: TextInputLengthAdjust = DEFAULT_VALUE['lengthAdjust'];

  @property({ type: String, attribute: 'textLength', reflect: true })
  textLength = DEFAULT_VALUE['textLength'];

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  private currentValue = cloneValue(DEFAULT_VALUE);
  private lastCommittedValue = cloneValue(DEFAULT_VALUE);

  get value(): TextInputValue {
    return cloneValue(this.currentValue);
  }

  set value(value: TextInputValueInput) {
    const previousValue = this.currentValue;
    this.#applyValue(value);
    this.currentValue = this.#createValue();
    this.lastCommittedValue = cloneValue(this.currentValue);
    this.requestUpdate('value', previousValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#syncValueFromProperties();
    this.lastCommittedValue = this.#createValue();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (TEXT_PROPERTY_NAMES.some((property) => changedProperties.has(property))) {
      this.#syncValueFromProperties();
    }
  }

  focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('.control')?.focus(options);
  }

  render() {
    return html`
      <div class="field-grid">
        ${this.#renderNumberField('Rotate', 'rotate', this.rotate, 1, 0.1)}
        ${this.#renderNumberField('Text length', 'textLength', this.textLength, 1, 0.1)}
        ${this.#renderChoiceField('Anchor', 'text-anchor', this.textAnchor, TEXT_ANCHOR_VALUES)}
        ${this.#renderChoiceField('Length adjust', 'lengthAdjust', this.lengthAdjust, LENGTH_ADJUST_VALUES)}
        ${this.#renderChoiceField('Dominant baseline', 'dominant-baseline', this.dominantBaseline, DOMINANT_BASELINE_VALUES)}
        ${this.#renderChoiceField('Alignment baseline', 'alignment-baseline', this.alignmentBaseline, ALIGNMENT_BASELINE_VALUES)}
        <label class="field field-wide">
          <span>Baseline shift</span>
          <token-aware-input
            class="control"
            .value=${this.baselineShift}
            .allowedValues=${BASELINE_SHIFT_VALUES}
            suggestion-mode="dropdown"
            control-position="end"
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${this.#onBaselineShiftInput}
            @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
        </label>
      </div>
    `;
  }

  #renderNumberField(
    label: string,
    property: Extract<TextInputChangedProperty, 'rotate' | 'textLength'>,
    value: string,
    step: number,
    stepDecimal: number,
  ) {
    return html`
      <label class="field">
        <span>${label}</span>
        <number-aware-input
          class="control"
          .value=${value}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          readonly-mode="text"
          .step=${step}
          .stepDecimal=${stepDecimal}
          control-position="end"
          @input=${(event: Event) => this.#onNumberInput(property, event)}
          @number-aware-input-commit=${this.#onChildCommit}></number-aware-input>
      </label>
    `;
  }

  #renderChoiceField<T extends string>(
    label: string,
    property: TextInputChangedProperty,
    value: T,
    values: readonly T[],
  ) {
    return html`
      <label class="field">
        <span>${label}</span>
        <token-aware-input
          class="control"
          .value=${value}
          .allowedValues=${values}
          suggestion-mode="dropdown"
          control-position="end"
          .hideOnSelect=${this.hideOnSelect}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${(event: Event) => this.#onChoiceInput(property, event)}
          @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
      </label>
    `;
  }

  #applyValue(value: TextInputValueInput): void {
    const sanitized = sanitizeValue(value);
    this.rotate = sanitized['rotate'];
    this.textAnchor = sanitized['text-anchor'];
    this.dominantBaseline = sanitized['dominant-baseline'];
    this.alignmentBaseline = sanitized['alignment-baseline'];
    this.baselineShift = sanitized['baseline-shift'];
    this.lengthAdjust = sanitized['lengthAdjust'];
    this.textLength = sanitized['textLength'];
  }

  #createValue(): TextInputValue {
    return sanitizeValue({
      'rotate': this.rotate,
      'text-anchor': this.textAnchor,
      'dominant-baseline': this.dominantBaseline,
      'alignment-baseline': this.alignmentBaseline,
      'baseline-shift': this.baselineShift,
      'lengthAdjust': this.lengthAdjust,
      'textLength': this.textLength,
    });
  }

  #syncValueFromProperties(): void {
    this.currentValue = this.#createValue();
  }

  #commitPropertyChange(changedProperty: TextInputChangedProperty, previousValue: TextInputValue): void {
    this.#syncValueFromProperties();
    const detail = {
      value: this.value,
      previousValue,
      changedProperty,
      source: 'field' as TextInputChangeSource,
    };

    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    emitBubbledEvent(this, 'text-input-change', detail);
  }

  #emitCommit(): void {
    const detail = {
      value: this.value,
      previousValue: this.lastCommittedValue,
      changedProperty: 'rotate' as TextInputChangedProperty,
      source: 'field' as TextInputChangeSource,
    };
    this.lastCommittedValue = this.value;
    emitBubbledEvent(this, 'text-input-commit', detail);
  }

  #onNumberInput(property: TextInputChangedProperty, event: Event): void {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };

    switch (property) {
      case 'rotate':
        this.rotate = sanitizeNumberText(input.value, this.rotate);
        break;
      case 'textLength':
        this.textLength = sanitizeNumberText(input.value, this.textLength, true);
        break;
      default:
        break;
    }

    this.#commitPropertyChange(property, previousValue);
  }

  #onChoiceInput(property: TextInputChangedProperty, event: Event): void {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };

    switch (property) {
      case 'text-anchor':
        this.textAnchor = sanitizeChoice(input.value, TEXT_ANCHOR_VALUES, DEFAULT_VALUE['text-anchor']);
        break;
      case 'dominant-baseline':
        this.dominantBaseline = sanitizeChoice(
          input.value,
          DOMINANT_BASELINE_VALUES,
          DEFAULT_VALUE['dominant-baseline'],
        );
        break;
      case 'alignment-baseline':
        this.alignmentBaseline = sanitizeChoice(
          input.value,
          ALIGNMENT_BASELINE_VALUES,
          DEFAULT_VALUE['alignment-baseline'],
        );
        break;
      case 'lengthAdjust':
        this.lengthAdjust = sanitizeChoice(input.value, LENGTH_ADJUST_VALUES, DEFAULT_VALUE['lengthAdjust']);
        break;
      default:
        break;
    }

    this.#commitPropertyChange(property, previousValue);
  }

  #onBaselineShiftInput = (event: Event): void => {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };
    this.baselineShift = sanitizeBaselineShift(input.value, this.baselineShift);
    this.#commitPropertyChange('baseline-shift', previousValue);
  };

  #onChildCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit();
  };

  static styles = css`
    :host {
      display: block;
      width: var(--text-input-width, 100%);
      color: var(--text-input-color, #17322d);
      font: var(--text-input-font, 400 0.95rem/1.35 "Segoe UI", sans-serif);
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--text-input-gap, 10px);
      min-width: 0;
    }

    .field {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .field-wide {
      grid-column: 1 / -1;
    }

    span {
      color: var(--text-input-label-color, rgba(23, 50, 45, 0.72));
      font: var(--text-input-label-font, 600 0.75rem/1.2 "Segoe UI", sans-serif);
    }

    .control,
    number-aware-input,
    token-aware-input {
      width: 100%;
      min-width: 0;
    }

    number-aware-input,
    token-aware-input {
      --number-aware-input-radius: var(--text-input-radius, 8px);
      --number-aware-input-font: inherit;
      --number-aware-input-border: var(--text-input-border, rgba(20, 56, 50, 0.18));
      --number-aware-input-border-focus: var(--text-input-border-focus, #0f5449);
      --number-aware-input-background: var(--text-input-background, #ffffff);
      --number-aware-input-color: var(--text-input-color, #17322d);
      --number-aware-input-padding-y: var(--text-input-padding-y, 0.4rem);
      --number-aware-input-padding-x: var(--text-input-padding-x, 0.55rem);
      --number-aware-input-input-min-height: var(--text-input-control-min-height, 35px);
      --token-aware-input-radius: var(--text-input-radius, 8px);
      --token-aware-input-font: inherit;
      --token-aware-input-border: var(--text-input-border, rgba(20, 56, 50, 0.18));
      --token-aware-input-border-focus: var(--text-input-border-focus, #0f5449);
      --token-aware-input-background: var(--text-input-background, #ffffff);
      --token-aware-input-color: var(--text-input-color, #17322d);
      --token-aware-input-padding-y: var(--text-input-padding-y, 0.4rem);
      --token-aware-input-padding-x: var(--text-input-padding-x, 0.55rem);
      --token-aware-input-input-min-height: var(--text-input-control-min-height, 35px);
    }

    @media (max-width: 420px) {
      .field-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'text-input': CaskoUiTextInputElement;
  }
}
