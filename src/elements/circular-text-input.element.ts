import {
  buildCircularSectorGuidePath,
  buildCircularSectorPathByMode,
  createCircularSectorViewModel,
  type CircularSectorGuideRing,
  type ICircularSectorViewModel,
  type IPoint,
} from '@casko/circular-sector';
import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { type AnchorPointBlock, type AnchorPointInline, type AnchorPointValue } from './anchor-point-input.element';
import { type TextInputValue } from './text-input.element';
import './anchor-point-input.element';
import './number-aware-input.element';
import './text-input.element';
import './token-aware-input.element';

export type CircularTextInputMode = 'point' | 'path';
export type CircularTextInputChangedProperty =
  | 'text'
  | 'mode'
  | 'anchor'
  | 'offsetX'
  | 'offsetY'
  | 'radialOffset'
  | 'textAttributes';
export type CircularTextInputChangeSource = 'field' | 'text-input' | 'anchor' | 'mode';
export type CircularTextInputSelectionSource = 'pointer' | 'keyboard';
export type CircularTextInputCommitSource = CircularTextInputChangeSource | CircularTextInputSelectionSource;

export interface CircularTextInputSector {
  value: number;
  radius: number;
  height: number;
  label?: string;
}

export interface CircularTextInputValueItem {
  text: string;
  mode: CircularTextInputMode;
  anchor: AnchorPointValue;
  offsetX: number;
  offsetY: number;
  radialOffset: number;
  textAttributes: TextInputValue;
}

export type CircularTextInputValue = CircularTextInputValueItem[];

export interface CircularTextInputChangeDetail {
  value: CircularTextInputValue;
  previousValue: CircularTextInputValue;
  selectedIndexes: number[];
  changedProperty: CircularTextInputChangedProperty;
  source: CircularTextInputChangeSource;
}

export interface CircularTextInputSelectionChangeDetail {
  selectedIndexes: number[];
  previousSelectedIndexes: number[];
  source: CircularTextInputSelectionSource;
}

export interface CircularTextInputCommitDetail {
  value: CircularTextInputValue;
  previousValue: CircularTextInputValue;
  selectedIndexes: number[];
  changedProperty: CircularTextInputChangedProperty | 'selection';
  source: CircularTextInputCommitSource;
}

interface CircularTextInputRenderItem {
  sector: CircularTextInputSector;
  text: CircularTextInputValueItem;
  index: number;
  ratio: number;
  path: string;
  viewModel: ICircularSectorViewModel;
}

const VIEW_BOX_SIZE = 320;
const CENTER = VIEW_BOX_SIZE / 2;
const FULL_TURN_DEGREES = 360;
const DEFAULT_SECTORS: CircularTextInputSector[] = [
  { value: 25, radius: 112, height: 40, label: 'A' },
  { value: 30, radius: 124, height: 52, label: 'B' },
  { value: 20, radius: 96, height: 36, label: 'C' },
  { value: 25, radius: 132, height: 58, label: 'D' },
];
const DEFAULT_TEXT_ATTRIBUTES: TextInputValue = {
  'rotate': '0',
  'text-anchor': 'middle',
  'dominant-baseline': 'middle',
  'alignment-baseline': 'baseline',
  'baseline-shift': '0',
  'lengthAdjust': 'spacing',
  'textLength': '',
};
const DEFAULT_VALUE_ITEM: CircularTextInputValueItem = {
  text: '',
  mode: 'point',
  anchor: 'block-center-inline-center',
  offsetX: 0,
  offsetY: 0,
  radialOffset: 0,
  textAttributes: DEFAULT_TEXT_ATTRIBUTES,
};
const TEXT_MODE_VALUES: CircularTextInputMode[] = ['point', 'path'];
const ANCHOR_VALUES: AnchorPointValue[] = [
  'block-start-inline-start',
  'block-start-inline-center',
  'block-start-inline-end',
  'block-center-inline-start',
  'block-center-inline-center',
  'block-center-inline-end',
  'block-end-inline-start',
  'block-end-inline-center',
  'block-end-inline-end',
];

