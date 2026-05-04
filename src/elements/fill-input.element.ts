import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emitBubbledEvent } from './input-shared';
import './number-aware-input.element';
import './token-aware-input.element';

export type FillInputRule = 'nonzero' | 'evenodd';
export type FillInputChangeSource = 'field';
export type FillInputChangedProperty = keyof FillInputValue;

export interface FillInputValue {
  'fill': string;
  'fill-opacity': string;
  'fill-rule': FillInputRule;
}

export interface FillInputChangeDetail {
  value: FillInputValue;
  previousValue: FillInputValue;
  changedProperty: FillInputChangedProperty;
  source: FillInputChangeSource;
}

type FillInputValueInput = Partial<FillInputValue> | null | undefined;

const FILL_RULE_VALUES: FillInputRule[] = ['nonzero', 'evenodd'];
const FILL_PROPERTY_NAMES = ['fill', 'fillOpacity', 'fillRule'] as const;

const DEFAULT_VALUE: FillInputValue = {
  'fill': '#0f5449',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
};

function cloneValue(value: FillInputValue): FillInputValue {
  return { ...value };
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getColorInputValue(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_VALUE['fill'];
}

function sanitizeNumberText(value: unknown, fallback: string, min = 0, max = Number.POSITIVE_INFINITY): string {
  const text = sanitizeString(value, fallback);
  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return String(Math.min(max, Math.max(min, parsed)));
}

function sanitizeChoice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function sanitizeValue(value: FillInputValueInput): FillInputValue {
  return {
    'fill': sanitizeString(value?.['fill'], DEFAULT_VALUE['fill']) || DEFAULT_VALUE['fill'],
    'fill-opacity': sanitizeNumberText(value?.['fill-opacity'], DEFAULT_VALUE['fill-opacity'], 0, 1),
    'fill-rule': sanitizeChoice(value?.['fill-rule'], FILL_RULE_VALUES, DEFAULT_VALUE['fill-rule']),
  };
}

@customElement('fill-input')
export class CaskoUiFillInputElement extends LitElement {
  @property({ type: String, reflect: true })
  fill = DEFAULT_VALUE['fill'];

  @property({ type: String, attribute: 'fill-opacity', reflect: true })
  fillOpacity = DEFAULT_VALUE['fill-opacity'];

  @property({ type: String, attribute: 'fill-rule', reflect: true })
  fillRule: FillInputRule = DEFAULT_VALUE['fill-rule'];

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  private currentValue = cloneValue(DEFAULT_VALUE);
  private lastCommittedValue = cloneValue(DEFAULT_VALUE);

  get value(): FillInputValue {
    return cloneValue(this.currentValue);
  }

  set value(value: FillInputValueInput) {
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
    if (FILL_PROPERTY_NAMES.some((property) => changedProperties.has(property))) {
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
          <span>Opacity</span>
          <number-aware-input
            class="control"
            .value=${this.fillOpacity}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            readonly-mode="text"
            .min=${0}
            .max=${1}
            .step=${0.1}
            .stepDecimal=${0.05}
            control-position="end"
            @input=${this.#onOpacityInput}
            @number-aware-input-commit=${this.#onChildCommit}></number-aware-input>
        </label>

        <label class="field">
          <span>Fill</span>
          <input
            class="control"
            type="color"
            colorspace="limited-srgb"
            alpha="true"
            .value=${getColorInputValue(this.fill)}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${this.#onFillInput}
            @change=${this.#onNativeCommit}
            @keydown=${this.#onCommitKeydown} />
        </label>

        <label class="field field-wide">
          <span>Rule</span>
          <token-aware-input
            class="control"
            .value=${this.fillRule}
            .allowedValues=${FILL_RULE_VALUES}
            suggestion-mode="dropdown"
            control-position="end"
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${this.#onRuleInput}
            @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
        </label>
      </div>
    `;
  }

  #applyValue(value: FillInputValueInput): void {
    const sanitized = sanitizeValue(value);
    this.fill = sanitized['fill'];
    this.fillOpacity = sanitized['fill-opacity'];
    this.fillRule = sanitized['fill-rule'];
  }

  #createValue(): FillInputValue {
    return sanitizeValue({
      'fill': this.fill,
      'fill-opacity': this.fillOpacity,
      'fill-rule': this.fillRule,
    });
  }

  #syncValueFromProperties(): void {
    this.currentValue = this.#createValue();
  }

  #commitPropertyChange(changedProperty: FillInputChangedProperty, previousValue: FillInputValue): void {
    this.#syncValueFromProperties();
    const detail = {
      value: this.value,
      previousValue,
      changedProperty,
      source: 'field' as FillInputChangeSource,
    };

    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    emitBubbledEvent(this, 'fill-input-change', detail);
  }

  #emitCommit(): void {
    if (this.disabled || this.readonly) {
      return;
    }

    const detail = {
      value: this.value,
      previousValue: this.lastCommittedValue,
      changedProperty: 'fill' as FillInputChangedProperty,
      source: 'field' as FillInputChangeSource,
    };
    this.lastCommittedValue = this.value;
    emitBubbledEvent(this, 'fill-input-commit', detail);
  }

  #onFillInput = (event: Event): void => {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    this.fill = (event.currentTarget as HTMLInputElement).value;
    this.#commitPropertyChange('fill', previousValue);
  };

  #onOpacityInput = (event: Event): void => {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };
    this.fillOpacity = sanitizeNumberText(input.value, this.fillOpacity, 0, 1);
    this.#commitPropertyChange('fill-opacity', previousValue);
  };

  #onRuleInput = (event: Event): void => {
    event.stopPropagation();

    if (this.disabled || this.readonly) {
      return;
    }

    const previousValue = this.value;
    const input = event.currentTarget as unknown as { value: string };
    this.fillRule = sanitizeChoice(input.value, FILL_RULE_VALUES, DEFAULT_VALUE['fill-rule']);
    this.#commitPropertyChange('fill-rule', previousValue);
  };

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
      width: var(--fill-input-width, 100%);
      color: var(--fill-input-color, #17322d);
      font: var(--fill-input-font, 400 0.95rem/1.35 "Segoe UI", sans-serif);
    }

    :host([disabled]) {
      opacity: var(--fill-input-disabled-opacity, 0.72);
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--fill-input-gap, 10px);
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
      color: var(--fill-input-label-color, rgba(23, 50, 45, 0.72));
      font: var(--fill-input-label-font, 600 0.75rem/1.2 "Segoe UI", sans-serif);
    }

    .control,
    input,
    number-aware-input,
    token-aware-input {
      width: 100%;
      min-width: 0;
    }

    input {
      min-height: var(--fill-input-control-min-height, 35px);
      border-radius: var(--fill-input-radius, 8px);
      border: 1px solid var(--fill-input-border, rgba(20, 56, 50, 0.18));
      background: var(--fill-input-background, #ffffff);
      color: var(--fill-input-color, #17322d);
      padding: var(--fill-input-padding-y, 0.4rem) var(--fill-input-padding-x, 0.55rem);
      font: inherit;
    }

    input:focus {
      border-color: var(--fill-input-border-focus, #0f5449);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--fill-input-border-focus, #0f5449) 16%, transparent);
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
      width: 2rem;
    }

    input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch {
      border: none;
    }

    number-aware-input,
    token-aware-input {
      --number-aware-input-radius: var(--fill-input-radius, 8px);
      --number-aware-input-font: inherit;
      --number-aware-input-border: var(--fill-input-border, rgba(20, 56, 50, 0.18));
      --number-aware-input-border-focus: var(--fill-input-border-focus, #0f5449);
      --number-aware-input-background: var(--fill-input-background, #ffffff);
      --number-aware-input-color: var(--fill-input-color, #17322d);
      --number-aware-input-padding-y: var(--fill-input-padding-y, 0.4rem);
      --number-aware-input-padding-x: var(--fill-input-padding-x, 0.55rem);
      --number-aware-input-input-min-height: var(--fill-input-control-min-height, 35px);
      --token-aware-input-radius: var(--fill-input-radius, 8px);
      --token-aware-input-font: inherit;
      --token-aware-input-border: var(--fill-input-border, rgba(20, 56, 50, 0.18));
      --token-aware-input-border-focus: var(--fill-input-border-focus, #0f5449);
      --token-aware-input-background: var(--fill-input-background, #ffffff);
      --token-aware-input-color: var(--fill-input-color, #17322d);
      --token-aware-input-padding-y: var(--fill-input-padding-y, 0.4rem);
      --token-aware-input-padding-x: var(--fill-input-padding-x, 0.55rem);
      --token-aware-input-input-min-height: var(--fill-input-control-min-height, 35px);
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
    'fill-input': CaskoUiFillInputElement;
  }
}
