import { t as e } from "../decorate-9sBcXH5_.js";
import { LitElement as t, css as n, html as r } from "lit";
import { customElement as i, property as a } from "lit/decorators.js";
//#region src/elements/transform-box.element.ts
var o = {
	nw: {
		x: -1,
		y: -1
	},
	n: {
		x: 0,
		y: -1
	},
	ne: {
		x: 1,
		y: -1
	},
	e: {
		x: 1,
		y: 0
	},
	se: {
		x: 1,
		y: 1
	},
	s: {
		x: 0,
		y: 1
	},
	sw: {
		x: -1,
		y: 1
	},
	w: {
		x: -1,
		y: 0
	}
}, s = [
	"nw",
	"ne",
	"se",
	"sw"
], c = [
	"n",
	"e",
	"s",
	"w"
];
function l(e) {
	return e * Math.PI / 180;
}
function u(e) {
	return e * 180 / Math.PI;
}
function d(e, t) {
	let n = l(t), r = Math.cos(n), i = Math.sin(n);
	return {
		x: e.x * r - e.y * i,
		y: e.x * i + e.y * r
	};
}
function f(e) {
	return {
		x: e.x + e.width / 2,
		y: e.y + e.height / 2
	};
}
function p(e) {
	let t = f(e), n = e.width / 2, r = e.height / 2, i = [
		d({
			x: -n,
			y: -r
		}, e.rotation),
		d({
			x: n,
			y: -r
		}, e.rotation),
		d({
			x: n,
			y: r
		}, e.rotation),
		d({
			x: -n,
			y: r
		}, e.rotation)
	].map((e) => ({
		x: t.x + e.x,
		y: t.y + e.y
	})), a = i.map((e) => e.x), o = i.map((e) => e.y);
	return {
		minX: Math.min(...a),
		maxX: Math.max(...a),
		minY: Math.min(...o),
		maxY: Math.max(...o)
	};
}
var m = class extends t {
	constructor(...e) {
		super(...e), this.x = 0, this.y = 0, this.width = 160, this.height = 120, this.rotation = 0, this.selected = !1, this.showWhenUnselected = !0, this.disabled = !1, this.showSideHandles = !1, this.rotatable = !0, this.movable = !0, this.resizable = !0, this.keyboardStep = 1, this.minWidth = 24, this.minHeight = 24, this.clampToBounds = !1, this.keepProportionsOnResize = !1;
	}
	#e;
	#t = !1;
	connectedCallback() {
		super.connectedCallback(), this.hasAttribute("tabindex") || (this.tabIndex = 0);
	}
	render() {
		let e = this.#i(), t = this.showSideHandles ? [...s, ...c] : s, n = this.selected || this.showWhenUnselected;
		return r`
      <div
        class="surface"
        tabindex=${this.disabled ? -1 : 0}
        role="group"
        aria-disabled=${String(this.disabled)}
        aria-label="Transform box"
        @pointermove=${this.#_}
        @pointerup=${this.#v}
        @pointercancel=${this.#v}
        @lostpointercapture=${this.#y}
        @keydown=${this.#O}
        @keyup=${this.#k}
        @focus=${this.#E}
        @blur=${this.#D}>
        <div
          class="box ${this.selected ? "selected" : ""} ${this.disabled ? "disabled" : ""} ${n ? "" : "hidden"}"
          style=${this.#a(e)}
          @pointerdown=${this.#m}>
          <div class="box-outline" aria-hidden="true"></div>
          <div class="content">
            <slot></slot>
          </div>

          ${this.resizable ? t.map((e) => this.#n(e)) : null}

          ${this.rotatable ? this.#r() : null}
        </div>
      </div>
    `;
	}
	#n(e) {
		return r`
      <button
        type="button"
        class="handle handle-${e}"
        data-handle=${e}
        aria-label=${`Resize ${e}`}
        title=${`Resize ${e}`}
        ?disabled=${this.disabled}
        @pointerdown=${this.#h}>
      </button>
    `;
	}
	#r() {
		return r`
      <button
        type="button"
        class="rotate-handle"
        aria-label="Rotate box"
        title="Rotate box"
        ?disabled=${this.disabled}
        @pointerdown=${this.#g}>
      </button>
    `;
	}
	#i() {
		return {
			x: Number.isFinite(this.x) ? this.x : 0,
			y: Number.isFinite(this.y) ? this.y : 0,
			width: Math.max(this.minWidth, Number.isFinite(this.width) ? this.width : this.minWidth),
			height: Math.max(this.minHeight, Number.isFinite(this.height) ? this.height : this.minHeight),
			rotation: Number.isFinite(this.rotation) ? this.rotation : 0
		};
	}
	#a(e) {
		return [
			`left:${e.x}px`,
			`top:${e.y}px`,
			`width:${e.width}px`,
			`height:${e.height}px`,
			`transform:rotate(${e.rotation}deg)`
		].join(";");
	}
	#o(e) {
		let t = this.getBoundingClientRect();
		return {
			x: e.clientX - t.left,
			y: e.clientY - t.top
		};
	}
	#s() {
		let e = this.getBoundingClientRect();
		return {
			width: Math.max(0, e.width),
			height: Math.max(0, e.height)
		};
	}
	#c(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	#l(e, t) {
		this.selected !== e && (this.selected = e, this.#c("transform-box-select", {
			selected: this.selected,
			source: t
		}));
	}
	#u(e, t) {
		let n = this.#f(e);
		this.x = n.x, this.y = n.y, this.width = n.width, this.height = n.height, this.rotation = n.rotation, this.#c("transform-box-change", {
			...n,
			source: t
		});
	}
	#d(e) {
		let t = this.#i();
		this.#c("transform-box-commit", {
			...t,
			source: e
		});
	}
	#f(e) {
		let t = Math.max(this.minWidth, e.width), n = Math.max(this.minHeight, e.height), r = e.x, i = e.y, a = Number.isFinite(e.rotation) ? e.rotation : 0;
		if (!this.clampToBounds) return {
			x: r,
			y: i,
			width: t,
			height: n,
			rotation: a
		};
		let o = this.#s();
		t = Math.min(t, o.width || t), n = Math.min(n, o.height || n);
		let s = p({
			x: r,
			y: i,
			width: t,
			height: n,
			rotation: a
		}), c = 0, l = 0;
		return s.minX < 0 ? c = -s.minX : s.maxX > o.width && (c = o.width - s.maxX), s.minY < 0 ? l = -s.minY : s.maxY > o.height && (l = o.height - s.maxY), r += c, i += l, {
			x: r,
			y: i,
			width: t,
			height: n,
			rotation: a
		};
	}
	#p(e, t) {
		if (this.disabled) return;
		this.#l(!0, "pointer"), this.shadowRoot?.querySelector(".surface")?.focus();
		let n = e.currentTarget, r = this.#i(), i = this.#o(e);
		n.setPointerCapture(e.pointerId), this.#e = {
			...t,
			pointerId: e.pointerId,
			captureElement: n,
			startGeometry: r,
			startPointer: i
		}, e.preventDefault(), e.stopPropagation();
	}
	#m = (e) => {
		!this.movable || this.disabled || e.composedPath().some((e) => e instanceof HTMLElement && (e.classList.contains("handle") || e.classList.contains("rotate-handle"))) || this.#p(e, { kind: "move" });
	};
	#h = (e) => {
		if (!this.resizable || this.disabled) return;
		let t = e.currentTarget.dataset.handle;
		t && this.#p(e, {
			kind: "resize",
			handle: t
		});
	};
	#g = (e) => {
		if (!this.rotatable || this.disabled) return;
		let t = f(this.#i()), n = this.#o(e);
		this.#p(e, {
			kind: "rotate",
			startAngle: u(Math.atan2(n.y - t.y, n.x - t.x))
		});
	};
	#_ = (e) => {
		if (!this.#e || e.pointerId !== this.#e.pointerId) return;
		let t = this.#o(e), n = this.#x(this.#e, t);
		this.#u(n, this.#e.kind);
	};
	#v = (e) => {
		if (!this.#e || e.pointerId !== this.#e.pointerId) return;
		let t = this.#e;
		t.captureElement.releasePointerCapture(e.pointerId), this.#b(t.kind);
	};
	#y = (e) => {
		!this.#e || e.pointerId !== this.#e.pointerId || this.#b(this.#e.kind);
	};
	#b(e) {
		this.#e = void 0, this.#d(e);
	}
	#x(e, t) {
		switch (e.kind) {
			case "move": return this.#S(e, t);
			case "resize": return this.#C(e, t);
			case "rotate": return this.#T(e, t);
		}
	}
	#S(e, t) {
		let n = t.x - e.startPointer.x, r = t.y - e.startPointer.y;
		return {
			...e.startGeometry,
			x: e.startGeometry.x + n,
			y: e.startGeometry.y + r
		};
	}
	#C(e, t) {
		let n = o[e.handle], r = d({
			x: t.x - e.startPointer.x,
			y: t.y - e.startPointer.y
		}, -e.startGeometry.rotation), i = -e.startGeometry.width / 2, a = e.startGeometry.width / 2, s = -e.startGeometry.height / 2, c = e.startGeometry.height / 2;
		this.keepProportionsOnResize ? {left: i, right: a, top: s, bottom: c} = this.#w(e.startGeometry, n, r, {
			left: i,
			right: a,
			top: s,
			bottom: c
		}) : (n.x === -1 && (i += r.x), n.x === 1 && (a += r.x), n.y === -1 && (s += r.y), n.y === 1 && (c += r.y), a - i < this.minWidth && (n.x === -1 ? i = a - this.minWidth : n.x === 1 && (a = i + this.minWidth)), c - s < this.minHeight && (n.y === -1 ? s = c - this.minHeight : n.y === 1 && (c = s + this.minHeight)));
		let l = a - i, u = c - s, p = d({
			x: (i + a) / 2,
			y: (s + c) / 2
		}, e.startGeometry.rotation), m = f(e.startGeometry), h = {
			x: m.x + p.x,
			y: m.y + p.y
		};
		return {
			x: h.x - l / 2,
			y: h.y - u / 2,
			width: l,
			height: u,
			rotation: e.startGeometry.rotation
		};
	}
	#w(e, t, n, r) {
		let i = e.width / e.height || 1, a = Math.max(this.minWidth, this.minHeight * i), o = a / i, s = t.x === 0 ? 0 : t.x * n.x, c = t.y === 0 ? 0 : t.y * n.y, l = e.width + s, u = e.height + c, d = e.width, f = e.height;
		if (t.x !== 0 && t.y !== 0) {
			let t = s / e.width, n = c / e.height;
			Math.abs(t) >= Math.abs(n) ? (d = Math.max(a, l), f = d / i) : (f = Math.max(o, u), d = f * i);
		} else t.x === 0 ? t.y !== 0 && (f = Math.max(o, u), d = f * i) : (d = Math.max(a, l), f = d / i);
		let { left: p, right: m, top: h, bottom: g } = r;
		return t.x === -1 ? p = m - d : t.x === 1 ? m = p + d : (p = -d / 2, m = d / 2), t.y === -1 ? h = g - f : t.y === 1 ? g = h + f : (h = -f / 2, g = f / 2), {
			left: p,
			right: m,
			top: h,
			bottom: g
		};
	}
	#T(e, t) {
		let n = f(e.startGeometry), r = u(Math.atan2(t.y - n.y, t.x - n.x)) - e.startAngle;
		return {
			...e.startGeometry,
			rotation: e.startGeometry.rotation + r
		};
	}
	#E = () => {
		this.disabled || this.#l(!0, "focus");
	};
	#D = () => {
		this.#e || this.#l(!1, "blur");
	};
	#O = (e) => {
		if (this.disabled || !this.selected) return;
		let t = Math.max(1, this.keyboardStep), n = this.#i(), r;
		switch (e.key) {
			case "ArrowUp":
				r = {
					...n,
					y: n.y - t
				};
				break;
			case "ArrowDown":
				r = {
					...n,
					y: n.y + t
				};
				break;
			case "ArrowLeft":
				r = {
					...n,
					x: n.x - t
				};
				break;
			case "ArrowRight":
				r = {
					...n,
					x: n.x + t
				};
				break;
			default: return;
		}
		e.preventDefault(), this.#t = !0, this.#u(r, "keyboard");
	};
	#k = (e) => {
		this.#t && [
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight"
		].includes(e.key) && (this.#t = !1, this.#d("keyboard"));
	};
	static {
		this.styles = [n`
      :host {
        display: block;
        position: relative;
        min-width: 0;
        min-height: 0;
        outline: none;
        touch-action: none;
        --transform-box-outline-color: rgba(15, 84, 73, 0.75);
        --transform-box-selected-color: #0f5449;
        --transform-box-handle-size: 12px;
        --transform-box-handle-border: 2px;
        --transform-box-rotate-offset: 28px;
        --transform-box-background: rgba(15, 84, 73, 0.06);
        --transform-box-overlay-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9) inset;
      }

      .surface {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: inherit;
        outline: none;
        pointer-events: none;
      }

      .box {
        position: absolute;
        box-sizing: border-box;
        transform-origin: center center;
        pointer-events: auto;
      }

      .box.disabled {
        opacity: 0.7;
      }

      .box.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .box-outline {
        position: absolute;
        inset: 0;
        border: 1px solid var(--transform-box-outline-color);
        background: var(--transform-box-background);
        box-shadow: var(--transform-box-overlay-shadow);
        pointer-events: none;
      }

      .box.selected .box-outline,
      :host([selected]) .box-outline {
        border-color: var(--transform-box-selected-color);
        box-shadow:
          var(--transform-box-overlay-shadow),
          0 0 0 1px color-mix(in srgb, var(--transform-box-selected-color) 35%, transparent);
      }

      .content {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .handle,
      .rotate-handle {
        position: absolute;
        width: var(--transform-box-handle-size);
        height: var(--transform-box-handle-size);
        border-radius: 999px;
        border: var(--transform-box-handle-border) solid var(--transform-box-selected-color);
        background: white;
        box-sizing: border-box;
        padding: 0;
        cursor: pointer;
      }

      .handle {
        z-index: 2;
      }

      .handle-nw {
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        cursor: nwse-resize;
      }

      .handle-ne {
        right: 0;
        top: 0;
        transform: translate(50%, -50%);
        cursor: nesw-resize;
      }

      .handle-se {
        right: 0;
        bottom: 0;
        transform: translate(50%, 50%);
        cursor: nwse-resize;
      }

      .handle-sw {
        left: 0;
        bottom: 0;
        transform: translate(-50%, 50%);
        cursor: nesw-resize;
      }

      .handle-n {
        left: 50%;
        top: 0;
        transform: translate(-50%, -50%);
        cursor: ns-resize;
      }

      .handle-e {
        right: 0;
        top: 50%;
        transform: translate(50%, -50%);
        cursor: ew-resize;
      }

      .handle-s {
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 50%);
        cursor: ns-resize;
      }

      .handle-w {
        left: 0;
        top: 50%;
        transform: translate(-50%, -50%);
        cursor: ew-resize;
      }

      .rotate-handle {
        left: 50%;
        top: calc(var(--transform-box-rotate-offset) * -1);
        transform: translateX(-50%);
        cursor: grab;
        z-index: 2;
      }

      .rotate-handle::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 100%;
        width: 1px;
        height: calc(var(--transform-box-rotate-offset) - var(--transform-box-handle-size));
        background: var(--transform-box-selected-color);
        transform: translateX(-50%);
      }

      .rotate-handle:active {
        cursor: grabbing;
      }
    `];
	}
};
e([a({ type: Number })], m.prototype, "x", void 0), e([a({ type: Number })], m.prototype, "y", void 0), e([a({ type: Number })], m.prototype, "width", void 0), e([a({ type: Number })], m.prototype, "height", void 0), e([a({ type: Number })], m.prototype, "rotation", void 0), e([a({
	type: Boolean,
	reflect: !0
})], m.prototype, "selected", void 0), e([a({
	type: Boolean,
	attribute: "show-when-unselected"
})], m.prototype, "showWhenUnselected", void 0), e([a({
	type: Boolean,
	reflect: !0
})], m.prototype, "disabled", void 0), e([a({
	type: Boolean,
	attribute: "show-side-handles"
})], m.prototype, "showSideHandles", void 0), e([a({
	type: Boolean,
	reflect: !0
})], m.prototype, "rotatable", void 0), e([a({
	type: Boolean,
	reflect: !0
})], m.prototype, "movable", void 0), e([a({
	type: Boolean,
	reflect: !0
})], m.prototype, "resizable", void 0), e([a({
	type: Number,
	attribute: "keyboard-step"
})], m.prototype, "keyboardStep", void 0), e([a({
	type: Number,
	attribute: "min-width"
})], m.prototype, "minWidth", void 0), e([a({
	type: Number,
	attribute: "min-height"
})], m.prototype, "minHeight", void 0), e([a({
	type: Boolean,
	attribute: "clamp-to-bounds"
})], m.prototype, "clampToBounds", void 0), e([a({
	type: Boolean,
	attribute: "keep-proportions-on-resize"
})], m.prototype, "keepProportionsOnResize", void 0), m = e([i("transform-box")], m);
var h = m;
//#endregion
export { m as CaskoUiTransformBoxElement, h as default };

//# sourceMappingURL=transform-box.js.map