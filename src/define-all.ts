import { CaskoUiAngleInputElement } from './elements/angle-input.element';
import { CaskoUiAnchorPointInputElement } from './elements/anchor-point-input.element';
import { CaskoUiCircularInputElement } from './elements/circular-input.element';
import { CaskoUiCircularSectorLayerSvgElement } from './elements/circular-sector-svg/circular-sector-layer-svg.element';
import { CaskoUiCircularSectorSvgElement } from './elements/circular-sector-svg/circular-sector-svg.element';
import { CaskoUiDragBoxElement } from './elements/drag-box/drag-box.element';
import { CaskoUiDragScrollElement } from './elements/drag-scroll.element';
import { CaskoUiNumberAwareInputElement } from './elements/number-aware-input.element';
import { CaskoUiSelectionBoxElement } from './elements/selection-box.element';
import { CaskoUiTokenAwareInputElement } from './elements/token-aware-input.element';
import { CaskoUiTransformBoxElement } from './elements/transform-box.element';

/**
 * Explicit registration hook for bundlers that tree-shake bare side-effect imports.
 */
export function defineCaskoUiElements(): void {
  void CaskoUiAngleInputElement;
  void CaskoUiAnchorPointInputElement;
  void CaskoUiCircularInputElement;
  void CaskoUiCircularSectorLayerSvgElement;
  void CaskoUiCircularSectorSvgElement;
  void CaskoUiDragBoxElement;
  void CaskoUiDragScrollElement;
  void CaskoUiNumberAwareInputElement;
  void CaskoUiSelectionBoxElement;
  void CaskoUiTokenAwareInputElement;
  void CaskoUiTransformBoxElement;
}
