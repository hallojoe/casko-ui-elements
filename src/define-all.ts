import { CaskoUiAngleInputElement } from './elements/angle-input.element';
import { CaskoUiAnchorPointInputElement } from './elements/anchor-point-input.element';
import { CaskoUiBackgroundColorsElement } from './elements/background-colors.element';
import { CaskoUiDragBoxElement } from './elements/drag-box/drag-box.element';
import { CaskoUiDragScrollElement } from './elements/drag-scroll.element';
import { CaskoUiNumberAwareInputElement } from './elements/number-aware-input.element';
import { CaskoUiRangeItemElement, CaskoUiRangeThingElement } from './elements/range-thing.element';
import { CaskoUiSelectionBoxElement } from './elements/selection-box.element';
import { CaskoUiTokenAwareInputElement } from './elements/token-aware-input.element';
import { CaskoUiTransformBoxElement } from './elements/transform-box.element';

/**
 * Explicit registration hook for bundlers that tree-shake bare side-effect imports.
 */
export function defineCaskoUiElements(): void {
  void CaskoUiAngleInputElement;
  void CaskoUiAnchorPointInputElement;
  void CaskoUiBackgroundColorsElement;
  void CaskoUiDragBoxElement;
  void CaskoUiDragScrollElement;
  void CaskoUiNumberAwareInputElement;
  void CaskoUiRangeItemElement;
  void CaskoUiRangeThingElement;
  void CaskoUiSelectionBoxElement;
  void CaskoUiTokenAwareInputElement;
  void CaskoUiTransformBoxElement;
}
