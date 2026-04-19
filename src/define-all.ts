import { CaskoUiDragBoxElement } from './elements/drag-box.element';
import { CaskoUiDragScrollElement } from './elements/drag-scroll.element';
import { CaskoUiNumberAwareInputElement } from './elements/number-aware-input.element';
import { CaskoUiSelectionBoxElement } from './elements/selection-box.element';
import { CaskoUiTransformBoxElement } from './elements/transform-box.element';

/**
 * Explicit registration hook for bundlers that tree-shake bare side-effect imports.
 */
export function defineCaskoUiElements(): void {
  void CaskoUiDragBoxElement;
  void CaskoUiDragScrollElement;
  void CaskoUiNumberAwareInputElement;
  void CaskoUiSelectionBoxElement;
  void CaskoUiTransformBoxElement;
}
