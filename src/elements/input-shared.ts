type TextControl = HTMLInputElement | HTMLTextAreaElement;

export type InputReadonlyMode = 'none' | 'all' | 'text' | 'number';
export type InputPairLockMode = 'step' | 'all';
export type InputTokenMode = 'number' | 'values' | 'pattern-values';
export type InputSuggestionMode = 'none' | 'dropdown';
export type NumberPart = 'integer' | 'fraction';
export type SpinnerDirection = 1 | -1;

export interface ParsedTokenBase {
  raw: string;
  value: number | string;
  startIndex: number;
  length: number;
  endIndex: number;
  mode: InputTokenMode;
  activePart: NumberPart | null;
}

export interface ParsedNumber extends ParsedTokenBase {
  value: number;
  mode: 'number';
  decimalSeparator: '.' | ',' | null;
  precision: number;
  step: number;
  integerStep: number;
  decimalStep: number;
}

export interface ParsedValueToken extends ParsedTokenBase {
  value: string;
  mode: 'values' | 'pattern-values';
  allowedIndex: number;
}

export type ParsedToken = ParsedNumber | ParsedValueToken;

export interface ResolvedPatternToken {
  startIndex: number;
  endIndex: number;
  raw: string;
}

export interface SpinnerPosition {
  top: number;
  left: number;
  visible: boolean;
}

export interface TokenReplacement {
  tokenIndex: number;
  startIndex: number;
  endIndex: number;
  replacement: string;
}

export interface InputSnapshot<TToken> {
  value: string;
  numbers: TToken[];
  activeTokenIndex: number;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toMeasureHtml(value: string): string {
  return escapeHtml(value).replaceAll(' ', '&nbsp;').replaceAll('\n', '<br>');
}

export function getPrecision(value: number): number {
  const text = String(value);
  const exponentMatch = text.match(/e-(\d+)$/i);

  if (exponentMatch) {
    return Number(exponentMatch[1]);
  }

  const decimalIndex = text.indexOf('.');
  return decimalIndex === -1 ? 0 : text.length - decimalIndex - 1;
}

export function allowedValuesConverter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
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
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return trimmedValue.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
}

export function getTokenPattern(decimalSeparator: '.' | ','): RegExp {
  const decimal = decimalSeparator === '.' ? '\\.' : ',';
  return new RegExp(`[+-]?(?:\\d+(?:${decimal}\\d+)?|${decimal}\\d+)`, 'g');
}

export function parseNumbers(
  value: string,
  decimalSeparator: '.' | ',',
  integerStep: number,
  decimalStep: number,
  minValue?: number,
  maxValue?: number,
): ParsedNumber[] {
  const matcher = getTokenPattern(decimalSeparator);
  const numbers: ParsedNumber[] = [];

  for (const match of value.matchAll(matcher)) {
    const raw = match[0];
    const startIndex = match.index ?? 0;
    const normalized = decimalSeparator === ',' ? raw.replace(',', '.') : raw;
    const numericValue = Number(normalized);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    if (minValue !== undefined && numericValue < minValue) {
      continue;
    }

    if (maxValue !== undefined && numericValue > maxValue) {
      continue;
    }

    const precision = raw.includes(decimalSeparator) ? raw.split(decimalSeparator)[1]?.length ?? 0 : 0;
    numbers.push({
      raw,
      value: numericValue,
      startIndex,
      length: raw.length,
      endIndex: startIndex + raw.length,
      mode: 'number',
      decimalSeparator: raw.includes(decimalSeparator) ? decimalSeparator : null,
      precision,
      step: precision > 0 ? decimalStep : integerStep,
      integerStep,
      decimalStep,
      activePart: null,
    });
  }

  return numbers;
}

export function normalizePatternInput(value: string | RegExp | null | undefined): RegExp | null {
  if (!value) {
    return null;
  }

  try {
    if (value instanceof RegExp) {
      const flags = `${value.flags.replace(/[gy]/g, '')}${value.flags.includes('d') ? '' : 'd'}`;
      return new RegExp(value.source, flags);
    }

    return new RegExp(value, 'd');
  } catch {
    return null;
  }
}

