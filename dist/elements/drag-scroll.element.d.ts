import { LitElement } from 'lit';
export declare class CaskoUiDragScrollElement extends LitElement {
    /**
     * Prevent dragging when the initial pointer-down happens on a child element.
     * Equivalent to the original `nochilddrag` attribute behavior.
     */
    noChildDrag: boolean;
    /**
     * Whether dragging is currently active.
     */
    private isDragging;
    /**
     * Last known pointer coordinates.
     */
    private lastClientX;
    private lastClientY;
    /**
     * The scrollable container inside the component.
     */
    private containerElement;
    /**
     * Bound event handlers so they can be added/removed safely.
     */
    private readonly onMouseDown;
    private readonly onMouseUp;
    private readonly onMouseMove;
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected firstUpdated(): void;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
declare global {
    interface HTMLElementTagNameMap {
        'drag-scroll': CaskoUiDragScrollElement;
    }
}
//# sourceMappingURL=drag-scroll.element.d.ts.map