import { buildCircularSectorPathByMode, createCircularSectorViewModel } from '@casko/circular-sector';
import { LitElement, css, html, svg, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

export type CircularInputChangeSource = 'pointer' | 'keyboard';
export type CircularInputField = 'value' | 'radius' | 'height' | 'start-angle';
export type CircularInputHiddenControl = CircularInputField;
type CircularInputValueBoundary = 'start' | 'end';

export interface CircularInputSector {
  value: number;
  radius: number;
  height: number;
  label?: string;
}

export interface CircularInputChangeDetail {
  sectors: CircularInputSector[];
  index: number;
  field: CircularInputField;
  source: CircularInputChangeSource;
  gap: number;
  borderRadius: number;
  startAngle: number;
}

interface CircularInputInteraction {
  pointerId: number;
  index: number;
  field: CircularInputField;
  boundary?: CircularInputValueBoundary;
  captureElement: Element;
}

interface CircularInputPoint {
  x: number;
  y: number;
}

interface CircularInputSectorRenderItem {
  sector: CircularInputSector;
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  ratio: number;
  path: string;
  radiusPoint: CircularInputPoint;
  innerPoint: CircularInputPoint;
  valueStartPoint: CircularInputPoint;
  valueEndPoint: CircularInputPoint;
}

const VIEW_BOX_SIZE = 320;
const CENTER = VIEW_BOX_SIZE / 2;
const FULL_TURN_DEGREES = 360;
const START_ANGLE_HANDLE_OFFSET = 18;
const HANDLE_TURN_EPSILON = 0.001;
const HIDDEN_CONTROLS = ['value', 'radius', 'height', 'start-angle'] as const;
const DEFAULT_SECTORS: CircularInputSector[] = [
  { value: 25, radius: 112, height: 40, label: 'A' },
  { value: 30, radius: 124, height: 52, label: 'B' },
  { value: 20, radius: 96, height: 36, label: 'C' },
  { value: 25, radius: 132, height: 58, label: 'D' },
];

@customElement('circular-input')
export class CaskoUiCircularInputElement extends LitElement {
  @property({ attribute: false })
  sectors: CircularInputSector[] = DEFAULT_SECTORS;

  @property({ type: Number, attribute: 'total-value' })
  totalValue = 100;

  @property({ type: Number, attribute: 'start-angle' })
  startAngle = -90;

  @property({ type: Number, attribute: 'keyboard-step' })
  keyboardStep = 1;

  @property({ type: Number, attribute: 'radius-step' })
  radiusStep = 5;

  @property({ type: Number, attribute: 'value-snap-step' })
  valueSnapStep = 0;

  @property({ type: Number, attribute: 'rotate-snap-step' })
  rotateSnapStep = 0;

  @property({ type: Number, attribute: 'radius-snap-step' })
  radiusSnapStep = 0;

  @property({ type: Number, attribute: 'height-snap-step' })
  heightSnapStep = 0;

  @property({
    attribute: 'hidden-controls',
    converter: {
      fromAttribute: (value) => CaskoUiCircularInputElement.parseHiddenControls(value),
      toAttribute: (value: CircularInputHiddenControl[]) => value.join(','),
    },
  })
  hiddenControls: CircularInputHiddenControl[] = [];

  @property({
    attribute: 'allow-crossing',
    converter: {
      fromAttribute: (value) => value === null || value.toLowerCase() !== 'false',
      toAttribute: (value) => (value ? '' : 'false'),
    },
  })
  allowCrossing = true;

  @property({ type: Number })
  gap = 0;

  @property({ type: Number, attribute: 'border-radius' })
  borderRadius = 0;

  @property({ attribute: 'value-handle-path' })
  valueHandlePath = '';

  @property({ attribute: 'radius-handle-path' })
  radiusHandlePath = '';

  @property({ attribute: 'height-handle-path' })
  heightHandlePath = '';

  @property({ attribute: 'start-angle-handle-path' })
  startAngleHandlePath = '';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @query('.control')
  private controlElement?: SVGSVGElement;

  @state()
  private activeIndex = 0;

  private interaction?: CircularInputInteraction;
  private pendingKeyboardCommit?: { index: number; field: CircularInputField };
  private boundaryTurns?: number[];
  private internalSectorsUpdate = false;

  static parseHiddenControls(value: unknown): CircularInputHiddenControl[] {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? CaskoUiCircularInputElement.parseHiddenControlsString(value)
        : [];
    const seen = new Set<CircularInputHiddenControl>();

    values.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const normalized = entry.trim();
      if (CaskoUiCircularInputElement.isHiddenControl(normalized)) {
        seen.add(normalized);
      }
    });

    return [...seen];
  }

  private static parseHiddenControlsString(value: string): unknown[] {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return trimmed.split(',');
  }

  private static isHiddenControl(value: string): value is CircularInputHiddenControl {
    return (HIDDEN_CONTROLS as readonly string[]).includes(value);
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('sectors')) {
      if (!this.internalSectorsUpdate) {
        this.boundaryTurns = undefined;
      }

      this.internalSectorsUpdate = false;
    }
  }

  render() {
    const sectors = this.#getSectors();
    const items = this.#getRenderItems(sectors);
    const startAnglePoint = this.#getStartAngleHandlePoint(items);
    const startAngleTrackPath = this.#getStartAngleTrackPath(items);
    const showRadialLines = !this.#isControlHidden('radius') || !this.#isControlHidden('height');
    const activeIndex = this.#getActiveIndex(items.length);
    const inactiveItems = items.filter((item) => item.index !== activeIndex);
    const activeItem = items.find((item) => item.index === activeIndex);

    return html`
      <svg
        class="control"
        viewBox=${`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
        role="group"
        aria-label="Circular sector input"
        aria-disabled=${String(this.disabled)}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @lostpointercapture=${this.#onLostPointerCapture}>
        <circle class="center" cx=${CENTER} cy=${CENTER} r="3"></circle>
        <g class="sector-layer">
          ${items.map(
            (item) => svg`
              <path
                class=${`sector-path sector-hit ${item.index === activeIndex ? 'active-sector' : ''}`}
                d=${item.path}
                tabindex=${this.disabled ? -1 : 0}
                role="button"
                aria-label=${`Sector ${item.index + 1}`}
                data-index=${String(item.index)}
                @click=${this.#onSectorActivate}
                @focus=${this.#onSectorActivate}
                @keydown=${this.#onSectorActivateKeydown}></path>
            `,
          )}
        </g>
        <g class="radius-lines">
          ${showRadialLines
            ? items.map(
              (item) => svg`
                <line
                  class="radius-line"
                  x1=${CENTER}
                  y1=${CENTER}
                  x2=${item.radiusPoint.x}
                  y2=${item.radiusPoint.y}></line>
              `,
            )
            : ''}
        </g>
        <g class="gap-track-layer">
          ${this.#isControlHidden('start-angle') ? '' : svg`<path class="sector-path start-angle-track" d=${startAngleTrackPath}></path>`}
        </g>
        <g class="handles">
          ${inactiveItems.map((item) => this.#renderSectorHandles(item, false))}
          ${activeItem ? this.#renderSectorHandles(activeItem, true) : ''}
          ${this.#isControlHidden('start-angle') ? '' : this.#renderHandle({
            field: 'start-angle',
            point: startAnglePoint,
            label: 'Sector start angle',
            value: this.#getStartAngle(),
            min: -180,
            max: 180,
            index: -1,
          })}
        </g>
      </svg>
    `;
  }

  #renderSectorHandles(item: CircularInputSectorRenderItem, active: boolean) {
    return svg`
      ${this.#isControlHidden('value') ? '' : this.#renderHandle({
        field: 'value',
        point: item.valueStartPoint,
        label: `Sector ${item.index + 1} start boundary`,
        value: item.sector.value,
        min: 0,
        max: this.#getTotalValue(),
        index: item.index,
        boundary: 'start',
        active,
      })}
      ${this.#isControlHidden('value') ? '' : this.#renderHandle({
        field: 'value',
        point: item.valueEndPoint,
        label: `Sector ${item.index + 1} end boundary`,
        value: item.sector.value,
        min: 0,
        max: this.#getTotalValue(),
        index: item.index,
        boundary: 'end',
        active,
      })}
      ${this.#isControlHidden('radius') ? '' : this.#renderHandle({
        field: 'radius',
        point: item.radiusPoint,
        label: `Sector ${item.index + 1} radius`,
        value: item.sector.radius,
        min: 1,
        max: VIEW_BOX_SIZE / 2,
        index: item.index,
        active,
      })}
      ${this.#isControlHidden('height') ? '' : this.#renderHandle({
        field: 'height',
        point: item.innerPoint,
        label: `Sector ${item.index + 1} height`,
        value: item.sector.height,
        min: 0,
        max: item.sector.radius,
        index: item.index,
        active,
      })}
    `;
  }

  #renderHandle(options: {
    field: CircularInputField;
    point: CircularInputPoint;
    label: string;
    value: number;
    min: number;
    max: number;
    index: number;
    boundary?: CircularInputValueBoundary;
    active?: boolean;
  }) {
    const path = this.#getHandlePath(options.field);
    const className = `handle handle-${options.field}${options.boundary ? ` handle-${options.field}-${options.boundary}` : ''}${options.active ? ' active-handle' : ''}`;
    const commonAttributes = {
      class: className,
      tabindex: this.disabled ? -1 : 0,
      role: 'slider',
      'aria-label': options.label,
      'aria-valuemin': String(options.min),
      'aria-valuemax': String(options.max),
      'aria-valuenow': String(Math.round(options.value * 1000) / 1000),
      'data-index': String(options.index),
      'data-field': options.field,
      'data-boundary': options.boundary ?? '',
    };

    if (path) {
      return svg`
        <path
          class=${commonAttributes.class}
          tabindex=${commonAttributes.tabindex}
          role=${commonAttributes.role}
          aria-label=${commonAttributes['aria-label']}
          aria-valuemin=${commonAttributes['aria-valuemin']}
          aria-valuemax=${commonAttributes['aria-valuemax']}
          aria-valuenow=${commonAttributes['aria-valuenow']}
          data-index=${commonAttributes['data-index']}
          data-field=${commonAttributes['data-field']}
          data-boundary=${commonAttributes['data-boundary']}
          d=${path}
          transform=${`translate(${options.point.x} ${options.point.y})`}
          @pointerdown=${this.#onPointerDown}
          @keydown=${this.#onKeyDown}
          @keyup=${this.#onKeyUp}></path>
      `;
    }

    return svg`
      <circle
        class=${commonAttributes.class}
        cx=${options.point.x}
        cy=${options.point.y}
        r=${options.field === 'value' || options.field === 'start-angle' ? 4.5 : 4}
        tabindex=${commonAttributes.tabindex}
        role=${commonAttributes.role}
        aria-label=${commonAttributes['aria-label']}
        aria-valuemin=${commonAttributes['aria-valuemin']}
        aria-valuemax=${commonAttributes['aria-valuemax']}
        aria-valuenow=${commonAttributes['aria-valuenow']}
        data-index=${commonAttributes['data-index']}
        data-field=${commonAttributes['data-field']}
        data-boundary=${commonAttributes['data-boundary']}
        @pointerdown=${this.#onPointerDown}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}></circle>
    `;
  }

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;

    const target = event.currentTarget as SVGElement;
    const index = Number(target.dataset.index);
    const field = target.dataset.field as CircularInputField | undefined;
    const boundary = target.dataset.boundary as CircularInputValueBoundary | undefined;
    if (!Number.isInteger(index) || !field) return;
    if (this.#isControlHidden(field)) return;
    if (index >= 0) {
      this.activeIndex = index;
    }

    target.setPointerCapture(event.pointerId);
    this.interaction = {
      pointerId: event.pointerId,
      index,
      field,
      boundary: boundary === 'start' || boundary === 'end' ? boundary : undefined,
      captureElement: target,
    };

    this.#applyPointerValue(event, index, field, boundary === 'end' ? 'end' : boundary === 'start' ? 'start' : undefined);
    event.preventDefault();
  };

  #onSectorActivate = (event: Event) => {
    if (this.disabled) return;

    const target = event.currentTarget as SVGElement;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;

    this.activeIndex = index;
  };

  #onSectorActivateKeydown = (event: KeyboardEvent) => {
    if (this.disabled) return;

    const target = event.currentTarget as SVGElement;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;

    if (event.key === 'Enter' || event.key === ' ') {
      this.activeIndex = index;
      event.preventDefault();
      return;
    }

    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
      return;
    }

    const items = this.#getRenderItems(this.#getSectors());
    if (items.length === 0) return;

    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + items.length) % items.length;
    const nextSector = this.renderRoot.querySelector<SVGElement>(`.sector-hit[data-index="${nextIndex}"]`);
    nextSector?.focus();
    this.activeIndex = nextIndex;
    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#applyPointerValue(event, this.interaction.index, this.interaction.field, this.interaction.boundary);
  };

  #onPointerUp = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    const { index, field } = this.interaction;
    this.#releasePointerCapture(event.pointerId);
    this.interaction = undefined;
    this.#emitCommit(index, field, 'pointer');
  };

  #onPointerCancel = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#releasePointerCapture(event.pointerId);
    this.interaction = undefined;
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    const { index, field } = this.interaction;
    this.interaction = undefined;
    this.#emitCommit(index, field, 'pointer');
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;

    const target = event.currentTarget as SVGElement;
    const index = Number(target.dataset.index);
    const field = target.dataset.field as CircularInputField | undefined;
    const boundary = target.dataset.boundary as CircularInputValueBoundary | undefined;
    if (!Number.isInteger(index) || !field) return;
    if (this.#isControlHidden(field)) return;
    if (index >= 0) {
      this.activeIndex = index;
    }

    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
    const baseStep = field === 'value'
      ? this.#getValueKeyboardStep()
      : field === 'start-angle'
        ? this.#getRotateKeyboardStep()
        : field === 'height'
          ? this.#getHeightKeyboardStep()
          : this.#getRadiusKeyboardStep();
    const step = baseStep * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1);
    const sectors = this.#getSectors();
    const sector = sectors[index];
    if (field !== 'start-angle' && !sector) return;

    let nextValue: number;
    if (event.key === 'Home') {
      nextValue = field === 'height'
        ? 1
        : field === 'radius'
          ? 1
          : field === 'start-angle'
            ? -180
            : 0;
    } else if (event.key === 'End') {
      nextValue = field === 'value'
        ? this.#getTotalValue()
        : field === 'radius'
          ? VIEW_BOX_SIZE / 2
          : field === 'start-angle'
            ? 180
            : sector.radius;
    } else {
      nextValue = (
        field === 'value'
          ? sector.value
          : field === 'radius'
            ? sector.radius
            : field === 'start-angle'
              ? this.#getStartAngle()
              : sector.height
      ) + step * direction;
    }

    event.preventDefault();
    this.pendingKeyboardCommit = { index, field };
    if (field === 'start-angle') {
      this.#applyStartAngleValue(nextValue, 'keyboard');
      return;
    }

    if (field === 'value') {
      const delta = event.key === 'Home' || event.key === 'End'
        ? nextValue - sector.value
        : step * direction;
      this.#applyValueBoundaryKeyboard(index, boundary === 'end' ? 'end' : 'start', delta);
      return;
    }

    this.#applyFieldValue(index, field, nextValue, 'keyboard');
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.pendingKeyboardCommit) return;
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;

    const { index, field } = this.pendingKeyboardCommit;
    this.pendingKeyboardCommit = undefined;
    this.#emitCommit(index, field, 'keyboard');
  };

  #applyPointerValue(
    event: PointerEvent,
    index: number,
    field: CircularInputField,
    boundary?: CircularInputValueBoundary,
  ) {
    if (this.#isControlHidden(field)) return;

    const point = this.#getLocalPoint(event);
    if (field === 'start-angle') {
      this.#applyStartAnglePointerValue(point);
      return;
    }

    if (field === 'value') {
      this.#applyValueBoundaryHandle(index, boundary === 'end' ? 'end' : 'start', point);
      return;
    }

    const sectors = this.#getSectors();
    const item = this.#getRenderItems(sectors)[index];
    if (!item) return;

    const projectedRadius = this.#projectPointToAngleRadius(point, item.midAngle);
    if (field === 'height') {
      this.#applyHeightFromInnerRadius(index, projectedRadius, 'pointer');
      return;
    }

    this.#applyFieldValue(index, field, projectedRadius, 'pointer');
  }

  #applyValueBoundaryHandle(index: number, boundary: CircularInputValueBoundary, point: CircularInputPoint) {
    const sectors = this.#getSectors();
    if (!sectors[index]) return;

    const boundaryIndex = boundary === 'start' ? index : (index + 1) % sectors.length;
    const boundaryTurns = this.#getBoundaryTurns(sectors);
    const rawDesiredTurn = this.#normalizeDegrees(this.#getPointDegrees(point) - this.#getStartAngle()) / FULL_TURN_DEGREES;
    const desiredTurn = this.#snapValueTurn(rawDesiredTurn);

    boundaryTurns[boundaryIndex] = this.#clampBoundaryTurn(boundaryIndex, desiredTurn, boundaryTurns);

    this.boundaryTurns = boundaryTurns.map((turn) => this.#normalizeTurn(turn));
    const nextSectors = this.#applyValuesFromBoundaryTurns(sectors, this.boundaryTurns);
    this.#setSectors(nextSectors, index, 'value', 'pointer');
  }

  #applyValueBoundaryKeyboard(index: number, boundary: CircularInputValueBoundary, deltaValue: number) {
    const sectors = this.#getSectors();
    if (!sectors[index]) return;

    const boundaryIndex = boundary === 'start' ? index : (index + 1) % sectors.length;
    const boundaryTurns = this.#getBoundaryTurns(sectors);
    const deltaTurn = deltaValue / this.#getTotalValue();
    const desiredTurn = this.#snapValueTurn(boundaryTurns[boundaryIndex] + deltaTurn);
    boundaryTurns[boundaryIndex] = this.#clampBoundaryTurn(boundaryIndex, desiredTurn, boundaryTurns);

    this.boundaryTurns = boundaryTurns.map((turn) => this.#normalizeTurn(turn));
    const nextSectors = this.#applyValuesFromBoundaryTurns(sectors, this.boundaryTurns);
    this.#setSectors(nextSectors, index, 'value', 'keyboard');
  }

  #applyFieldValue(index: number, field: CircularInputField, value: number, source: CircularInputChangeSource) {
    if (field === 'start-angle') {
      this.#applyStartAngleValue(value, source);
      return;
    }

    const sectors = this.#getSectors();
    const sector = sectors[index];
    if (!sector) return;

    const nextSectors = sectors.map((entry, entryIndex) => {
      if (entryIndex !== index) return { ...entry };

      if (field === 'value') {
        return { ...entry, value: Math.max(0, Number.isFinite(value) ? value : entry.value) };
      }

      if (field === 'radius') {
        const snappedValue = source === 'pointer' ? this.#snapRadiusValue(value) : value;
        const radius = Math.max(1, Number.isFinite(snappedValue) ? snappedValue : entry.radius);
        return { ...entry, radius, height: Math.min(Math.max(1, entry.height), radius) };
      }

      const snappedValue = source === 'pointer' ? this.#snapHeightValue(value) : value;
      const height = Math.max(1, Math.min(entry.radius, Number.isFinite(snappedValue) ? snappedValue : entry.height));
      return { ...entry, height };
    });

    if (field === 'value') {
      this.boundaryTurns = undefined;
    }

    this.#setSectors(nextSectors, index, field, source);
  }

  #applyHeightFromInnerRadius(index: number, innerRadius: number, source: CircularInputChangeSource) {
    const sectors = this.#getSectors();
    const sector = sectors[index];
    if (!sector) return;

    const rawHeight = Number.isFinite(innerRadius) ? sector.radius - innerRadius : sector.height;
    const nextHeight = Math.max(
      1,
      Math.min(sector.radius, this.#snapHeightValue(rawHeight)),
    );
    const nextSectors = sectors.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, height: nextHeight } : { ...entry }
    ));

    this.#setSectors(nextSectors, index, 'height', source);
  }

  #applyStartAnglePointerValue(point: CircularInputPoint) {
    this.#applyStartAngleValue(this.#snapRotateValue(this.#getPointDegrees(point)), 'pointer');
  }

  #applyStartAngleValue(value: number, source: CircularInputChangeSource) {
    this.startAngle = this.#normalizeSignedDegrees(value);
    this.#emitChange(-1, 'start-angle', source);
  }

  #applyValuesFromBoundaryTurns(sectors: CircularInputSector[], boundaryTurns: number[]): CircularInputSector[] {
    if (boundaryTurns.length === 1) {
      return sectors.map((sector) => ({ ...sector, value: this.#getTotalValue() }));
    }

    return sectors.map((sector, index) => ({
      ...sector,
      value: this.#positiveTurnDelta(
        this.#normalizeTurn(boundaryTurns[index] ?? 0),
        this.#normalizeTurn(boundaryTurns[(index + 1) % boundaryTurns.length] ?? 0),
      ) * this.#getTotalValue(),
    }));
  }

  #setSectors(
    sectors: CircularInputSector[],
    index: number,
    field: CircularInputField,
    source: CircularInputChangeSource,
  ) {
    this.internalSectorsUpdate = true;
    this.sectors = sectors;
    this.#emitChange(index, field, source);
  }

  #getRenderItems(sectors: CircularInputSector[]): CircularInputSectorRenderItem[] {
    const boundaryTurns = this.#getBoundaryTurns(sectors);
    const sectorTurns = this.#getSectorTurns(boundaryTurns);

    return sectors.map((sector, index) => {
      const sectorTurn = sectorTurns[index];
      const ratio = sectorTurn?.ratio ?? 1 / sectors.length;
      const startTurn = sectorTurn?.start ?? 0;
      const centerTurn = this.#normalizeTurn(startTurn + ratio / 2);
      const endTurn = this.#normalizeTurn(startTurn + ratio);
      const startAngle = this.#getStartAngle() + startTurn * FULL_TURN_DEGREES;
      const endAngle = startAngle + ratio * FULL_TURN_DEGREES;
      const midAngle = this.#getStartAngle() + centerTurn * FULL_TURN_DEGREES;
      const radius = Math.max(1, sector.radius);
      const height = Math.max(1, Math.min(radius, sector.height));
      const viewModel = createCircularSectorViewModel({
        center: { x: CENTER, y: CENTER },
        radius,
        ratio,
        theta: this.#degreesToRadians(startAngle),
        gap: this.#getGap(),
        height,
        borderRadius: this.#getBorderRadius(),
      });

      return {
        sector,
        index,
        startAngle,
        endAngle,
        midAngle,
        ratio,
        path: buildCircularSectorPathByMode(viewModel, { mode: 'arc', cornerRadius: this.#getBorderRadius() }),
        radiusPoint: this.#pointForAngle(midAngle, radius),
        innerPoint: this.#pointForAngle(midAngle, radius - height),
        valueStartPoint: this.#pointForAngle(startAngle, radius + 12),
        valueEndPoint: this.#pointForAngle(this.#getStartAngle() + endTurn * FULL_TURN_DEGREES, radius + 12),
      };
    });
  }

  #getBoundaryTurns(sectors: CircularInputSector[]): number[] {
    if (this.boundaryTurns?.length === sectors.length) {
      return this.boundaryTurns.map((turn) => this.#normalizeTurn(Number.isFinite(turn) ? turn : 0));
    }

    const total = this.#getValueTotal(sectors);
    let offset = 0;
    return sectors.map((sector, index) => {
      const ratio = total > 0 ? Math.max(0, sector.value) / total : 1 / sectors.length;
      const startTurn = index === 0 ? 0 : offset;
      offset += ratio;
      return this.#normalizeTurn(startTurn);
    });
  }

  #getSectorTurns(boundaryTurns: number[]): Array<{ start: number; ratio: number }> {
    if (boundaryTurns.length === 0) return [];
    if (boundaryTurns.length === 1) return [{ start: 0, ratio: 1 }];

    const turns = new Array<{ start: number; ratio: number }>(boundaryTurns.length);

    boundaryTurns.forEach((turn, index) => {
      const start = this.#normalizeTurn(turn);
      const end = this.#normalizeTurn(boundaryTurns[(index + 1) % boundaryTurns.length] ?? start);
      turns[index] = {
        start,
        ratio: this.#positiveTurnDelta(start, end),
      };
    });

    return turns;
  }

  #getStartAngleHandlePoint(items: CircularInputSectorRenderItem[]): CircularInputPoint {
    return this.#pointForAngle(this.#getStartAngle(), this.#getStartAngleHandleBaseRadius(items));
  }

  #getStartAngleTrackPath(items: CircularInputSectorRenderItem[]): string {
    const radius = this.#getStartAngleHandleBaseRadius(items);
    const right = this.#pointForAngle(0, radius);
    const left = this.#pointForAngle(180, radius);
    return `M ${right.x} ${right.y} A ${radius} ${radius} 0 1 1 ${left.x} ${left.y} A ${radius} ${radius} 0 1 1 ${right.x} ${right.y}`;
  }

  #getStartAngleHandleBaseRadius(items: CircularInputSectorRenderItem[]): number {
    return this.#getLargestSectorRadius(items) + START_ANGLE_HANDLE_OFFSET;
  }

  #getLargestSectorRadius(items: CircularInputSectorRenderItem[]): number {
    const largestRadius = items.reduce((largest, item) => Math.max(largest, item.sector.radius), 0);
    return largestRadius;
  }

  #clampBoundaryTurn(index: number, desiredTurn: number, boundaryTurns: number[]): number {
    if (boundaryTurns.length < 3) return this.#normalizeTurn(desiredTurn);

    const previousTurn = this.#normalizeTurn(boundaryTurns[(index - 1 + boundaryTurns.length) % boundaryTurns.length] ?? 0);
    const nextTurn = this.#normalizeTurn(boundaryTurns[(index + 1) % boundaryTurns.length] ?? 0);
    const desired = this.#normalizeTurn(desiredTurn);
    const span = this.#positiveTurnDelta(previousTurn, nextTurn);
    if (span <= HANDLE_TURN_EPSILON * 2) {
      return this.#normalizeTurn(boundaryTurns[index] ?? desired);
    }

    const delta = this.#positiveTurnDelta(previousTurn, desired);
    if (delta >= HANDLE_TURN_EPSILON && delta <= span - HANDLE_TURN_EPSILON) {
      return desired;
    }

    const previousClamp = this.#normalizeTurn(previousTurn + HANDLE_TURN_EPSILON);
    const nextClamp = this.#normalizeTurn(previousTurn + span - HANDLE_TURN_EPSILON);
    return this.#turnDistance(desired, previousClamp) <= this.#turnDistance(desired, nextClamp)
      ? previousClamp
      : nextClamp;
  }

  #getSectors(): CircularInputSector[] {
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

  #getActiveIndex(count: number): number {
    if (count <= 0) return -1;
    return this.#clamp(Math.trunc(this.activeIndex), 0, count - 1);
  }

  #getLocalPoint(event: PointerEvent): CircularInputPoint {
    const bounds = this.controlElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return { x: CENTER, y: CENTER };
    }

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * VIEW_BOX_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * VIEW_BOX_SIZE,
    };
  }

  #projectPointToAngleRadius(point: CircularInputPoint, degrees: number): number {
    const vectorX = point.x - CENTER;
    const vectorY = point.y - CENTER;
    const radians = this.#degreesToRadians(degrees);
    const unitX = Math.cos(radians);
    const unitY = Math.sin(radians);
    return Math.max(0, vectorX * unitX + vectorY * unitY);
  }

  #pointForAngle(degrees: number, radius: number): CircularInputPoint {
    const radians = this.#degreesToRadians(degrees);
    return {
      x: CENTER + Math.cos(radians) * radius,
      y: CENTER + Math.sin(radians) * radius,
    };
  }

  #getPointDegrees(point: CircularInputPoint): number {
    return (Math.atan2(point.y - CENTER, point.x - CENTER) * 180) / Math.PI;
  }

  #releasePointerCapture(pointerId: number) {
    if (!this.interaction?.captureElement.hasPointerCapture(pointerId)) {
      return;
    }

    this.interaction.captureElement.releasePointerCapture(pointerId);
  }

  #emitChange(index: number, field: CircularInputField, source: CircularInputChangeSource) {
    this.#emitEvent('circular-input-change', this.#createDetail(index, field, source));
  }

  #emitCommit(index: number, field: CircularInputField, source: CircularInputChangeSource) {
    this.#emitEvent('circular-input-commit', this.#createDetail(index, field, source));
  }

  #createDetail(index: number, field: CircularInputField, source: CircularInputChangeSource): CircularInputChangeDetail {
    return {
      sectors: this.#getSectors(),
      index,
      field,
      source,
      gap: this.#getGap(),
      borderRadius: this.#getBorderRadius(),
      startAngle: this.#getStartAngle(),
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

  #getValueTotal(sectors: CircularInputSector[]): number {
    const total = sectors.reduce((sum, sector) => sum + Math.max(0, sector.value), 0);
    return total > 0 ? total : sectors.length;
  }

  #getTotalValue(): number {
    return Number.isFinite(this.totalValue) && this.totalValue > 0 ? this.totalValue : 100;
  }

  #getGap(): number {
    return Number.isFinite(this.gap) ? Math.max(0, this.gap) : 0;
  }

  #getBorderRadius(): number {
    return Number.isFinite(this.borderRadius) ? Math.max(0, this.borderRadius) : 0;
  }

  #getStartAngle(): number {
    return Number.isFinite(this.startAngle) ? this.#normalizeSignedDegrees(this.startAngle) : -90;
  }

  #getKeyboardStep(): number {
    return Number.isFinite(this.keyboardStep) && this.keyboardStep > 0 ? this.keyboardStep : 1;
  }

  #getRadiusStep(): number {
    return Number.isFinite(this.radiusStep) && this.radiusStep > 0 ? this.radiusStep : 5;
  }

  #getValueKeyboardStep(): number {
    return this.#getPositiveNumber(this.valueSnapStep) ?? this.#getKeyboardStep();
  }

  #getRotateKeyboardStep(): number {
    return this.#getPositiveNumber(this.rotateSnapStep) ?? this.#getKeyboardStep();
  }

  #getRadiusKeyboardStep(): number {
    return this.#getPositiveNumber(this.radiusSnapStep) ?? this.#getRadiusStep();
  }

  #getHeightKeyboardStep(): number {
    return this.#getPositiveNumber(this.heightSnapStep) ?? this.#getRadiusStep();
  }

  #snapValueTurn(turn: number): number {
    const step = this.#getPositiveNumber(this.valueSnapStep);
    if (step === undefined) return this.#normalizeTurn(turn);

    return this.#normalizeTurn(this.#snapNumber(turn, step / this.#getTotalValue()));
  }

  #snapRotateValue(value: number): number {
    const step = this.#getPositiveNumber(this.rotateSnapStep);
    return step === undefined ? value : this.#snapNumber(value, step);
  }

  #snapRadiusValue(value: number): number {
    const step = this.#getPositiveNumber(this.radiusSnapStep);
    return step === undefined ? value : this.#snapNumber(value, step);
  }

  #snapHeightValue(value: number): number {
    const step = this.#getPositiveNumber(this.heightSnapStep);
    return step === undefined ? value : this.#snapNumber(value, step);
  }

  #snapNumber(value: number, step: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
    return Math.round(value / step) * step;
  }

  #getPositiveNumber(value: number): number | undefined {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  #isControlHidden(field: CircularInputField): boolean {
    return CaskoUiCircularInputElement.parseHiddenControls(this.hiddenControls).includes(field);
  }

  #getHandlePath(field: CircularInputField): string {
    const path = field === 'value'
      ? this.valueHandlePath
      : field === 'radius'
        ? this.radiusHandlePath
        : field === 'height'
          ? this.heightHandlePath
          : field === 'start-angle'
            ? this.startAngleHandlePath
            : '';
    return path.trim();
  }

  #clamp(value: number, min: number, max: number): number {
    const finiteValue = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, finiteValue));
  }

  #degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  #normalizeDegrees(degrees: number): number {
    return ((degrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  }

  #normalizeSignedDegrees(degrees: number): number {
    const normalized = ((degrees + 180) % FULL_TURN_DEGREES + FULL_TURN_DEGREES) % FULL_TURN_DEGREES - 180;
    return normalized === -180 && degrees > 0 ? 180 : normalized;
  }

  #positiveDegreesDelta(start: number, end: number): number {
    return ((end - start) % FULL_TURN_DEGREES + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  }

  #degreesDistance(a: number, b: number): number {
    const delta = Math.abs(this.#normalizeDegrees(a) - this.#normalizeDegrees(b));
    return Math.min(delta, FULL_TURN_DEGREES - delta);
  }

  #normalizeTurn(turn: number): number {
    return ((turn % 1) + 1) % 1;
  }

  #turnMidpoint(start: number, end: number): number {
    return this.#normalizeTurn(start + this.#positiveTurnDelta(start, end) / 2);
  }

  #turnDistance(a: number, b: number): number {
    const delta = Math.abs(this.#normalizeTurn(a) - this.#normalizeTurn(b));
    return Math.min(delta, 1 - delta);
  }

  #positiveTurnDelta(start: number, end: number): number {
    return ((end - start) % 1 + 1) % 1;
  }

  static styles = css`
    :host {
      display: inline-block;
      min-width: 0;
      --circular-input-size: 320px;
      --circular-input-sector-stroke: rgba(15, 84, 73, 0.35);
      --circular-input-sector-stroke-width: 1;
      --circular-input-active-sector-stroke: #2563eb;
      --circular-input-active-sector-stroke-width: 2;
      --circular-input-line-stroke: rgba(15, 84, 73, 0);
      --circular-input-handle-fill: #ffffff;
      --circular-input-handle-stroke-width: 1;
      --circular-input-active-handle-stroke-width: 2;
      --circular-input-value-handle-fill: #0f5449;
      --circular-input-radius-handle-fill: var(--circular-input-handle-fill);
      --circular-input-radius-handle-stroke: #0f5449;
      --circular-input-height-handle-fill: var(--circular-input-handle-fill);
      --circular-input-height-handle-stroke: #d8682d;
      --circular-input-start-angle-handle-fill: #d8682d;
      --circular-input-start-angle-handle-stroke: #000;
      --circular-input-focus-ring: #2563eb;
      --circular-input-focus-ring-stroke-width: 3;
      --circular-input-disabled-opacity: 0.48;
    }

    .control {
      display: block;
      width: var(--circular-input-size);
      max-width: 100%;
      height: auto;
      touch-action: none;
      user-select: none;
      overflow: visible;
    }

    :host([disabled]) .control {
      opacity: var(--circular-input-disabled-opacity);
    }

    .sector-path {
      fill: none;
      stroke: var(--circular-input-sector-stroke);
      stroke-width: var(--circular-input-sector-stroke-width);
      stroke-dasharray: 3 5;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }

    .sector-hit {
      cursor: pointer;
      outline: none;
      pointer-events: visibleStroke;
    }

    .sector-hit:focus-visible,
    .sector-hit.active-sector {
      stroke: var(--circular-input-active-sector-stroke);
      stroke-width: var(--circular-input-active-sector-stroke-width);
    }

    .radius-line {
      stroke: var(--circular-input-line-stroke);
      stroke-width: 1.5;
      stroke-dasharray: 2 5;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }

    .center {
      fill: var(--circular-input-line-stroke);
      pointer-events: none;
    }

    .handle {
      fill: var(--circular-input-handle-fill);
      stroke-width: var(--circular-input-handle-stroke-width);
      cursor: grab;
      outline: none;
      vector-effect: non-scaling-stroke;
    }

    .handle:active {
      cursor: grabbing;
    }

    .handle:focus-visible {
      stroke: var(--circular-input-focus-ring);
      stroke-width: var(--circular-input-focus-ring-stroke-width);
    }

    .active-handle {
      stroke-width: var(--circular-input-active-handle-stroke-width);
    }

    .handle-value {
      fill: var(--circular-input-value-handle-fill, var(--circular-input-handle-fill));
      stroke: #ffffff;
      stroke-width: var(--circular-input-value-handle-stroke-width, var(--circular-input-handle-stroke-width));
    }

    .handle-radius {
      fill: var(--circular-input-radius-handle-fill, var(--circular-input-handle-fill));
      stroke: var(--circular-input-radius-handle-stroke);
      stroke-width: var(--circular-input-radius-handle-stroke-width, var(--circular-input-handle-stroke-width));
    }

    .handle-height {
      fill: var(--circular-input-height-handle-fill, var(--circular-input-handle-fill));
      stroke: var(--circular-input-height-handle-stroke);
      stroke-width: var(--circular-input-height-handle-stroke-width, var(--circular-input-handle-stroke-width));
    }

    .handle-start-angle {
      fill: var(--circular-input-start-angle-handle-fill, var(--circular-input-handle-fill));
      stroke: var(--circular-input-start-angle-handle-stroke);
      stroke-width: var(--circular-input-start-angle-handle-stroke-width, var(--circular-input-handle-stroke-width));
    }

    :host([disabled]) .handle {
      cursor: default;
    }
  `;
}

export default CaskoUiCircularInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'circular-input': CaskoUiCircularInputElement;
  }
}
