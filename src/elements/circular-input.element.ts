import { buildCircularSectorPathByMode, createCircularSectorViewModel } from '@casko/circular-sector';
import { LitElement, css, html, svg, type PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

export type CircularInputChangeSource = 'pointer' | 'keyboard';
export type CircularInputField = 'value' | 'radius' | 'height' | 'gap' | 'border-radius' | 'start-angle';
export type CircularInputHiddenControl = CircularInputField;
export type CircularInputValueHandleAnchor = 'start' | 'center' | 'end';

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
  valueAngle: number;
  ratio: number;
  path: string;
  radiusPoint: CircularInputPoint;
  innerPoint: CircularInputPoint;
  valuePoint: CircularInputPoint;
}

const VIEW_BOX_SIZE = 320;
const CENTER = VIEW_BOX_SIZE / 2;
const FULL_TURN_DEGREES = 360;
const START_ANGLE_HANDLE_OFFSET = 18;
const BORDER_RADIUS_HANDLE_OFFSET = 31;
const GAP_HANDLE_OFFSET = 44;
const GAP_TRACK_START_ANGLE = -107.5;
const GAP_TRACK_END_ANGLE = -72.5;
const HANDLE_TURN_EPSILON = 0.001;
const HIDDEN_CONTROLS = ['value', 'radius', 'height', 'gap', 'border-radius', 'start-angle'] as const;
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

  @property({ attribute: 'value-handle-anchor' })
  valueHandleAnchor: CircularInputValueHandleAnchor = 'start';

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

  @property({ type: Number, attribute: 'gap-step' })
  gapStep = 1;

  @property({ type: Number, attribute: 'gap-max' })
  gapMax = 48;

  @property({ type: Number, attribute: 'border-radius' })
  borderRadius = 0;

  @property({ type: Number, attribute: 'border-radius-step' })
  borderRadiusStep = 1;

  @property({ type: Number, attribute: 'border-radius-max' })
  borderRadiusMax = 48;

  @property({ attribute: 'value-handle-path' })
  valueHandlePath = '';

  @property({ attribute: 'radius-handle-path' })
  radiusHandlePath = '';

  @property({ attribute: 'height-handle-path' })
  heightHandlePath = '';

  @property({ attribute: 'gap-handle-path' })
  gapHandlePath = '';

  @property({ attribute: 'border-radius-handle-path' })
  borderRadiusHandlePath = '';

  @property({ attribute: 'start-angle-handle-path' })
  startAngleHandlePath = '';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @query('.control')
  private controlElement?: SVGSVGElement;

  private interaction?: CircularInputInteraction;
  private pendingKeyboardCommit?: { index: number; field: CircularInputField };
  private valueHandleTurns?: number[];
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
        this.valueHandleTurns = undefined;
      }

      this.internalSectorsUpdate = false;
    }

    if (changedProperties.has('valueHandleAnchor')) {
      this.valueHandleTurns = undefined;
    }
  }

  render() {
    const sectors = this.#getSectors();
    const items = this.#getRenderItems(sectors);
    const gapPoint = this.#getGapHandlePoint(items);
    const gapTrackPath = this.#getGapTrackPath(items);
    const borderRadiusPoint = this.#getBorderRadiusHandlePoint(items);
    const borderRadiusTrackPath = this.#getBorderRadiusTrackPath(items);
    const startAnglePoint = this.#getStartAngleHandlePoint(items);
    const startAngleTrackPath = this.#getStartAngleTrackPath(items);
    const showRadialLines = !this.#isControlHidden('radius') || !this.#isControlHidden('height');

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
              <path class="sector-path" d=${item.path}></path>
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
          ${this.#isControlHidden('border-radius') ? '' : svg`<path class="sector-path border-radius-track" d=${borderRadiusTrackPath}></path>`}
          ${this.#isControlHidden('gap') ? '' : svg`<path class="sector-path gap-track" d=${gapTrackPath}></path>`}
        </g>
        <g class="handles">
          ${items.map((item) => this.#renderSectorHandles(item))}
          ${this.#isControlHidden('gap') ? '' : this.#renderHandle({
            field: 'gap',
            point: gapPoint,
            label: 'Sector gap',
            value: this.#getGap(),
            min: 0,
            max: this.#getGapMax(),
            index: -1,
          })}
          ${this.#isControlHidden('border-radius') ? '' : this.#renderHandle({
            field: 'border-radius',
            point: borderRadiusPoint,
            label: 'Sector border radius',
            value: this.#getBorderRadius(),
            min: 0,
            max: this.#getBorderRadiusMax(),
            index: -1,
          })}
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

  #renderSectorHandles(item: CircularInputSectorRenderItem) {
    return svg`
      ${this.#isControlHidden('value') ? '' : this.#renderHandle({
        field: 'value',
        point: item.valuePoint,
        label: `Sector ${item.index + 1} value`,
        value: item.sector.value,
        min: 0,
        max: this.#getTotalValue(),
        index: item.index,
      })}
      ${this.#isControlHidden('radius') ? '' : this.#renderHandle({
        field: 'radius',
        point: item.radiusPoint,
        label: `Sector ${item.index + 1} radius`,
        value: item.sector.radius,
        min: 0,
        max: VIEW_BOX_SIZE / 2,
        index: item.index,
      })}
      ${this.#isControlHidden('height') ? '' : this.#renderHandle({
        field: 'height',
        point: item.innerPoint,
        label: `Sector ${item.index + 1} height`,
        value: item.sector.height,
        min: 0,
        max: item.sector.radius,
        index: item.index,
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
  }) {
    const path = this.#getHandlePath(options.field);
    const className = `handle handle-${options.field}`;
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
        r=${options.field === 'value' ? 5 : ['gap', 'border-radius', 'start-angle'].includes(options.field) ? 4.5 : 4}
        tabindex=${commonAttributes.tabindex}
        role=${commonAttributes.role}
        aria-label=${commonAttributes['aria-label']}
        aria-valuemin=${commonAttributes['aria-valuemin']}
        aria-valuemax=${commonAttributes['aria-valuemax']}
        aria-valuenow=${commonAttributes['aria-valuenow']}
        data-index=${commonAttributes['data-index']}
        data-field=${commonAttributes['data-field']}
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
    if (!Number.isInteger(index) || !field) return;
    if (this.#isControlHidden(field)) return;

    target.setPointerCapture(event.pointerId);
    this.interaction = {
      pointerId: event.pointerId,
      index,
      field,
      captureElement: target,
    };

    this.#applyPointerValue(event, index, field);
    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#applyPointerValue(event, this.interaction.index, this.interaction.field);
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
    if (!Number.isInteger(index) || !field) return;
    if (this.#isControlHidden(field)) return;

    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
    const baseStep = field === 'value'
      ? this.#getValueKeyboardStep()
      : field === 'start-angle'
        ? this.#getRotateKeyboardStep()
      : field === 'gap'
        ? this.#getGapStep()
        : field === 'border-radius'
          ? this.#getBorderRadiusStep()
          : field === 'height'
            ? this.#getHeightKeyboardStep()
            : this.#getRadiusKeyboardStep();
    const step = baseStep * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1);
    const sectors = this.#getSectors();
    const sector = sectors[index];
    if (!['gap', 'border-radius', 'start-angle'].includes(field) && !sector) return;

    let nextValue: number;
    if (event.key === 'Home') {
      nextValue = field === 'height'
        ? 1
        : field === 'radius'
          ? this.#getRadiusMinimum(sector)
          : field === 'start-angle'
            ? -180
            : 0;
    } else if (event.key === 'End') {
      nextValue = field === 'value'
        ? this.#getTotalValue()
        : field === 'radius'
          ? VIEW_BOX_SIZE / 2
          : field === 'gap'
            ? this.#getGapMax()
            : field === 'border-radius'
              ? this.#getBorderRadiusMax()
              : field === 'start-angle'
                ? 180
                : sector.radius;
    } else {
      nextValue = (
        field === 'value'
          ? sector.value
          : field === 'radius'
            ? sector.radius
            : field === 'gap'
              ? this.#getGap()
              : field === 'border-radius'
                ? this.#getBorderRadius()
                : field === 'start-angle'
                  ? this.#getStartAngle()
                  : sector.height
      ) + step * direction;
    }

    event.preventDefault();
    this.pendingKeyboardCommit = { index, field };
    if (field === 'gap') {
      this.#applyGapValue(nextValue, 'keyboard');
      return;
    }

    if (field === 'border-radius') {
      this.#applyBorderRadiusValue(nextValue, 'keyboard');
      return;
    }

    if (field === 'start-angle') {
      this.#applyStartAngleValue(nextValue, 'keyboard');
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

  #applyPointerValue(event: PointerEvent, index: number, field: CircularInputField) {
    if (this.#isControlHidden(field)) return;

    const point = this.#getLocalPoint(event);
    if (field === 'gap') {
      this.#applyGapPointerValue(point);
      return;
    }

    if (field === 'border-radius') {
      this.#applyBorderRadiusPointerValue(point);
      return;
    }

    if (field === 'start-angle') {
      this.#applyStartAnglePointerValue(point);
      return;
    }

    if (field === 'value') {
      this.#applyValueHandle(index, point);
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

  #applyValueHandle(index: number, point: CircularInputPoint) {
    const sectors = this.#getSectors();
    const items = this.#getRenderItems(sectors);
    const item = items[index];
    if (!item) return;

    const handleTurns = items.map((entry) => ({
      index: entry.index,
      angle: this.#normalizeDegrees(entry.valueAngle - this.#getStartAngle()) / FULL_TURN_DEGREES,
    }));
    const rawDesiredTurn = this.#normalizeDegrees(this.#getPointDegrees(point) - this.#getStartAngle()) / FULL_TURN_DEGREES;
    const desiredTurn = this.#snapValueTurn(rawDesiredTurn);
    handleTurns[index] = {
      index,
      angle: this.#getAllowCrossing()
        ? desiredTurn
        : this.#clampValueHandleTurn(index, desiredTurn, handleTurns),
    };

    this.valueHandleTurns = handleTurns
      .sort((a, b) => a.index - b.index)
      .map((entry) => this.#normalizeTurn(entry.angle));
    const nextSectors = this.#applyValuesFromValueHandles(sectors, handleTurns);
    this.#setSectors(nextSectors, index, 'value', 'pointer');
  }

  #applyFieldValue(index: number, field: CircularInputField, value: number, source: CircularInputChangeSource) {
    if (field === 'gap') {
      this.#applyGapValue(value, source);
      return;
    }

    if (field === 'border-radius') {
      this.#applyBorderRadiusValue(value, source);
      return;
    }

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
        const radius = Math.max(this.#getRadiusMinimum(entry), Number.isFinite(snappedValue) ? snappedValue : entry.radius);
        return { ...entry, radius, height: Math.min(Math.max(1, entry.height), radius) };
      }

      const snappedValue = source === 'pointer' ? this.#snapHeightValue(value) : value;
      const height = Math.max(1, Math.min(entry.radius, Number.isFinite(snappedValue) ? snappedValue : entry.height));
      return { ...entry, height };
    });

    if (field === 'value') {
      this.valueHandleTurns = undefined;
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

  #applyGapPointerValue(point: CircularInputPoint) {
    this.#applyGapValue(this.#getGapValueFromPoint(point), 'pointer');
  }

  #applyGapValue(value: number, source: CircularInputChangeSource) {
    this.gap = this.#clamp(value, 0, this.#getGapMax());
    this.#emitChange(-1, 'gap', source);
  }

  #applyBorderRadiusPointerValue(point: CircularInputPoint) {
    this.#applyBorderRadiusValue(this.#getBorderRadiusValueFromPoint(point), 'pointer');
  }

  #applyBorderRadiusValue(value: number, source: CircularInputChangeSource) {
    this.borderRadius = this.#clamp(value, 0, this.#getBorderRadiusMax());
    this.#emitChange(-1, 'border-radius', source);
  }

  #applyStartAnglePointerValue(point: CircularInputPoint) {
    this.#applyStartAngleValue(this.#snapRotateValue(this.#getPointDegrees(point)), 'pointer');
  }

  #applyStartAngleValue(value: number, source: CircularInputChangeSource) {
    this.startAngle = this.#normalizeSignedDegrees(value);
    this.#emitChange(-1, 'start-angle', source);
  }

  #applyValuesFromValueHandles(
    sectors: CircularInputSector[],
    handleTurns: Array<{ index: number; angle: number }>,
  ): CircularInputSector[] {
    if (handleTurns.length === 1) {
      return sectors.map((sector) => ({ ...sector, value: this.#getTotalValue() }));
    }

    const anchor = this.#getValueHandleAnchor();
    const sorted = [...handleTurns]
      .map((entry) => ({ ...entry, angle: this.#normalizeTurn(entry.angle) }))
      .sort((a, b) => a.angle - b.angle);
    const values = new Map<number, number>();

    sorted.forEach((entry, sortedIndex) => {
      const previous = sorted[(sortedIndex - 1 + sorted.length) % sorted.length];
      const next = sorted[(sortedIndex + 1) % sorted.length];
      const valueRatio = anchor === 'start'
        ? this.#positiveTurnDelta(entry.angle, next.angle)
        : anchor === 'end'
          ? this.#positiveTurnDelta(previous.angle, entry.angle)
          : (
            this.#positiveTurnDelta(previous.angle, entry.angle) +
            this.#positiveTurnDelta(entry.angle, next.angle)
          ) / 2;
      values.set(entry.index, valueRatio * this.#getTotalValue());
    });

    return sectors.map((sector, index) => ({
      ...sector,
      value: values.get(index) ?? sector.value,
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
    const handleTurns = this.#getValueHandleTurns(sectors);
    const sectorTurns = this.#getSectorTurns(handleTurns);

    return sectors.map((sector, index) => {
      const sectorTurn = sectorTurns[index];
      const ratio = sectorTurn?.ratio ?? 1 / sectors.length;
      const startTurn = sectorTurn?.start ?? 0;
      const centerTurn = this.#normalizeTurn(startTurn + ratio / 2);
      const valueTurn = handleTurns[index] ?? this.#getValueTurnFromSectorTurn(startTurn, ratio);
      const startAngle = this.#getStartAngle() + startTurn * FULL_TURN_DEGREES;
      const endAngle = startAngle + ratio * FULL_TURN_DEGREES;
      const midAngle = this.#getStartAngle() + centerTurn * FULL_TURN_DEGREES;
      const valueAngle = this.#getStartAngle() + valueTurn * FULL_TURN_DEGREES;
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
        valueAngle,
        ratio,
        path: buildCircularSectorPathByMode(viewModel, { mode: 'arc', cornerRadius: this.#getBorderRadius() }),
        radiusPoint: this.#pointForAngle(midAngle, radius),
        innerPoint: this.#pointForAngle(midAngle, radius - height),
        valuePoint: this.#pointForAngle(valueAngle, radius + 12),
      };
    });
  }

  #getValueHandleTurns(sectors: CircularInputSector[]): number[] {
    if (this.valueHandleTurns?.length === sectors.length) {
      return this.valueHandleTurns.map((turn) => this.#normalizeTurn(Number.isFinite(turn) ? turn : 0));
    }

    const total = this.#getValueTotal(sectors);
    let offset = 0;
    return sectors.map((sector) => {
      const ratio = total > 0 ? Math.max(0, sector.value) / total : 1 / sectors.length;
      const handleTurn = this.#getValueTurnFromSectorTurn(offset, ratio);
      offset += ratio;
      return handleTurn;
    });
  }

  #getSectorTurns(handleTurns: number[]): Array<{ start: number; ratio: number }> {
    if (handleTurns.length === 0) return [];
    if (handleTurns.length === 1) return [{ start: 0, ratio: 1 }];

    const anchor = this.#getValueHandleAnchor();
    const sorted = handleTurns
      .map((angle, index) => ({ index, angle: this.#normalizeTurn(angle) }))
      .sort((a, b) => a.angle - b.angle);
    const turns = new Array<{ start: number; ratio: number }>(handleTurns.length);

    sorted.forEach((entry, sortedIndex) => {
      const previous = sorted[(sortedIndex - 1 + sorted.length) % sorted.length];
      const next = sorted[(sortedIndex + 1) % sorted.length];
      const start = anchor === 'start'
        ? entry.angle
        : anchor === 'end'
          ? previous.angle
          : this.#turnMidpoint(previous.angle, entry.angle);
      const end = anchor === 'start'
        ? next.angle
        : anchor === 'end'
          ? entry.angle
          : this.#turnMidpoint(entry.angle, next.angle);
      turns[entry.index] = {
        start,
        ratio: this.#positiveTurnDelta(start, end),
      };
    });

    return turns;
  }

  #getValueTurnFromSectorTurn(startTurn: number, ratio: number): number {
    const anchor = this.#getValueHandleAnchor();
    if (anchor === 'start') return this.#normalizeTurn(startTurn);
    if (anchor === 'end') return this.#normalizeTurn(startTurn + ratio);
    return this.#normalizeTurn(startTurn + ratio / 2);
  }

  #getGapHandlePoint(items: CircularInputSectorRenderItem[]): CircularInputPoint {
    return this.#pointForAngle(this.#getGapTrackAngle(), this.#getGapHandleBaseRadius(items));
  }

  #getGapTrackPath(items: CircularInputSectorRenderItem[]): string {
    return this.#getBowTrackPath(this.#getGapHandleBaseRadius(items));
  }

  #getGapTrackAngle(): number {
    const ratio = this.#getGapMax() === 0 ? 0 : this.#getGap() / this.#getGapMax();
    return GAP_TRACK_START_ANGLE + (GAP_TRACK_END_ANGLE - GAP_TRACK_START_ANGLE) * ratio;
  }

  #getGapValueFromPoint(point: CircularInputPoint): number {
    return this.#getBowValueFromPoint(point, this.#getGapMax());
  }

  #getGapHandleBaseRadius(items: CircularInputSectorRenderItem[]): number {
    return this.#getLargestSectorRadius(items) + GAP_HANDLE_OFFSET;
  }

  #getBorderRadiusHandlePoint(items: CircularInputSectorRenderItem[]): CircularInputPoint {
    return this.#pointForAngle(this.#getBorderRadiusTrackAngle(), this.#getBorderRadiusHandleBaseRadius(items));
  }

  #getBorderRadiusTrackPath(items: CircularInputSectorRenderItem[]): string {
    return this.#getBowTrackPath(this.#getBorderRadiusHandleBaseRadius(items));
  }

  #getBorderRadiusTrackAngle(): number {
    const ratio = this.#getBorderRadiusMax() === 0 ? 0 : this.#getBorderRadius() / this.#getBorderRadiusMax();
    return GAP_TRACK_START_ANGLE + (GAP_TRACK_END_ANGLE - GAP_TRACK_START_ANGLE) * ratio;
  }

  #getBorderRadiusValueFromPoint(point: CircularInputPoint): number {
    return this.#getBowValueFromPoint(point, this.#getBorderRadiusMax());
  }

  #getBorderRadiusHandleBaseRadius(items: CircularInputSectorRenderItem[]): number {
    return this.#getLargestSectorRadius(items) + BORDER_RADIUS_HANDLE_OFFSET;
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

  #getBowTrackPath(radius: number): string {
    const start = this.#pointForAngle(GAP_TRACK_START_ANGLE, radius);
    const end = this.#pointForAngle(GAP_TRACK_END_ANGLE, radius);
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  }

  #getBowValueFromPoint(point: CircularInputPoint, max: number): number {
    const angle = this.#normalizeDegrees(this.#getPointDegrees(point));
    const start = this.#normalizeDegrees(GAP_TRACK_START_ANGLE);
    const end = this.#normalizeDegrees(GAP_TRACK_END_ANGLE);
    const sweep = this.#positiveDegreesDelta(start, end);
    const delta = this.#positiveDegreesDelta(start, angle);
    const clampedDelta = delta <= sweep
      ? delta
      : this.#degreesDistance(angle, start) <= this.#degreesDistance(angle, end)
        ? 0
        : sweep;
    const ratio = sweep === 0 ? 0 : clampedDelta / sweep;
    return ratio * max;
  }

  #getLargestSectorRadius(items: CircularInputSectorRenderItem[]): number {
    const largestRadius = items.reduce((largest, item) => Math.max(largest, item.sector.radius), 0);
    return largestRadius;
  }

  #clampValueHandleTurn(index: number, desiredTurn: number, handleTurns: Array<{ index: number; angle: number }>): number {
    if (handleTurns.length < 3) return this.#normalizeTurn(desiredTurn);

    const previous = handleTurns[(index - 1 + handleTurns.length) % handleTurns.length];
    const next = handleTurns[(index + 1) % handleTurns.length];
    if (!previous || !next) return this.#normalizeTurn(desiredTurn);

    const previousTurn = this.#normalizeTurn(previous.angle);
    const nextTurn = this.#normalizeTurn(next.angle);
    const desired = this.#normalizeTurn(desiredTurn);
    const span = this.#positiveTurnDelta(previousTurn, nextTurn);
    if (span <= HANDLE_TURN_EPSILON * 2) {
      return this.#normalizeTurn(handleTurns[index]?.angle ?? desired);
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

  #getRadiusMinimum(sector: CircularInputSector): number {
    return Math.max(1, sector.radius - sector.height, sector.height);
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
    return this.#clamp(this.gap, 0, this.#getGapMax());
  }

  #getGapMax(): number {
    return Number.isFinite(this.gapMax) && this.gapMax > 0 ? this.gapMax : 48;
  }

  #getBorderRadius(): number {
    return this.#clamp(this.borderRadius, 0, this.#getBorderRadiusMax());
  }

  #getBorderRadiusMax(): number {
    return Number.isFinite(this.borderRadiusMax) && this.borderRadiusMax > 0 ? this.borderRadiusMax : 48;
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

  #getGapStep(): number {
    return Number.isFinite(this.gapStep) && this.gapStep > 0 ? this.gapStep : 1;
  }

  #getBorderRadiusStep(): number {
    return Number.isFinite(this.borderRadiusStep) && this.borderRadiusStep > 0 ? this.borderRadiusStep : 1;
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

  #getAllowCrossing(): boolean {
    return this.allowCrossing;
  }

  #getValueHandleAnchor(): CircularInputValueHandleAnchor {
    return this.valueHandleAnchor === 'start' || this.valueHandleAnchor === 'end'
      ? this.valueHandleAnchor
      : 'center';
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
          : field === 'gap'
            ? this.gapHandlePath
          : field === 'border-radius'
            ? this.borderRadiusHandlePath
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
      --circular-input-line-stroke: rgba(15, 84, 73, 0.28);
      --circular-input-handle-fill: #ffffff;
      --circular-input-handle-stroke-width: 1;
      --circular-input-value-handle-fill: #0f5449;
      --circular-input-radius-handle-fill: var(--circular-input-handle-fill);
      --circular-input-radius-handle-stroke: #0f5449;
      --circular-input-height-handle-fill: var(--circular-input-handle-fill);
      --circular-input-height-handle-stroke: #d8682d;
      --circular-input-gap-handle-fill: #365c8d;
      --circular-input-gap-handle-stroke: #ffffff;
      --circular-input-border-radius-handle-fill: #8b5cf6;
      --circular-input-border-radius-handle-stroke: #ffffff;
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

    .handle-gap {
      fill: var(--circular-input-gap-handle-fill, var(--circular-input-handle-fill));
      stroke: var(--circular-input-gap-handle-stroke);
      stroke-width: var(--circular-input-gap-handle-stroke-width, var(--circular-input-handle-stroke-width));
    }

    .handle-border-radius {
      fill: var(--circular-input-border-radius-handle-fill, var(--circular-input-handle-fill));
      stroke: var(--circular-input-border-radius-handle-stroke);
      stroke-width: var(--circular-input-border-radius-handle-stroke-width, var(--circular-input-handle-stroke-width));
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
