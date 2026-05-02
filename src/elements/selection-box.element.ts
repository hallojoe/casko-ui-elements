import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, queryAssignedElements } from 'lit/decorators.js';

export type SelectionBoxMode = 'single' | 'multiple';
export type SelectionBoxLegacyMode = SelectionBoxMode | 'multi';
export type SelectionBoxMultiSelectKey = 'none' | 'shift' | 'ctrl';
export type SelectionBoxChangeSource = 'click' | 'drag' | 'keyboard';
export type SelectionBoxOrderDirection = 'front' | 'back';
export type SelectionBoxOrderSource = 'method' | 'double-click';

export interface SelectionBoxItemDetail {
  element: Element;
  value: string | null;
  selected: boolean;
}

export interface SelectionBoxChangeDetail {
  items: SelectionBoxItemDetail[];
  selectedItems: SelectionBoxItemDetail[];
  changedItems: SelectionBoxItemDetail[];
  mode: SelectionBoxMode;
  source: SelectionBoxChangeSource;
}

export interface SelectionBoxOrderChangeDetail {
  items: SelectionBoxItemDetail[];
  selectedItems: SelectionBoxItemDetail[];
  movedItems: SelectionBoxItemDetail[];
  direction: SelectionBoxOrderDirection;
  source: SelectionBoxOrderSource;
}

interface SelectionBoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionBoundsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface SelectionBoundsProvider {
  getSelectionBoundsElement?(): Element | null | undefined;
  getSelectionBoundsRect?(): SelectionBoundsRect | DOMRect | null | undefined;
}

interface SelectionBoxInteraction {
  pointerId: number;
  target?: Element;
  startedOnEmptySpace: boolean;
  startClientX: number;
  startClientY: number;
  startLocalX: number;
  startLocalY: number;
  captureElement?: HTMLElement;
  dragRect?: SelectionBoxRect;
}

interface SelectionBoxPointerSelectionSnapshot {
  target: Element;
  selectedElements: Element[];
  targetWasSelected: boolean;
  timestamp: number;
}

const POINTER_MOVE_TOLERANCE = 4;
const DOUBLE_CLICK_SNAPSHOT_TIMEOUT = 500;

@customElement('selection-box')
export class CaskoUiSelectionBoxElement extends LitElement {
  @property({ type: String, attribute: 'selection-mode', reflect: true })
  selectionMode: SelectionBoxLegacyMode = 'single';

