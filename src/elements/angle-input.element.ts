import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import {
  AngleInputModel,
  CENTER,
  DEFAULT_NUMBER_DISTRIBUTION,
  DEFAULT_RADIUS,
  DEFAULT_VALUE_TEXT_ANCHOR,
  FULL_TURN_DEGREES,
  VIEW_BOX_SIZE,
  dataListConverter,
} from './angle-input.model';
import type {
  AngleInputChangeDetail,
  AngleInputChangeSource,
  AngleInputDataListMode,
  AngleInputDirection,
  AngleInputDisplayUnitPosition,
  AngleInputLabelDisplay,
  AngleInputPoint,
  AngleInputUnit,
} from './angle-input.model';
import type { AnchorPointBlock, AnchorPointInline, AnchorPointValue } from './anchor-point-input.element';

export type {
  AngleInputChangeDetail,
  AngleInputChangeSource,
  AngleInputDataListMode,
  AngleInputDirection,
  AngleInputDisplayUnitPosition,
  AngleInputLabelDisplay,
  AngleInputUnit,
} from './angle-input.model';

interface AngleInputInteraction {
  pointerId: number;
  captureElement: HTMLElement;
}

@customElement('angle-input')
export class CaskoUiAngleInputElement extends LitElement {
  @property({ type: Number })
  value = 0;

  @property({ type: String, reflect: true })
  unit: AngleInputUnit = 'degrees';

  @property({ type: String, reflect: true })
  direction: AngleInputDirection = 'clockwise';

  @property({ type: Number, attribute: 'start-angle' })
  startAngle = -90;

  @property({ type: Number, attribute: 'arc-degrees' })
  arcDegrees = FULL_TURN_DEGREES;

  @property({ type: Number })
  min = Number.NaN;

  @property({ type: Number })
  max = Number.NaN;

  @property({ type: Number })
  distribution = DEFAULT_NUMBER_DISTRIBUTION;

  @property({ type: Number })
  step = Number.NaN;

  @property({ type: Number, attribute: 'snap-step' })
  snapStep = 0;

  @property({
    attribute: 'data-list',
    converter: {
      fromAttribute: (value) => dataListConverter(value),
      toAttribute: (value) => JSON.stringify(dataListConverter(value)),
    },
  })
  dataList: number[] = [];

  @property({ type: String, attribute: 'data-list-mode', reflect: true })
  dataListMode: AngleInputDataListMode = 'sliding';

  @property({ type: String })
  label = '';

  @property({ type: String, attribute: 'label-display', reflect: true })
  labelDisplay: AngleInputLabelDisplay = 'visible';

  @property({ type: Boolean, attribute: 'show-value-text' })
  showValueText = false;

  @property({ type: String, attribute: 'value-text' })
  valueText = '';

  @property({ type: String, attribute: 'value-text-anchor', reflect: true })
  valueTextAnchor: AnchorPointValue = DEFAULT_VALUE_TEXT_ANCHOR;

  @property({ type: Number, attribute: 'value-text-offset' })
  valueTextOffset = 0;

  @property({ type: Boolean, attribute: 'show-step-value-text' })
  showStepValueText = false;

  @property({ type: Boolean, attribute: 'show-step-ticks' })
  showStepTicks = false;

  @property({ type: Boolean, attribute: 'hide-constrained-track' })
  hideConstrainedTrack = false;

  @property({ type: Number, attribute: 'step-value-text-offset' })
  stepValueTextOffset = 0;

  @property({ type: String, attribute: 'display-unit' })
  displayUnit = '';

  @property({ type: String, attribute: 'display-unit-position', reflect: true })
  displayUnitPosition: AngleInputDisplayUnitPosition = 'after';

  @property({ type: Boolean, attribute: 'hide-angle-line', reflect: true })
  hideAngleLine = false;

  @property({ type: Boolean, attribute: 'hide-center-point', reflect: true })
  hideCenterPoint = false;

  @property({ type: String, attribute: 'handle-path' })
  handlePath = '';

