import {
  buildCircularSectorGuidePath,
  buildCircularSectorPathByMode,
  buildRectangularSectorPathByMode,
  createCircularSectorViewModel,
  type CircularSectorPathMode as CaskoCircularSectorPathMode,
  type ICircularSectorViewModel,
  type IPoint,
  type RectangularSectorPathDirection,
  type RectangularSectorPathLayout,
  type RectangularSectorPathMode,
} from '@casko/circular-sector';

export type CircularSectorAlignment = 'start' | 'mid' | 'end';
export type CircularSectorPathMode = CaskoCircularSectorPathMode;
export type CircularSectorRectangularMode = 'none' | RectangularSectorPathMode;
export type CircularSectorRectangularLayout = RectangularSectorPathLayout;
export type CircularSectorRectangularDirection = RectangularSectorPathDirection;
export type CircularSectorTextPlacementStrategy =
  | 'anchor'
  | 'radial-outward'
  | 'radial-inward'
  | 'path';
export type CircularSectorSectorTextAnchor =
  | 'outer-start'
  | 'outer-mid'
  | 'outer-end'
  | 'middle-start'
  | 'middle-mid'
  | 'middle-end'
  | 'inner-start'
  | 'inner-mid'
  | 'inner-end'
  | 'centroid';
export type CircularSectorCanvasTextAnchor =
  | 'viewbox-top-left'
  | 'viewbox-top-center'
  | 'viewbox-top-right'
  | 'viewbox-center-left'
  | 'viewbox-center'
  | 'viewbox-center-right'
  | 'viewbox-bottom-left'
  | 'viewbox-bottom-center'
  | 'viewbox-bottom-right';
export type CircularSectorTextAnchor =
  | CircularSectorSectorTextAnchor
  | CircularSectorCanvasTextAnchor;

export interface CircularSectorSvgSettings {
  title: string;
  backgroundColor: string;
  width: number;
  height: number;
  viewBoxX: number;
  viewBoxY: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
}

export interface CircularSectorGenerationSettings {
  values: string;
  distributeValues: boolean;
  totalValue: number;
  centerX: number;
  centerY: number;
  radiusValues: string;
  alignment: CircularSectorAlignment;
  thetaDegrees: number;
  gap: number;
  heightValues: string;
  roundedCornerRadius: number;
  bevelSize: number;
  facetCount: number;
  scallopCount: number;
  scallopDepth: number;
  stepCount: number;
  stepInset: number;
  burstCount: number;
  burstDepth: number;
  rectangularMode: CircularSectorRectangularMode;
  rectangularLayout: CircularSectorRectangularLayout;
  rectangularDirection: CircularSectorRectangularDirection;
  rectangularSize: number;
  pathModeValue: number;
  pathMode: CircularSectorPathMode;
}

export interface CircularSectorValueItem {
  value: number;
  label?: string;
  text?: string;
}

export interface CircularSectorLayerDecoration {
  strokeWidth?: number;
  strokePaletteName?: string;
  fillPaletteName?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  textOpacity?: number;
}

export interface CircularSectorLayerOverrides
  extends Partial<CircularSectorGenerationSettings>,
    CircularSectorLayerDecoration {
  valueItems?: Array<CircularSectorValueItem>;
}

export interface CircularSectorLayerTextOverrides {
  anchor?: string;
  placementStrategy?: string;
  radialOffset?: number;
  offsetX?: number;
  offsetY?: number;
  fontSize?: number;
  fontWeight?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'baseline';
}

export interface CircularSectorLayerDefinition {
  id?: string;
  name?: string;
  visible?: boolean;
  collapsed?: boolean;
  settings?: CircularSectorLayerOverrides;
  textSettings?: CircularSectorLayerTextOverrides;
  decoration?: CircularSectorLayerDecoration;
}

export interface CircularSectorColorDefinition {
  fill: string;
  stroke: string;
  text?: string;
}

export interface CircularSectorColorPaletteDefinition {
  id?: string;
  name: string;
  collapsed?: boolean;
  colors: ReadonlyArray<CircularSectorColorDefinition>;
}

export interface CircularSectorSvgConfig {
  svg?: Partial<CircularSectorSvgSettings>;
  globalSettings?: Partial<CircularSectorGenerationSettings>;
  colorPalettes?: ReadonlyArray<CircularSectorColorPaletteDefinition>;
  layers?: ReadonlyArray<CircularSectorLayerDefinition>;
}

export interface CircularSectorPreviewItem {
  index: number;
  inputValue: number;
  label: string;
  text: string;
  appliedRadius: number;
  appliedHeight: number;
  normalizedRatio: number;
  viewModel: ICircularSectorViewModel;
  path: string;
  fill: string;
  stroke: string;
  textFill: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  textOpacity: number;
}