export function resolvePatternToken(value: string, pattern: RegExp): ResolvedPatternToken | null {
  const match = pattern.exec(value) as RegExpExecArray & {
    indices?: Array<[number, number] | undefined>;
  };

  if (!match || match[0] !== value || !match.indices || match.indices.length !== 2) {
    return null;
  }

  const group = match.indices[1];
  if (!group) {
    return null;
  }

  const [startIndex, endIndex] = group;
  return {
    startIndex,
    endIndex,
    raw: value.slice(startIndex, endIndex),
  };
}

function selectionOverlapsToken(
  selectionStart: number,
  selectionEnd: number,
  token: ParsedToken,
): boolean {
  const overlapStart = Math.max(selectionStart, token.startIndex);
  const overlapEnd = Math.min(selectionEnd, token.endIndex);
  return overlapStart < overlapEnd;
}

export function getTokenWithActivePart(token: ParsedNumber, caret: number): ParsedNumber {
  if (!token.decimalSeparator) {
    return {
      ...token,
      step: token.integerStep,
      activePart: 'integer',
    };
  }

  const decimalOffset = token.raw.indexOf(token.decimalSeparator);
  const decimalIndex = token.startIndex + decimalOffset;
  const activePart = caret <= decimalIndex ? 'integer' : 'fraction';

  return {
    ...token,
    step: activePart === 'fraction' ? token.decimalStep : token.integerStep,
    activePart,
  };
}

function getActiveTokenWithPart(token: ParsedToken, caret: number): ParsedToken {
  return token.mode === 'number' ? getTokenWithActivePart(token, caret) : token;
}

export function getActiveParsedNumber(
  numbers: ParsedNumber[],
  selectionStart: number | null,
  selectionEnd: number | null,
): ParsedNumber | null {
  if (selectionStart === null || selectionEnd === null) {
    return null;
  }

  if (selectionStart === selectionEnd) {
    const caret = selectionStart;
    const token = numbers.find((entry) => caret >= entry.startIndex && caret <= entry.endIndex) ?? null;
    return token ? getTokenWithActivePart(token, caret) : null;
  }

  const overlapping = numbers.filter((token) => selectionOverlapsToken(selectionStart, selectionEnd, token));
  return overlapping.length === 1 ? getTokenWithActivePart(overlapping[0], selectionStart) : null;
}

export function getActiveParsedToken(
  numbers: ParsedToken[],
  selectionStart: number | null,
  selectionEnd: number | null,
): ParsedToken | null {
  if (selectionStart === null || selectionEnd === null) {
    return null;
  }

  if (selectionStart === selectionEnd) {
    const caret = selectionStart;
    const token = numbers.find((entry) => caret >= entry.startIndex && caret <= entry.endIndex) ?? null;
    return token ? getActiveTokenWithPart(token, caret) : null;
  }

  const overlapping = numbers.filter((token) => selectionOverlapsToken(selectionStart, selectionEnd, token));
  return overlapping.length === 1 ? getActiveTokenWithPart(overlapping[0], selectionStart) : null;
}

export function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatNumberToken(token: ParsedNumber, nextValue: number): string {
  const precision = Math.max(token.precision, getPrecision(token.step));
  const rounded = roundToPrecision(nextValue, precision);
  let nextText = precision > 0 ? rounded.toFixed(precision) : String(Math.round(rounded));

  if (token.decimalSeparator === ',') {
    nextText = nextText.replace('.', ',');
  }

  if (token.raw.startsWith('+') && !nextText.startsWith('-') && !nextText.startsWith('+')) {
    nextText = `+${nextText}`;
  }

  return nextText;
}

export function getTokenPartCaret(token: ParsedNumber, part: NumberPart): number {
  if (!token.decimalSeparator || part === 'integer') {
    return token.startIndex;
  }

  const decimalOffset = token.raw.indexOf(token.decimalSeparator);
  return token.startIndex + decimalOffset + 1;
}

