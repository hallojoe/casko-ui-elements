import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  buildCircularSectorRenderedSvg,
  type CircularSectorPathTextItem,
  type CircularSectorPositionedTextItem,
  type CircularSectorRenderedLayer,
  type CircularSectorRenderedSvg,
  type CircularSectorSvgConfig,
} from './circular-sector-svg.model';

export type CircularSectorSvgErrorMode = 'render-message' | 'silent';

@customElement('circular-sector-svg')
export class CaskoUiCircularSectorSvgElement extends LitElement {
  @property({ attribute: false })
  public config: CircularSectorSvgConfig = {};

  @property({ type: Boolean, attribute: 'show-guide-circle' })
  public showGuideCircle = false;

  @property({ attribute: 'error-mode' })
  public errorMode: CircularSectorSvgErrorMode = 'render-message';

  render() {
    const result = this.#buildResult();

    if (!result.data) {
      return this.errorMode === 'silent'
        ? nothing
        : html`<div class="error" role="alert">${result.error}</div>`;
    }

    return renderCircularSectorSvg(result.data, this.showGuideCircle);
  }

  #buildResult(): { data?: CircularSectorRenderedSvg; error?: string } {
    try {
      return { data: buildCircularSectorRenderedSvg(this.config) };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to generate circular sector SVG.',
      };
    }
  }

  static styles = css`
    :host {
      display: block;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .guide-circle {
      fill: none;
      stroke: currentColor;
      stroke-dasharray: 6 8;
      stroke-opacity: 0.24;
      stroke-width: 1;
      pointer-events: none;
    }

    .sector-text {
      pointer-events: none;
      paint-order: stroke fill;
    }

    .error {
      box-sizing: border-box;
      min-height: 2.5rem;
      padding: 0.75rem 0.9rem;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font: 14px/1.35 system-ui, sans-serif;
    }
  `;
}

export function renderCircularSectorSvg(
  data: CircularSectorRenderedSvg,
  showGuideCircle = false,
) {
  const visibleLayers = data.layers.filter((layer) => layer.visible);

  return svg`
    <svg
      width=${String(data.svg.width)}
      height=${String(data.svg.height)}
      viewBox=${`${data.svg.viewBoxX} ${data.svg.viewBoxY} ${data.svg.viewBoxWidth} ${data.svg.viewBoxHeight}`}
      role="img"
      aria-label=${data.svg.title || 'Circular sector preview'}>
      <title>${data.svg.title}</title>
      ${data.svg.backgroundColor
        ? svg`
            <rect
              x=${String(data.svg.viewBoxX)}
              y=${String(data.svg.viewBoxY)}
              width=${String(data.svg.viewBoxWidth)}
              height=${String(data.svg.viewBoxHeight)}
              fill=${data.svg.backgroundColor}>
            </rect>
          `
        : nothing}
      ${showGuideCircle
        ? svg`
            <circle
              cx=${String(data.globalSettings.centerX)}
              cy=${String(data.globalSettings.centerY)}
              r=${String(getGuideRadius(data.globalSettings.radiusValues))}
              class="guide-circle">
            </circle>
          `
        : nothing}
      ${data.textItems.layerPathTextItems.length
        ? svg`
            <defs>
              ${data.textItems.layerPathTextItems.map(renderGuidePath)}
            </defs>
          `
        : nothing}
      ${visibleLayers.map((layer) => renderCircularSectorLayer(layer, data))}
    </svg>
  `;
}

export function renderCircularSectorLayer(
  layer: CircularSectorRenderedLayer,
  data: CircularSectorRenderedSvg,
) {
  const positionedTextItems = data.textItems.layerPositionedTextItems.filter(
    (item) => item.layerId === layer.id,
  );
  const pathTextItems = data.textItems.layerPathTextItems.filter(
    (item) => item.layerId === layer.id,
  );

  return svg`
    <g data-layer-id=${layer.id} data-layer-name=${layer.name}>
      ${layer.sectors.map(
        (sector) => svg`
          <path
            d=${sector.path}
            fill=${sector.fill}
            fill-opacity=${String(sector.fillOpacity)}
            stroke=${sector.stroke}
            stroke-opacity=${String(sector.strokeOpacity)}
            stroke-width=${String(sector.strokeWidth)}
            stroke-linecap="round"
            stroke-linejoin="round">
          </path>
        `,
      )}
      ${positionedTextItems.map(renderPositionedText)}
      ${pathTextItems.map(renderPathText)}
    </g>
  `;
}

function renderGuidePath(item: CircularSectorPathTextItem) {
  return svg`<path id=${item.pathId} d=${item.guidePath}></path>`;
}

function renderPositionedText(item: CircularSectorPositionedTextItem) {
  return svg`
    <text
      id=${item.id}
      x=${String(item.x)}
      y=${String(item.y)}
      fill=${item.fill}
      fill-opacity=${String(item.opacity)}
      font-size=${String(item.fontSize)}
      font-weight=${String(item.fontWeight)}
      text-anchor=${item.textAnchor}
      dominant-baseline=${item.dominantBaseline}
      class="sector-text">
      ${item.text}
    </text>
  `;
}

function renderPathText(item: CircularSectorPathTextItem) {
  return svg`
    <text
      id=${item.id}
      fill=${item.fill}
      fill-opacity=${String(item.opacity)}
      font-size=${String(item.fontSize)}
      font-weight=${String(item.fontWeight)}
      text-anchor=${item.textAnchor}
      dominant-baseline=${item.dominantBaseline}
      class="sector-text">
      <textPath
        href=${`#${item.pathId}`}
        startOffset=${item.startOffset}>
        ${item.text}
      </textPath>
    </text>
  `;
}

function getGuideRadius(valueSet: string): number {
  const value = String(valueSet)
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .find((part) => Number.isFinite(part) && part > 0);

  return value ?? 0;
}

export default CaskoUiCircularSectorSvgElement;

declare global {
  interface HTMLElementTagNameMap {
    'circular-sector-svg': CaskoUiCircularSectorSvgElement;
  }
}