export interface CircularSectorRenderedLayer {
  id: string;
  name: string;
  visible: boolean;
  distributeValues: boolean;
  totalValue: number;
  usedDistributedValues: boolean;
  authoredSettings: CircularSectorLayerOverrides;
  authoredTextSettings: CircularSectorLayerTextOverrides;
  effectiveSettings: CircularSectorGenerationSettings;
  effectiveTextSettings: ResolvedCircularSectorLayerTextSettings;
  effectiveValueItems: Array<CircularSectorValueItem>;
  sectors: Array<CircularSectorPreviewItem>;
}

export interface CircularSectorRenderedSvg {
  svg: CircularSectorSvgSettings;
  globalSettings: CircularSectorGenerationSettings;
  colorPalettes: Array<CircularSectorColorPaletteDefinition>;
  layers: Array<CircularSectorRenderedLayer>;
  textItems: CircularSectorPreviewTextItems;
}

export interface ResolvedCircularSectorLayerTextSettings {
  anchor: CircularSectorSectorTextAnchor;
  placementStrategy: CircularSectorTextPlacementStrategy;
  radialOffset: number;
  offsetX: number;
  offsetY: number;
  fontSize?: number;
  fontWeight?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'baseline';
}

export interface CircularSectorPositionedTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fill: string;
  opacity: number;
  fontSize: number;
  fontWeight: string | number;
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline: 'auto' | 'middle' | 'hanging' | 'baseline';
  layerId?: string;
}

export interface CircularSectorPathTextItem {
  id: string;
  text: string;
  pathId: string;
  guidePath: string;
  fill: string;
  opacity: number;
  fontSize: number;
  fontWeight: string | number;
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline: 'auto' | 'middle' | 'hanging' | 'baseline';
  startOffset: string;
  layerId?: string;
}

export interface CircularSectorPreviewTextItems {
  layerPositionedTextItems: Array<CircularSectorPositionedTextItem>;
  layerPathTextItems: Array<CircularSectorPathTextItem>;
}

export const CIRCULAR_SECTOR_PREVIEW_SIZE = 1024;

export const DEFAULT_CIRCULAR_SECTOR_GLOBAL_SETTINGS: CircularSectorGenerationSettings = {
  values: '1 1 2 3 5 8',
  distributeValues: true,
  totalValue: 100,
  centerX: CIRCULAR_SECTOR_PREVIEW_SIZE / 2,
  centerY: CIRCULAR_SECTOR_PREVIEW_SIZE / 2,
  radiusValues: '256',
  alignment: 'start',
  thetaDegrees: -90,
  gap: 10,
  heightValues: '256',
  roundedCornerRadius: 10,
  bevelSize: 10,
  facetCount: 8,
  scallopCount: 6,
  scallopDepth: 12,
  stepCount: 6,
  stepInset: 12,
  burstCount: 8,
  burstDepth: 18,
  rectangularMode: 'none',
  rectangularLayout: 'many',
  rectangularDirection: 'top-down',
  rectangularSize: 20,
  pathModeValue: 10,
  pathMode: 'arc',
};

export const DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS: CircularSectorSvgSettings = {
  title: 'Circular sector preview',
  backgroundColor: '',
  width: CIRCULAR_SECTOR_PREVIEW_SIZE,
  height: CIRCULAR_SECTOR_PREVIEW_SIZE,
  viewBoxX: 0,
  viewBoxY: 0,
  viewBoxWidth: CIRCULAR_SECTOR_PREVIEW_SIZE,
  viewBoxHeight: CIRCULAR_SECTOR_PREVIEW_SIZE,
};

