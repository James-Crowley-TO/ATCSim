import { MIN_ZOOM, MAX_ZOOM } from "./constants.js";
import { clamp } from "./utils.js";

// Only numbers are transformed. The SVG itself stays at one user unit/CSS pixel.
export class Camera {
  constructor(bounds) {
    this.bounds = bounds;
    this.width = bounds.width;
    this.height = bounds.height;
    this.reset();
  }
  get fit() { return Math.min(this.width / this.bounds.width, this.height / this.bounds.height); }
  toScreen(point) { return { x: point.x * this.zoom + this.x, y: point.y * this.zoom + this.y }; }
  toWorld(point) { return { x: (point.x - this.x) / this.zoom, y: (point.y - this.y) / this.zoom }; }
  reset() {
    this.zoom = this.fit;
    this.x = (this.width - this.bounds.width * this.zoom) / 2;
    this.y = (this.height - this.bounds.height * this.zoom) / 2;
  }
  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    const centre = this.toWorld({ x: this.width / 2, y: this.height / 2 });
    const relativeZoom = this.zoom / this.fit;
    this.width = width;
    this.height = height;
    this.zoom = relativeZoom * this.fit;
    this.x = width / 2 - centre.x * this.zoom;
    this.y = height / 2 - centre.y * this.zoom;
  }
  zoomAt(point, factor) {
    const anchor = this.toWorld(point);
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM * this.fit, MAX_ZOOM * this.fit);
    this.x = point.x - anchor.x * this.zoom;
    this.y = point.y - anchor.y * this.zoom;
  }
}
