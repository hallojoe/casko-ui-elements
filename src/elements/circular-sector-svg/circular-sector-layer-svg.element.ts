import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  buildCircularSectorRenderedLayer,
  buildCircularSectorTextItems,
  DEFAULT_CIRCULAR_SECTOR_GLOBAL_SETTINGS,
  DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS,
  type CircularSectorColorPaletteDefinition,
  type CircularSectorGenerationSettings,
  type CircularSectorLayerDefinition,
  type CircularSectorRenderedSvg,
  type CircularSectorSvgSettings,
} from './circular-sector-svg.model';
import {
  renderCircularSectorSvg,
  type CircularSectorSvgErrorMode,
} from './circular-sector-svg.element';

@customElement('circular-sector-layer-svg')
export class CaskoUiCircularSectorLayerSvgElement extends LitElement {
  @property({ attribute: false })
  public svg?: Partial<CircularSectorSvgSettings>;

  @property({ attribute: false })
  public globalSettings?: Partial<CircularSectorGenerationSettings>;

  @property({ attribute: false })
  public layer: CircularSectorLayerDefinition = {};

  @property({ attribute: false })
  public allLayers?: ReadonlyArray<CircularSectorLayerDefinition>;

  @property({ attribute: false })
  public colorPalettes: ReadonlyArray<CircularSectorColorPaletteDefinition> = [];

  @property({ attribute: 'error-mode' })
  public errorMode: CircularSectorSvgErrorMode = 'render-message';

  render() {
    const result = this.#buildResult();

    if (!result.data) {
      return this.errorMode === 'silent'
        ? nothing
        : html`<div class="error" role="alert">${result.error}</div>`;
    }

    return renderCircularSectorSvg(result.data);
  }

  #buildResult(): { data?: CircularSectorRenderedSvg; error?: string } {
    try {
      const svgSettings = {
        ...DEFAULT_CIRCULAR_SECTOR_SVG_SETTINGS,
        ...this.svg,
      };
      const globalSettings = {
        ...DEFAULT_CIRCULAR_SECTOR_GLOBAL_SETTINGS,
        ...this.globalSettings,
      };
      const layerIndex = Math.max(
        0,
        this.allLayers?.findIndex((entry) => entry === this.layer) ?? 0,
      );
      const layer = buildCircularSectorRenderedLayer(this.layer, {
        svg: svgSettings,
        globalSettings,
        colorPalettes: this.colorPalettes,
        layers: this.allLayers ?? [this.layer],
        layerIndex,
      });
      const data: CircularSectorRenderedSvg = {
        svg: svgSettings,
        globalSettings,
        colorPalettes: [...this.colorPalettes],
        layers: [layer],
        textItems: buildCircularSectorTextItems(svgSettings, [layer]),
      };

      return { data };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to generate circular sector layer SVG.',
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

export default CaskoUiCircularSectorLayerSvgElement;

declare global {
  interface HTMLElementTagNameMap {
    'circular-sector-layer-svg': CaskoUiCircularSectorLayerSvgElement;
  }
}