const DEFAULT_LAYER_TEXT_SETTINGS: ResolvedCircularSectorLayerTextSettings = {
  anchor: 'centroid',
  placementStrategy: 'anchor',
  radialOffset: 0,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_LAYER_DECORATION: Required<CircularSectorLayerDecoration> = {
  strokeWidth: 2,
  strokePaletteName: '',
  fillPaletteName: '',
  fillOpacity: 0.5,
  strokeOpacity: 1,
  textOpacity: 0.5,
};

export function buildCircularSectorRenderedSvg(
  config: CircularSectorSvgConfig = {},
): CircularSectorRenderedSvg {
  const svg = normalizeSvgSettings(config.svg);
  const globalSettings = normalizeGlobalSettings(config.globalSettings);
  const colorPalettes = [...(config.colorPalettes ?? [])].map((palette) => ({
    ...palette,
    colors: [...palette.colors],
  }));
  const layers = normalizeLayers(config.layers);
  const renderedLayers = layers.map((layer, index, allLayers) =>
    buildCircularSectorRenderedLayer(
      layer,
      {
        svg,
        globalSettings,
        colorPalettes,
        layers: allLayers,
        layerIndex: index,
      },
    ),
  );

  return {
    svg,
    globalSettings,
    colorPalettes,
    layers: renderedLayers,
    textItems: buildCircularSectorTextItems(svg, renderedLayers),
  };
}

export function buildCircularSectorRenderedLayer(
  layer: CircularSectorLayerDefinition,
  context: {
    svg?: CircularSectorSvgSettings;
    globalSettings?: CircularSectorGenerationSettings;
    colorPalettes?: ReadonlyArray<CircularSectorColorPaletteDefinition>;
    layers?: ReadonlyArray<CircularSectorLayerDefinition>;
    layerIndex?: number;
  } = {},
): CircularSectorRenderedLayer {
  const svg = context.svg ?? DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS;
  const globalSettings =
    context.globalSettings ?? DEFAULT_CIRCULAR_SECTOR_GLOBAL_SETTINGS;
  const layers = normalizeLayers(context.layers ?? [layer]);
  const layerIndex = Math.max(
    0,
    context.layerIndex ?? layers.findIndex((entry) => entry === layer),
  );
  const normalizedLayer = normalizeLayer(layer, layerIndex);
  const effectiveSettings = resolveLayerSettings(
    normalizedLayer,
    layers,
    globalSettings,
  );
  const effectiveTextSettings = resolveLayerTextSettings(
    normalizedLayer.textSettings,
  );
  const effectiveValueItems = resolveLayerValueItems(
    normalizedLayer,
    effectiveSettings.values,
    layers,
    globalSettings,
  );
  const values = effectiveValueItems.length
    ? effectiveValueItems.map((item) => item.value)
    : parsePositiveNumbers(effectiveSettings.values);
  const radiusValues = parsePositiveNumbers(effectiveSettings.radiusValues);
  const heightValues = parsePositiveNumbers(effectiveSettings.heightValues);

  if (values.length === 0) {
    throw new Error(`Layer "${normalizedLayer.name}" needs at least one positive value.`);
  }

  if (radiusValues.length === 0) {
    throw new Error(`Layer "${normalizedLayer.name}" needs at least one positive radius value.`);
  }

  if (heightValues.length === 0) {
    throw new Error(`Layer "${normalizedLayer.name}" needs at least one positive height value.`);
  }

  const sum = values.reduce((current, value) => current + value, 0);
  const ratioTotal = effectiveSettings.distributeValues
    ? sum
    : Math.max(effectiveSettings.totalValue, sum);
  const firstSectorRatio = values[0] / ratioTotal;
  const alignmentOffset = getAlignmentOffset(
    firstSectorRatio * Math.PI * 2,
    effectiveSettings.alignment,
  );
  const ratios = values.map((value) => value / ratioTotal);
  const decoration = resolveLayerDecoration(normalizedLayer);
  const layerId = normalizedLayer.id ?? `layer-${layerIndex + 1}`;
  const layerName =
    normalizedLayer.name ?? (layerIndex === 0 ? 'Base Layer' : `Layer ${layerIndex + 1}`);
  let offsetRatio = 0;

  const sectors = values.map((value, sectorIndex) => {
    const valueItem = effectiveValueItems[sectorIndex];
    const normalizedRatio = ratios[sectorIndex];
    const appliedRadius = radiusValues[sectorIndex % radiusValues.length];
    const appliedHeight = heightValues[sectorIndex % heightValues.length];
    const alignedTheta =
      degreesToRadians(effectiveSettings.thetaDegrees) +
      alignmentOffset +
      offsetRatio * Math.PI * 2;
    const viewModel = createCircularSectorViewModel({
      center: { x: effectiveSettings.centerX, y: effectiveSettings.centerY },
      radius: appliedRadius,
      ratio: normalizedRatio,
      theta: alignedTheta,
      gap: effectiveSettings.gap,
      height: appliedHeight,
      borderRadius: effectiveSettings.pathModeValue,
    });
    const colors = resolveSectorColors(
      sectorIndex,
      decoration,
      context.colorPalettes ?? [],
    );

    offsetRatio += normalizedRatio;

    return {
      index: sectorIndex,
      inputValue: value,
      label: valueItem?.label?.trim() ?? '',
      text: valueItem?.text?.trim() ?? '',
      appliedRadius,
      appliedHeight,
      normalizedRatio,
      viewModel,
      path: buildSectorPath(viewModel, effectiveSettings, {
        index: sectorIndex,
        count: values.length,
        ratios,
      }),
      fill: colors.fill,
      stroke: colors.stroke,
      textFill: colors.text,
      fillOpacity: decoration.fillOpacity,
      strokeOpacity: decoration.strokeOpacity,
      strokeWidth: decoration.strokeWidth,
      textOpacity: decoration.textOpacity,
    };
  });

  return {
    id: layerId,
    name: layerName,
    visible: normalizedLayer.visible ?? true,
    distributeValues: effectiveSettings.distributeValues,
    totalValue: ratioTotal,
    usedDistributedValues: effectiveSettings.distributeValues,
    authoredSettings: normalizedLayer.settings ?? {},
    authoredTextSettings: normalizedLayer.textSettings ?? {},
    effectiveSettings,
    effectiveTextSettings,
    effectiveValueItems,
    sectors,
  };
}

export function buildCircularSectorTextItems(
  svg: CircularSectorSvgSettings,
  layers: ReadonlyArray<CircularSectorRenderedLayer>,
): CircularSectorPreviewTextItems {
  const positionedTextItems: Array<CircularSectorPositionedTextItem> = [];
  const pathTextItems: Array<CircularSectorPathTextItem> = [];

  for (const layer of layers.filter((item) => item.visible)) {
    for (const [sectorIndex, sector] of layer.sectors.entries()) {
      if (!sector.label) continue;

      const definition = layer.effectiveTextSettings;
      const context = createTextTemplateContext(
        svg,
        layers,
        layer,
        sector,
        sectorIndex,
      );
      const resolvedLabel = formatCircularSectorTextTemplate(
        sector.label,
        context,
      ).trim();
      const resolvedText = formatCircularSectorTextTemplate(
        sector.text,
        context,
      ).trim();

      sector.label = resolvedLabel;
      sector.text = resolvedText;
      if (!resolvedLabel) continue;

      const idBase = `layer-value-text-${toStableId(layer.id)}-${sectorIndex}`;

      if (definition.placementStrategy === 'path') {
        pathTextItems.push(
          resolveSectorPathText(idBase, definition, context, sector),
        );
        continue;
      }

      positionedTextItems.push(
        resolveSectorPositionedText(idBase, definition, context, sector),
      );
    }
  }

  return {
    layerPositionedTextItems: positionedTextItems,
    layerPathTextItems: pathTextItems,
  };
}

export function parseCircularSectorNumbers(value: string): Array<number> {
  return parseNumbers(value);
}

export function formatCircularSectorTextTemplate(
  template: string,
  context: unknown,
): string {
  return template.replace(/\$\{([^}]+)\}/g, (_match, token: string) => {
    const normalizedToken = token.trim();
    const path = normalizedToken.match(/^[^#%]+/)?.[0]?.trim();
    if (!path) return '';
    const prefersPercentOverride =
      normalizedToken.includes('%') &&
      path === 'value' &&
      Number.isFinite(getValueAtPath(context, 'current.normalizedRatio'));

    return formatTemplateValue(
      prefersPercentOverride
        ? getValueAtPath(context, 'current.normalizedRatio')
        : getValueAtPath(context, path),
      normalizedToken,
    );
  });
}

function normalizeSvgSettings(
  settings?: Partial<CircularSectorSvgSettings>,
): CircularSectorSvgSettings {
  const merged = {
    ...DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS,
    ...settings,
  };

  return {
    title: merged.title,
    backgroundColor: merged.backgroundColor,
    width: getPositiveNumber(merged.width, DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.width),
    height: getPositiveNumber(merged.height, DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.height),
    viewBoxX: getFiniteNumber(merged.viewBoxX, DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.viewBoxX),
    viewBoxY: getFiniteNumber(merged.viewBoxY, DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.viewBoxY),
    viewBoxWidth: getPositiveNumber(
      merged.viewBoxWidth,
      DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.viewBoxWidth,
    ),
    viewBoxHeight: getPositiveNumber(
      merged.viewBoxHeight,
      DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS.viewBoxHeight,
    ),
  };
}

function normalizeGlobalSettings(
  settings?: Partial<CircularSectorGenerationSettings>,
): CircularSectorGenerationSettings {
  return resolveGenerationSettings(
    settings ?? {},
    DEFAULT_CIRCULAR_SECTOR_GLOBAL_SETTINGS,
  );
}

function resolveLayerSettings(
  layer: CircularSectorLayerDefinition,
  layers: ReadonlyArray<CircularSectorLayerDefinition>,
  globalSettings: CircularSectorGenerationSettings,
): CircularSectorGenerationSettings {
  const overrides = layer.settings ?? {};
  const baseLayer = layers[0];
  const inheritsBaseValues = Boolean(baseLayer && baseLayer.id !== layer.id);

  const valueBase = {
    ...globalSettings,
    values:
      inheritsBaseValues
        ? getBaseLayerValueString(layers, globalSettings)
        : globalSettings.values,
    distributeValues:
      inheritsBaseValues
        ? baseLayer?.settings?.distributeValues ?? globalSettings.distributeValues
        : globalSettings.distributeValues,
    totalValue:
      inheritsBaseValues
        ? baseLayer?.settings?.totalValue ?? globalSettings.totalValue
        : globalSettings.totalValue,
  };

  return resolveGenerationSettings(overrides, valueBase);
}

function resolveGenerationSettings(
  overrides: Partial<CircularSectorGenerationSettings>,
  fallback: CircularSectorGenerationSettings,
): CircularSectorGenerationSettings {
  const rectangularMode =
    normalizeRectangularMode(overrides.rectangularMode) ??
    normalizeRectangularModeFromLegacy(String(overrides.pathMode ?? '')) ??
    fallback.rectangularMode;

  return {
    values: overrides.values ?? fallback.values,
    distributeValues: overrides.distributeValues ?? fallback.distributeValues,
    totalValue: getFiniteNumber(overrides.totalValue, fallback.totalValue),
    centerX: getFiniteNumber(overrides.centerX, fallback.centerX),
    centerY: getFiniteNumber(overrides.centerY, fallback.centerY),
    radiusValues: overrides.radiusValues ?? fallback.radiusValues,
    alignment: normalizeAlignment(overrides.alignment) ?? fallback.alignment,
    thetaDegrees: getFiniteNumber(overrides.thetaDegrees, fallback.thetaDegrees),
    gap: getFiniteNumber(overrides.gap, fallback.gap),
    heightValues: overrides.heightValues ?? fallback.heightValues,
    roundedCornerRadius: getFiniteNumber(
      overrides.roundedCornerRadius ?? overrides.pathModeValue,
      fallback.roundedCornerRadius,
    ),
    bevelSize: getFiniteNumber(
      overrides.bevelSize ?? overrides.pathModeValue,
      fallback.bevelSize,
    ),
    facetCount: getFiniteNumber(
      overrides.facetCount ?? overrides.pathModeValue,
      fallback.facetCount,
    ),
    scallopCount: getFiniteNumber(
      overrides.scallopCount ?? overrides.pathModeValue,
      fallback.scallopCount,
    ),
    scallopDepth: getFiniteNumber(
      overrides.scallopDepth ?? overrides.pathModeValue,
      fallback.scallopDepth,
    ),
    stepCount: getFiniteNumber(
      overrides.stepCount ?? overrides.pathModeValue,
      fallback.stepCount,
    ),
    stepInset: getFiniteNumber(
      overrides.stepInset ?? overrides.pathModeValue,
      fallback.stepInset,
    ),
    burstCount: getFiniteNumber(
      overrides.burstCount ?? overrides.pathModeValue,
      fallback.burstCount,
    ),
    burstDepth: getFiniteNumber(
      overrides.burstDepth ?? overrides.pathModeValue,
      fallback.burstDepth,
    ),
    rectangularMode,
    rectangularLayout:
      normalizeRectangularLayout(overrides.rectangularLayout) ??
      fallback.rectangularLayout,
    rectangularDirection:
      normalizeRectangularDirection(overrides.rectangularDirection) ??
      getDefaultRectangularDirection(rectangularMode),
    rectangularSize: getFiniteNumber(
      overrides.rectangularSize ?? overrides.pathModeValue,
      fallback.rectangularSize,
    ),
    pathModeValue: getFiniteNumber(
      overrides.pathModeValue,
      fallback.pathModeValue,
    ),
    pathMode:
      normalizePathMode(overrides.pathMode) ??
      (String(overrides.pathMode ?? '').trim().toLowerCase() === 'rounded'
        ? 'arc'
        : undefined) ??
      fallback.pathMode,
  };
}

function resolveLayerTextSettings(
  overrides?: CircularSectorLayerTextOverrides,
): ResolvedCircularSectorLayerTextSettings {
  const placementStrategy = isTextPlacementStrategy(overrides?.placementStrategy)
    ? overrides.placementStrategy
    : DEFAULT_LAYER_TEXT_SETTINGS.placementStrategy;
  const anchorCandidate = isSectorAnchor(overrides?.anchor)
    ? overrides.anchor
    : DEFAULT_LAYER_TEXT_SETTINGS.anchor;
  const anchor =
    placementStrategy === 'path' && !isPathCompatibleAnchor(anchorCandidate)
      ? 'middle-mid'
      : anchorCandidate;

  return {
    anchor,
    placementStrategy,
    radialOffset: overrides?.radialOffset ?? DEFAULT_LAYER_TEXT_SETTINGS.radialOffset,
    offsetX: overrides?.offsetX ?? DEFAULT_LAYER_TEXT_SETTINGS.offsetX,
    offsetY: overrides?.offsetY ?? DEFAULT_LAYER_TEXT_SETTINGS.offsetY,
    fontSize: overrides?.fontSize,
    fontWeight: overrides?.fontWeight,
    textAnchor: overrides?.textAnchor,
    dominantBaseline: overrides?.dominantBaseline,
  };
}

function resolveLayerValueItems(
  layer: CircularSectorLayerDefinition,
  fallbackValues: string,
  layers: ReadonlyArray<CircularSectorLayerDefinition>,
  globalSettings: CircularSectorGenerationSettings,
): Array<CircularSectorValueItem> {
  const overrides = layer.settings ?? {};
  if (overrides.valueItems && overrides.valueItems.length > 0) {
    return mapLayerValueItems(overrides.valueItems);
  }

  const baseLayer = layers[0];
  if (!overrides.values && baseLayer && baseLayer.id !== layer.id) {
    const baseLayerValueItems = getBaseLayerValueItems(layers, globalSettings);
    if (baseLayerValueItems.length > 0) {
      return baseLayerValueItems;
    }
  }

  return parsePositiveNumbers(overrides.values ?? fallbackValues).map((value) => ({
    value,
    label: String(value),
    text: '',
  }));
}

function getBaseLayerValueString(
  layers: ReadonlyArray<CircularSectorLayerDefinition>,
  globalSettings: CircularSectorGenerationSettings,
): string {
  const baseLayer = layers[0];
  return baseLayer?.settings?.values?.trim() || globalSettings.values;
}

function getBaseLayerValueItems(
  layers: ReadonlyArray<CircularSectorLayerDefinition>,
  globalSettings: CircularSectorGenerationSettings,
): Array<CircularSectorValueItem> {
  const baseLayer = layers[0];
  if (!baseLayer) return [];

  if (baseLayer.settings?.valueItems?.length) {
    return mapLayerValueItems(baseLayer.settings.valueItems);
  }

  if (baseLayer.settings?.values?.trim()) {
    return parsePositiveNumbers(baseLayer.settings.values).map((value) => ({
      value,
      label: String(value),
      text: '',
    }));
  }

  return parsePositiveNumbers(globalSettings.values).map((value) => ({
    value,
    label: String(value),
    text: '',
  }));
}

function buildSectorPath(
  viewModel: ICircularSectorViewModel,
  settings: CircularSectorGenerationSettings,
  rectangularStack: { index: number; count: number; ratios: Array<number> },
): string {
  if (settings.rectangularMode === 'vertical') {
    return buildRectangularSectorPathByMode(viewModel, {
      mode: 'vertical',
      layout: settings.rectangularLayout,
      direction: settings.rectangularDirection,
      cornerRadius: Math.max(0, settings.roundedCornerRadius),
      size: Math.max(0, settings.rectangularSize),
      stackIndex: rectangularStack.index,
      stackCount: rectangularStack.count,
      segmentIndex: rectangularStack.index,
      segmentRatios: rectangularStack.ratios,
    });
  }

  if (settings.rectangularMode === 'horizontal') {
    return buildRectangularSectorPathByMode(viewModel, {
      mode: 'horizontal',
      layout: settings.rectangularLayout,
      direction: settings.rectangularDirection,
      cornerRadius: Math.max(0, settings.roundedCornerRadius),
      size: Math.max(0, settings.rectangularSize),
      stackIndex: rectangularStack.index,
      stackCount: rectangularStack.count,
      segmentIndex: rectangularStack.index,
      segmentRatios: rectangularStack.ratios,
    });
  }

  return buildCircularSectorPathByMode(viewModel, {
    mode: settings.pathMode,
    cornerRadius: Math.max(0, settings.roundedCornerRadius),
    bevelSize: Math.max(0, settings.bevelSize),
    facetCount: Math.max(2, Math.floor(settings.facetCount || 2)),
    scallopCount: Math.max(1, Math.floor(settings.scallopCount || 1)),
    scallopDepth: Math.max(0, settings.scallopDepth),
    stepCount: Math.max(1, Math.floor(settings.stepCount || 1)),
    stepInset: Math.max(0, settings.stepInset),
    burstCount: Math.max(1, Math.floor(settings.burstCount || 1)),
    burstDepth: Math.max(0, settings.burstDepth),
  });
}

function normalizeLayers(
  layers?: ReadonlyArray<CircularSectorLayerDefinition>,
): Array<CircularSectorLayerDefinition> {
  if (!layers?.length) return [normalizeLayer({}, 0)];
  return layers.map((layer, index) => normalizeLayer(layer, index));
}

function normalizeLayer(
  layer: CircularSectorLayerDefinition,
  index: number,
): CircularSectorLayerDefinition {
  return {
    ...layer,
    id: layer.id?.trim() || `layer-${index + 1}`,
    name: layer.name?.trim() || (index === 0 ? 'Base Layer' : `Layer ${index + 1}`),
    visible: layer.visible ?? true,
    settings: { ...(layer.settings ?? {}) },
    textSettings: layer.textSettings ? { ...layer.textSettings } : undefined,
    decoration: layer.decoration ? { ...layer.decoration } : undefined,
  };
}

function resolveLayerDecoration(
  layer: CircularSectorLayerDefinition,
): Required<CircularSectorLayerDecoration> {
  const settings = layer.settings ?? {};
  const decoration = layer.decoration ?? {};

  return {
    strokeWidth: getFiniteNumber(
      decoration.strokeWidth ?? settings.strokeWidth,
      DEFAULT_LAYER_DECORATION.strokeWidth,
    ),
    strokePaletteName:
      decoration.strokePaletteName ??
      settings.strokePaletteName ??
      DEFAULT_LAYER_DECORATION.strokePaletteName,
    fillPaletteName:
      decoration.fillPaletteName ??
      settings.fillPaletteName ??
      DEFAULT_LAYER_DECORATION.fillPaletteName,
    fillOpacity: getFiniteNumber(
      decoration.fillOpacity ?? settings.fillOpacity,
      DEFAULT_LAYER_DECORATION.fillOpacity,
    ),
    strokeOpacity: getFiniteNumber(
      decoration.strokeOpacity ?? settings.strokeOpacity,
      DEFAULT_LAYER_DECORATION.strokeOpacity,
    ),
    textOpacity: getFiniteNumber(
      decoration.textOpacity ?? settings.textOpacity,
      DEFAULT_LAYER_DECORATION.textOpacity,
    ),
  };
}

function resolveSectorColors(
  sectorIndex: number,
  decoration: Required<CircularSectorLayerDecoration>,
  palettes: ReadonlyArray<CircularSectorColorPaletteDefinition>,
): { fill: string; stroke: string; text: string } {
  const fillPalette = findPalette(decoration.fillPaletteName, palettes);
  const strokePalette = findPalette(decoration.strokePaletteName, palettes);
  const fillColor = fillPalette?.colors[sectorIndex % fillPalette.colors.length];
  const strokeColor = strokePalette?.colors[sectorIndex % strokePalette.colors.length];

  return {
    fill: fillColor?.fill || 'currentColor',
    stroke: strokeColor?.stroke || 'currentColor',
    text: fillColor?.text || strokeColor?.text || 'currentColor',
  };
}

function findPalette(
  name: string | undefined,
  palettes: ReadonlyArray<CircularSectorColorPaletteDefinition>,
): CircularSectorColorPaletteDefinition | undefined {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) return undefined;

  const palette = palettes.find(
    (entry) => entry.name.trim().toLowerCase() === normalizedName,
  );

  return palette && palette.colors.length > 0 ? palette : undefined;
}

function resolveSectorPositionedText(
  id: string,
  definition: ResolvedCircularSectorLayerTextSettings,
  context: ReturnType<typeof createTextTemplateContext>,
  sector: CircularSectorPreviewItem,
): CircularSectorPositionedTextItem {
  const anchorPoint = getSectorAnchorPoint(definition.anchor, sector.viewModel);
  const placedPoint = applyPlacementStrategy(
    anchorPoint,
    definition.placementStrategy,
    definition.radialOffset,
    sector.viewModel,
  );

  return {
    id,
    text: sector.label,
    x: placedPoint.x + definition.offsetX,
    y: placedPoint.y + definition.offsetY,
    fill: sector.textFill,
    opacity: sector.textOpacity,
    fontSize: definition.fontSize ?? 16,
    fontWeight: definition.fontWeight ?? '600',
    textAnchor: definition.textAnchor ?? 'middle',
    dominantBaseline: definition.dominantBaseline ?? 'middle',
    layerId: context.layer.id,
  };
}

function resolveSectorPathText(
  id: string,
  definition: ResolvedCircularSectorLayerTextSettings,
  context: ReturnType<typeof createTextTemplateContext>,
  sector: CircularSectorPreviewItem,
): CircularSectorPathTextItem {
  const anchor = definition.anchor;

  return {
    id,
    text: sector.label,
    pathId: `${id}-guide`,
    guidePath: buildCircularSectorGuidePath(sector.viewModel, {
      ring: getGuideRing(anchor),
    }),
    fill: sector.textFill,
    opacity: sector.textOpacity,
    fontSize: definition.fontSize ?? 16,
    fontWeight: definition.fontWeight ?? '600',
    textAnchor: definition.textAnchor ?? 'middle',
    dominantBaseline: definition.dominantBaseline ?? 'middle',
    startOffset: getPathStartOffset(anchor),
    layerId: context.layer.id,
  };
}

function createTextTemplateContext(
  svg: CircularSectorSvgSettings,
  layers: ReadonlyArray<CircularSectorRenderedLayer>,
  layer: CircularSectorRenderedLayer,
  sector: CircularSectorPreviewItem,
  sectorIndex: number,
) {
  return {
    svg,
    layers,
    layer,
    current: sector,
    effectiveSettings: layer.effectiveSettings as unknown as Record<string, unknown>,
    value: sector.inputValue,
    valueIndex: sectorIndex,
    valueCount: layer.sectors.length,
    percent: sector.normalizedRatio * 100,
    sector: sector.viewModel,
    label: sector.label,
    text: sector.text,
  };
}

function getSectorAnchorPoint(
  anchor: CircularSectorSectorTextAnchor,
  sector: ICircularSectorViewModel,
): IPoint {
  if (anchor === 'centroid') return sector.anchors.centroid;

  const [ring, position] = anchor.split('-') as [
    'outer' | 'middle' | 'inner',
    'start' | 'mid' | 'end',
  ];
  return sector.anchors[ring][position];
}

function getGuideRing(
  anchor: CircularSectorSectorTextAnchor,
): 'outer' | 'middle' | 'inner' {
  if (anchor === 'centroid') return 'middle';
  return anchor.split('-')[0] as 'outer' | 'middle' | 'inner';
}

function getPathStartOffset(anchor: CircularSectorSectorTextAnchor): string {
  if (anchor === 'centroid') return '50%';

  const position = anchor.split('-')[1] as 'start' | 'mid' | 'end';
  if (position === 'start') return '0%';
  if (position === 'end') return '100%';
  return '50%';
}

function applyPlacementStrategy(
  point: IPoint,
  strategy: CircularSectorTextPlacementStrategy,
  radialOffset: number,
  sector: ICircularSectorViewModel,
): IPoint {
  if (strategy === 'anchor' || strategy === 'path' || radialOffset === 0) {
    return point;
  }

  const vectorX = point.x - sector.center.x;
  const vectorY = point.y - sector.center.y;
  const length = Math.hypot(vectorX, vectorY) || 1;
  const direction = strategy === 'radial-inward' ? -1 : 1;

  return {
    x: point.x + (vectorX / length) * radialOffset * direction,
    y: point.y + (vectorY / length) * radialOffset * direction,
  };
}

function getValueAtPath(context: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((currentValue, segment) => {
    if (currentValue === null || currentValue === undefined) return undefined;
    if (typeof currentValue !== 'object') return undefined;
    return (currentValue as Record<string, unknown>)[segment];
  }, context);
}

function formatTemplateValue(value: unknown, token: string): string {
  if (value === null || value === undefined) return '';

  const modifiers = token.replace(/^[^#%]+/, '');
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  const decimalMatch = modifiers.match(/#(\d+)/);
  const decimals = decimalMatch ? Number(decimalMatch[1]) : undefined;
  const percent = modifiers.includes('%');

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  const formattedNumber = percent ? numberValue * 100 : numberValue;
  const resolvedDecimals = decimals ?? (percent ? 0 : undefined);
  const output =
    resolvedDecimals !== undefined
      ? formattedNumber.toFixed(resolvedDecimals)
      : String(formattedNumber);

  return percent ? `${output}%` : output;
}

function parseNumbers(value: string): Array<number> {
  return String(value ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function parsePositiveNumbers(value: string): Array<number> {
  return parseNumbers(value).filter((part) => part > 0);
}

function mapLayerValueItems(
  items: ReadonlyArray<CircularSectorValueItem>,
): Array<CircularSectorValueItem> {
  return items
    .map((item) => ({
      value: item.value,
      label: item.label?.trim() || String(item.value),
      text: item.text?.trim() || '',
    }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
}

function getAlignmentOffset(totalAngle: number, alignment: CircularSectorAlignment): number {
  if (alignment === 'mid') return -totalAngle / 2;
  if (alignment === 'end') return -totalAngle;
  return 0;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getPositiveNumber(value: unknown, fallback: number): number {
  const finiteValue = getFiniteNumber(value, fallback);
  return finiteValue > 0 ? finiteValue : fallback;
}

function normalizeAlignment(value: unknown): CircularSectorAlignment | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'start') return 'start';
  if (normalized === 'mid' || normalized === 'middle' || normalized === 'center') {
    return 'mid';
  }
  if (normalized === 'end') return 'end';
  return undefined;
}

function normalizePathMode(value: unknown): CircularSectorPathMode | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (
    normalized === 'arc' ||
    normalized === 'angular' ||
    normalized === 'beveled' ||
    normalized === 'faceted' ||
    normalized === 'scalloped' ||
    normalized === 'stepped' ||
    normalized === 'burst'
  ) {
    return normalized;
  }

  return undefined;
}

function normalizeRectangularMode(
  value: unknown,
): CircularSectorRectangularMode | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'none' || normalized === 'vertical' || normalized === 'horizontal') {
    return normalized;
  }

  return undefined;
}

function normalizeRectangularModeFromLegacy(
  value: string,
): CircularSectorRectangularMode | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'rectangular-vertical') return 'vertical';
  if (normalized === 'rectangular-horizontal') return 'horizontal';
  return undefined;
}

function normalizeRectangularLayout(
  value: unknown,
): CircularSectorRectangularLayout | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'many' || normalized === 'single') return normalized;
  return undefined;
}

