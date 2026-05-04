import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emitBubbledEvent } from './input-shared';
import './number-aware-input.element';
import './token-aware-input.element';

export type StrokeInputType = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'custom';
export type StrokeInputLinecap = 'butt' | 'round' | 'square';
export type StrokeInputLinejoin = 'miter' | 'round' | 'bevel';
export type StrokeInputVectorEffect = 'none' | 'non-scaling-stroke';
export type StrokeInputChangeSource = 'field' | 'preset';
export type StrokeInputChangedProperty = keyof StrokeInputValue | 'type';

export interface StrokeInputValue {
  'stroke': string;
  'stroke-width': string;
  'stroke-opacity': string;
  'stroke-linecap': StrokeInputLinecap;
  'stroke-linejoin': StrokeInputLinejoin;
  'stroke-miterlimit': string;
  'stroke-dasharray': string;
  'stroke-dashoffset': string;
  'vector-effect': StrokeInputVectorEffect;
}

export interface StrokeInputChangeDetail {
  value: StrokeInputValue;
  previousValue: StrokeInputValue;
  changedProperty: StrokeInputChangedProperty;
  source: StrokeInputChangeSource;
}

type StrokeInputValueInput = Partial<StrokeInputValue> | null | undefined;

const LINECAP_VALUES: StrokeInputLinecap[] = ['butt', 'round', 'square'];
const LINEJOIN_VALUES: StrokeInputLinejoin[] = ['miter', 'round', 'bevel'];
const VECTOR_EFFECT_VALUES: StrokeInputVectorEffect[] = ['none', 'non-scaling-stroke'];
const TYPE_VALUES: StrokeInputType[] = ['solid', 'dashed', 'dotted', 'dash-dot', 'custom'];
const STROKE_PROPERTY_NAMES = [
  'type',
  'stroke',
  'strokeWidth',
  'strokeOpacity',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeDasharray',
  'strokeDashoffset',
  'vectorEffect',
] as const;

const DEFAULT_VALUE: StrokeInputValue = {
  'stroke': 'rgba(0, 0, 0, .5)',
  'stroke-width': '2',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0',
  'vector-effect': 'none',
};

