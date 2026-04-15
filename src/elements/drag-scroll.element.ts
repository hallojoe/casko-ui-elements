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
   * Last known pointer coordinates.
   */
  private lastClientX = 0;
  private lastClientY = 0;

  /**
   * The scrollable container inside the component.
   */
  @query('.dragscroll-container')
  private containerElement!: HTMLDivElement;

  /**
   * Bound event handlers so they can be added/removed safely.
   */
  private readonly onMouseDown = (event: MouseEvent): void => {
    const container = this.containerElement;

    if (!container) {
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
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;

    event.preventDefault();
  };

  private readonly onMouseUp = (): void => {
    this.isDragging = false;
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging) {
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
  };

  public connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);

    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.containerElement.addEventListener('mousedown', this.onMouseDown);
  }

  public render() {
    return html`
      <div class="dragscroll-container">
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
    }

    .dragscroll-container:active {
      cursor: grabbing;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
 
    'drag-scroll': CaskoUiDragScrollElement;
  }
}
