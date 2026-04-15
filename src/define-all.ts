import { CaskoUiDragScrollElement } from './elements/drag-scroll.element';
import { CaskoUiTransformBoxElement } from './elements/transform-box.element';

/**
 * Explicit registration hook for bundlers that tree-shake bare side-effect imports.
 */
export function defineCaskoUiElements(): void {
  void CaskoUiDragScrollElement;
  void CaskoUiTransformBoxElement;
}