function normalizeRectangularDirection(
  value: unknown,
): CircularSectorRectangularDirection | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (
    normalized === 'top-down' ||
    normalized === 'bottom-up' ||
    normalized === 'left-right' ||
    normalized === 'right-left'
  ) {
    return normalized;
  }

  return undefined;
}

function getDefaultRectangularDirection(
  mode: CircularSectorRectangularMode,
): CircularSectorRectangularDirection {
  return mode === 'vertical' ? 'left-right' : 'top-down';
}

function isSectorAnchor(
  value: unknown,
): value is CircularSectorSectorTextAnchor {
  return (
    value === 'outer-start' ||
    value === 'outer-mid' ||
    value === 'outer-end' ||
    value === 'middle-start' ||
    value === 'middle-mid' ||
    value === 'middle-end' ||
    value === 'inner-start' ||
    value === 'inner-mid' ||
    value === 'inner-end' ||
    value === 'centroid'
  );
}

function isTextPlacementStrategy(
  value: unknown,
): value is CircularSectorTextPlacementStrategy {
  return (
    value === 'anchor' ||
    value === 'radial-outward' ||
    value === 'radial-inward' ||
    value === 'path'
  );
}

function isPathCompatibleAnchor(anchor: CircularSectorSectorTextAnchor): boolean {
  return anchor !== 'centroid';
}

function toStableId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'layer';
}