function cloneValue(value: StrokeInputValue): StrokeInputValue {
  return { ...value };
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getColorInputValue(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_VALUE['stroke'];
}

function sanitizeNumberText(value: unknown, fallback: string, min = 0, max = Number.POSITIVE_INFINITY): string {
  const text = sanitizeString(value, fallback);
  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return String(Math.min(max, Math.max(min, parsed)));
}

function sanitizeDasharray(value: unknown, fallback = 'none'): string {
  const text = sanitizeString(value, fallback);

  if (!text || text.toLowerCase() === 'none') {
    return 'none';
  }

  const normalized = text.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = normalized.split(' ');

  return parts.length > 0 && parts.every((part) => Number.isFinite(Number(part)) && Number(part) >= 0)
    ? normalized
    : text;
}

function sanitizeChoice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function getStrokeWidth(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getPresetDasharray(type: StrokeInputType, strokeWidth: string): string {
  const width = getStrokeWidth(strokeWidth);

  switch (type) {
    case 'dashed':
      return `${width * 3} ${width * 2}`;
    case 'dotted':
      return `0 ${width * 2}`;
    case 'dash-dot':
      return `${width * 3} ${width * 2} 0 ${width * 2}`;
    default:
      return 'none';
  }
}

function sanitizeValue(value: Partial<StrokeInputValue> | null | undefined): StrokeInputValue {
  return {
    'stroke': sanitizeString(value?.['stroke'], DEFAULT_VALUE['stroke']) || DEFAULT_VALUE['stroke'],
    'stroke-width': sanitizeNumberText(value?.['stroke-width'], DEFAULT_VALUE['stroke-width']),
    'stroke-opacity': sanitizeNumberText(value?.['stroke-opacity'], DEFAULT_VALUE['stroke-opacity'], 0, 1),
    'stroke-linecap': sanitizeChoice(value?.['stroke-linecap'], LINECAP_VALUES, DEFAULT_VALUE['stroke-linecap']),
    'stroke-linejoin': sanitizeChoice(value?.['stroke-linejoin'], LINEJOIN_VALUES, DEFAULT_VALUE['stroke-linejoin']),
    'stroke-miterlimit': sanitizeNumberText(value?.['stroke-miterlimit'], DEFAULT_VALUE['stroke-miterlimit']),
    'stroke-dasharray': sanitizeDasharray(value?.['stroke-dasharray'], DEFAULT_VALUE['stroke-dasharray']),
    'stroke-dashoffset': sanitizeNumberText(value?.['stroke-dashoffset'], DEFAULT_VALUE['stroke-dashoffset']),
    'vector-effect': sanitizeChoice(value?.['vector-effect'], VECTOR_EFFECT_VALUES, DEFAULT_VALUE['vector-effect']),
  };
}

@customElement('stroke-input')
export class CaskoUiStrokeInputElement extends LitElement {
  @property({ type: String, reflect: true })
  type: StrokeInputType = 'solid';

  @property({ type: String, reflect: true })
  stroke = DEFAULT_VALUE['stroke'];

  @property({ type: String, attribute: 'stroke-width', reflect: true })
  strokeWidth = DEFAULT_VALUE['stroke-width'];

  @property({ type: String, attribute: 'stroke-opacity', reflect: true })
  strokeOpacity = DEFAULT_VALUE['stroke-opacity'];

  @property({ type: String, attribute: 'stroke-linecap', reflect: true })
  strokeLinecap: StrokeInputLinecap = DEFAULT_VALUE['stroke-linecap'];

  @property({ type: String, attribute: 'stroke-linejoin', reflect: true })
  strokeLinejoin: StrokeInputLinejoin = DEFAULT_VALUE['stroke-linejoin'];

  @property({ type: String, attribute: 'stroke-miterlimit', reflect: true })
  strokeMiterlimit = DEFAULT_VALUE['stroke-miterlimit'];

  @property({ type: String, attribute: 'stroke-dasharray', reflect: true })
  strokeDasharray = DEFAULT_VALUE['stroke-dasharray'];

  @property({ type: String, attribute: 'stroke-dashoffset', reflect: true })
  strokeDashoffset = DEFAULT_VALUE['stroke-dashoffset'];

  @property({ type: String, attribute: 'vector-effect', reflect: true })
  vectorEffect: StrokeInputVectorEffect = DEFAULT_VALUE['vector-effect'];

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  private currentValue = cloneValue(DEFAULT_VALUE);
  private lastCommittedValue = cloneValue(DEFAULT_VALUE);
  private customDasharray = DEFAULT_VALUE['stroke-dasharray'];

  get value(): StrokeInputValue {
    return cloneValue(this.currentValue);
  }

  set value(value: StrokeInputValueInput) {
    const previousValue = this.currentValue;
    this.#applyValue(value);
    this.currentValue = this.#createValue();
    this.lastCommittedValue = cloneValue(this.currentValue);
    this.requestUpdate('value', previousValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.type = sanitizeChoice(this.type, TYPE_VALUES, 'solid');

    if (this.type === 'custom') {
      this.customDasharray = this.strokeDasharray;
    } else {
      this.strokeDasharray = getPresetDasharray(this.type, this.strokeWidth);
    }

    this.#syncValueFromProperties();
    this.lastCommittedValue = this.#createValue();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('type')) {
      this.type = sanitizeChoice(this.type, TYPE_VALUES, 'solid');
    }

    if (this.type !== 'custom' && (changedProperties.has('type') || changedProperties.has('strokeWidth'))) {
      this.strokeDasharray = getPresetDasharray(this.type, this.strokeWidth);
    }

    if (STROKE_PROPERTY_NAMES.some((property) => changedProperties.has(property))) {
      this.#syncValueFromProperties();
    }
  }

  focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('.control')?.focus(options);
  }

  render() {
    return html`
      <div class="field-grid">
        <label class="field">
          <span>Type</span>
          <token-aware-input
            class="control"
            .value=${this.type}
            .allowedValues=${TYPE_VALUES}
            suggestion-mode="dropdown"
            control-position="end"
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${this.#onTypeInput}
            @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
        </label>

        <label class="field">
          <span>Stroke</span>
          <input
            class="control"
            type="color"
            colorspace="limited-srgb"
            alpha="true"
            .value=${getColorInputValue(this.stroke)}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${(event: Event) => this.#onTextInput('stroke', event)}
            @change=${this.#onNativeCommit}
            @keydown=${this.#onCommitKeydown} />
        </label>

        ${this.#renderNumberField('Width', 'stroke-width', this.strokeWidth, 0, Number.NaN, 1, 0.1)}
        ${this.#renderNumberField('Opacity', 'stroke-opacity', this.strokeOpacity, 0, 1, 0.1, 0.05)}

        ${this.#renderChoiceField('Cap', 'stroke-linecap', this.strokeLinecap, LINECAP_VALUES)}
        ${this.#renderChoiceField('Join', 'stroke-linejoin', this.strokeLinejoin, LINEJOIN_VALUES)}

        ${this.#renderNumberField('Miter', 'stroke-miterlimit', this.strokeMiterlimit, 0, Number.NaN, 1, 0.1)}
        ${this.#renderNumberField('Dash offset', 'stroke-dashoffset', this.strokeDashoffset, 0, Number.NaN, 1, 0.1)}

        <label class="field">
          <span>Dash array</span>
          <number-aware-input
            class="control"
            .value=${this.strokeDasharray}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            readonly-mode=${this.strokeDasharray.toLowerCase() === 'none' ? 'none' : 'text'}
            step="1"
            step-decimal="0.1"
            control-position="end"
            @input=${(event: Event) => this.#onNumberInput('stroke-dasharray', event)}
            @number-aware-input-commit=${this.#onChildCommit}></number-aware-input>
        </label>

        <label class="field">
          <span>Vector effect</span>
          <token-aware-input
            class="control"
            .value=${this.vectorEffect}
            .allowedValues=${VECTOR_EFFECT_VALUES}
            suggestion-mode="dropdown"
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${(event: Event) => this.#onChoiceInput('vector-effect', event)}
            @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
        </label>
      </div>
    `;
  }

  #renderChoiceField<T extends string>(
    label: string,
    property: keyof StrokeInputValue,
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
          .hideOnSelect=${this.hideOnSelect}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${(event: Event) => this.#onChoiceInput(property, event)}
          @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
      </label>
    `;
  }

  #renderNumberField(
    label: string,
    property: keyof StrokeInputValue,
    value: string,
    min: number,
    max: number,
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
          .min=${min}
          .max=${max}
          .step=${step}
          .stepDecimal=${stepDecimal}
          @input=${(event: Event) => this.#onNumberInput(property, event)}
          @number-aware-input-commit=${this.#onChildCommit}></number-aware-input>
      </label>
    `;
  }

  #applyValue(value: StrokeInputValueInput): void {
    const sanitized = sanitizeValue(value);
    this.stroke = sanitized['stroke'];
    this.strokeWidth = sanitized['stroke-width'];
    this.strokeOpacity = sanitized['stroke-opacity'];
    this.strokeLinecap = sanitized['stroke-linecap'];
    this.strokeLinejoin = sanitized['stroke-linejoin'];
    this.strokeMiterlimit = sanitized['stroke-miterlimit'];
    this.strokeDasharray = sanitized['stroke-dasharray'];
    this.strokeDashoffset = sanitized['stroke-dashoffset'];
    this.vectorEffect = sanitized['vector-effect'];
    this.customDasharray = sanitized['stroke-dasharray'];
  }

  #createValue(): StrokeInputValue {
    return sanitizeValue({
      'stroke': this.stroke,
      'stroke-width': this.strokeWidth,
      'stroke-opacity': this.strokeOpacity,
      'stroke-linecap': this.strokeLinecap,
      'stroke-linejoin': this.strokeLinejoin,
      'stroke-miterlimit': this.strokeMiterlimit,
      'stroke-dasharray': this.strokeDasharray,
      'stroke-dashoffset': this.strokeDashoffset,
      'vector-effect': this.vectorEffect,
    });
  }

  #syncValueFromProperties(): void {
    this.currentValue = this.#createValue();
  }

  #commitPropertyChange(
    changedProperty: StrokeInputChangedProperty,
    previousValue: StrokeInputValue,
    source: StrokeInputChangeSource,
  ): void {
    this.#syncValueFromProperties();
    const detail = {
      value: this.value,
      previousValue,
      changedProperty,
      source,
    };

    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    emitBubbledEvent(this, 'stroke-input-change', detail);
  }

  #emitCommit(): void {
    if (this.disabled || this.readonly) {
      return;
    }

    const detail = {
      value: this.value,
      previousValue: this.lastCommittedValue,
      changedProperty: 'type' as StrokeInputChangedProperty,
      source: 'field' as StrokeInputChangeSource,
    };
    this.lastCommittedValue = this.value;
    emitBubbledEvent(this, 'stroke-input-commit', detail);
  }

  #onTypeInput = (event: Event): void => {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };
    const nextType = sanitizeChoice(input.value, TYPE_VALUES, 'solid');
    this.type = nextType;

    if (nextType === 'custom') {
      this.strokeDasharray = this.customDasharray;
    } else {
      this.strokeDasharray = getPresetDasharray(nextType, this.strokeWidth);
      if (nextType === 'dotted') {
        this.strokeLinecap = 'round';
      }
    }

    this.#commitPropertyChange('type', previousValue, 'preset');
  };

  #onTextInput(property: keyof StrokeInputValue, event: Event): void {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    this.stroke = (event.currentTarget as HTMLInputElement).value;
    this.#commitPropertyChange(property, previousValue, 'field');
  }

  #onChoiceInput(property: keyof StrokeInputValue, event: Event): void {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const value = (event.currentTarget as unknown as { value: string }).value;

    switch (property) {
      case 'stroke-linecap':
        this.strokeLinecap = sanitizeChoice(value, LINECAP_VALUES, DEFAULT_VALUE['stroke-linecap']);
        break;
      case 'stroke-linejoin':
        this.strokeLinejoin = sanitizeChoice(value, LINEJOIN_VALUES, DEFAULT_VALUE['stroke-linejoin']);
        break;
      case 'vector-effect':
        this.vectorEffect = sanitizeChoice(value, VECTOR_EFFECT_VALUES, DEFAULT_VALUE['vector-effect']);
        break;
      default:
        break;
    }

    this.#commitPropertyChange(property, previousValue, 'field');
  }

  #onNumberInput(property: keyof StrokeInputValue, event: Event): void {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };

    switch (property) {
      case 'stroke-width':
        this.strokeWidth = sanitizeNumberText(input.value, this.strokeWidth);
        if (this.type !== 'custom') {
          this.strokeDasharray = getPresetDasharray(this.type, this.strokeWidth);
        }
        break;
      case 'stroke-opacity':
        this.strokeOpacity = sanitizeNumberText(input.value, this.strokeOpacity, 0, 1);
        break;
      case 'stroke-miterlimit':
        this.strokeMiterlimit = sanitizeNumberText(input.value, this.strokeMiterlimit);
        break;
      case 'stroke-dashoffset':
        this.strokeDashoffset = sanitizeNumberText(input.value, this.strokeDashoffset);
        break;
      case 'stroke-dasharray':
        this.strokeDasharray = sanitizeDasharray(input.value, this.strokeDasharray);
        this.customDasharray = this.strokeDasharray;
        this.type = 'custom';
        break;
      default:
        break;
    }

    this.#commitPropertyChange(property, previousValue, 'field');
  }

  #onNativeCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit();
  };

  #onChildCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit();
  };

  #onCommitKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !this.disabled && !this.readonly) {
      this.#emitCommit();
    }
  };

  static styles = css`
    :host {
      display: block;
      width: var(--stroke-input-width, 100%);
      color: var(--stroke-input-color, #17322d);
      font: var(--stroke-input-font, 400 0.95rem/1.35 "Segoe UI", sans-serif);
    }

    :host([disabled]) {
      opacity: var(--stroke-input-disabled-opacity, 0.72);
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--stroke-input-gap, 10px);
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
      color: var(--stroke-input-label-color, rgba(23, 50, 45, 0.72));
      font: var(--stroke-input-label-font, 600 0.75rem/1.2 "Segoe UI", sans-serif);
    }

    .control,
    input,
    number-aware-input,
    token-aware-input {
      width: 100%;
      min-width: 0;
    }

    input {
      min-height: var(--stroke-input-control-min-height, 35px);
      border-radius: var(--stroke-input-radius, 8px);
      border: 1px solid var(--stroke-input-border, rgba(20, 56, 50, 0.18));
      background: var(--stroke-input-background, #ffffff);
      color: var(--stroke-input-color, #17322d);
      padding: var(--stroke-input-padding-y, 0.4rem) var(--stroke-input-padding-x, 0.55rem);
      font: inherit;
    }

    input:focus {
      border-color: var(--stroke-input-border-focus, #0f5449);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--stroke-input-border-focus, #0f5449) 16%, transparent);
      outline: none;
    }

    input:disabled,
    input[readonly] {
      cursor: not-allowed;
      opacity: 0.68;
    }

    input[type="color"] {
      padding: 0;
      border: none;
      width:2rem;
    }

    input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch {
      border: none;
    }

    number-aware-input,
    token-aware-input {
      --number-aware-input-radius: var(--stroke-input-radius, 8px);
      --number-aware-input-font: inherit;
      --number-aware-input-border: var(--stroke-input-border, rgba(20, 56, 50, 0.18));
      --number-aware-input-border-focus: var(--stroke-input-border-focus, #0f5449);
      --number-aware-input-background: var(--stroke-input-background, #ffffff);
      --number-aware-input-color: var(--stroke-input-color, #17322d);
      --number-aware-input-padding-y: var(--stroke-input-padding-y, 0.4rem);
      --number-aware-input-padding-x: var(--stroke-input-padding-x, 0.55rem);
      --number-aware-input-input-min-height: var(--stroke-input-control-min-height, 35px);
      --token-aware-input-radius: var(--stroke-input-radius, 8px);
      --token-aware-input-font: inherit;
      --token-aware-input-border: var(--stroke-input-border, rgba(20, 56, 50, 0.18));
      --token-aware-input-border-focus: var(--stroke-input-border-focus, #0f5449);
      --token-aware-input-background: var(--stroke-input-background, #ffffff);
      --token-aware-input-color: var(--stroke-input-color, #17322d);
      --token-aware-input-padding-y: var(--stroke-input-padding-y, 0.4rem);
      --token-aware-input-padding-x: var(--stroke-input-padding-x, 0.55rem);
      --token-aware-input-input-min-height: var(--stroke-input-control-min-height, 35px);
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
    'stroke-input': CaskoUiStrokeInputElement;
  }
}
