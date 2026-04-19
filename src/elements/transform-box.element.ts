import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  getLocalPoint,
  type DragPoint,
} from './drag-box.controller';
import './drag-box.element';
import type { DragBoxChangeDetail } from './drag-box.element';

export type TransformBoxChangeSource = 'move' | 'resize' | 'rotate' | 'keyboard';
export type TransformBoxSelectSource = 'pointer' | 'focus' | 'blur';
type ResizeHandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ITransformBoxGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface IInteractionBase {
  kind: Exclude<TransformBoxChangeSource, 'move' | 'keyboard'>;
  pointerId: number;
  captureElement: HTMLElement;
  startPointer: DragPoint;
  startGeometry: ITransformBoxGeometry;
}

interface IResizeInteraction extends IInteractionBase {
  kind: 'resize';
  handle: ResizeHandleName;
}

interface IRotateInteraction extends IInteractionBase {
  kind: 'rotate';
  startAngle: number;
}

type TransformBoxInteraction = IResizeInteraction | IRotateInteraction;

export interface TransformBoxChangeDetail extends ITransformBoxGeometry {
  source: TransformBoxChangeSource;
}

export interface TransformBoxSelectDetail {
  selected: boolean;
  source: TransformBoxSelectSource;
}

const HANDLE_DIRECTIONS: Record<ResizeHandleName, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