  @property({ type: String, attribute: 'multi-select-key', reflect: true })
  multiSelectKey: SelectionBoxMultiSelectKey = 'none';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, attribute: 'drag-select', reflect: true })
  dragSelect = false;

  @property({ type: Boolean, attribute: 'deselect-on-outside-click', reflect: true })
  deselectOnOutsideClick = false;

  @property({ type: Boolean, attribute: 'double-click-bring-to-front', reflect: true })
  doubleClickBringToFront = false;

  @property({ type: String, attribute: 'value-attr' })
  valueAttr = 'value';

  @queryAssignedElements({ flatten: true })
  private assignedElements!: Element[];

  private interaction?: SelectionBoxInteraction;
  private previewElements = new Set<Element>();
  private focusedElement?: Element;
  private pointerSelectionSnapshot?: SelectionBoxPointerSelectionSnapshot;

  connectedCallback(): void {
    super.connectedCallback();
    this.updateComplete.then(() => {
      this.#reconcileSelection();
      this.#syncManagedChildAccessibility();
    });
  }

  get selectedValues(): string[] {
    return this.#getSelectableElements()
      .filter((element) => element.hasAttribute('selected'))
      .map((element) => element.getAttribute(this.valueAttr))
      .filter((value): value is string => value !== null);
  }

  bringSelectedToFront(): void {
    this.#orderSelectedElements('front', 'method');
  }

  sendSelectedToBack(): void {
    this.#orderSelectedElements('back', 'method');
  }

  protected render() {
    return html`
      <div
        class="surface"
        role="listbox"
        aria-multiselectable=${String(this.#getSelectionMode() === 'multiple')}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @focusin=${this.#onFocusIn}
        @focusout=${this.#onFocusOut}
        @keydown=${this.#onKeyDown}
        @dblclick=${this.#onDoubleClick}>
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
      ${this.#renderDragOverlay()}
    `;
  }

  #renderDragOverlay() {
    if (!this.interaction?.dragRect) {
      return nothing;
    }

    const rect = this.interaction.dragRect;
    return html`
      <div
        class="drag-overlay"
        style=${`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`}>
      </div>
    `;
  }

  #onSlotChange = () => {
    this.#reconcileSelection();
    this.#syncManagedChildAccessibility();
  };

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;

    const target = this.#getSelectableTargetFromComposedPath(event.composedPath());
    const localPoint = this.#getLocalPoint(event);
    const captureElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.#capturePointerSelectionSnapshot(target);

    if (!target && (this.dragSelect || this.deselectOnOutsideClick) && captureElement) {
      captureElement.setPointerCapture(event.pointerId);
    }

    this.interaction = {
      pointerId: event.pointerId,
      target,
      startedOnEmptySpace: !target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLocalX: localPoint.x,
      startLocalY: localPoint.y,
      captureElement,
    };
  };

  #onPointerMove = (event: PointerEvent) => {
    const interaction = this.interaction;
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    if (!this.dragSelect || !interaction.startedOnEmptySpace) return;
    if (!this.#didPointerMoveBeyondTolerance(event, interaction)) return;

    const localPoint = this.#getLocalPoint(event);
    interaction.dragRect = this.#createRectFromPoints(
      interaction.startLocalX,
      interaction.startLocalY,
      localPoint.x,
      localPoint.y,
    );
    this.#setPreviewElements(this.#getElementsOverlappingRect(interaction.dragRect));

    this.requestUpdate();
  };

  #onPointerUp = (event: PointerEvent) => {
    const interaction = this.interaction;
    this.interaction = undefined;
    this.#releaseInteractionCapture(interaction, event.pointerId);
    this.requestUpdate();

    if (!interaction || event.pointerId !== interaction.pointerId || this.disabled) return;

    if (interaction.dragRect) {
      this.#commitDragSelection(interaction.dragRect);
      this.#clearPreviewElements();
      return;
    }

    const item = interaction.target;
    if (this.#didPointerMoveBeyondTolerance(event, interaction)) return;
    if (!item) {
      this.#clearPreviewElements();
      if (this.deselectOnOutsideClick) {
        this.#clearSelection('click');
      }
      return;
    }

    if (item.hasAttribute('ignore')) {
      this.#clearPreviewElements();
      return;
    }

    this.#commitClickSelection(item, event);
    this.#clearPreviewElements();
  };

  #onPointerCancel = (event: PointerEvent) => {
    if (!this.interaction || event.pointerId !== this.interaction.pointerId) return;
    this.#releaseInteractionCapture(this.interaction, event.pointerId);
    this.interaction = undefined;
    this.#clearPreviewElements();
    this.requestUpdate();
  };

  #commitClickSelection(target: Element, event: PointerEvent) {
    const previousSelected = this.#getSelectedElements();
    this.#applyClickSelection(target, event);
    this.#focusSelectionTarget(target);
    this.#emitSelectionEvents(previousSelected, 'click');
  }

  #applyClickSelection(target: Element, event: PointerEvent) {
    const mode = this.#getSelectionMode();
    const selectable = this.#getSelectableElements();
    const selected = this.#getSelectedElements();
    const targetIsSelected = target.hasAttribute('selected');

    if (mode === 'single') {
      if (targetIsSelected) {
        target.removeAttribute('selected');
        return;
      }

      selectable.forEach((element) => {
        element.toggleAttribute('selected', element === target);
      });
      return;
    }

    const multiSelectKey = this.#getMultiSelectKey();
    const allowToggleOnly =
      multiSelectKey === 'none' || this.#isConfiguredModifierPressed(event, multiSelectKey);

    if (allowToggleOnly) {
      target.toggleAttribute('selected', !targetIsSelected);
      return;
    }

    const targetIsOnlySelected = targetIsSelected && selected.length === 1;
    if (targetIsOnlySelected) {
      target.removeAttribute('selected');
      return;
    }

    selectable.forEach((element) => {
      element.toggleAttribute('selected', element === target);
    });
  }

  #commitDragSelection(rect: SelectionBoxRect) {
    const matches = this.#getElementsOverlappingRect(rect);
    if (matches.length === 0) {
      return;
    }

    const previousSelected = this.#getSelectedElements();
    matches.forEach((element) => element.setAttribute('selected', ''));
    this.#emitSelectionEvents(previousSelected, 'drag');
  }

  #clearSelection(source: SelectionBoxChangeSource) {
    const previousSelected = this.#getSelectedElements();
    if (previousSelected.length === 0) {
      return;
    }

    previousSelected.forEach((element) => element.removeAttribute('selected'));
    this.#emitSelectionEvents(previousSelected, source);
  }

  #emitSelectionEvents(previousSelected: Element[], source: SelectionBoxChangeSource) {
    const detail = this.#createChangeDetail(previousSelected, source);
    if (detail.changedItems.length === 0) return;

    this.#syncManagedChildAccessibility();
    this.#emitEvent('selection-box-change', detail);
    this.#emitEvent('selection-box-commit', detail);
  }

  #orderSelectedElements(direction: SelectionBoxOrderDirection, source: SelectionBoxOrderSource) {
    this.#orderElements(this.#getSelectedElements(), direction, source);
  }

  #orderElements(
    movedElements: Element[],
    direction: SelectionBoxOrderDirection,
    source: SelectionBoxOrderSource,
  ) {
    const movableElements = movedElements.filter((element) => this.#getSelectableElements().includes(element));
    if (movableElements.length === 0) {
      return;
    }

    const previousDirectChildren = this.#getDirectChildren();

    if (direction === 'front') {
      this.append(...movableElements);
    } else {
      this.prepend(...movableElements);
    }

    const nextDirectChildren = this.#getDirectChildren();
    if (this.#hasSameElementOrder(previousDirectChildren, nextDirectChildren)) {
      return;
    }

    this.#syncManagedChildAccessibility();
    const detail = this.#createOrderChangeDetail(movableElements, direction, source);
    this.#emitEvent('selection-box-order-change', detail);
    this.#emitEvent('selection-box-order-commit', detail);
  }

  #createOrderChangeDetail(
    movedElements: Element[],
    direction: SelectionBoxOrderDirection,
    source: SelectionBoxOrderSource,
  ): SelectionBoxOrderChangeDetail {
    const movedSet = new Set(movedElements);
    const items = this.#getSelectableElements().map((element) => this.#toItemDetail(element));

    return {
      items,
      selectedItems: items.filter((item) => item.selected),
      movedItems: items.filter((item) => movedSet.has(item.element)),
      direction,
      source,
    };
  }

  #hasSameElementOrder(previousElements: Element[], nextElements: Element[]): boolean {
    return (
      previousElements.length === nextElements.length &&
      previousElements.every((element, index) => nextElements[index] === element)
    );
  }

  #createRectFromPoints(startX: number, startY: number, endX: number, endY: number): SelectionBoxRect {
    return {
      left: Math.min(startX, endX),
      top: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    };
  }

  #getElementsOverlappingRect(rect: SelectionBoxRect): Element[] {
    const hostBounds = this.getBoundingClientRect();
    const dragBounds = {
      left: hostBounds.left + rect.left,
      top: hostBounds.top + rect.top,
      right: hostBounds.left + rect.left + rect.width,
      bottom: hostBounds.top + rect.top + rect.height,
    };

    return this.#getSelectableElements().filter((element) => {
      const bounds = this.#getSelectionBoundsRect(element);
      return !(
        bounds.right < dragBounds.left ||
        bounds.left > dragBounds.right ||
        bounds.bottom < dragBounds.top ||
        bounds.top > dragBounds.bottom
      );
    });
  }

  #setPreviewElements(elements: Element[]) {
    const nextSet = new Set(elements);

    this.previewElements.forEach((element) => {
      if (!nextSet.has(element)) {
        element.removeAttribute('data-selection-preview');
      }
    });

    nextSet.forEach((element) => {
      element.setAttribute('data-selection-preview', '');
    });

    this.previewElements = nextSet;
  }

  #clearPreviewElements() {
    this.previewElements.forEach((element) => {
      element.removeAttribute('data-selection-preview');
    });

    this.previewElements.clear();
  }

  #clearFocusedElement() {
    if (!this.focusedElement) {
      return;
    }

    this.focusedElement.removeAttribute('data-selection-focus');
    this.focusedElement = undefined;
  }

  #capturePointerSelectionSnapshot(target: Element | undefined) {
    if (!target || !this.doubleClickBringToFront) {
      this.pointerSelectionSnapshot = undefined;
      return;
    }

    const now = Date.now();
    if (
      this.pointerSelectionSnapshot?.target === target &&
      now - this.pointerSelectionSnapshot.timestamp <= DOUBLE_CLICK_SNAPSHOT_TIMEOUT
    ) {
      return;
    }

    this.pointerSelectionSnapshot = {
      target,
      selectedElements: this.#getSelectedElements(),
      targetWasSelected: target.hasAttribute('selected'),
      timestamp: now,
    };
  }

  #getSelectableTargetFromComposedPath(path: EventTarget[]): Element | undefined {
    const directChildren = this.#getDirectChildren();

    return path.find((node): node is Element => {
      if (!(node instanceof Element) || !directChildren.includes(node)) {
        return false;
      }

      return this.#pathRepresentsSelectableHit(path, node);
    });
  }

  #getSelectionBoundsRect(element: Element): SelectionBoundsRect {
    const provider = element as Element & SelectionBoundsProvider;

    if (typeof provider.getSelectionBoundsRect === 'function') {
      const rect = provider.getSelectionBoundsRect();
      if (this.#isValidSelectionBoundsRect(rect)) {
        return rect;
      }
    }

    if (typeof provider.getSelectionBoundsElement === 'function') {
      const boundsElement = provider.getSelectionBoundsElement();
      if (boundsElement instanceof Element) {
        return boundsElement.getBoundingClientRect();
      }
    }

    const shadowBoundsElement = this.#getElementShadowRoot(element)?.querySelector<HTMLElement>(
      '[data-selection-bounds]',
    );
    if (shadowBoundsElement) {
      return shadowBoundsElement.getBoundingClientRect();
    }

    return element.getBoundingClientRect();
  }

  #isValidSelectionBoundsRect(
    rect: SelectionBoundsRect | DOMRect | null | undefined,
  ): rect is SelectionBoundsRect | DOMRect {
    if (!rect) {
      return false;
    }

    return ['left', 'top', 'right', 'bottom'].every((key) => {
      const value = rect[key as keyof SelectionBoundsRect];
      return typeof value === 'number' && Number.isFinite(value);
    });
  }

  #pathRepresentsSelectableHit(path: EventTarget[], element: Element): boolean {
    const shadowRoot = this.#getElementShadowRoot(element);

    if (!shadowRoot) {
      return true;
    }

    return path.some(
      (node) =>
        node instanceof Element &&
        node.hasAttribute('data-selection-hit') &&
        shadowRoot.contains(node),
    );
  }

  #didPointerMoveBeyondTolerance(event: PointerEvent, interaction: SelectionBoxInteraction): boolean {
    const deltaX = event.clientX - interaction.startClientX;
    const deltaY = event.clientY - interaction.startClientY;
    return Math.hypot(deltaX, deltaY) > POINTER_MOVE_TOLERANCE;
  }

  #isConfiguredModifierPressed(event: PointerEvent, key: SelectionBoxMultiSelectKey): boolean {
    switch (key) {
      case 'shift':
        return event.shiftKey;
      case 'ctrl':
        return event.ctrlKey || event.metaKey;
      case 'none':
      default:
        return false;
    }
  }

  #getLocalPoint(event: PointerEvent) {
    const bounds = this.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  #getDirectChildren(): Element[] {
    const lightDomChildren = Array.from(this.children);
    return lightDomChildren.length > 0 ? lightDomChildren : (this.assignedElements ?? []);
  }

  #getSelectableElements(): Element[] {
    return this.#getDirectChildren().filter((element) => !element.hasAttribute('ignore'));
  }

  #getSelectedElements(): Element[] {
    return this.#getSelectableElements().filter((element) => element.hasAttribute('selected'));
  }

  #getSelectionMode(): SelectionBoxMode {
    return this.selectionMode === 'multiple' || this.selectionMode === 'multi'
      ? 'multiple'
      : 'single';
  }

  #getMultiSelectKey(): SelectionBoxMultiSelectKey {
    if (this.multiSelectKey === 'shift' || this.multiSelectKey === 'ctrl') {
      return this.multiSelectKey;
    }

    return 'none';
  }

  #reconcileSelection() {
    const selectable = this.#getSelectableElements();
    const selected = selectable.filter((element) => element.hasAttribute('selected'));

    if (this.#getSelectionMode() === 'single' && selected.length > 1) {
      selected.forEach((element, index) => {
        element.toggleAttribute('selected', index === 0);
      });
    }

    this.#syncManagedChildAccessibility();
  }

  #createChangeDetail(
    previousSelected: Element[],
    source: SelectionBoxChangeSource,
  ): SelectionBoxChangeDetail {
    const selectable = this.#getSelectableElements();
    const previousSelectedSet = new Set(previousSelected);
    const items = selectable.map((element) => this.#toItemDetail(element));
    const selectedItems = items.filter((item) => item.selected);
    const changedItems = items.filter((item) => {
      const wasSelected = previousSelectedSet.has(item.element);
      return wasSelected !== item.selected;
    });

    return {
      items,
      selectedItems,
      changedItems,
      mode: this.#getSelectionMode(),
      source,
    };
  }

  #toItemDetail(element: Element): SelectionBoxItemDetail {
    return {
      element,
      value: element.getAttribute(this.valueAttr),
      selected: element.hasAttribute('selected'),
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

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;
    if (event.key !== ' ' && event.key !== 'Spacebar') return;

    const target = this.#getSelectableTargetFromComposedPath(event.composedPath());
    if (!target || target.hasAttribute('ignore')) return;

    event.preventDefault();
    const previousSelected = this.#getSelectedElements();
    this.#applyClickSelection(target, {
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    } as PointerEvent);
    this.#emitSelectionEvents(previousSelected, 'keyboard');
  };

  #onDoubleClick = (event: MouseEvent) => {
    if (this.disabled || !this.doubleClickBringToFront) return;

    const target = this.#getSelectableTargetFromComposedPath(event.composedPath());
    const snapshot = this.pointerSelectionSnapshot;
    if (!target || !snapshot?.targetWasSelected || snapshot.target !== target) return;

    this.#orderElements(snapshot.selectedElements, 'front', 'double-click');
  };

  #onFocusIn = (event: FocusEvent) => {
    const target = this.#getSelectableTargetFromComposedPath(event.composedPath());

    if (!target || target.hasAttribute('ignore')) {
      this.#clearFocusedElement();
      return;
    }

    if (this.focusedElement && this.focusedElement !== target) {
      this.focusedElement.removeAttribute('data-selection-focus');
    }

    this.focusedElement = target;
    target.setAttribute('data-selection-focus', '');
  };

  #onFocusOut = (event: FocusEvent) => {
    const previousTarget = this.#getSelectableTargetFromComposedPath(event.composedPath());
    if (!previousTarget) {
      return;
    }

    if (
      event.relatedTarget instanceof Node &&
      (previousTarget.contains(event.relatedTarget) ||
        this.#getElementShadowRoot(previousTarget)?.contains(event.relatedTarget))
    ) {
      return;
    }

    if (this.focusedElement === previousTarget) {
      previousTarget.removeAttribute('data-selection-focus');
      this.focusedElement = undefined;
    }
  };

  #releaseInteractionCapture(interaction: SelectionBoxInteraction | undefined, pointerId: number) {
    if (!interaction?.captureElement?.hasPointerCapture(pointerId)) {
      return;
    }

    interaction.captureElement.releasePointerCapture(pointerId);
  }

  #syncManagedChildAccessibility() {
    const selectable = new Set(this.#getSelectableElements());

    this.#getDirectChildren().forEach((element) => {
      const isSelectable = selectable.has(element);

      if (isSelectable) {
        if (!element.hasAttribute('role')) {
          element.setAttribute('role', 'option');
          element.setAttribute('data-selection-box-managed-role', '');
        }

        if (!element.hasAttribute('tabindex') && !this.#isNaturallyFocusable(element)) {
          element.setAttribute('tabindex', '0');
          element.setAttribute('data-selection-box-managed-tabindex', '');
        }

        element.setAttribute('aria-selected', String(element.hasAttribute('selected')));
        return;
      }

      element.removeAttribute('aria-selected');
      element.removeAttribute('data-selection-focus');

      if (element.hasAttribute('data-selection-box-managed-role')) {
        element.removeAttribute('role');
        element.removeAttribute('data-selection-box-managed-role');
      }

      if (element.hasAttribute('data-selection-box-managed-tabindex')) {
        element.removeAttribute('tabindex');
        element.removeAttribute('data-selection-box-managed-tabindex');
      }
    });
  }

  #isNaturallyFocusable(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();

    if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
      return !element.hasAttribute('disabled');
    }

    if (tagName === 'a') {
      return element.hasAttribute('href');
    }

    return element.hasAttribute('contenteditable');
  }

  #focusSelectionTarget(element: Element) {
    if (!this.#canFocusElement(element)) {
      return;
    }

    element.focus({ preventScroll: true });
  }

  #canFocusElement(element: Element): element is HTMLElement | SVGElement {
    return element instanceof HTMLElement || element instanceof SVGElement;
  }

  #getElementShadowRoot(element: Element): ShadowRoot | null {
    return element instanceof HTMLElement ? element.shadowRoot : null;
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      min-width: 0;
      min-height: 0;
      --selection-box-selected-outline: none;
      --selection-box-selected-outline-offset: 0px;
      --selection-box-selected-background: rgba(15, 84, 73, 0.08);
      --selection-box-selected-shadow:
        inset 0 0 0 2px rgba(15, 84, 73, 0.92),
        0 0 0 1px rgba(15, 84, 73, 0.16);
      --selection-box-preview-outline: none;
      --selection-box-preview-outline-offset: 0px;
      --selection-box-preview-background: rgba(59, 130, 246, 0.08);
      --selection-box-preview-shadow:
        inset 0 0 0 2px rgba(59, 130, 246, 0.9),
        0 0 0 1px rgba(59, 130, 246, 0.18);
      --selection-box-focus-outline: none;
      --selection-box-focus-outline-offset: 0px;
      --selection-box-focus-background: transparent;
      --selection-box-focus-shadow:
        inset 0 0 0 2px rgba(37, 99, 235, 0.96),
        0 0 0 4px rgba(37, 99, 235, 0.2);
      --selection-box-selected-focus-shadow:
        inset 0 0 0 2px rgba(15, 84, 73, 0.92),
        0 0 0 1px rgba(15, 84, 73, 0.16),
        0 0 0 4px rgba(37, 99, 235, 0.2);
      --selection-box-transition: outline-color 140ms ease, background-color 140ms ease;
      --selection-box-drag-outline: 1px solid rgba(15, 84, 73, 0.7);
      --selection-box-drag-background: rgba(15, 84, 73, 0.12);
      --selection-box-drag-z-index: 10;
      --selection-box-item-user-select: none;
    }

    .surface {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: inherit;
    }

    ::slotted(*) {
      transition: var(--selection-box-transition);
      -webkit-user-select: var(--selection-box-item-user-select);
      user-select: var(--selection-box-item-user-select);
    }

    ::slotted([selected]) {
      outline: var(--selection-box-selected-outline) !important;
      outline-offset: var(--selection-box-selected-outline-offset) !important;
      background: var(--selection-box-selected-background) !important;
      box-shadow: var(--selection-box-selected-shadow) !important;
    }

    ::slotted([data-selection-preview]:not([selected])) {
      outline: var(--selection-box-preview-outline) !important;
      outline-offset: var(--selection-box-preview-outline-offset) !important;
      background: var(--selection-box-preview-background) !important;
      box-shadow: var(--selection-box-preview-shadow) !important;
    }

    ::slotted([data-selection-focus]) {
      outline: var(--selection-box-focus-outline) !important;
      outline-offset: var(--selection-box-focus-outline-offset) !important;
      background: var(--selection-box-focus-background) !important;
      box-shadow: var(--selection-box-focus-shadow) !important;
    }

    ::slotted([selected][data-selection-focus]) {
      box-shadow: var(--selection-box-selected-focus-shadow) !important;
    }

    .drag-overlay {
      position: absolute;
      border: var(--selection-box-drag-outline);
      background: var(--selection-box-drag-background);
      pointer-events: none;
      z-index: var(--selection-box-drag-z-index);
    }
  `;
}

export default CaskoUiSelectionBoxElement;

declare global {
  interface HTMLElementTagNameMap {
    'selection-box': CaskoUiSelectionBoxElement;
  }
}
