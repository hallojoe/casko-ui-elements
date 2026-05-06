import { LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type BackgroundColorsDirection = 'horizontal' | 'vertical';

const DIRECTION_VALUES: BackgroundColorsDirection[] = ['horizontal', 'vertical'];

function parseColors(colors: string | string[]): string[] {
  const values = Array.isArray(colors) ? colors : colors.split(',');

  return values
    .map((color) => color.trim())
    .filter((color) => color.length > 0);
}

function sanitizeDirection(direction: unknown): BackgroundColorsDirection {
  return DIRECTION_VALUES.includes(direction as BackgroundColorsDirection)
    ? direction as BackgroundColorsDirection
    : 'horizontal';
}

function sanitizeSize(size: unknown): number {
  const value = Number(size);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function isValidCanvasColor(context: CanvasRenderingContext2D, color: string): boolean {
  context.fillStyle = '#000001';
  context.fillStyle = color;

  if (context.fillStyle !== '#000001') {
    return true;
  }

  context.fillStyle = '#000002';
  context.fillStyle = color;

  return context.fillStyle !== '#000002';
}

function getCanvasSize(
  colorCount: number,
  direction: BackgroundColorsDirection,
  size: number
): { width: number; height: number } {
  if (direction === 'vertical') {
    return size > 0
      ? { width: Math.ceil(colorCount / size), height: size }
      : { width: 1, height: colorCount };
  }

  return size > 0
    ? { width: size, height: Math.ceil(colorCount / size) }
    : { width: colorCount, height: 1 };
}

@customElement('background-colors')
export class CaskoUiBackgroundColorsElement extends LitElement {
  @property()
  colors: string | string[] = [];

  @property({ type: String, reflect: true })
  direction: BackgroundColorsDirection = 'horizontal';

  @property({ type: Number, reflect: true })
  size = 0;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('colors') ||
      changedProperties.has('direction') ||
      changedProperties.has('size')
    ) {
      this.#drawBackground();
    }
  }

  render() {
    return nothing;
  }

  #drawBackground(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      this.style.removeProperty('background-image');
      return;
    }

    const colors = parseColors(this.colors)
      .filter((color) => isValidCanvasColor(context, color));

    if (colors.length === 0) {
      this.style.removeProperty('background-image');
      return;
    }

    const direction = sanitizeDirection(this.direction);
    const size = sanitizeSize(this.size);
    const { width, height } = getCanvasSize(colors.length, direction, size);

    canvas.width = width;
    canvas.height = height;

    colors.forEach((color, index) => {
      const x = direction === 'vertical' ? Math.floor(index / height) : index % width;
      const y = direction === 'vertical' ? index % height : Math.floor(index / width);

      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
    });

    this.style.backgroundImage = `url("${canvas.toDataURL('image/png')}")`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'background-colors': CaskoUiBackgroundColorsElement;
  }
}
