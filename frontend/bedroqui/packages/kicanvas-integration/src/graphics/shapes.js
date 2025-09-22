/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/** A filled circle */
export class Circle {
    /**
     * Create a filled circle
     * @param center - center of circle
     * @param radius - circle radius
     * @param color - fill color
     */
    constructor(center, radius, color) {
        this.center = center;
        this.radius = radius;
        this.color = color;
    }
}
/** A stroked circular arc */
export class Arc {
    /**
     * Create a stroked arc
     * @param center - center of arc circle
     * @param radius - arc circle radius
     * @param start_angle - arc start angle
     * @param end_angle - arc end angle
     * @param color - stroke color
     */
    constructor(center, radius, start_angle, end_angle, width, color) {
        this.center = center;
        this.radius = radius;
        this.start_angle = start_angle;
        this.end_angle = end_angle;
        this.width = width;
        this.color = color;
    }
}
/** Stroked polyline */
export class Polyline {
    /**
     * Create a stroked polyline
     * @param points - line segment points
     * @param width - thickness of the rendered lines
     * @param color - stroke color
     */
    constructor(points, width, color) {
        this.points = points;
        this.width = width;
        this.color = color;
    }
    /**
     * Create a rectangular outline from a bounding box.
     * @param bb
     * @param width - thickness of the rendered lines
     * @param color - fill color
     */
    static from_BBox(bb, width, color) {
        return new Polyline([
            bb.top_left,
            bb.top_right,
            bb.bottom_right,
            bb.bottom_left,
            bb.top_left,
        ], width, color);
    }
}
/** Filled polygon */
export class Polygon {
    /**
     * Create a filled polygon
     * @param points - point cloud representing the polygon
     * @param color - fill color
     */
    constructor(points, color) {
        this.points = points;
        this.color = color;
    }
    /**
     * Create a filled polygon from a bounding box.
     * @param bb
     * @param color - fill color
     */
    static from_BBox(bb, color) {
        return new Polygon([bb.top_left, bb.top_right, bb.bottom_right, bb.bottom_left], color);
    }
}
