export interface DragPoint {
  x: number;
  y: number;
}

export interface DragPosition {
  x: number;
  y: number;
}

export interface DragInteraction {
  pointerId: number;
  captureElement: HTMLElement;
  startPointer: DragPoint;
  startPosition: DragPosition;
}

export interface DragSize {
  width: number;
  height: number;
}

export interface DragBounds {
  width: number;
  height: number;
}

export function getLocalPoint(element: HTMLElement, event: PointerEvent): DragPoint {
  const bounds = element.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

export function getDraggedPosition(
  interaction: Pick<DragInteraction, 'startPointer' | 'startPosition'>,
  pointer: DragPoint,
): DragPosition {
  return {
    x: interaction.startPosition.x + (pointer.x - interaction.startPointer.x),
    y: interaction.startPosition.y + (pointer.y - interaction.startPointer.y),
  };
}

export function clampDraggedPosition(
  position: DragPosition,
  size: DragSize,
  bounds: DragBounds,
): DragPosition {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, bounds.width - size.width)),
    y: Math.min(Math.max(0, position.y), Math.max(0, bounds.height - size.height)),
  };
}
