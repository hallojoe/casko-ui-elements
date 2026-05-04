import { buildCircularSectorPathByMode, createCircularSectorViewModel } from '@casko/circular-sector';
import { LitElement, css, html, svg, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { type FillInputValue } from './fill-input.element';
import { type StrokeInputValue } from './stroke-input.element';
import './fill-input.element';
import './stroke-input.element';

export type CircularDecorationInputValueHandleAnchor = 'start' | 'center' | 'end';
export type CircularDecorationInputChangedProperty = 'fill' | 'stroke';
export type CircularDecorationInputChangeSource = 'fill' | 'stroke';
export type CircularDecorationInputSelectionSource = 'pointer' | 'keyboard';
export type CircularDecorationInputCommitSource = CircularDecorationInputChangeSource | CircularDecorationInputSelectionSource;

export interface CircularDecorationInputSector {
  value: number;
  radius: number;
  height: number;
  label?: string;
}

export interface CircularDecorationInputSectorDecoration {
  fill: FillInputValue;
  stroke: StrokeInputValue;
}

export type CircularDecorationInputValue = CircularDecorationInputSectorDecoration[];

export interface CircularDecorationInputChangeDetail {
  value: CircularDecorationInputValue;
  previousValue: CircularDecorationInputValue;
  selectedIndexes: number[];
  changedProperty: CircularDecorationInputChangedProperty;
  source: CircularDecorationInputChangeSource;
}

export interface CircularDecorationInputSelectionChangeDetail {
  selectedIndexes: number[];
  previousSelectedIndexes: number[];
  source: CircularDecorationInputSelectionSource;
}

export interface CircularDecorationInputCommitDetail {
  value: CircularDecorationInputValue;
  previousValue: CircularDecorationInputValue;
  selectedIndexes: number[];
  changedProperty: CircularDecorationInputChangedProperty | 'selection';
  source: CircularDecorationInputCommitSource;
}

interface CircularDecorationInputPoint {
  x: number;
  y: number;
}

interface CircularDecorationInputRenderItem {
  sector: CircularDecorationInputSector;
  decoration: CircularDecorationInputSectorDecoration;
  index: number;
  ratio: number;
  path: string;
  midpoint: CircularDecorationInputPoint;
}

const VIEW_BOX_SIZE = 320;
const CENTER = VIEW_BOX_SIZE / 2;
const FULL_TURN_DEGREES = 360;
const DEFAULT_SECTORS: CircularDecorationInputSector[] = [
  { value: 25, radius: 112, height: 40, label: 'A' },
  { value: 30, radius: 124, height: 52, label: 'B' },
  { value: 20, radius: 96, height: 36, label: 'C' },
  { value: 25, radius: 132, height: 58, label: 'D' },
];
const DEFAULT_FILL_VALUE: FillInputValue = {
  'fill': '#0f5449',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
};
const DEFAULT_STROKE_VALUE: StrokeInputValue = {
  'stroke': '#000000',
  'stroke-width': '2',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0',
  'vector-effect': 'none',
};
const DEFAULT_DECORATION: CircularDecorationInputSectorDecoration = {
  fill: DEFAULT_FILL_VALUE,
  stroke: DEFAULT_STROKE_VALUE,
};

function cloneFillValue(value: FillInputValue): FillInputValue {
  return { ...value };
}

function cloneStrokeValue(value: StrokeInputValue): StrokeInputValue {
  return { ...value };
}

function cloneDecoration(value: CircularDecorationInputSectorDecoration): CircularDecorationInputSectorDecoration {
  return {
    fill: cloneFillValue(value.fill),
    stroke: cloneStrokeValue(value.stroke),
  };
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeNumberText(value: unknown, fallback: string, min = 0, max = Number.POSITIVE_INFINITY): string {
  const text = typeof value === 'string' ? value.trim() : fallback;
  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return String(Math.min(max, Math.max(min, parsed)));
}

function sanitizeChoice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function sanitizeDasharray(value: unknown, fallback = 'none'): string {
  const text = typeof value === 'string' ? value.trim() : fallback;

  if (!text || text.toLowerCase() === 'none') {
    return 'none';
  }

  const normalized = text.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = normalized.split(' ');

  return parts.length > 0 && parts.every((part) => Number.isFinite(Number(part)) && Number(part) >= 0)
    ? normalized
    : text;
}

function sanitizeFillValue(value: Partial<FillInputValue> | null | undefined): FillInputValue {
  return {
    'fill': sanitizeString(value?.['fill'], DEFAULT_FILL_VALUE['fill']),
    'fill-opacity': sanitizeNumberText(value?.['fill-opacity'], DEFAULT_FILL_VALUE['fill-opacity'], 0, 1),
    'fill-rule': sanitizeChoice(value?.['fill-rule'], ['nonzero', 'evenodd'], DEFAULT_FILL_VALUE['fill-rule']),
  };
}

function sanitizeStrokeValue(value: Partial<StrokeInputValue> | null | undefined): StrokeInputValue {
  return {
    'stroke': sanitizeString(value?.['stroke'], DEFAULT_STROKE_VALUE['stroke']),
    'stroke-width': sanitizeNumberText(value?.['stroke-width'], DEFAULT_STROKE_VALUE['stroke-width']),
    'stroke-opacity': sanitizeNumberText(value?.['stroke-opacity'], DEFAULT_STROKE_VALUE['stroke-opacity'], 0, 1),
    'stroke-linecap': sanitizeChoice(value?.['stroke-linecap'], ['butt', 'round', 'square'], DEFAULT_STROKE_VALUE['stroke-linecap']),
    'stroke-linejoin': sanitizeChoice(value?.['stroke-linejoin'], ['miter', 'round', 'bevel'], DEFAULT_STROKE_VALUE['stroke-linejoin']),
    'stroke-miterlimit': sanitizeNumberText(value?.['stroke-miterlimit'], DEFAULT_STROKE_VALUE['stroke-miterlimit']),
    'stroke-dasharray': sanitizeDasharray(value?.['stroke-dasharray'], DEFAULT_STROKE_VALUE['stroke-dasharray']),
    'stroke-dashoffset': sanitizeNumberText(value?.['stroke-dashoffset'], DEFAULT_STROKE_VALUE['stroke-dashoffset']),
    'vector-effect': sanitizeChoice(
      value?.['vector-effect'],
      ['none', 'non-scaling-stroke'],
      DEFAULT_STROKE_VALUE['vector-effect'],
    ),
  };
}

function sanitizeDecoration(value: Partial<CircularDecorationInputSectorDecoration> | null | undefined): CircularDecorationInputSectorDecoration {
  return {
    fill: sanitizeFillValue(value?.fill),
    stroke: sanitizeStrokeValue(value?.stroke),
  };
}

@customElement('circular-decoration-input')
export class CaskoUiCircularDecorationInputElement extends LitElement {
  @property({ attribute: false })
  sectors: CircularDecorationInputSector[] = DEFAULT_SECTORS;

  @property({ type: Number, attribute: 'total-value' })
  totalValue = 100;

  @property({ type: Number, attribute: 'start-angle' })
  startAngle = -90;

  @property({ type: Number })
  gap = 0;

  @property({ type: Number, attribute: 'border-radius' })
  borderRadius = 0;

  @property({ attribute: 'value-handle-anchor' })
  valueHandleAnchor: CircularDecorationInputValueHandleAnchor = 'start';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, attribute: 'hide-on-select', reflect: true })
  hideOnSelect = true;

  @property({ attribute: false })
  selectedIndexes: number[] = [];

  private authoredValue: CircularDecorationInputValue = [];
  private lastCommittedValue: CircularDecorationInputValue = [];

  get value(): CircularDecorationInputValue {
    return this.#getValue();
  }

  set value(value: CircularDecorationInputValue | null | undefined) {
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
    const editorDecoration = this.#getEditorDecoration(value, selectedIndexes);
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
          aria-label="Circular sector decoration input"
          aria-multiselectable="true"
          aria-disabled=${String(this.disabled || this.readonly)}
          @click=${this.#onControlClick}>
          <g class="sector-layer">
            ${items.map((item) => this.#renderSector(item, selectedSet.has(item.index)))}
          </g>
        </svg>

        <div class="editor">
          <div class="editor-header">${editorHeader}</div>
          <fill-input
            .value=${editorDecoration.fill}
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${editorDisabled}
            ?readonly=${this.readonly}
            @input=${this.#onFillInput}
            @fill-input-change=${this.#onFillChange}
            @fill-input-commit=${this.#onFillCommit}></fill-input>
          <stroke-input
            .value=${editorDecoration.stroke}
            .hideOnSelect=${this.hideOnSelect}
            ?disabled=${editorDisabled}
            ?readonly=${this.readonly}
            @input=${this.#stopChildInput}
            @stroke-input-change=${this.#onStrokeChange}
            @stroke-input-commit=${this.#onStrokeCommit}></stroke-input>
        </div>
      </div>
    `;
  }

  #renderSector(item: CircularDecorationInputRenderItem, selected: boolean) {
    return svg`
      <g>
        <path
          class="sector-button"
          d=${item.path}
          fill=${item.decoration.fill['fill']}
          fill-opacity=${item.decoration.fill['fill-opacity']}
          fill-rule=${item.decoration.fill['fill-rule']}
          stroke=${item.decoration.stroke['stroke']}
          stroke-width=${item.decoration.stroke['stroke-width']}
          stroke-opacity=${item.decoration.stroke['stroke-opacity']}
          stroke-linecap=${item.decoration.stroke['stroke-linecap']}
          stroke-linejoin=${item.decoration.stroke['stroke-linejoin']}
          stroke-miterlimit=${item.decoration.stroke['stroke-miterlimit']}
          stroke-dasharray=${item.decoration.stroke['stroke-dasharray']}
          stroke-dashoffset=${item.decoration.stroke['stroke-dashoffset']}
          vector-effect=${item.decoration.stroke['vector-effect']}
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

  #applySelection(index: number, additive: boolean, source: CircularDecorationInputSelectionSource): void {
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

  #clearSelection(source: CircularDecorationInputSelectionSource): void {
    const previousSelectedIndexes = this.#sanitizeSelectedIndexes(this.selectedIndexes);
    if (previousSelectedIndexes.length === 0) return;

    this.selectedIndexes = [];
    this.#emitSelectionChange(previousSelectedIndexes, source);
    this.#emitCommit('selection', source, this.lastCommittedValue);
  }

  #onFillInput = (event: Event): void => {
    event.stopPropagation();
  };

  #stopChildInput = (event: Event): void => {
    event.stopPropagation();
  };

  #onFillChange = (event: CustomEvent<{ value: FillInputValue }>): void => {
    event.stopPropagation();
    this.#applyDecorationChange('fill', event.detail.value, 'fill');
  };

  #onStrokeChange = (event: CustomEvent<{ value: StrokeInputValue }>): void => {
    event.stopPropagation();
    this.#applyDecorationChange('stroke', event.detail.value, 'stroke');
  };

  #onFillCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit('fill', 'fill', this.lastCommittedValue);
  };

  #onStrokeCommit = (event: Event): void => {
    event.stopPropagation();
    this.#emitCommit('stroke', 'stroke', this.lastCommittedValue);
  };

  #applyDecorationChange(
    property: CircularDecorationInputChangedProperty,
    nextValue: FillInputValue | StrokeInputValue,
    source: CircularDecorationInputChangeSource,
  ): void {
    if (this.disabled || this.readonly || this.selectedIndexes.length === 0) return;

    const previousValue = this.value;
    const selectedSet = new Set(this.#sanitizeSelectedIndexes(this.selectedIndexes));
    const nextDecorations = this.#getValue().map((entry, index) => {
      if (!selectedSet.has(index)) return entry;

      return property === 'fill'
        ? { ...entry, fill: sanitizeFillValue(nextValue as FillInputValue) }
        : { ...entry, stroke: sanitizeStrokeValue(nextValue as StrokeInputValue) };
    });

    this.authoredValue = nextDecorations;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.#emitChange(property, source, previousValue);
  }

  #emitChange(
    changedProperty: CircularDecorationInputChangedProperty,
    source: CircularDecorationInputChangeSource,
    previousValue: CircularDecorationInputValue,
  ): void {
    this.#emitEvent('circular-decoration-input-change', {
      value: this.value,
      previousValue,
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      changedProperty,
      source,
    } satisfies CircularDecorationInputChangeDetail);
  }

  #emitSelectionChange(
    previousSelectedIndexes: number[],
    source: CircularDecorationInputSelectionSource,
  ): void {
    this.#emitEvent('circular-decoration-input-selection-change', {
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      previousSelectedIndexes,
      source,
    } satisfies CircularDecorationInputSelectionChangeDetail);
  }

  #emitCommit(
    changedProperty: CircularDecorationInputChangedProperty | 'selection',
    source: CircularDecorationInputCommitSource,
    previousValue: CircularDecorationInputValue,
  ): void {
    const detail = {
      value: this.value,
      previousValue,
      selectedIndexes: this.#sanitizeSelectedIndexes(this.selectedIndexes),
      changedProperty,
      source,
    } satisfies CircularDecorationInputCommitDetail;

    this.lastCommittedValue = this.value;
    this.#emitEvent('circular-decoration-input-commit', detail);
  }

  #emitEvent<T>(eventName: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(eventName, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  #getRenderItems(
    sectors: CircularDecorationInputSector[],
    value: CircularDecorationInputValue,
  ): CircularDecorationInputRenderItem[] {
    const total = this.#getValueTotal(sectors);
    let offset = 0;

    return sectors.map((sector, index) => {
      const ratio = total > 0 ? Math.max(0, sector.value) / total : 1 / sectors.length;
      const startTurn = offset;
      offset += ratio;
      const midAngle = this.#getStartAngle() + (startTurn + ratio / 2) * FULL_TURN_DEGREES;
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
        decoration: value[index] ?? cloneDecoration(DEFAULT_DECORATION),
        index,
        ratio,
        path: buildCircularSectorPathByMode(viewModel, { mode: 'arc', cornerRadius: this.#getBorderRadius() }),
        midpoint: this.#pointForAngle(midAngle, Math.max(1, radius - height / 2)),
      };
    });
  }

  #getEditorDecoration(
    value: CircularDecorationInputValue,
    selectedIndexes: number[],
  ): CircularDecorationInputSectorDecoration {
    if (selectedIndexes.length > 0) {
      return cloneDecoration(value[selectedIndexes[0]] ?? DEFAULT_DECORATION);
    }

    return cloneDecoration(DEFAULT_DECORATION);
  }

  #getValue(sectors = this.#getSectors()): CircularDecorationInputValue {
    return sectors.map((_, index) => sanitizeDecoration(this.authoredValue[index]));
  }

  #sanitizeValue(value: CircularDecorationInputValue | null | undefined): CircularDecorationInputValue {
    const source = Array.isArray(value) ? value : [];
    const length = Math.max(source.length, this.#getSectors().length);
    return Array.from({ length }, (_, index) => sanitizeDecoration(source[index]));
  }

  #getSectors(): CircularDecorationInputSector[] {
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

  #getValueTotal(sectors: CircularDecorationInputSector[]): number {
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

  #pointForAngle(degrees: number, radius: number): CircularDecorationInputPoint {
    const radians = this.#degreesToRadians(degrees);
    return {
      x: CENTER + Math.cos(radians) * radius,
      y: CENTER + Math.sin(radians) * radius,
    };
  }

  #degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  static styles = css`
    :host {
      display: inline-block;
      min-width: 0;
      color: var(--circular-decoration-input-color, #17322d);
      font: var(--circular-decoration-input-font, 400 0.95rem/1.35 "Segoe UI", sans-serif);
      --circular-decoration-input-size: 320px;
      --circular-decoration-input-sector-fill: rgba(15, 84, 73, 0.24);
      --circular-decoration-input-sector-stroke: rgba(15, 84, 73, 0.75);
      --circular-decoration-input-sector-stroke-width: 2;
      --circular-decoration-input-selected-stroke: #d8682d;
      --circular-decoration-input-selected-stroke-width: 4;
      --circular-decoration-input-focus-stroke: #2563eb;
      --circular-decoration-input-focus-stroke-width: 4;
      --circular-decoration-input-disabled-opacity: 0.48;
    }

    .shell {
      display: grid;
      justify-items: center;
      gap: var(--circular-decoration-input-gap, 14px);
      max-width: 100%;
      min-width: 0;
    }

    .control {
      display: block;
      width: var(--circular-decoration-input-size);
      max-width: 100%;
      height: auto;
      user-select: none;
      overflow: visible;
    }

    :host([disabled]) .control,
    :host([readonly]) .control {
      opacity: var(--circular-decoration-input-disabled-opacity);
    }

    .sector-button {
      cursor: pointer;
      outline: none;
      transition: filter 140ms ease, stroke-width 140ms ease;
    }

    .sector-button[fill=""] {
      fill: var(--circular-decoration-input-sector-fill);
    }

    .sector-button[stroke=""] {
      stroke: var(--circular-decoration-input-sector-stroke);
      stroke-width: var(--circular-decoration-input-sector-stroke-width);
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
      stroke: var(--circular-decoration-input-selected-stroke);
      stroke-width: var(--circular-decoration-input-selected-stroke-width);
    }

    .selection-ring.selected {
      display: block;
    }

    .focus-ring {
      display: none;
      stroke: var(--circular-decoration-input-focus-stroke);
      stroke-width: var(--circular-decoration-input-focus-stroke-width);
    }

    .sector-button:focus-visible ~ .focus-ring {
      display: block;
    }

    :host([disabled]) .sector-button,
    :host([readonly]) .sector-button {
      cursor: default;
    }

    .editor {
      box-sizing: border-box;
      width: var(--circular-decoration-input-editor-width, 100%);
      max-width: var(--circular-decoration-input-editor-max-width, 520px);
      display: grid;
      gap: var(--circular-decoration-input-editor-gap, 14px);
      justify-self: stretch;
    }

    .editor-header {
      color: var(--circular-decoration-input-label-color, rgba(23, 50, 45, 0.72));
      font: var(--circular-decoration-input-label-font, 700 0.78rem/1.2 "Segoe UI", sans-serif);
    }
  `;
}

export default CaskoUiCircularDecorationInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'circular-decoration-input': CaskoUiCircularDecorationInputElement;
  }
}