export function getTokenStartCaret(token: ParsedToken): number {
  return token.mode === 'number' ? getTokenPartCaret(token, 'integer') : token.startIndex;
}

export function getCssPixelValue(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeReadonlyMode(value: string): InputReadonlyMode {
  switch (value) {
    case 'all':
    case 'text':
    case 'number':
      return value;
    default:
      return 'none';
  }
}

export function sanitizePairLockMode(value: string): InputPairLockMode {
  return value === 'all' ? 'all' : 'step';
}

export function sanitizeSuggestionMode(value: string): InputSuggestionMode {
  return value === 'dropdown' ? 'dropdown' : 'none';
}

export function clampNumber(value: number, minValue?: number, maxValue?: number): number {
  return Math.min(maxValue ?? value, Math.max(minValue ?? value, value));
}

export function getProposedValueFromBeforeInput(control: TextControl, event: InputEvent): string | null {
  const selectionStart = control.selectionStart ?? 0;
  const selectionEnd = control.selectionEnd ?? selectionStart;
  const before = control.value.slice(0, selectionStart);
  const after = control.value.slice(selectionEnd);

  switch (event.inputType) {
    case 'insertText':
    case 'insertCompositionText':
    case 'insertReplacementText':
    case 'insertFromPaste':
    case 'insertFromDrop':
      return `${before}${event.data ?? ''}${after}`;
    case 'insertLineBreak':
    case 'insertParagraph':
      return `${before}\n${after}`;
    case 'deleteContentBackward':
      if (selectionStart !== selectionEnd) {
        return `${before}${after}`;
      }

      return `${control.value.slice(0, Math.max(0, selectionStart - 1))}${after}`;
    case 'deleteContentForward':
      if (selectionStart !== selectionEnd) {
        return `${before}${after}`;
      }

      return `${before}${control.value.slice(Math.min(control.value.length, selectionEnd + 1))}`;
    case 'deleteByCut':
    case 'deleteContent':
    case 'deleteByDrag':
    case 'deleteByComposition':
      return `${before}${after}`;
    default:
      return null;
  }
}

export function getPairTokenIndex(activeIndex: number, totalTokens: number): number {
  if (activeIndex < 0 || activeIndex >= totalTokens) {
    return -1;
  }

  return activeIndex % 2 === 0
    ? activeIndex + 1 < totalTokens
      ? activeIndex + 1
      : -1
    : activeIndex - 1;
}

export function getPairLockedValue(
  activeToken: ParsedNumber,
  nextActiveValue: number,
  pairedToken: ParsedNumber,
): number {
  if (activeToken.value === 0) {
    return pairedToken.value;
  }

  const nextValue = nextActiveValue * (pairedToken.value / activeToken.value);
  return Number.isFinite(nextValue) ? nextValue : pairedToken.value;
}

export function replaceTokenValues(value: string, replacements: TokenReplacement[]): string {
  return [...replacements]
    .sort((left, right) => right.startIndex - left.startIndex)
    .reduce(
      (nextValue, replacement) =>
        nextValue.slice(0, replacement.startIndex) +
        replacement.replacement +
        nextValue.slice(replacement.endIndex),
      value,
    );
}

export function getSelectionWithinToken(
  selectionStart: number | null,
  selectionEnd: number | null,
  token: ParsedTokenBase,
) {
  const startOffset =
    selectionStart === null ? 0 : Math.max(0, Math.min(token.length, selectionStart - token.startIndex));
  const endOffset =
    selectionEnd === null ? startOffset : Math.max(0, Math.min(token.length, selectionEnd - token.startIndex));

  return {
    startOffset,
    endOffset,
  };
}

export function emitBubbledEvent<T>(host: HTMLElement, eventName: string, detail: T) {
  host.dispatchEvent(
    new CustomEvent<T>(eventName, {
      detail,
      bubbles: true,
      composed: true,
    }),
  );
}

export function getFiniteOptionalNumber(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}