const CORNER_HANDLES: Array<ResizeHandleName> = ['nw', 'ne', 'se', 'sw'];
const SIDE_HANDLES: Array<ResizeHandleName> = ['n', 'e', 's', 'w'];

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function rotatePoint(point: DragPoint, angleDegrees: number): DragPoint {
  const radians = degreesToRadians(angleDegrees);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

function getBoxCenter(geometry: ITransformBoxGeometry): DragPoint {
  return {
    x: geometry.x + geometry.width / 2,
    y: geometry.y + geometry.height / 2,
  };
}

function getRotatedBounds(geometry: ITransformBoxGeometry) {
  const center = getBoxCenter(geometry);
  const halfWidth = geometry.width / 2;
  const halfHeight = geometry.height / 2;
  const corners = [
    rotatePoint({ x: -halfWidth, y: -halfHeight }, geometry.rotation),
    rotatePoint({ x: halfWidth, y: -halfHeight }, geometry.rotation),
    rotatePoint({ x: halfWidth, y: halfHeight }, geometry.rotation),
    rotatePoint({ x: -halfWidth, y: halfHeight }, geometry.rotation),
  ].map((corner) => ({
    x: center.x + corner.x,
    y: center.y + corner.y,
  }));

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

@customElement('transform-box')
export class CaskoUiTransformBoxElement extends LitElement {
  @property({ type: Number })
  x = 0;

  @property({ type: Number })
  y = 0;

  @property({ type: Number })
  width = 160;

  @property({ type: Number })
  height = 120;

  @property({ type: Number })
  rotation = 0;

  @property({ type: Boolean, reflect: true })
  selected = false;

  @property({ type: Boolean, attribute: 'selection-controlled', reflect: true })
  selectionControlled = false;

  @property({ type: Boolean, attribute: 'show-when-unselected' })
  showWhenUnselected = true;

  @property({ type: Boolean, attribute: 'show-controls-when-unselected' })
  showControlsWhenUnselected = true;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, attribute: 'show-side-handles' })
  showSideHandles = false;

  @property({ type: Boolean, reflect: true })
  rotatable = true;

  @property({ type: Boolean, reflect: true })
  movable = true;

  @property({ type: Boolean, reflect: true })
  resizable = true;

  @property({ type: Number, attribute: 'keyboard-step' })
  keyboardStep = 1;

  @property({ type: Number, attribute: 'min-width' })
  minWidth = 24;

  @property({ type: Number, attribute: 'min-height' })
  minHeight = 24;

  @property({ type: Boolean, attribute: 'clamp-to-bounds' })
  clampToBounds = false;

  @property({ type: Boolean, attribute: 'keep-proportions-on-resize' })
  keepProportionsOnResize = false;

  private interaction?: TransformBoxInteraction;
  private pendingKeyboardCommit = false;

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }
  }

  protected render() {
    const geometry = this.#getNormalizedGeometry();
    const handles = this.showSideHandles
      ? [...CORNER_HANDLES, ...SIDE_HANDLES]
      : CORNER_HANDLES;
    const visible = this.selected || this.showWhenUnselected;
    const showControls = this.selected || this.showControlsWhenUnselected;

    return html`
      <div
        class="surface"
        tabindex=${this.disabled ? -1 : 0}
        role="group"
        aria-disabled=${String(this.disabled)}
        aria-label="Transform box"
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @lostpointercapture=${this.#onLostPointerCapture}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
        @focus=${this.#onFocus}
        @blur=${this.#onBlur}>
        <drag-box
          .x=${geometry.x}
          .y=${geometry.y}
          ?disabled=${this.disabled || !this.movable}
          .clampToBounds=${false}
          @pointerdown=${this.#onMovePointerDown}
          @drag-box-change=${this.#onDragChange}
          @drag-box-commit=${this.#onDragCommit}>
          <div
            class="box ${this.selected ? 'selected' : ''} ${this.disabled ? 'disabled' : ''} ${visible ? '' : 'hidden'}"
            data-selection-hit
            style=${this.#getBoxStyle(geometry)}>
            <div class="box-outline ${showControls ? '' : 'hidden'}" aria-hidden="true"></div>
            <div class="content">
              <slot></slot>
            </div>

            ${this.resizable && showControls
              ? handles.map((handle) => this.#renderResizeHandle(handle))
              : null}

            ${this.rotatable && showControls ? this.#renderRotateHandle() : null}
          </div>
        </drag-box>
      </div>
    `;
  }

  #renderResizeHandle(handle: ResizeHandleName) {
    return html`
      <button
        type="button"
        class="handle handle-${handle}"
        data-handle=${handle}
        data-drag-ignore
        aria-label=${`Resize ${handle}`}
        title=${`Resize ${handle}`}
        ?disabled=${this.disabled}
        @pointerdown=${this.#onResizePointerDown}>
      </button>
    `;
  }

  #renderRotateHandle() {
    return html`
      <button
        type="button"
        class="rotate-handle"
        data-drag-ignore
        aria-label="Rotate box"
        title="Rotate box"
        ?disabled=${this.disabled}
        @pointerdown=${this.#onRotatePointerDown}>
      </button>
    `;
  }

  #getNormalizedGeometry(): ITransformBoxGeometry {
    return {
      x: Number.isFinite(this.x) ? this.x : 0,
      y: Number.isFinite(this.y) ? this.y : 0,
      width: Math.max(this.minWidth, Number.isFinite(this.width) ? this.width : this.minWidth),
      height: Math.max(this.minHeight, Number.isFinite(this.height) ? this.height : this.minHeight),
      rotation: Number.isFinite(this.rotation) ? this.rotation : 0,
    };
  }

  #getBoxStyle(geometry: ITransformBoxGeometry): string {
    return [
      `width:${geometry.width}px`,
      `height:${geometry.height}px`,
      `transform:rotate(${geometry.rotation}deg)`,
    ].join(';');
  }

  #getHostSize() {
    const bounds = this.getBoundingClientRect();
    return {
      width: Math.max(0, bounds.width),
      height: Math.max(0, bounds.height),
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

  #setSelected(nextSelected: boolean, source: TransformBoxSelectSource) {
    if (this.selected === nextSelected) return;

    this.selected = nextSelected;
    this.#emitEvent<TransformBoxSelectDetail>('transform-box-select', {
      selected: this.selected,
      source,
    });
  }

  #applyGeometry(nextGeometry: ITransformBoxGeometry, source: TransformBoxChangeSource) {
    const normalizedGeometry = this.#normalizeGeometry(nextGeometry);

    this.x = normalizedGeometry.x;
    this.y = normalizedGeometry.y;
    this.width = normalizedGeometry.width;
    this.height = normalizedGeometry.height;
    this.rotation = normalizedGeometry.rotation;

    this.#emitEvent<TransformBoxChangeDetail>('transform-box-change', {
      ...normalizedGeometry,
      source,
    });
  }

  #commitGeometry(source: TransformBoxChangeSource) {
    const geometry = this.#getNormalizedGeometry();
    this.#emitEvent<TransformBoxChangeDetail>('transform-box-commit', {
      ...geometry,
      source,
    });
  }

  #normalizeGeometry(geometry: ITransformBoxGeometry): ITransformBoxGeometry {
    let width = Math.max(this.minWidth, geometry.width);
    let height = Math.max(this.minHeight, geometry.height);
    let x = geometry.x;
    let y = geometry.y;
    const rotation = Number.isFinite(geometry.rotation) ? geometry.rotation : 0;

    if (!this.clampToBounds) {
      return { x, y, width, height, rotation };
    }

    const hostSize = this.#getHostSize();
    width = Math.min(width, hostSize.width || width);
    height = Math.min(height, hostSize.height || height);

    const bounds = getRotatedBounds({ x, y, width, height, rotation });
    let offsetX = 0;
    let offsetY = 0;

    if (bounds.minX < 0) {
      offsetX = -bounds.minX;
    } else if (bounds.maxX > hostSize.width) {
      offsetX = hostSize.width - bounds.maxX;
    }

    if (bounds.minY < 0) {
      offsetY = -bounds.minY;
    } else if (bounds.maxY > hostSize.height) {
      offsetY = hostSize.height - bounds.maxY;
    }

    x += offsetX;
    y += offsetY;

    return { x, y, width, height, rotation };
  }

  #beginInteraction(
    event: PointerEvent,
    interaction:
      | Omit<IResizeInteraction, 'pointerId' | 'captureElement' | 'startPointer' | 'startGeometry'>
      | Omit<IRotateInteraction, 'pointerId' | 'captureElement' | 'startPointer' | 'startGeometry'>,
  ) {
    if (this.disabled) return;

    if (!this.selectionControlled) {
      this.#setSelected(true, 'pointer');
    }

    this.shadowRoot?.querySelector<HTMLElement>('.surface')?.focus();

    const captureElement = event.currentTarget as HTMLElement;
    const startGeometry = this.#getNormalizedGeometry();
    const startPointer = getLocalPoint(this, event);

    captureElement.setPointerCapture(event.pointerId);

    this.interaction = {
      ...interaction,
      pointerId: event.pointerId,
      captureElement,
      startGeometry,
      startPointer,
    } as TransformBoxInteraction;

    event.preventDefault();
    event.stopPropagation();
  }

  #onMovePointerDown = (event: PointerEvent) => {
    if (!this.movable || this.disabled) return;

    const path = event.composedPath();
    const targetIsControl = path.some(
      (node) =>
        node instanceof HTMLElement &&
        (node.classList.contains('handle') || node.classList.contains('rotate-handle')),
    );

    if (targetIsControl) return;

    if (!this.selectionControlled) {
      this.#setSelected(true, 'pointer');
    }

    this.shadowRoot?.querySelector<HTMLElement>('.surface')?.focus();
  };

  #onDragChange = (event: CustomEvent<DragBoxChangeDetail>) => {
    if (this.disabled || !this.movable) return;

    event.stopPropagation();
    const geometry = this.#getNormalizedGeometry();
    this.#applyGeometry(
      {
        ...geometry,
        x: event.detail.x,
        y: event.detail.y,
      },
      'move',
    );
  };

  #onDragCommit = (event: CustomEvent<DragBoxChangeDetail>) => {
    if (this.disabled || !this.movable) return;

    event.stopPropagation();
    this.#commitGeometry('move');
  };

  #onResizePointerDown = (event: PointerEvent) => {
    if (!this.resizable || this.disabled) return;

    const handle = (event.currentTarget as HTMLElement).dataset.handle as ResizeHandleName | undefined;
    if (!handle) return;

    this.#beginInteraction(event, { kind: 'resize', handle });
  };

  #onRotatePointerDown = (event: PointerEvent) => {
    if (!this.rotatable || this.disabled) return;

    const geometry = this.#getNormalizedGeometry();
    const center = getBoxCenter(geometry);
    const pointer = getLocalPoint(this, event);

    this.#beginInteraction(event, {
      kind: 'rotate',
      startAngle: radiansToDegrees(Math.atan2(pointer.y - center.y, pointer.x - center.x)),
    });
  };

  #onPointerMove = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;

    const pointer = getLocalPoint(this, event);
    const nextGeometry = this.#getGeometryForInteraction(this.interaction, pointer);
    this.#applyGeometry(nextGeometry, this.interaction.kind);
  };

  #onPointerUp = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;

    const interaction = this.interaction;
    interaction.captureElement.releasePointerCapture(event.pointerId);
    this.#finishInteraction(interaction.kind);
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#finishInteraction(this.interaction.kind);
  };

  #finishInteraction(source: Exclude<TransformBoxChangeSource, 'move' | 'keyboard'>) {
    this.interaction = undefined;
    this.#commitGeometry(source);
  }

  #getGeometryForInteraction(
    interaction: TransformBoxInteraction,
    pointer: DragPoint,
  ): ITransformBoxGeometry {
    switch (interaction.kind) {
      case 'resize':
        return this.#getResizeGeometry(interaction, pointer);
      case 'rotate':
        return this.#getRotateGeometry(interaction, pointer);
    }
  }

  #getResizeGeometry(interaction: IResizeInteraction, pointer: DragPoint): ITransformBoxGeometry {
    const direction = HANDLE_DIRECTIONS[interaction.handle];
    const worldDelta = {
      x: pointer.x - interaction.startPointer.x,
      y: pointer.y - interaction.startPointer.y,
    };
    const localDelta = rotatePoint(worldDelta, -interaction.startGeometry.rotation);

    let left = -interaction.startGeometry.width / 2;
    let right = interaction.startGeometry.width / 2;
    let top = -interaction.startGeometry.height / 2;
    let bottom = interaction.startGeometry.height / 2;

    if (this.keepProportionsOnResize) {
      ({ left, right, top, bottom } = this.#getProportionalResizeEdges(
        interaction.startGeometry,
        direction,
        localDelta,
        { left, right, top, bottom },
      ));
    } else {
      if (direction.x === -1) left += localDelta.x;
      if (direction.x === 1) right += localDelta.x;
      if (direction.y === -1) top += localDelta.y;
      if (direction.y === 1) bottom += localDelta.y;

      if (right - left < this.minWidth) {
        if (direction.x === -1) {
          left = right - this.minWidth;
        } else if (direction.x === 1) {
          right = left + this.minWidth;
        }
      }

      if (bottom - top < this.minHeight) {
        if (direction.y === -1) {
          top = bottom - this.minHeight;
        } else if (direction.y === 1) {
          bottom = top + this.minHeight;
        }
      }
    }

    const nextWidth = right - left;
    const nextHeight = bottom - top;
    const centerOffsetLocal = {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
    };
    const centerOffsetWorld = rotatePoint(centerOffsetLocal, interaction.startGeometry.rotation);
    const startCenter = getBoxCenter(interaction.startGeometry);
    const nextCenter = {
      x: startCenter.x + centerOffsetWorld.x,
      y: startCenter.y + centerOffsetWorld.y,
    };

    return {
      x: nextCenter.x - nextWidth / 2,
      y: nextCenter.y - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
      rotation: interaction.startGeometry.rotation,
    };
  }

  #getProportionalResizeEdges(
    startGeometry: ITransformBoxGeometry,
    direction: { x: -1 | 0 | 1; y: -1 | 0 | 1 },
    localDelta: DragPoint,
    edges: { left: number; right: number; top: number; bottom: number },
  ) {
    const aspectRatio = startGeometry.width / startGeometry.height || 1;
    const minWidth = Math.max(this.minWidth, this.minHeight * aspectRatio);
    const minHeight = minWidth / aspectRatio;
    const widthDelta = direction.x !== 0 ? direction.x * localDelta.x : 0;
    const heightDelta = direction.y !== 0 ? direction.y * localDelta.y : 0;
    const widthCandidate = startGeometry.width + widthDelta;
    const heightCandidate = startGeometry.height + heightDelta;

    let nextWidth = startGeometry.width;
    let nextHeight = startGeometry.height;

    if (direction.x !== 0 && direction.y !== 0) {
      const widthChangeRatio = widthDelta / startGeometry.width;
      const heightChangeRatio = heightDelta / startGeometry.height;

      if (Math.abs(widthChangeRatio) >= Math.abs(heightChangeRatio)) {
        nextWidth = Math.max(minWidth, widthCandidate);
        nextHeight = nextWidth / aspectRatio;
      } else {
        nextHeight = Math.max(minHeight, heightCandidate);
        nextWidth = nextHeight * aspectRatio;
      }
    } else if (direction.x !== 0) {
      nextWidth = Math.max(minWidth, widthCandidate);
      nextHeight = nextWidth / aspectRatio;
    } else if (direction.y !== 0) {
      nextHeight = Math.max(minHeight, heightCandidate);
      nextWidth = nextHeight * aspectRatio;
    }

    let { left, right, top, bottom } = edges;

    if (direction.x === -1) {
      left = right - nextWidth;
    } else if (direction.x === 1) {
      right = left + nextWidth;
    } else {
      left = -nextWidth / 2;
      right = nextWidth / 2;
    }

    if (direction.y === -1) {
      top = bottom - nextHeight;
    } else if (direction.y === 1) {
      bottom = top + nextHeight;
    } else {
      top = -nextHeight / 2;
      bottom = nextHeight / 2;
    }

    return { left, right, top, bottom };
  }

  #getRotateGeometry(interaction: IRotateInteraction, pointer: DragPoint): ITransformBoxGeometry {
    const center = getBoxCenter(interaction.startGeometry);
    const pointerAngle = radiansToDegrees(Math.atan2(pointer.y - center.y, pointer.x - center.x));
    const rotationDelta = pointerAngle - interaction.startAngle;

    return {
      ...interaction.startGeometry,
      rotation: interaction.startGeometry.rotation + rotationDelta,
    };
  }

  #onFocus = () => {
    if (this.disabled || this.selectionControlled) return;
    this.#setSelected(true, 'focus');
  };

  #onBlur = () => {
    if (this.interaction || this.selectionControlled) return;
    this.#setSelected(false, 'blur');
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled || !this.selected) return;

    const step = Math.max(1, this.keyboardStep);
    const geometry = this.#getNormalizedGeometry();
    let nextGeometry: ITransformBoxGeometry | undefined;

    switch (event.key) {
      case 'ArrowUp':
        nextGeometry = { ...geometry, y: geometry.y - step };
        break;
      case 'ArrowDown':
        nextGeometry = { ...geometry, y: geometry.y + step };
        break;
      case 'ArrowLeft':
        nextGeometry = { ...geometry, x: geometry.x - step };
        break;
      case 'ArrowRight':
        nextGeometry = { ...geometry, x: geometry.x + step };
        break;
      default:
        return;
    }

    event.preventDefault();
    this.pendingKeyboardCommit = true;
    this.#applyGeometry(nextGeometry, 'keyboard');
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.pendingKeyboardCommit) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

    this.pendingKeyboardCommit = false;
    this.#commitGeometry('keyboard');
  };

  static styles = [
    css`
      :host {
        display: block;
        position: relative;
        min-width: 0;
        min-height: 0;
        outline: none;
        touch-action: none;
        --transform-box-outline-color: rgba(15, 84, 73, 0.75);
        --transform-box-selected-color: #0f5449;
        --transform-box-handle-size: 12px;
        --transform-box-handle-border: 2px;
        --transform-box-rotate-offset: 28px;
        --transform-box-background: rgba(15, 84, 73, 0.06);
        --transform-box-overlay-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9) inset;
      }

      .surface {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: inherit;
        outline: none;
        pointer-events: none;
      }

      drag-box {
        width: 100%;
        height: 100%;
      }

      .box {
        position: relative;
        box-sizing: border-box;
        transform-origin: center center;
      }

      .box.disabled {
        opacity: 0.7;
      }

      .box.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .box-outline {
        position: absolute;
        inset: 0;
        border: 1px solid var(--transform-box-outline-color);
        background: var(--transform-box-background);
        box-shadow: var(--transform-box-overlay-shadow);
        pointer-events: none;
      }

      .box-outline.hidden {
        opacity: 0;
      }

      .box.selected .box-outline,
      :host([selected]) .box-outline {
        border-color: var(--transform-box-selected-color);
        box-shadow:
          var(--transform-box-overlay-shadow),
          0 0 0 1px color-mix(in srgb, var(--transform-box-selected-color) 35%, transparent);
      }

      .content {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .handle,
      .rotate-handle {
        position: absolute;
        width: var(--transform-box-handle-size);
        height: var(--transform-box-handle-size);
        border-radius: 999px;
        border: var(--transform-box-handle-border) solid var(--transform-box-selected-color);
        background: white;
        box-sizing: border-box;
        padding: 0;
        cursor: pointer;
      }

      .handle {
        z-index: 2;
      }

      .handle-nw {
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        cursor: nwse-resize;
      }

      .handle-ne {
        right: 0;
        top: 0;
        transform: translate(50%, -50%);
        cursor: nesw-resize;
      }

      .handle-se {
        right: 0;
        bottom: 0;
        transform: translate(50%, 50%);
        cursor: nwse-resize;
      }

      .handle-sw {
        left: 0;
        bottom: 0;
        transform: translate(-50%, 50%);
        cursor: nesw-resize;
      }

      .handle-n {
        left: 50%;
        top: 0;
        transform: translate(-50%, -50%);
        cursor: ns-resize;
      }

      .handle-e {
        right: 0;
        top: 50%;
        transform: translate(50%, -50%);
        cursor: ew-resize;
      }

      .handle-s {
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 50%);
        cursor: ns-resize;
      }

      .handle-w {
        left: 0;
        top: 50%;
        transform: translate(-50%, -50%);
        cursor: ew-resize;
      }

      .rotate-handle {
        left: 50%;
        top: calc(var(--transform-box-rotate-offset) * -1);
        transform: translateX(-50%);
        cursor: grab;
        z-index: 2;
      }

      .rotate-handle::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 100%;
        width: 1px;
        height: calc(var(--transform-box-rotate-offset) - var(--transform-box-handle-size));
        background: var(--transform-box-selected-color);
        transform: translateX(-50%);
      }

      .rotate-handle:active {
        cursor: grabbing;
      }
    `,
  ];
}

export default CaskoUiTransformBoxElement;

declare global {
  interface HTMLElementTagNameMap {
    'transform-box': CaskoUiTransformBoxElement;
  }
}
