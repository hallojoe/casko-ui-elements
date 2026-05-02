import type { AnchorPointBlock, AnchorPointInline, AnchorPointValue } from './anchor-point-input.element';

export type AngleInputUnit = 'degrees' | 'radians' | 'ratio' | 'number';
export type AngleInputDirection = 'clockwise' | 'counterclockwise';
export type AngleInputLabelDisplay = 'visible' | 'title';
export type AngleInputChangeSource = 'pointer' | 'keyboard';
export type AngleInputDisplayUnitPosition = 'before' | 'after';
export type AngleInputDataListMode = 'sliding' | 'absolute';

export interface AngleInputChangeDetail {
  value: number;
  degrees: number;
  radians: number;
  distribution: number;
  unit: AngleInputUnit;
  direction: AngleInputDirection;
  source: AngleInputChangeSource;
}

export interface AngleInputRange {
  min: number;
  max: number;
}

export interface AngleInputPoint {
  x: number;
  y: number;
}

export interface AngleInputModelOptions {
  value: number;
  unit: AngleInputUnit;
  direction: AngleInputDirection;
  startAngle: number;
  arcDegrees: number;
  min: number;
  max: number;
  distribution: number;
  step: number;
  snapStep: number;
  dataList: number[];
  dataListMode: AngleInputDataListMode;
  valueText: string;
  valueTextAnchor: AnchorPointValue;
  displayUnit: string;
  displayUnitPosition: AngleInputDisplayUnitPosition;
}

export interface AngleInputAnchorParts {
  block: AnchorPointBlock;
  inline: AnchorPointInline;
}

export const VIEW_BOX_SIZE = 64;
export const CENTER = VIEW_BOX_SIZE / 2;
export const DEFAULT_RADIUS = 38;
export const FULL_TURN_DEGREES = 360;
export const FULL_TURN_RADIANS = Math.PI * 2;
export const FULL_TURN_RATIO = 1;
export const DEFAULT_NUMBER_DISTRIBUTION = 100;
export const DEFAULT_VALUE_TEXT_ANCHOR: AnchorPointValue = 'block-center-inline-center';

const MAX_GENERATED_STEP_MARKERS = 64;

export function dataListConverter(value: unknown): number[] {
  const parseEntry = (entry: unknown) => {
    const parsedValue = typeof entry === 'number' ? entry : Number(String(entry).trim());
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  };

  if (Array.isArray(value)) {
    return value.map(parseEntry).filter((entry): entry is number => entry !== undefined);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    return Array.isArray(parsed) ? dataListConverter(parsed) : [];
  } catch {
    return trimmedValue.split(',').map(parseEntry).filter((entry): entry is number => entry !== undefined);
  }
}

export class AngleInputModel {
  readonly unit: AngleInputUnit;
  readonly direction: AngleInputDirection;
  readonly dataListMode: AngleInputDataListMode;
  readonly valueTextAnchor: AnchorPointValue;
  readonly displayUnitPosition: AngleInputDisplayUnitPosition;
  readonly distribution: number;
  readonly arcDegrees: number;
  readonly validDataList?: number[];
  readonly range: AngleInputRange;
  readonly usesPartialArc: boolean;
  readonly usesClamping: boolean;

  constructor(private readonly options: AngleInputModelOptions) {
    this.unit = normalizeUnit(options.unit);
    this.direction = normalizeDirection(options.direction);
    this.dataListMode = normalizeDataListMode(options.dataListMode);
    this.valueTextAnchor = normalizeValueTextAnchor(options.valueTextAnchor);
    this.displayUnitPosition = normalizeDisplayUnitPosition(options.displayUnitPosition);
    this.distribution = getDistribution(this.unit, options.distribution);
    this.arcDegrees = normalizeArcDegrees(options.arcDegrees);
    this.validDataList = getValidDataList(options.dataList);
    this.range = this.#getRange();
    this.usesPartialArc = this.arcDegrees < FULL_TURN_DEGREES;
    this.usesClamping =
      this.validDataList !== undefined ||
      this.usesPartialArc ||
      this.unit === 'ratio' ||
      this.unit === 'number' ||
      this.#getExplicitRange() !== undefined;
  }