  @property({ type: Number, attribute: 'handle-offset' })
  handleOffset = 0;

  @property({ type: Boolean, attribute: 'rotate-handle' })
  rotateHandle = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @query('.control')
  private controlElement?: HTMLDivElement;

  private interaction?: AngleInputInteraction;
  private pendingKeyboardCommit = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.#normalizeCurrentValue();
    this.#normalizeModelBackedProperties();
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('value') ||
      changedProperties.has('unit') ||
      changedProperties.has('direction') ||
      changedProperties.has('arcDegrees') ||
      changedProperties.has('min') ||
      changedProperties.has('max') ||
      changedProperties.has('distribution') ||
      changedProperties.has('dataList') ||
      changedProperties.has('dataListMode') ||
      changedProperties.has('valueTextAnchor') ||
      changedProperties.has('displayUnitPosition')
    ) {
      this.#normalizeCurrentValue();
      this.#normalizeModelBackedProperties();
    }
  }

  focus(options?: FocusOptions): void {
    this.controlElement?.focus(options);
  }

  render() {
    const model = this.#createModel();
    const detail = model.createDetail(this.value, 'pointer');
    const radius = this.#getRadius();
    const angleLineEndPoint = model.getPointForValue(this.value, radius);
    const handlePoint = model.getPointForValue(this.value, radius + this.#getHandleOffset());
    const stepMarkers = this.showStepTicks || this.showStepValueText ? model.getStepMarkers() : [];
    const displayLabel = this.#getLabelDisplay() === 'visible' && this.label.trim().length > 0;
    const title = this.#getLabelDisplay() === 'title' && this.label.trim().length > 0 ? this.label : nothing;

    return html`
      <div class="field ${this.disabled ? 'disabled' : ''}">
        ${displayLabel ? html`<div class="label">${this.label}</div>` : nothing}
        <div
          class="control"
          role="slider"
          tabindex=${this.disabled ? -1 : 0}
          aria-label=${this.label || 'Angle'}
          aria-valuemin=${model.formatAriaNumber(model.range.min)}
          aria-valuemax=${model.formatAriaNumber(model.range.max)}
          aria-valuenow=${model.formatAriaNumber(detail.value)}
          aria-valuetext=${model.getValueText(detail)}
          aria-disabled=${String(this.disabled)}
          title=${title}
          @pointerdown=${this.#onPointerDown}
          @pointermove=${this.#onPointerMove}
          @pointerup=${this.#onPointerUp}
          @pointercancel=${this.#onPointerCancel}
          @lostpointercapture=${this.#onLostPointerCapture}
          @keydown=${this.#onKeyDown}
          @keyup=${this.#onKeyUp}>
          <svg
            class="dial"
            viewBox=${`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
            aria-hidden="true">
            ${this.#renderTrack(model, radius)}
            <path class="value-arc" d=${model.getValueArcPath(this.value, radius)}></path>
            ${this.showStepTicks ? this.#renderStepTicks(model, stepMarkers, radius) : nothing}
            ${this.hideAngleLine
              ? nothing
              : html`<line
                  class="angle-line"
                  x1=${CENTER}
                  y1=${CENTER}
                  x2=${angleLineEndPoint.x}
                  y2=${angleLineEndPoint.y}></line>`}
            ${this.hideCenterPoint ? nothing : html`<circle class="center" cx=${CENTER} cy=${CENTER} r="2.5"></circle>`}
            ${this.#renderHandle(model, handlePoint)}
          </svg>
          ${this.showStepValueText ? this.#renderStepValueTexts(model, stepMarkers) : nothing}
          ${this.showValueText ? this.#renderValueText(model, detail) : nothing}
        </div>
      </div>
    `;
  }

  #createModel(): AngleInputModel {
    return new AngleInputModel({
      value: this.value,
      unit: this.unit,
      direction: this.direction,
      startAngle: this.startAngle,
      arcDegrees: this.arcDegrees,
      min: this.min,
      max: this.max,
      distribution: this.distribution,
      step: this.step,
      snapStep: this.snapStep,
      dataList: this.dataList,
      dataListMode: this.dataListMode,
      valueText: this.valueText,
      valueTextAnchor: this.valueTextAnchor,
      displayUnit: this.displayUnit,
      displayUnitPosition: this.displayUnitPosition,
    });
  }

  #renderHandle(model: AngleInputModel, handlePoint: AngleInputPoint) {
    const handlePath = this.handlePath.trim();
    if (handlePath.length > 0) {
      const rotation = this.rotateHandle ? ` rotate(${model.getHandleRotation(this.value)})` : '';

      return svg`
        <path
          class="handle"
          d=${handlePath}
          transform=${`translate(${handlePoint.x} ${handlePoint.y})${rotation}`}></path>
      `;
    }

    return svg`
      <circle
        class="handle"
        cx=${handlePoint.x}
        cy=${handlePoint.y}
        r="var(--angle-input-handle-size)"></circle>
    `;
  }

  #renderValueText(model: AngleInputModel, detail: AngleInputChangeDetail) {
    const { block, inline } = model.getAnchorParts(model.valueTextAnchor);
    const anchorPoint = model.getAnchorPoint(block, inline, this.#getValueTextAnchorRadius(), this.valueTextOffset);
    const text = model.getDisplayValueText(detail);

    return html`
      <span
        class="value-text"
        style=${`
          --angle-input-value-text-x: ${anchorPoint.x}%;
          --angle-input-value-text-y: ${anchorPoint.y}%;
          --angle-input-value-text-translate-x: ${model.getAnchorTranslate(inline)}%;
          --angle-input-value-text-translate-y: ${model.getAnchorTranslate(block)}%;
        `}
        aria-hidden="true">
        ${text}
      </span>
    `;
  }

  #renderTrack(model: AngleInputModel, radius: number) {
    if (model.usesPartialArc || (this.hideConstrainedTrack && model.usesClamping)) {
      return svg`<path class="track" style=${this.#getTrackStyle()} d=${model.getTrackArcPath(radius)}></path>`;
    }

    return svg`<circle class="track" style=${this.#getTrackStyle()} cx=${CENTER} cy=${CENTER} r=${radius}></circle>`;
  }

  #getTrackStyle(): string {
    return [
      'fill: none',
      'vector-effect: non-scaling-stroke',
      'stroke: var(--angle-input-track-stroke)',
      'stroke-width: var(--angle-input-track-stroke-width)',
    ].join('; ');
  }

  #renderStepTicks(model: AngleInputModel, stepMarkers: number[], radius: number) {
    const tickLength = this.#getStepTickLength();

    return stepMarkers.map((value) => {
      const innerPoint = model.getPointForValue(value, radius - tickLength / 2);
      const outerPoint = model.getPointForValue(value, radius + tickLength / 2);

      return svg`
        <line
          class="step-tick"
          x1=${innerPoint.x}
          y1=${innerPoint.y}
          x2=${outerPoint.x}
          y2=${outerPoint.y}></line>
      `;
    });
  }

  #renderStepValueTexts(model: AngleInputModel, stepMarkers: number[]) {
    return stepMarkers.map((value) => {
      const offset = Number.isFinite(this.stepValueTextOffset) ? this.stepValueTextOffset : 0;
      const anchorPoint = model.getPointForValue(value, this.#getStepValueTextRadius() + offset);
      const anchor = this.#getStepValueTextAutoAnchor(anchorPoint);

      return html`
        <span
          class="step-value-text"
          style=${`
            --angle-input-step-value-text-x: ${(anchorPoint.x / VIEW_BOX_SIZE) * 100}%;
            --angle-input-step-value-text-y: ${(anchorPoint.y / VIEW_BOX_SIZE) * 100}%;
            --angle-input-step-value-text-translate-x: ${model.getAnchorTranslate(anchor.inline)}%;
            --angle-input-step-value-text-translate-y: ${model.getAnchorTranslate(anchor.block)}%;
          `}
          aria-hidden="true">
          ${model.getDisplayTextForValue(value)}
        </span>
      `;
    });
  }

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;

    const captureElement = event.currentTarget as HTMLElement;
    captureElement.focus();
    captureElement.setPointerCapture(event.pointerId);
    this.interaction = {
      pointerId: event.pointerId,
      captureElement,
    };

    this.#setValueFromPointer(event, 'pointer');
    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#setValueFromPointer(event, 'pointer');
  };

  #onPointerUp = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#releasePointerCapture(event.pointerId);
    this.interaction = undefined;
    this.#emitCommit('pointer');
  };

  #onPointerCancel = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#releasePointerCapture(event.pointerId);
    this.interaction = undefined;
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.interaction = undefined;
    this.#emitCommit('pointer');
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;
    const handledKeys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End'];
    if (!handledKeys.includes(event.key)) return;

    const model = this.#createModel();
    const range = model.range;
    const step = model.getStepValue();
    let nextValue: number;

    const dataListKeyboardValue = model.getDataListKeyboardValue(event.key, this.value);
    if (dataListKeyboardValue !== undefined) {
      nextValue = dataListKeyboardValue;
    } else if (event.key === 'Home') {
      nextValue = range.min;
    } else if (event.key === 'End') {
      nextValue = model.usesClamping ? range.max : range.max - step;
    } else {
      const directionMultiplier =
        event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'PageUp' ? 1 : -1;
      const pageMultiplier = event.key === 'PageUp' || event.key === 'PageDown' ? 10 : 1;
      const modifierMultiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      nextValue = this.value + step * pageMultiplier * modifierMultiplier * directionMultiplier;
    }

    event.preventDefault();
    this.pendingKeyboardCommit = true;
    this.#applyValue(nextValue, 'keyboard');
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.pendingKeyboardCommit) return;
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
      return;
    }

    this.pendingKeyboardCommit = false;
    this.#emitCommit('keyboard');
  };

  #setValueFromPointer(event: PointerEvent, source: AngleInputChangeSource) {
    const model = this.#createModel();
    const localPoint = this.#getLocalSvgPoint(event);
    const pointerDegrees = (Math.atan2(localPoint.y - CENTER, localPoint.x - CENTER) * 180) / Math.PI;
    const nextValue = model.getValueFromPointerDegrees(pointerDegrees);

    this.#applyValue(nextValue, source);
  }

  #applyValue(value: number, source: AngleInputChangeSource) {
    const model = this.#createModel();
    const nextValue = model.normalizeAndSnapValue(value);
    if (Object.is(nextValue, this.value)) return;

    this.value = nextValue;
    this.#emitChange(source);
  }

  #normalizeCurrentValue() {
    const normalizedValue = this.#createModel().normalizeValue(this.value);
    if (!Object.is(normalizedValue, this.value)) {
      this.value = normalizedValue;
    }
  }

  #normalizeModelBackedProperties() {
    const model = this.#createModel();
    if (model.dataListMode !== this.dataListMode) {
      this.dataListMode = model.dataListMode;
    }

    if (model.valueTextAnchor !== this.valueTextAnchor) {
      this.valueTextAnchor = model.valueTextAnchor;
    }

    if (model.displayUnitPosition !== this.displayUnitPosition) {
      this.displayUnitPosition = model.displayUnitPosition;
    }
  }

  #emitChange(source: AngleInputChangeSource) {
    this.#emitEvent('angle-input-change', this.#createModel().createDetail(this.value, source));
  }

  #emitCommit(source: AngleInputChangeSource) {
    this.#emitEvent('angle-input-commit', this.#createModel().createDetail(this.value, source));
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

  #getLocalSvgPoint(event: PointerEvent) {
    const bounds = this.controlElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return { x: CENTER, y: CENTER };
    }

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * VIEW_BOX_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * VIEW_BOX_SIZE,
    };
  }

  #releasePointerCapture(pointerId: number) {
    if (!this.interaction?.captureElement.hasPointerCapture(pointerId)) {
      return;
    }

    this.interaction.captureElement.releasePointerCapture(pointerId);
  }

  #getRadius(): number {
    const rawValue = getComputedStyle(this).getPropertyValue('--angle-input-radius');
    const parsedValue = Number.parseFloat(rawValue);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_RADIUS;
  }

  #getValueTextAnchorRadius(): number {
    const styles = getComputedStyle(this);
    const trackStrokeWidth = Number.parseFloat(styles.getPropertyValue('--angle-input-track-stroke-width'));
    const valueStrokeWidth = Number.parseFloat(styles.getPropertyValue('--angle-input-value-stroke-width'));
    const strokeWidth = Math.max(
      Number.isFinite(trackStrokeWidth) ? trackStrokeWidth : 0,
      Number.isFinite(valueStrokeWidth) ? valueStrokeWidth : 0,
    );

    return this.#getRadius() + strokeWidth / 2;
  }

  #getStepValueTextRadius(): number {
    const styles = getComputedStyle(this);
    const trackStrokeWidth = Number.parseFloat(styles.getPropertyValue('--angle-input-track-stroke-width'));
    const valueStrokeWidth = Number.parseFloat(styles.getPropertyValue('--angle-input-value-stroke-width'));
    const tickLength = this.#getStepTickLength();
    const strokeWidth = Math.max(
      Number.isFinite(trackStrokeWidth) ? trackStrokeWidth : 0,
      Number.isFinite(valueStrokeWidth) ? valueStrokeWidth : 0,
      tickLength,
    );

    return this.#getRadius() + strokeWidth / 2;
  }

  #getStepTickLength(): number {
    const rawValue = getComputedStyle(this).getPropertyValue('--angle-input-step-tick-length');
    const parsedValue = Number.parseFloat(rawValue);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 6;
  }

  #getHandleOffset(): number {
    return Number.isFinite(this.handleOffset) ? this.handleOffset : 0;
  }

  #getLabelDisplay(): AngleInputLabelDisplay {
    return this.labelDisplay === 'title' ? 'title' : 'visible';
  }

  #getStepValueTextAutoAnchor(point: AngleInputPoint): { block: AnchorPointBlock; inline: AnchorPointInline } {
    return {
      block: 'center',
      inline: 'center',
    };
  }

  static styles = css`
    :host {
      display: inline-block;
      min-width: 0;
      --angle-input-size: 60px;
      --angle-input-radius: 30;
      --angle-input-track-stroke: rgba(0, 0, 0, .2);
      --angle-input-track-stroke-width: 10;
      --angle-input-value-stroke: rgba(15, 84, 73, 0.9);
      --angle-input-value-stroke-width: 5;
      --angle-input-handle-size: 6;
      --angle-input-handle-fill: #ffffff;
      --angle-input-handle-stroke: #0f5449;
      --angle-input-handle-stroke-width: 1;
      --angle-input-center-fill: #0f5449;
      --angle-input-line-stroke: rgba(15, 84, 73, 0.55);
      --angle-input-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.2);
      --angle-input-label-color: #17322d;
      --angle-input-label-font: 600 0.92rem/1.3 "Segoe UI", sans-serif;
      --angle-input-disabled-opacity: 0.48;
      --angle-input-value-text-color: #17322d;
      --angle-input-value-text-font: 600 0.8rem/1.2 "Segoe UI", sans-serif;
      --angle-input-value-text-background: transparent;
      --angle-input-value-text-padding: 0;
      --angle-input-value-text-radius: 4px;
      --angle-input-value-text-offset-x: 0px;
      --angle-input-value-text-offset-y: 0px;
      --angle-input-step-tick-length: 10;
      --angle-input-step-tick-stroke: rgba(15, 84, 73, 0.7);
      --angle-input-step-tick-stroke-width: 1.5;
      --angle-input-step-tick-opacity: 1;
      --angle-input-step-value-text-color: var(--angle-input-value-text-color);
      --angle-input-step-value-text-font: 600 0.65rem/1.2 "Segoe UI", sans-serif;
      --angle-input-step-value-text-background: transparent;
      --angle-input-step-value-text-padding: 0;
      --angle-input-step-value-text-radius: 4px;
      --angle-input-step-value-text-offset-x: 0px;
      --angle-input-step-value-text-offset-y: 0px;
    }

    .field {
      display: inline-grid;
      gap: 10px;
      justify-items: center;
      min-width: 0;
    }

    .label {
      color: var(--angle-input-label-color);
      font: var(--angle-input-label-font);
      text-align: center;
    }

    .control {
      position: relative;
      width: var(--angle-input-size);
      aspect-ratio: 1;
      border-radius: 50%;
      outline: none;
      touch-action: none;
      cursor: pointer;
      user-select: none;
    }

    .control:focus-visible {
      box-shadow: var(--angle-input-focus-ring);
    }

    .disabled .control {
      cursor: default;
      opacity: var(--angle-input-disabled-opacity);
    }

    .dial {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .value-text {
      position: absolute;
      left: var(--angle-input-value-text-x);
      top: var(--angle-input-value-text-y);
      max-width: 100%;
      padding: var(--angle-input-value-text-padding);
      border-radius: var(--angle-input-value-text-radius);
      background: var(--angle-input-value-text-background);
      color: var(--angle-input-value-text-color);
      font: var(--angle-input-value-text-font);
      line-height: 1.2;
      pointer-events: none;
      text-align: center;
      white-space: nowrap;
      transform: translate(
        calc(var(--angle-input-value-text-translate-x) + var(--angle-input-value-text-offset-x)),
        calc(var(--angle-input-value-text-translate-y) + var(--angle-input-value-text-offset-y))
      );
      z-index: 1;
    }

    .step-value-text {
      position: absolute;
      left: var(--angle-input-step-value-text-x);
      top: var(--angle-input-step-value-text-y);
      max-width: 100%;
      padding: var(--angle-input-step-value-text-padding);
      border-radius: var(--angle-input-step-value-text-radius);
      background: var(--angle-input-step-value-text-background);
      color: var(--angle-input-step-value-text-color);
      font: var(--angle-input-step-value-text-font);
      line-height: 1.2;
      pointer-events: none;
      text-align: center;
      white-space: nowrap;
      transform: translate(
        calc(var(--angle-input-step-value-text-translate-x) + var(--angle-input-step-value-text-offset-x)),
        calc(var(--angle-input-step-value-text-translate-y) + var(--angle-input-step-value-text-offset-y))
      );
      z-index: 1;
    }

    .track,
    .value-arc,
    .angle-line,
    .step-tick {
      fill: none;
      vector-effect: non-scaling-stroke;
    }

    .track {
      stroke: var(--angle-input-track-stroke);
      stroke-width: var(--angle-input-track-stroke-width);
    }

    .value-arc {
      stroke: var(--angle-input-value-stroke);
      stroke-width: var(--angle-input-value-stroke-width);
      stroke-linecap: round;
    }

    .step-tick {
      opacity: var(--angle-input-step-tick-opacity);
      stroke: var(--angle-input-step-tick-stroke);
      stroke-width: var(--angle-input-step-tick-stroke-width);
      stroke-linecap: round;
    }

    .angle-line {
      stroke: var(--angle-input-line-stroke);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .center {
      fill: var(--angle-input-center-fill);
    }

    .handle {
      fill: var(--angle-input-handle-fill);
      stroke: var(--angle-input-handle-stroke);
      stroke-width: var(--angle-input-handle-stroke-width);
      vector-effect: non-scaling-stroke;
    }
  `;
}

export default CaskoUiAngleInputElement;

declare global {
  interface HTMLElementTagNameMap {
    'angle-input': CaskoUiAngleInputElement;
  }
}
