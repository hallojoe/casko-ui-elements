import { LitElement } from 'lit';
export type TransformBoxChangeSource = "move" | "resize" | "rotate" | "keyboard";
export type TransformBoxSelectSource = "pointer" | "focus" | "blur";
interface ITransformBoxGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}
export interface TransformBoxChangeDetail extends ITransformBoxGeometry {
    source: TransformBoxChangeSource;
}
export interface TransformBoxSelectDetail {
    selected: boolean;
    source: TransformBoxSelectSource;
}
export declare class CaskoUiTransformBoxElement extends LitElement {
    #private;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    selected: boolean;
    showWhenUnselected: boolean;
    disabled: boolean;
    showSideHandles: boolean;
    rotatable: boolean;
    movable: boolean;
    resizable: boolean;
    keyboardStep: number;
    minWidth: number;
    minHeight: number;
    clampToBounds: boolean;
    keepProportionsOnResize: boolean;
    connectedCallback(): void;
    protected render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
export default CaskoUiTransformBoxElement;
declare global {
    interface HTMLElementTagNameMap {
        "transform-box": CaskoUiTransformBoxElement;
    }
}
//# sourceMappingURL=transform-box.element.d.ts.map