  normalizeValue(value: number): number {
    const fallbackValue = Number.isFinite(value) ? value : this.range.min;

    if (this.usesClamping) {
      return Math.min(this.range.max, Math.max(this.range.min, fallbackValue));
    }

    return wrapValue(fallbackValue, this.range);
  }

  applySnap(value: number): number {
    if (this.dataListMode === 'absolute' && this.validDataList) {
      return this.getClosestDataListValue(value, this.validDataList);
    }

    if (!Number.isFinite(this.options.snapStep) || this.options.snapStep <= 0) {
      return value;
    }

    return Math.round(value / this.options.snapStep) * this.options.snapStep;
  }

  normalizeAndSnapValue(value: number): number {
    return this.normalizeValue(this.applySnap(value));
  }

  createDetail(value: number, source: AngleInputChangeSource): AngleInputChangeDetail {
    const normalizedValue = this.normalizeValue(value);
    return {
      value: normalizedValue,
      degrees: this.getDegreesForValue(normalizedValue),
      radians: this.getRadiansForValue(normalizedValue),
      distribution: this.distribution,
      unit: this.unit,
      direction: this.direction,
      source,
    };
  }

  getPointForValue(value: number, radius: number): AngleInputPoint {
    const radians = (this.getVisualDegreesForValue(value) * Math.PI) / 180;

    return {
      x: CENTER + Math.cos(radians) * radius,
      y: CENTER + Math.sin(radians) * radius,
    };
  }

  getHandleRotation(value: number): number {
    return this.getVisualDegreesForValue(value) + 90;
  }

  getVisualDegreesForValue(value: number): number {
    if (this.usesPartialArc) {
      const visualDegrees = this.getRangeFractionForValue(this.normalizeValue(value)) * this.arcDegrees;
      const directionMultiplier = this.direction === 'clockwise' ? 1 : -1;
      return this.options.startAngle + visualDegrees * directionMultiplier;
    }

    const degrees = this.getDegreesForValue(this.normalizeValue(value));
    const directionMultiplier = this.direction === 'clockwise' ? 1 : -1;
    return this.options.startAngle + degrees * directionMultiplier;
  }

  getTrackArcPath(radius: number): string {
    return this.getArcPathForValues(this.range.min, this.range.max, radius);
  }

  getValueArcPath(value: number, radius: number): string {
    const normalizedValue = this.normalizeValue(value);
    const startValue = this.usesClamping ? this.range.min : 0;
    if (Object.is(normalizedValue, startValue)) {
      return '';
    }

    return this.getArcPathForValues(startValue, normalizedValue, radius);
  }

  getArcPathForValues(startValue: number, endValue: number, radius: number): string {
    const degreesDelta = this.getArcDegreesDeltaForValues(startValue, endValue);
    const endPoint = this.getPointForValue(endValue, radius);
    const startPoint = this.getPointForValue(startValue, radius);
    const largeArcFlag = degreesDelta > FULL_TURN_DEGREES / 2 ? 1 : 0;
    const sweepFlag = this.direction === 'clockwise' ? 1 : 0;

    if (degreesDelta >= FULL_TURN_DEGREES) {
      const startDegrees = this.getDegreesForValue(startValue);
      const midPoint = this.getPointForValue(this.getValueFromDegrees(startDegrees + FULL_TURN_DEGREES / 2), radius);
      return [
        `M ${startPoint.x} ${startPoint.y}`,
        `A ${radius} ${radius} 0 1 ${sweepFlag} ${midPoint.x} ${midPoint.y}`,
        `A ${radius} ${radius} 0 1 ${sweepFlag} ${startPoint.x} ${startPoint.y}`,
      ].join(' ');
    }

    return [
      `M ${startPoint.x} ${startPoint.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endPoint.x} ${endPoint.y}`,
    ].join(' ');
  }

  getArcDegreesDeltaForValues(startValue: number, endValue: number): number {
    if (this.usesPartialArc) {
      return Math.abs((this.getRangeFractionForValue(endValue) - this.getRangeFractionForValue(startValue)) * this.arcDegrees);
    }

    return Math.abs(this.getDegreesForValue(endValue) - this.getDegreesForValue(startValue));
  }

