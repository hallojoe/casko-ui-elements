import { CaskoUiAngleInputElement } from './elements/angle-input.element';
import { CaskoUiAnchorPointInputElement } from './elements/anchor-point-input.element';
import { CaskoUiCircularDecorationInputElement } from './elements/circular-decoration-input.element';
import { CaskoUiCircularInputElement } from './elements/circular-input.element';
import { CaskoUiCircularSectorLayerSvgElement } from './elements/circular-sector-svg/circular-sector-layer-svg.element';
import { CaskoUiCircularSectorSvgElement } from './elements/circular-sector-svg/circular-sector-svg.element';
import { CaskoUiCircularTextInputElement } from './elements/circular-text-input.element';
import { CaskoUiDragBoxElement } from './elements/drag-box/drag-box.element';
import { CaskoUiDragScrollElement } from './elements/drag-scroll.element';
import { CaskoUiFillInputElement } from './elements/fill-input.element';
import { CaskoUiNumberAwareInputElement } from './elements/number-aware-input.element';
import { CaskoUiSelectionBoxElement } from './elements/selection-box.element';
import { CaskoUiStrokeInputElement } from './elements/stroke-input.element';
import { CaskoUiTextInputElement } from './elements/text-input.element';
import { CaskoUiTokenAwareInputElement } from './elements/token-aware-input.element';
import { CaskoUiTransformBoxElement } from './elements/transform-box.element';

/**
 * Explicit registration hook for bundlers that tree-shake bare side-effect imports.
 */
export function defineCaskoUiElements(): void {
  void CaskoUiAngleInputElement;
  void CaskoUiAnchorPointInputElement;
  void CaskoUiCircularDecorationInputElement;
  void CaskoUiCircularInputElement;
  void CaskoUiCircularSectorLayerSvgElement;
  void CaskoUiCircularSectorSvgElement;
  void CaskoUiCircularTextInputElement;
  void CaskoUiDragBoxElement;
  void CaskoUiDragScrollElement;
  void CaskoUiFillInputElement;
  void CaskoUiNumberAwareInputElement;
  void CaskoUiSelectionBoxElement;
  void CaskoUiStrokeInputElement;
  void CaskoUiTextInputElement;
  void CaskoUiTokenAwareInputElement;
  void CaskoUiTransformBoxElement;
}
