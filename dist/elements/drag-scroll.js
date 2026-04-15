import { t as e } from "../decorate-9sBcXH5_.js";
import { LitElement as t, css as n, html as r } from "lit";
import { customElement as i, property as a, query as o } from "lit/decorators.js";
//#region src/elements/drag-scroll.element.ts
var s = class extends t {
	constructor(...e) {
		super(...e), this.noChildDrag = !1, this.isDragging = !1, this.lastClientX = 0, this.lastClientY = 0, this.onMouseDown = (e) => {
			let t = this.containerElement;
			t && (this.noChildDrag && e.target instanceof Node && e.target !== t || (this.isDragging = !0, this.lastClientX = e.clientX, this.lastClientY = e.clientY, e.preventDefault()));
		}, this.onMouseUp = () => {
			this.isDragging = !1;
		}, this.onMouseMove = (e) => {
			if (!this.isDragging) return;
			let t = this.containerElement;
			if (!t) return;
			let n = e.clientX - this.lastClientX, r = e.clientY - this.lastClientY;
			this.lastClientX = e.clientX, this.lastClientY = e.clientY, t.scrollLeft -= n, t.scrollTop -= r;
		};
	}
	connectedCallback() {
		super.connectedCallback(), window.addEventListener("mouseup", this.onMouseUp), window.addEventListener("mousemove", this.onMouseMove);
	}
	disconnectedCallback() {
		window.removeEventListener("mouseup", this.onMouseUp), window.removeEventListener("mousemove", this.onMouseMove), super.disconnectedCallback();
	}
	firstUpdated() {
		this.containerElement.addEventListener("mousedown", this.onMouseDown);
	}
	render() {
		return r`
      <div class="dragscroll-container">
        <slot></slot>
      </div>
    `;
	}
	static {
		this.styles = n`
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
    }

    .dragscroll-container {
      overflow: auto;
      cursor: grab;
      width: 100%;
      height: 100%;
    }

    .dragscroll-container:active {
      cursor: grabbing;
    }
  `;
	}
};
e([a({
	type: Boolean,
	attribute: "nochilddrag",
	reflect: !0
})], s.prototype, "noChildDrag", void 0), e([o(".dragscroll-container")], s.prototype, "containerElement", void 0), s = e([i("drag-scroll")], s);
//#endregion
export { s as CaskoUiDragScrollElement };

//# sourceMappingURL=drag-scroll.js.map