  getValueFromPointerDegrees(pointerDegrees: number): number {
    const directionMultiplier = this.direction === 'clockwise' ? 1 : -1;
    const relativeDegrees = (pointerDegrees - this.options.startAngle) * directionMultiplier;
    const nextValue = this.usesPartialArc
      ? this.getValueFromArcDegrees(this.clampDegreesToArc(relativeDegrees))
      : this.getValueFromDegrees(wrapDegrees(relativeDegrees));

    return this.getPointerValue(nextValue);
  }

  getStepValue(): number {
    if (Number.isFinite(this.options.step) && this.options.step > 0) {
      return this.options.step;
    }

    if (this.unit === 'radians') return Math.PI / 180;
    if (this.unit === 'ratio') return 1 / FULL_TURN_DEGREES;
    return 1;
  }

  getStepMarkers(): number[] {
    const values = this.validDataList ?? this.getGeneratedStepMarkers();
    return this.dedupeStepMarkers(values);
  }

  getGeneratedStepMarkers(): number[] {
    const step = this.getStepValue();
    const span = this.range.max - this.range.min;
    if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(step) || step <= 0) {
      return [];
    }

    const stepCount = Math.floor(span / step);
    if (stepCount + 2 > MAX_GENERATED_STEP_MARKERS) {
      return [];
    }

    const values: number[] = [this.range.min];
    for (let index = 1; index <= stepCount; index += 1) {
      const value = this.range.min + step * index;
      if (value >= this.range.max) {
        break;
      }

      values.push(value);
    }

