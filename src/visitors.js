'use strict';

// Lightweight, static 3D gallery visitors built from triangle meshes.
// No external models or textures are required.
module.exports = (regl, fps) => {
    const positions = [];
    const colors = [];

    const triangle = (a, b, c, color) => {
        for (const p of [a, b, c]) {
            positions.push(p[0], p[1], p[2]);
            colors.push(color[0], color[1], color[2]);
        }
    };

    const quad = (a, b, c, d, color) => {
        triangle(a, b, c, color);
        triangle(a, c, d, color);
    };

    const sphere = (center, radius, color, rings = 7, sectors = 10) => {
        for (let y = 0; y < rings; y++) {
            const t0 = Math.PI * y / rings;
            const t1 = Math.PI * (y + 1) / rings;
            for (let x = 0; x < sectors; x++) {
                const p0 = 2 * Math.PI * x / sectors;
                const p1 = 2 * Math.PI * (x + 1) / sectors;
                const point = (t, p) => [
                    center[0] + radius * Math.sin(t) * Math.cos(p),
                    center[1] + radius * Math.cos(t),
                    center[2] + radius * Math.sin(t) * Math.sin(p)
                ];
                const a = point(t0, p0), b = point(t0, p1);
                const c = point(t1, p1), d = point(t1, p0);
                triangle(a, c, b, color);
                triangle(a, d, c, color);
            }
        }
    };

    const limb = (a, b, radius, color, sides = 7) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const len = Math.hypot(dx, dy, dz) || 1;
        let ux = -dz / len, uy = 0, uz = dx / len;
        if (Math.hypot(ux, uz) < 0.01) { ux = 1; uz = 0; }
        for (let i = 0; i < sides; i++) {
            const t0 = 2 * Math.PI * i / sides, t1 = 2 * Math.PI * (i + 1) / sides;
            const ring = (p, r) => [a[0] + ux * Math.cos(p) * r, a[1] + Math.sin(p) * r, a[2] + uz * Math.cos(p) * r];
            const ring2 = (p, r) => [b[0] + ux * Math.cos(p) * r, b[1] + Math.sin(p) * r, b[2] + uz * Math.cos(p) * r];
            const p0 = ring(t0, radius), p1 = ring(t1, radius);
            const q0 = ring2(t0, radius * 0.82), q1 = ring2(t1, radius * 0.82);
            quad(p0, p1, q1, q0, color);
            triangle(a, p1, p0, color);
            triangle(b, q0, q1, color);
        }
    };

    const dress = (x, z, color, facing) => {
        // A softly flared, tapered skirt and fitted upper body.
        const front = facing === 'north' || facing === 'south';
        const y0 = 0.42, y1 = 1.08, y2 = 1.47;
        const lower = 0.29, waist = 0.16, shoulder = 0.20;
        const rings = [
            { y: y0, r: lower },
            { y: y1, r: waist },
            { y: y2, r: shoulder }
        ];
        for (let k = 0; k < rings.length - 1; k++) {
            const lo = rings[k], hi = rings[k + 1];
            for (let i = 0; i < 10; i++) {
                const a0 = 2 * Math.PI * i / 10, a1 = 2 * Math.PI * (i + 1) / 10;
                const p = (r, y, a) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
                quad(p(lo.r, lo.y, a0), p(lo.r, lo.y, a1), p(hi.r, hi.y, a1), p(hi.r, hi.y, a0), color);
            }
        }
        // Arms, skin-toned hands, and simple shoes make the silhouette read as a person.
        const arm = [0.74, 0.58, 0.48], skin = [0.78, 0.64, 0.52], shoe = [0.12, 0.11, 0.10];
        limb([x - 0.19, 1.35, z], [x - 0.28, 0.91, z + (front ? 0.02 : -0.02)], 0.065, color);
        limb([x + 0.19, 1.35, z], [x + 0.28, 0.91, z + (front ? 0.02 : -0.02)], 0.065, color);
        sphere([x - 0.28, 0.88, z], 0.065, skin, 5, 7);
        sphere([x + 0.28, 0.88, z], 0.065, skin, 5, 7);
        limb([x - 0.11, 0.43, z], [x - 0.12, 0.12, z], 0.075, [0.20, 0.19, 0.18]);
        limb([x + 0.11, 0.43, z], [x + 0.12, 0.12, z], 0.075, [0.20, 0.19, 0.18]);
        limb([x - 0.12, 0.12, z], [x - 0.12, 0.07, z + 0.08], 0.075, shoe);
        limb([x + 0.12, 0.12, z], [x + 0.12, 0.07, z + 0.08], 0.075, shoe);
        sphere([x, 1.62, z], 0.145, skin, 8, 10);
        limb([x, 1.45, z], [x, 1.53, z], 0.065, skin);
        // A subtle gold belt echoes the gallery's framed fashion artwork.
        limb([x - 0.14, 1.08, z], [x + 0.14, 1.08, z], 0.018, [0.78, 0.63, 0.32]);
    };

    // Positions follow the U-shaped gallery's walkable perimeter.
    // Each visitor faces a nearby wall rather than blocking the central route.
    const visitors = [
        { x: 7.5, z: 7.2, color: [0.04, 0.30, 0.25], facing: 'north' },
        { x: 23.5, z: 7.2, color: [0.48, 0.12, 0.17], facing: 'north' },
        { x: 40.5, z: 7.2, color: [0.12, 0.20, 0.43], facing: 'north' },
        { x: 7.5, z: 25.0, color: [0.50, 0.34, 0.12], facing: 'west' },
        { x: 40.5, z: 25.0, color: [0.34, 0.12, 0.38], facing: 'east' },
        { x: 7.5, z: 39.0, color: [0.10, 0.35, 0.38], facing: 'west' },
        { x: 40.5, z: 39.0, color: [0.45, 0.22, 0.10], facing: 'east' }
    ];
    visitors.forEach(v => dress(v.x, v.z, v.color, v.facing));

    const drawVisitors = regl({
        vert: `
            precision highp float;
            uniform mat4 proj, view;
            attribute vec3 position, color;
            varying vec3 vColor;
            void main() {
                vColor = color;
                gl_Position = proj * view * vec4(position, 1.0);
            }`,
        frag: `
            precision mediump float;
            varying vec3 vColor;
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
            }`,
        attributes: {
            position: { data: positions, dimension: 3 },
            color: { data: colors, dimension: 3 }
        },
        uniforms: {
            view: fps.view,
            proj: fps.proj
        },
        count: positions.length / 3,
        primitive: 'triangles',
        depth: { enable: true, mask: true },
        cull: { enable: false }
    });

    return () => drawVisitors();
};