function cloneTextAttributes(value: TextInputValue): TextInputValue {
  return { ...value };
}

function cloneValueItem(value: CircularTextInputValueItem): CircularTextInputValueItem {
  return {
    ...value,
    textAttributes: cloneTextAttributes(value.textAttributes),
  };
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeMode(value: unknown): CircularTextInputMode {
  return value === 'path' ? 'path' : 'point';
}

function sanitizeAnchor(value: unknown): AnchorPointValue {
  return ANCHOR_VALUES.includes(value as AnchorPointValue)
    ? value as AnchorPointValue
    : DEFAULT_VALUE_ITEM.anchor;
}

function sanitizeTextAttributes(value: Partial<TextInputValue> | null | undefined): TextInputValue {
  return {
    ...DEFAULT_TEXT_ATTRIBUTES,
    ...(value ?? {}),
  };
}

function sanitizeValueItem(
  value: Partial<CircularTextInputValueItem> | null | undefined,
  fallbackText: string,
): CircularTextInputValueItem {
  return {
    text: sanitizeString(value?.text, fallbackText),
    mode: sanitizeMode(value?.mode),
    anchor: sanitizeAnchor(value?.anchor),
    offsetX: sanitizeNumber(value?.offsetX),
    offsetY: sanitizeNumber(value?.offsetY),
    radialOffset: sanitizeNumber(value?.radialOffset),
    textAttributes: sanitizeTextAttributes(value?.textAttributes),
  };
}

@customElement('circular-text-input')
export class CaskoUiCircularTextInputElement extends LitElement {
  @property({ attribute: false })
  sectors: CircularTextInputSector[] = DEFAULT_SECTORS;

  @property({ type: Number, attribute: 'total-value' })
  totalValue = 100;

  @property({ type: Number, attribute: 'start-angle' })
  startAngle = -90;

  @property({ type: Number })
  gap = 0;

  @property({ type: Number, attribute: 'border-radius' })
  borderRadius = 0;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  @property({ attribute: false })
  selectedIndexes: number[] = [];

  private authoredValue: CircularTextInputValue = [];
  private lastCommittedValue: CircularTextInputValue = [];
  private pendingCommitChangedProperty: CircularTextInputChangedProperty = 'text';
  private pendingCommitSource: CircularTextInputChangeSource = 'field';

  get value(): CircularTextInputValue {
    return this.#getValue();
  }

  set value(value: CircularTextInputValue | null | undefined) {
    const previousValue = this.value;
    this.authoredValue = this.#sanitizeValue(value);
    this.lastCommittedValue = this.value;
    this.requestUpdate('value', previousValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.authoredValue = this.#sanitizeValue(this.authoredValue);
    this.selectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes);
    this.lastCommittedValue = this.value;
    document.addEventListener('pointerdown', this.#onDocumentPointerDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.#onDocumentPointerDown);
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has('sectors')) {
      this.selectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes);
      this.authoredValue = this.#sanitizeValue(this.authoredValue);
    }
  }

  focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('.sector-button')?.focus(options);
  }

  render() {
    const sectors = this.#getSectors();
    const value = this.#getValue(sectors);
    const items = this.#getRenderItems(sectors, value);
    const selectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes, sectors.length);
    const selectedSet = new Set(selectedIndexes);
    const editorValue = this.#getEditorValue(value, selectedIndexes);
    const editorDisabled = this.disabled || selectedIndexes.length === 0;
    const editorHeader = selectedIndexes.length === 0
      ? 'No sector selected'
      : selectedIndexes.length === 1
        ? `Sector ${selectedIndexes[0] + 1}`
        : `${selectedIndexes.length} sectors`;

    return html`
      <div class="shell">
        <svg
          class="control"
          viewBox=${`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
          role="listbox"
          aria-label="Circular sector text input"
          aria-multiselectable="true"
          aria-disabled=${String(this.disabled || this.readonly)}
          @click=${this.#onControlClick}>
          <defs>
            ${items
              .filter((item) => item.text.mode === 'path')
              .map((item) => svg`<path id=${this.#getTextPathId(item.index)} d=${this.#getGuidePath(item)}></path>`)}
          </defs>
          <g class="sector-layer">
            ${items.map((item) => this.#renderSector(item, selectedSet.has(item.index)))}
          </g>
          <g class="text-layer">
            ${items.map((item) => this.#renderText(item))}
          </g>
        </svg>

        <div class="editor">
          <div class="editor-header">${editorHeader}</div>
          <label class="field field-wide">
            <span>Text</span>
            <input
              class="text-field"
              .value=${editorValue.text}
              ?disabled=${editorDisabled}
              ?readonly=${this.readonly}
              @input=${this.#onTextInput}
              @change=${this.#onChildCommit} />
          </label>
          <label class="field">
            <span>Mode</span>
            <token-aware-input
              .value=${editorValue.mode}
              .allowedValues=${TEXT_MODE_VALUES}
              suggestion-mode="dropdown"
              control-position="end"
              .hideOnSelect=${this.hideOnSelect}
              ?disabled=${editorDisabled}
              ?readonly=${this.readonly}
              @input=${this.#onModeInput}
              @token-aware-input-commit=${this.#onChildCommit}></token-aware-input>
          </label>
          <label class="field">
            <span>Anchor</span>
            <anchor-point-input
              .value=${editorValue.anchor}
              label-display="title"
              ?disabled=${editorDisabled || this.readonly}
              @anchor-point-input-change=${this.#onAnchorChange}
              @anchor-point-input-commit=${this.#onChildCommit}></anchor-point-input>
          </label>
          ${this.#renderNumberField('Offset X', 'offsetX', editorValue.offsetX, editorDisabled)}
          ${this.#renderNumberField('Offset Y', 'offsetY', editorValue.offsetY, editorDisabled)}
          ${this.#renderNumberField('Radial offset', 'radialOffset', editorValue.radialOffset, editorDisabled)}
          <div class="field-wide">
            <text-input
              .value=${editorValue.textAttributes}
              .hideOnSelect=${this.hideOnSelect}
              ?disabled=${editorDisabled}
              ?readonly=${this.readonly}
              @input=${this.#stopChildInput}
              @text-input-change=${this.#onTextAttributesChange}
              @text-input-commit=${this.#onChildCommit}></text-input>
          </div>
        </div>
      </div>
    `;
  }

  #renderNumberField(
    label: string,
    property: Extract<CircularTextInputChangedProperty, 'offsetX' | 'offsetY' | 'radialOffset'>,
    value: number,
    editorDisabled: boolean,
  ) {
    return html`
      <label class="field">
        <span>${label}</span>
        <number-aware-input
          .value=${String(value)}
          step="1"
          step-decimal="0.1"
          control-position="end"
          ?disabled=${editorDisabled}
          ?readonly=${this.readonly}
          @input=${(event: Event) => this.#onNumberInput(event, property)}
          @number-aware-input-commit=${this.#onChildCommit}></number-aware-input>
      </label>
    `;
  }

  #renderSector(item: CircularTextInputRenderItem, selected: boolean) {
    return svg`
      <g>
        <path
          class="sector-button"
          d=${item.path}
          tabindex=${this.disabled || this.readonly ? -1 : 0}
          role="option"
          aria-label=${item.sector.label ? `Sector ${item.sector.label}` : `Sector ${item.index + 1}`}
          aria-selected=${String(selected)}
          data-index=${String(item.index)}
          @click=${this.#onSectorClick}
          @keydown=${this.#onSectorKeydown}></path>
        <path class=${`selection-ring ${selected ? 'selected' : ''}`} d=${item.path}></path>
        <path class="focus-ring" d=${item.path}></path>
      </g>
    `;
  }

  #renderText(item: CircularTextInputRenderItem) {
    const text = item.text.text.trim();
    if (!text) return nothing;

    const attrs = item.text.textAttributes;
    const transform = this.#getTextTransform(item);

    if (item.text.mode === 'path') {
      return svg`
        <text
          class="sector-text"
          fill="var(--circular-text-input-text-fill)"
          opacity="var(--circular-text-input-text-opacity)"
          font-size="var(--circular-text-input-text-font-size)"
          font-weight="var(--circular-text-input-text-font-weight)"
          text-anchor=${attrs['text-anchor']}
          dominant-baseline=${attrs['dominant-baseline']}
          alignment-baseline=${attrs['alignment-baseline']}
          baseline-shift=${attrs['baseline-shift']}
          lengthAdjust=${attrs.lengthAdjust}
          textLength=${attrs.textLength || nothing}
          transform=${transform || nothing}>
          <textPath href=${`#${this.#getTextPathId(item.index)}`} startOffset=${this.#getPathStartOffset(item.text.anchor)}>
            ${text}
          </textPath>
        </text>
      `;
    }

    const point = this.#getTextPoint(item);
    return svg`
      <text
        class="sector-text"
        x=${point.x}
        y=${point.y}
        fill="var(--circular-text-input-text-fill)"
        opacity="var(--circular-text-input-text-opacity)"
        font-size="var(--circular-text-input-text-font-size)"
        font-weight="var(--circular-text-input-text-font-weight)"
        text-anchor=${attrs['text-anchor']}
        dominant-baseline=${attrs['dominant-baseline']}
        alignment-baseline=${attrs['alignment-baseline']}
        baseline-shift=${attrs['baseline-shift']}
        lengthAdjust=${attrs.lengthAdjust}
        textLength=${attrs.textLength || nothing}
        rotate=${attrs.rotate}>
        ${text}
      </text>
    `;
  }

  #onSectorClick = (event: MouseEvent): void => {
    if (this.disabled || this.readonly) return;

    const index = Number((event.currentTarget as SVGElement).dataset.index);
    if (!Number.isInteger(index)) return;

    this.#applySelection(index, event.shiftKey || event.ctrlKey || event.metaKey, 'pointer');
  };

  #onControlClick = (event: MouseEvent): void => {
    if (this.disabled || this.readonly || event.target !== event.currentTarget) return;

    this.#clearSelection('pointer');
  };

  #onDocumentPointerDown = (event: PointerEvent): void => {
    if (this.disabled || this.readonly || this.selectedIndexes.length === 0) return;
    if (event.composedPath().includes(this)) return;

    this.#clearSelection('pointer');
  };

  #onSectorKeydown = (event: KeyboardEvent): void => {
    if (this.disabled || this.readonly) return;

    const target = event.currentTarget as SVGElement;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;

    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      this.#focusSector(index + direction);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.#focusSector(event.key === 'Home' ? 0 : this.#getSectors().length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#applySelection(index, event.shiftKey || event.ctrlKey || event.metaKey, 'keyboard');
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.#clearSelection('keyboard');
    }
  };

  #focusSector(index: number): void {
    const sectorCount = this.#getSectors().length;
    if (sectorCount === 0) return;

    const nextIndex = ((index % sectorCount) + sectorCount) % sectorCount;
    const nextElement = this.renderRoot.querySelector<SVGElement>(`.sector-button[data-index="${nextIndex}"]`);
    nextElement?.focus();
  }

  #applySelection(index: number, additive: boolean, source: CircularTextInputSelectionSource): void {
    const previousSelectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes);
    let nextSelectedIndexes: number[];

    if (additive) {
      nextSelectedIndexes = previousSelectedIndexes.includes(index)
        ? previousSelectedIndexes.filter((entry) => entry !== index)
        : [...previousSelectedIndexes, index];
    } else if (previousSelectedIndexes.length === 1 && previousSelectedIndexes[0] === index) {
      nextSelectedIndexes = [];
    } else {
      nextSelectedIndexes = [index];
    }

    nextSelectedIndexes = this.#sanitizeSelectedIndexes(nextSelectedIndexes);
    if (this.#indexesEqual(previousSelectedIndexes, nextSelectedIndexes)) return;

    this.selectedIndexes = nextSelectedIndexes;
    this.#emitSelectionChange(previousSelectedIndexes, source);
    this.#emitCommit('selection', source, this.lastCommittedValue);
  }

  #clearSelection(source: CircularTextInputSelectionSource): void {
    const previousSelectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes);
    if (previousSelectedIndexes.length === 0) return;

    this.selectedIndexes = [];
    this.#emitSelectionChange(previousSelectedIndexes, source);
    this.#emitCommit('selection', source, this.lastCommittedValue);
  }

  #onTextInput = (event: Event): void => {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    this.#applyTextValueChange('text', input.value, 'field');
  };

  #onModeInput = (event: Event): void => {
    event.stopPropagation();
    const input = event.currentTarget as unknown as { value: string };
    this.#applyTextValueChange('mode', sanitizeMode(input.value), 'mode');
  };

  #onAnchorChange = (event: CustomEvent<{ value: AnchorPointValue }>): void => {
    event.stopPropagation();
    this.#applyTextValueChange('anchor', event.detail.value, 'anchor');
  };

  #onNumberInput(event: Event, property: Extract<CircularTextInputChangedProperty, 'offsetX' | 'offsetY' | 'radialOffset'>): void {
    event.stopPropagation();
    const input = event.currentTarget as unknown as { value: string };
    this.#applyTextValueChange(property, sanitizeNumber(input.value), 'field');
  }

  #onTextAttributesChange = (event: CustomEvent<{ value: TextInputValue }>): void => {
    event.stopPropagation();
    this.#applyTextValueChange('textAttributes', event.detail.value, 'text-input');
  };

  #stopChildInput = (event: Event): void => {
    event.stopPropagation();
  };

  #onChildCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit(this.pendingCommitChangedProperty, this.pendingCommitSource, this.lastCommittedValue);
  };

  #applyTextValueChange(
    property: CircularTextInputChangedProperty,
    nextValue: string | number | TextInputValue,
    source: CircularTextInputChangeSource,
  ): void {
    if (this.disabled || this.readonly || this.selectedIndexes.length === 0) return;

    const previousValue = this.value;
    const selectedSet = new Set(this.#sanitizeSelectedIndexes(this.selectedIndexes));
    const nextItems = this.#getValue().map((entry, index) => {
      if (!selectedSet.has(index)) return entry;

      switch (property) {
        case 'text':
          return { ...entry, text: sanitizeString(nextValue, entry.text) };
        case 'mode':
          return { ...entry, mode: sanitizeMode(nextValue) };
        case 'anchor':
          return { ...entry, anchor: sanitizeAnchor(nextValue) };
        case 'offsetX':
        case 'offsetY':
        case 'radialOffset':
          return { ...entry, [property]: sanitizeNumber(nextValue) };
        case 'textAttributes':
          return { ...entry, textAttributes: sanitizeTextAttributes(nextValue as TextInputValue) };
        default:
          return entry;
      }
    });

    this.authoredValue = nextItems;
    this.pendingCommitChangedProperty = property;
    this.pendingCommitSource = source;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.#emitChange(property, source, previousValue);
  }

  #emitChange(
    changedProperty: CircularTextInputChangedProperty,
    source: CircularTextInputChangeSource,
    previousValue: CircularTextInputValue,
  ): void {
    this.#emitEvent('circular-text-input-change', {
      value: this.value,
      previousValue,
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      changedProperty,
      source,
    } satisfies CircularTextInputChangeDetail);
  }

  #emitSelectionChange(
    previousSelectedIndexes: number[],
    source: CircularTextInputSelectionSource,
  ): void {
    this.#emitEvent('circular-text-input-selection-change', {
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      previousSelectedIndexes,
      source,
    } satisfies CircularTextInputSelectionChangeDetail);
  }

  #emitCommit(
    changedProperty: CircularTextInputChangedProperty | 'selection',
    source: CircularTextInputCommitSource,
    previousValue: CircularTextInputValue,
  ): void {
    const detail = {
      value: this.value,
      previousValue,
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      changedProperty,
      source,
    } satisfies CircularTextInputCommitDetail;

    this.lastCommittedValue = this.value;
    this.#emitEvent('circular-text-input-commit', detail);
  }

  #emitEvent<T>(eventName: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(eventName, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  #getRenderItems(
    sectors: CircularTextInputSector[],
    value: CircularTextInputValue,
  ): CircularTextInputRenderItem[] {
    const total = this.#getValueTotal(sectors);
    let offset = 0;

    return sectors.map((sector, index) => {
      const ratio = total > 0 ? Math.max(0, sector.value) / total : 1 / sectors.length;
      const startTurn = offset;
      offset += ratio;
      const radius = Math.max(1, sector.radius);
      const height = Math.max(1, Math.min(radius, sector.height));
      const viewModel = createCircularSectorViewModel({
        center: { x: CENTER, y: CENTER },
        radius,
        ratio,
        theta: this.#degreesToRadians(this.#getStartAngle() + startTurn * FULL_TURN_DEGREES),
        gap: this.#getGap(),
        height,
        borderRadius: this.#getBorderRadius(),
      });

      return {
        sector,
        text: value[index] ?? this.#getDefaultValueItem(sector, index),
        index,
        ratio,
        path: buildCircularSectorPathByMode(viewModel, { mode: 'arc', cornerRadius: this.#getBorderRadius() }),
        viewModel,
      };
    });
  }

  #getEditorValue(value: CircularTextInputValue, selectedIndexes: number[]): CircularTextInputValueItem {
    if (selectedIndexes.length > 0) {
      return cloneValueItem(value[selectedIndexes[0]] ?? DEFAULT_VALUE_ITEM);
    }

    return cloneValueItem(DEFAULT_VALUE_ITEM);
  }

  #getValue(sectors = this.#getSectors()): CircularTextInputValue {
    return sectors.map((sector, index) => sanitizeValueItem(this.authoredValue[index], this.#getFallbackText(sector, index)));
  }

  #sanitizeValue(value: CircularTextInputValue | null | undefined): CircularTextInputValue {
    const source = Array.isArray(value) ? value : [];
    const sectors = this.#getSectors();
    const length = Math.max(source.length, sectors.length);
    return Array.from({ length }, (_, index) => sanitizeValueItem(source[index], this.#getFallbackText(sectors[index], index)));
  }

  #getDefaultValueItem(sector: CircularTextInputSector | undefined, index: number): CircularTextInputValueItem {
    return sanitizeValueItem(undefined, this.#getFallbackText(sector, index));
  }

  #getFallbackText(sector: CircularTextInputSector | undefined, index: number): string {
    return sector?.label?.trim() || `Sector ${index + 1}`;
  }

  #getSectors(): CircularTextInputSector[] {
    const source = Array.isArray(this.sectors) && this.sectors.length > 0 ? this.sectors : DEFAULT_SECTORS;
    return source.map((sector) => {
      const radius = Number.isFinite(sector.radius) ? Math.max(1, sector.radius) : 100;
      return {
        value: Number.isFinite(sector.value) ? Math.max(0, sector.value) : 1,
        radius,
        height: Number.isFinite(sector.height) ? Math.max(1, Math.min(radius, sector.height)) : Math.min(radius, 40),
        label: sector.label,
      };
    });
  }

  #sanitizeSelectedIndexes(indexes: number[], sectorCount = this.#getSectors().length): number[] {
    const seen = new Set<number>();
    indexes.forEach((index) => {
      if (Number.isInteger(index) && index >= 0 && index < sectorCount) {
        seen.add(index);
      }
    });

    return [...seen].sort((a, b) => a - b);
  }

  #indexesEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }

  #getTextPoint(item: CircularTextInputRenderItem): IPoint {
    const anchor = this.#getAnchorParts(item.text.anchor);
    const point = item.viewModel.anchors[this.#getGuideRing(anchor.block)][this.#getGuidePosition(anchor.inline)];
    return this.#applyTextOffsets(point, item);
  }

  #getGuidePath(item: CircularTextInputRenderItem): string {
    return buildCircularSectorGuidePath(this.#getOffsetViewModel(item), {
      ring: this.#getGuideRing(this.#getAnchorParts(item.text.anchor).block),
    });
  }

  #getOffsetViewModel(item: CircularTextInputRenderItem): ICircularSectorViewModel {
    if (item.text.radialOffset === 0) {
      return item.viewModel;
    }

    const nextRadius = Math.max(1, item.sector.radius + item.text.radialOffset);
    return createCircularSectorViewModel({
      ...item.viewModel.source,
      radius: nextRadius,
      height: Math.max(1, Math.min(nextRadius, item.sector.height)),
    });
  }

  #applyTextOffsets(point: IPoint, item: CircularTextInputRenderItem): IPoint {
    const vectorX = point.x - CENTER;
    const vectorY = point.y - CENTER;
    const length = Math.hypot(vectorX, vectorY) || 1;

    return {
      x: point.x + (vectorX / length) * item.text.radialOffset + item.text.offsetX,
      y: point.y + (vectorY / length) * item.text.radialOffset + item.text.offsetY,
    };
  }

  #getTextTransform(item: CircularTextInputRenderItem): string {
    const transforms = [];
    if (item.text.offsetX !== 0 || item.text.offsetY !== 0) {
      transforms.push(`translate(${item.text.offsetX} ${item.text.offsetY})`);
    }

    const rotate = Number(item.text.textAttributes.rotate);
    if (Number.isFinite(rotate) && rotate !== 0) {
      transforms.push(`rotate(${rotate} ${CENTER} ${CENTER})`);
    }

    return transforms.join(' ');
  }

  #getAnchorParts(value: AnchorPointValue): { block: AnchorPointBlock; inline: AnchorPointInline } {
    const [, block = 'center', , inline = 'center'] = value.split('-') as [
      'block',
      AnchorPointBlock,
      'inline',
      AnchorPointInline,
    ];

    return { block, inline };
  }

  #getGuideRing(block: AnchorPointBlock): CircularSectorGuideRing {
    if (block === 'start') return 'outer';
    if (block === 'end') return 'inner';
    return 'middle';
  }

  #getGuidePosition(inline: AnchorPointInline): 'start' | 'mid' | 'end' {
    if (inline === 'start') return 'start';
    if (inline === 'end') return 'end';
    return 'mid';
  }

  #getPathStartOffset(anchor: AnchorPointValue): string {
    const { inline } = this.#getAnchorParts(anchor);
    if (inline === 'start') return '0%';
    if (inline === 'end') return '100%';
    return '50%';
  }

  #getTextPathId(index: number): string {
    return `circular-text-input-${this.#instanceId}-${index}-path`;
  }

  readonly #instanceId = Math.random().toString(36).slice(2);

  #getValueTotal(sectors: CircularTextInputSector[]): number {
    const total = sectors.reduce((sum, sector) => sum + Math.max(0, sector.value), 0);
    return total > 0 ? total : sectors.length;
  }

  #getGap(): number {
    return Number.isFinite(this.gap) && this.gap >= 0 ? this.gap : 0;
  }

  #getBorderRadius(): number {
    return Number.isFinite(this.borderRadius) && this.borderRadius >= 0 ? this.borderRadius : 0;
  }

  #getStartAngle(): number {
    return Number.isFinite(this.startAngle) ? this.startAngle : -90;
  }

  #degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  static styles = css`
    :host {
      display: inline-block;
      min-width: 0;
      color: var(--circular-text-input-color, #17322d);
      font: var(--circular-text-input-font, 400 0.95rem/1.35 "Segoe UI", sans-serif);
      --circular-text-input-size: 320px;
      --circular-text-input-sector-fill: rgba(15, 84, 73, 0.08);
      --circular-text-input-sector-stroke: rgba(15, 84, 73, 0.42);
      --circular-text-input-sector-stroke-width: 2;
      --circular-text-input-selected-stroke: #d8682d;
      --circular-text-input-selected-stroke-width: 4;
      --circular-text-input-focus-stroke: #2563eb;
      --circular-text-input-focus-stroke-width: 4;
      --circular-text-input-text-fill: #17322d;
      --circular-text-input-text-opacity: 1;
      --circular-text-input-text-font-size: 14px;
      --circular-text-input-text-font-weight: 700;
      --circular-text-input-disabled-opacity: 0.48;
    }

    .shell {
      display: grid;
      justify-items: center;
      gap: var(--circular-text-input-gap, 14px);
      max-width: 100%;
      min-width: 0;
    }

    .control {
      display: block;
      width: var(--circular-text-input-size);
      max-width: 100%;
      height: auto;
      user-select: none;
      overflow: visible;
    }

    :host([disabled]) .control,
    :host([readonly]) .control {
      opacity: var(--circular-text-input-disabled-opacity);
    }

    .sector-button {
      cursor: pointer;
      fill: var(--circular-text-input-sector-fill);
      outline: none;
      stroke: var(--circular-text-input-sector-stroke);
      stroke-width: var(--circular-text-input-sector-stroke-width);
      transition: filter 140ms ease, stroke-width 140ms ease;
    }

    .sector-button:hover {
      filter: brightness(1.05);
    }

    .selection-ring,
    .focus-ring {
      fill: none;
      pointer-events: none;
      vector-effect: non-scaling-stroke;
    }

    .selection-ring {
      display: none;
      stroke: var(--circular-text-input-selected-stroke);
      stroke-width: var(--circular-text-input-selected-stroke-width);
    }

    .selection-ring.selected {
      display: block;
    }

    .focus-ring {
      display: none;
      stroke: var(--circular-text-input-focus-stroke);
      stroke-width: var(--circular-text-input-focus-stroke-width);
    }

    .sector-button:focus-visible ~ .focus-ring {
      display: block;
    }

    .sector-text {
      pointer-events: none;
    }

    :host([disabled]) .sector-button,
    :host([readonly]) .sector-button {
      cursor: default;
    }

    .editor {
      box-sizing: border-box;
      width: var(--circular-text-input-editor-width, 100%);
      max-width: var(--circular-text-input-editor-max-width, 520px);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--circular-text-input-editor-gap, 14px);
      justify-self: stretch;
    }

    .editor-header,
    .field-wide {
      grid-column: 1 / -1;
    }

    .editor-header,
    span {
      color: var(--circular-text-input-label-color, rgba(23, 50, 45, 0.72));
      font: var(--circular-text-input-label-font, 700 0.78rem/1.2 "Segoe UI", sans-serif);
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .text-field {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 35px;
      border: 1px solid var(--circular-text-input-border, rgba(20, 56, 50, 0.18));
      border-radius: var(--circular-text-input-radius, 8px);
      background: var(--circular-text-input-background, #ffffff);
      color: var(--circular-text-input-color, #17322d);
      font: inherit;
      padding: 0.4rem 0.55rem;
    }

    .text-field:focus {
      border-color: var(--circular-text-input-border-focus, #0f5449);
      outline: none;
    }

    number-aware-input,
    token-aware-input,
    text-input {
      width: 100%;
      min-width: 0;
    }

    anchor-point-input {
      justify-self: start;
      --anchor-point-input-size: 52px;
    }

    number-aware-input,
    token-aware-input {
      --number-aware-input-radius: var(--circular-text-input-radius, 8px);
      --number-aware-input-font: inherit;
      --number-aware-input-border: var(--circular-text-input-border, rgba(20, 56, 50, 0.18));
      --number-aware-input-border-focus: var(--circular-text-input-border-focus, #0f5449);
      --number-aware-input-background: var(--circular-text-input-background, #ffffff);
      --number-aware-input-color: var(--circular-text-input-color, #17322d);
      --token-aware-input-radius: var(--circular-text-input-radius, 8px);
      --token-aware-input-font: inherit;
      --token-aware-input-border: var(--circular-text-input-border, rgba(20, 56, 50, 0.18));
      --token-aware-input-border-focus: var(--circular-text-input-border-focus, #0f5449);
      --token-aware-input-background: var(--circular-text-input-background, #ffffff);
      --token-aware-input-color: var(--circular-text-input-color, #17322d);
    }

    @media (max-width: 520px) {
      .editor {
        grid-template-columns: 1fr;
      }

      .editor-header,
      .field-wide {
        grid-column: auto;
      }
    }
  `;
}

export default CaskoUiCircularTextInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'circular-text-input': CaskoUiCircularTextInputElement;
  }
}