    values.push(this.range.max);
    return values;
  }

  dedupeStepMarkers(values: number[]): number[] {
    const markers: number[] = [];
    const seenDegrees = new Set<number>();
    const rangeSpanDegrees = Math.abs(this.getDegreesForValue(this.range.max) - this.getDegreesForValue(this.range.min));
    const preserveRangeEndpoints = this.usesClamping && rangeSpanDegrees < FULL_TURN_DEGREES;

    for (const value of values) {
      if (!Number.isFinite(value)) {
        continue;
      }

      const normalizedValue = this.normalizeValue(value);
      const degreeKey = Math.round(wrapDegrees(this.getDegreesForValue(normalizedValue)) * 1000);
      if (seenDegrees.has(degreeKey) && !this.isRangeEndpoint(normalizedValue, preserveRangeEndpoints)) {
        continue;
      }

      seenDegrees.add(degreeKey);
      markers.push(normalizedValue);
    }

    return markers;
  }

  getPointerValue(value: number): number {
    if (this.dataListMode !== 'absolute' || !this.validDataList) {
      return value;
    }

    return this.getClosestDataListValue(value, this.validDataList);
  }

  getDataListKeyboardValue(key: string, value: number): number | undefined {
    if (this.dataListMode !== 'absolute' || !this.validDataList) {
      return undefined;
    }

    if (key === 'Home') {
      return this.validDataList[0];
    }

    if (key === 'End') {
      return this.validDataList[this.validDataList.length - 1];
    }

    const direction = key === 'ArrowUp' || key === 'ArrowRight' || key === 'PageUp' ? 1 : -1;
    const distance = key === 'PageUp' || key === 'PageDown' ? 10 : 1;
    const index = this.getDataListNavigationIndex(value, this.validDataList, direction, distance);
    return this.validDataList[index];
  }

  getDisplayValueText(detail: AngleInputChangeDetail): string {
    const text = this.options.valueText.trim().length > 0 ? this.options.valueText : formatDisplayNumber(detail.value);
    return this.getDisplayTextWithUnit(text);
  }

  getDisplayTextForValue(value: number): string {
    return this.getDisplayTextWithUnit(formatDisplayNumber(value));
  }

  getValueText(detail: AngleInputChangeDetail): string {
    if (detail.unit === 'ratio') {
      return `${formatDisplayNumber(detail.value)} ratio, ${formatDisplayNumber(detail.degrees)} degrees, ${formatDisplayNumber(
        detail.radians,
      )} radians`;
    }

    if (detail.unit === 'number') {
      return `${formatDisplayNumber(detail.value)} of ${formatDisplayNumber(detail.distribution)}, ${formatDisplayNumber(
        detail.degrees,
      )} degrees, ${formatDisplayNumber(detail.radians)} radians`;
    }

    return `${formatDisplayNumber(detail.degrees)} degrees, ${formatDisplayNumber(detail.radians)} radians`;
  }

  getAnchorParts(anchor: AnchorPointValue): AngleInputAnchorParts {
    const parts = anchor.match(/^block-(start|center|end)-inline-(start|center|end)$/);
    if (!parts) {
      return { block: 'center', inline: 'center' };
    }

    return {
      block: parts[1] as AnchorPointBlock,
      inline: parts[2] as AnchorPointInline,
    };
  }

  getAnchorPoint(
    block: AnchorPointBlock,
    inline: AnchorPointInline,
    radius: number,
    offset: number,
  ): { x: number; y: number } {
    const vectorX = inline === 'start' ? -1 : inline === 'end' ? 1 : 0;
    const vectorY = block === 'start' ? -1 : block === 'end' ? 1 : 0;
    const length = Math.hypot(vectorX, vectorY) || 1;
    const adjustedOffset = length > 0 && Number.isFinite(offset) ? offset : 0;
    const adjustedRadius = radius + adjustedOffset;

    return {
      x: ((CENTER + (vectorX / length) * adjustedRadius) / VIEW_BOX_SIZE) * 100,
      y: ((CENTER + (vectorY / length) * adjustedRadius) / VIEW_BOX_SIZE) * 100,
    };
  }

  getAnchorTranslate(value: AnchorPointBlock | AnchorPointInline): number {
    if (value === 'start') return -100;
    if (value === 'end') return 0;
    return -50;
  }

  formatAriaNumber(value: number): string {
    return formatDisplayNumber(value);
  }

  #getRange(): AngleInputRange {
    if (this.validDataList) {
      return { min: this.validDataList[0], max: this.validDataList[this.validDataList.length - 1] };
    }

    return this.#getExplicitRange() ?? this.#getDefaultRange();
  }

  #getExplicitRange(): AngleInputRange | undefined {
    if (!Number.isFinite(this.options.min) && !Number.isFinite(this.options.max)) {
      return undefined;
    }

    const defaults = this.#getDefaultRange();
    const min = Number.isFinite(this.options.min) ? this.options.min : defaults.min;
    const max = Number.isFinite(this.options.max) ? this.options.max : defaults.max;

    if (max <= min) {
      return undefined;
    }

    return { min, max };
  }

  #getDefaultRange(): AngleInputRange {
    if (this.unit === 'radians') return { min: 0, max: FULL_TURN_RADIANS };
    if (this.unit === 'ratio') return { min: 0, max: FULL_TURN_RATIO };
    if (this.unit === 'number') return { min: 0, max: this.distribution };
    return { min: 0, max: FULL_TURN_DEGREES };
  }

  private getDegreesForValue(value: number): number {
    if (this.unit === 'radians') return (value / FULL_TURN_RADIANS) * FULL_TURN_DEGREES;
    if (this.unit === 'ratio') return value * FULL_TURN_DEGREES;
    if (this.unit === 'number') return (value / this.distribution) * FULL_TURN_DEGREES;
    return value;
  }

  private getRadiansForValue(value: number): number {
    if (this.unit === 'radians') return value;
    if (this.unit === 'ratio') return value * FULL_TURN_RADIANS;
    if (this.unit === 'number') return (value / this.distribution) * FULL_TURN_RADIANS;
    return (value / FULL_TURN_DEGREES) * FULL_TURN_RADIANS;
  }

  private getValueFromDegrees(degrees: number): number {
    if (this.unit === 'radians') return (degrees / FULL_TURN_DEGREES) * FULL_TURN_RADIANS;
    if (this.unit === 'ratio') return degrees / FULL_TURN_DEGREES;
    if (this.unit === 'number') return (degrees / FULL_TURN_DEGREES) * this.distribution;
    return degrees;
  }

  private getRangeFractionForValue(value: number): number {
    const span = this.range.max - this.range.min;
    if (!Number.isFinite(span) || span <= 0) {
      return 0;
    }

    return (this.normalizeValue(value) - this.range.min) / span;
  }

  private getValueFromArcDegrees(degrees: number): number {
    const fraction = this.arcDegrees > 0 ? Math.min(this.arcDegrees, Math.max(0, degrees)) / this.arcDegrees : 0;
    return this.range.min + (this.range.max - this.range.min) * fraction;
  }

  private clampDegreesToArc(degrees: number): number {
    const normalizedDegrees = wrapDegrees(degrees);
    let closestValue = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of [
      normalizedDegrees - FULL_TURN_DEGREES,
      normalizedDegrees,
      normalizedDegrees + FULL_TURN_DEGREES,
    ]) {
      const clamped = Math.min(this.arcDegrees, Math.max(0, candidate));
      const distance = Math.abs(candidate - clamped);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestValue = clamped;
      }
    }

    return closestValue;
  }

  private getDisplayTextWithUnit(text: string): string {
    const displayUnit = this.options.displayUnit.trim();
    if (displayUnit.length === 0) {
      return text;
    }

    return this.displayUnitPosition === 'before' ? `${displayUnit}${text}` : `${text}${displayUnit}`;
  }

  private getClosestDataListValue(value: number, dataList: number[]): number {
    const fallbackValue = Number.isFinite(value) ? value : dataList[0];
    return dataList.reduce((closestValue, entry) =>
      Math.abs(entry - fallbackValue) < Math.abs(closestValue - fallbackValue) ? entry : closestValue,
    );
  }

  private getDataListNavigationIndex(value: number, dataList: number[], direction: 1 | -1, distance: number): number {
    const currentValue = Number.isFinite(value) ? value : dataList[0];
    const exactIndex = dataList.findIndex((entry) => Object.is(entry, currentValue));

    if (exactIndex !== -1) {
      return clampDataListIndex(exactIndex + direction * distance, dataList);
    }

    if (direction === 1) {
      const greaterIndex = dataList.findIndex((entry) => entry > currentValue);
      const baseIndex = greaterIndex === -1 ? dataList.length - 1 : greaterIndex;
      return clampDataListIndex(baseIndex + distance - 1, dataList);
    }

    let lowerIndex = -1;
    for (let index = dataList.length - 1; index >= 0; index -= 1) {
      if (dataList[index] < currentValue) {
        lowerIndex = index;
        break;
      }
    }

    const baseIndex = lowerIndex === -1 ? 0 : lowerIndex;
    return clampDataListIndex(baseIndex - distance + 1, dataList);
  }

  private isRangeEndpoint(value: number, preserveRangeEndpoints: boolean): boolean {
    return preserveRangeEndpoints && (Object.is(value, this.range.min) || Object.is(value, this.range.max));
  }
}

