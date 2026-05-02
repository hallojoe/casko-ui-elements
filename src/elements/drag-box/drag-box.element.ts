import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import {
  clampDraggedPosition,
  getDraggedPosition,
  getLocalPoint,
  snapDraggedPosition,
  type DragInteraction,
} from './drag-box.controller';

export type DragBoxChangeSource = 'move';

export interface DragBoxChangeDetail {
  x: number;
  y: number;
  source: DragBoxChangeSource;
}

@customElement('drag-box')
export class CaskoUiDragBoxElement extends LitElement {
  @property({ type: Number })
  x = 0;

  @property({ type: Number })
  y = 0;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  selected = false;

  @property({ type: Boolean, attribute: 'clamp-to-bounds', reflect: true })
  clampToBounds = true;

  @property({ type: Boolean, attribute: 'move-requires-selection', reflect: true })
  moveRequiresSelection = false;

  @property({ type: Number, attribute: 'snap-step', reflect: true })
  snapStep = 0;

  @query('.box')
  private boxElement?: HTMLDivElement;

  private interaction?: DragInteraction;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = -1;
    }
  }

  render() {
    return html`
      <div
        class="box ${this.disabled ? 'disabled' : ''}"
        data-selection-hit
        data-selection-bounds
        style=${this.#getBoxStyle()}
        tabindex=${this.disabled ? -1 : 0}
        role="group"
        aria-disabled=${String(this.disabled)}
        aria-selected=${String(this.selected)}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @lostpointercapture=${this.#onLostPointerCapture}>
        <slot></slot>
      </div>
    `;
  }

  #getBoxStyle(): string {
    return [`left:${this.x}px`, `top:${this.y}px`].join(';');
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

  #applyPosition(nextPosition: { x: number; y: number }) {
    const normalizedPosition = this.#normalizePosition(nextPosition);
    this.x = normalizedPosition.x;
    this.y = normalizedPosition.y;
    this.#emitEvent<DragBoxChangeDetail>('drag-box-change', {
      ...normalizedPosition,
      source: 'move',
    });
  }

  #commitPosition() {
    this.#emitEvent<DragBoxChangeDetail>('drag-box-commit', {
      x: this.x,
      y: this.y,
      source: 'move',
    });
  }

  #normalizePosition(position: { x: number; y: number }) {
    const snappedPosition = snapDraggedPosition(
      {
        x: Number.isFinite(position.x) ? position.x : 0,
        y: Number.isFinite(position.y) ? position.y : 0,
      },
      this.snapStep,
    );

    if (!this.clampToBounds) {
      return snappedPosition;
    }

    const bounds = this.getBoundingClientRect();
    const box = this.boxElement?.getBoundingClientRect();

    return clampDraggedPosition(
      snappedPosition,
      {
        width: box?.width ?? 0,
        height: box?.height ?? 0,
      },
      {
        width: bounds.width,
        height: bounds.height,
      },
    );
  }

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;
    if (this.moveRequiresSelection && !this.selected) return;

    const path = event.composedPath();
    const targetIsIgnored = path.some(
      (node) => node instanceof HTMLElement && node.hasAttribute('data-drag-ignore'),
    );

    if (targetIsIgnored) return;

    const captureElement = event.currentTarget as HTMLElement;
    captureElement.focus();
    captureElement.setPointerCapture(event.pointerId);

    this.interaction = {
      pointerId: event.pointerId,
      captureElement,
      startPointer: getLocalPoint(this, event),
      startPosition: { x: this.x, y: this.y },
    };

    event.preventDefault();
  };

  getSelectionBoundsElement(): Element | null {
    return this.boxElement ?? null;
  }

  #onPointerMove = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;

    const nextPosition = getDraggedPosition(this.interaction, getLocalPoint(this, event));
    this.#applyPosition(nextPosition);
  };

  #onPointerUp = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;

    this.interaction.captureElement.releasePointerCapture(event.pointerId);
    this.#finishInteraction();
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#finishInteraction();
  };

  #finishInteraction() {
    this.interaction = undefined;
    this.#commitPosition();
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      min-width: 0;
      min-height: 0;
      pointer-events: none;
      touch-action: none;
    }

    .box {
      position: absolute;
      box-sizing: border-box;
      pointer-events: auto;
      outline: none;
      touch-action: none;
      cursor: grab;
    }

    .box:active {
      cursor: grabbing;
    }

    .box.disabled {
      cursor: default;
    }
  `;
}

export default CaskoUiDragBoxElement;

declare global {
  interface HTMLElementTagNameMap {
    'drag-box': CaskoUiDragBoxElement;
  }
}
