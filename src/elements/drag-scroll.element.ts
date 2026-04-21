import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('drag-scroll')
export class CaskoUiDragScrollElement extends LitElement {
  /**
   * Prevent dragging when the initial pointer-down happens on a child element.
   * Equivalent to the original `nochilddrag` attribute behavior.
   */
  @property({ type: Boolean, attribute: 'nochilddrag', reflect: true })
  public noChildDrag = false;

  /**
   * Whether dragging is currently active.
   */
  private isDragging = false;

  /**
   * The active pointer id while dragging.
   */
  private activePointerId?: number;

  /**
   * Last known pointer coordinates.
   */
  private lastClientX = 0;
  private lastClientY = 0;

  /**
   * The scrollable container inside the component.
   */
  @query('.dragscroll-container')
  private containerElement!: HTMLDivElement;

  private readonly onPointerDown = (event: PointerEvent): void => {
    const container = this.containerElement;

    if (!container) {
      return;
    }

    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    if (
      this.noChildDrag &&
      event.target instanceof Node &&
      event.target !== container
    ) {
      return;
    }

    this.isDragging = true;
    this.activePointerId = event.pointerId;
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    container.setPointerCapture(event.pointerId);

    event.preventDefault();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    const container = this.containerElement;
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }

    this.#stopDragging();
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.#stopDragging();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.#stopDragging();
  };

  #stopDragging(): void {
    this.isDragging = false;
    this.activePointerId = undefined;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || event.pointerId !== this.activePointerId) {
      return;
    }

    const container = this.containerElement;

    if (!container) {
      return;
    }

    const deltaX = event.clientX - this.lastClientX;
    const deltaY = event.clientY - this.lastClientY;

    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;

    container.scrollLeft -= deltaX;
    container.scrollTop -= deltaY;

    event.preventDefault();
  };

  public render() {
    return html`
      <div
        class="dragscroll-container ${this.isDragging ? 'dragging' : ''}"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerCancel}
        @lostpointercapture=${this.onLostPointerCapture}>
        <slot></slot>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
    }

    .dragscroll-container {
      overflow: auto;
      cursor: grab;
      width: 100%;
      height: 100%;
      touch-action: none;
    }

    .dragscroll-container.dragging {
      cursor: grabbing;
      user-select: none;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
 
    'drag-scroll': CaskoUiDragScrollElement;
  }
}