export function normalizeUnit(value: unknown): AngleInputUnit {
  return value === 'radians' || value === 'ratio' || value === 'number' ? value : 'degrees';
}

export function normalizeDirection(value: unknown): AngleInputDirection {
  return value === 'counterclockwise' ? 'counterclockwise' : 'clockwise';
}

export function normalizeDataListMode(value: unknown): AngleInputDataListMode {
  return value === 'absolute' ? 'absolute' : 'sliding';
}

export function normalizeDisplayUnitPosition(value: unknown): AngleInputDisplayUnitPosition {
  return value === 'before' ? 'before' : 'after';
}

export function normalizeValueTextAnchor(value: unknown): AnchorPointValue {
  return isValidValueTextAnchor(value) ? value : DEFAULT_VALUE_TEXT_ANCHOR;
}

export function isValidValueTextAnchor(value: unknown): value is AnchorPointValue {
  return typeof value === 'string' && /^block-(start|center|end)-inline-(start|center|end)$/.test(value);
}

export function formatDisplayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function getDistribution(unit: AngleInputUnit, value: number): number {
  if (unit === 'radians') return FULL_TURN_RADIANS;
  if (unit === 'ratio') return FULL_TURN_RATIO;
  if (unit === 'number') {
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_NUMBER_DISTRIBUTION;
  }

  return FULL_TURN_DEGREES;
}

function normalizeArcDegrees(value: number): number {
  return Number.isFinite(value) && value > 0 && value < FULL_TURN_DEGREES ? value : FULL_TURN_DEGREES;
}

function getValidDataList(value: number[]): number[] | undefined {
  const dataList = dataListConverter(value);
  if (dataList.length < 2 || dataList[dataList.length - 1] <= dataList[0]) {
    return undefined;
  }

  return dataList;
}

function clampDataListIndex(index: number, dataList: number[]): number {
  return Math.min(dataList.length - 1, Math.max(0, index));
}

function wrapDegrees(value: number): number {
  return ((value % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
}

function wrapValue(value: number, range: AngleInputRange): number {
  const span = range.max - range.min;
  return ((value - range.min) % span + span) % span + range.min;
}
