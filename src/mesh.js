'use strict';

const loadTexture = async (texture, url) => {
    const result = await fetch(url);
    const blob = await result.blob();
    const data = await createImageBitmap(blob);
    texture({data,
        wrapS: 'repeat',
        wrapT: 'repeat'
    });
};

module.exports = (regl, data, useReflexion) => {
    const wallTexture = regl.texture();
    const floorTexture = regl.texture();
    loadTexture(wallTexture, "res/wall.jpg");
    loadTexture(floorTexture, "res/floor.jpg");
    return regl({
        frag: `
        precision mediump float;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform sampler2D wallTexture;
        uniform sampler2D floorTexture;

        void main() {
            float dist = length(v_relativepos);
            vec3 totalLight;

            // Dark ceiling with slightly smaller, crisp-edged LED-style square panels.
            if (v_normal.y < -0.5) {
                vec2 ceilingCell = mod(v_pos.xz, 6.0);
                float panelMargin = 1.15;
                float panelEnd = 6.0 - panelMargin;
                float lightPanel = step(panelMargin, ceilingCell.x)
                    * step(panelMargin, ceilingCell.y)
                    * (1.0 - step(panelEnd, ceilingCell.x))
                    * (1.0 - step(panelEnd, ceilingCell.y));
                // Warm light cream ceiling to harmonize with the golden brick wall.
                vec3 ceilingBase = vec3(0.72, 0.68, 0.59);
                vec3 panelWhite = vec3(0.98, 0.98, 0.96);
                totalLight = mix(ceilingBase, panelWhite, lightPanel);
            } else if (v_normal.y > 0.5) {
                // Keep the marble floor muted so the artwork, not the room, draws attention.
                vec3 stone = vec3(0.76, 0.73, 0.68);
                vec3 textureColor = texture2D(floorTexture, v_pos.xz / 8.0).rgb;
                totalLight = mix(stone, textureColor, 0.06);
                float pattern = sin((v_pos.x + v_pos.z * 0.65) * 2.4
                    + sin(v_pos.x * 0.7 + v_pos.z * 0.3) * 2.0);
                float vein = pow(1.0 - abs(pattern), 18.0);
                totalLight = mix(totalLight, vec3(0.55, 0.52, 0.47), vein * 0.12);
            } else {
                // Medium warm wood with layered grain, subtle pores, knots, and clear board seams.
                vec2 woodUV = vec2(v_pos.x + v_pos.z, v_pos.y);
                float boardHeight = 0.62;
                float boardRow = floor(woodUV.y / boardHeight);
                float boardPosition = fract(woodUV.y / boardHeight);
                float seamDistance = min(boardPosition, 1.0 - boardPosition);
                float boardSeam = 1.0 - smoothstep(0.006, 0.025, seamDistance);

                // Small hash-based variation breaks up the repeated, synthetic-looking stripes.
                vec2 cell = floor(vec2(woodUV.x * 2.0, woodUV.y * 5.0));
                float fineNoise = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
                float broadNoise = sin(woodUV.x * 2.1 + sin(woodUV.y * 4.7) * 0.65)
                    * 0.5 + 0.5;
                float warpedX = woodUV.x
                    + 0.045 * sin(woodUV.y * 8.0 + broadNoise * 2.0)
                    + 0.018 * sin(woodUV.y * 23.0 + woodUV.x * 0.4);

                // Several grain scales create fine fibers and wider natural growth lines.
                float grainWide = sin(warpedX * 7.5 + sin(warpedX * 1.8) * 1.4);
                float grainMedium = sin(warpedX * 21.0 + sin(woodUV.y * 2.7) * 1.1);
                float grainFine = sin(warpedX * 57.0 + sin(warpedX * 5.0) * 0.7);
                float pores = smoothstep(0.82, 1.0, sin(warpedX * 91.0 + fineNoise * 2.0));
                float grain = grainWide * 0.025 + grainMedium * 0.022
                    + grainFine * 0.009 - pores * 0.012;

                // Each board gets a restrained, slightly different walnut/oak tone.
                float boardVariation = fract(sin(boardRow * 19.19 + 7.7) * 43758.5453);
                vec3 woodBase = mix(vec3(0.40, 0.245, 0.135), vec3(0.55, 0.365, 0.215),
                    boardVariation * 0.65 + 0.17);
                float lightVariation = 0.97 + broadNoise * 0.06 + (fineNoise - 0.5) * 0.035;
                vec3 woodColor = woodBase * lightVariation
                    + vec3(grain * 1.0, grain * 0.72, grain * 0.46);

                // Very subtle elongated knot rings, varied per board segment.
                vec2 segment = vec2(floor(woodUV.x / 5.0), boardRow);
                vec2 knotCenter = vec2(
                    (fract(sin(dot(segment, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 3.2,
                    (fract(sin(dot(segment + 4.7, vec2(39.346, 11.135))) * 24634.6345) - 0.5) * 0.22
                );
                vec2 knotPos = vec2(mod(woodUV.x + 2.5, 5.0) - 2.5, boardPosition * boardHeight - boardHeight * 0.5);
                vec2 knotDelta = (knotPos - knotCenter) * vec2(0.42, 2.4);
                float knotRadius = length(knotDelta);
                float knotRings = sin(knotRadius * 38.0 + sin(knotRadius * 9.0) * 1.2);
                float knotMask = (1.0 - smoothstep(0.10, 0.34, knotRadius))
                    * (1.0 - smoothstep(0.0, 0.04, abs(knotCenter.y)));
                woodColor -= vec3(0.035, 0.024, 0.014) * knotMask * (0.5 + 0.5 * knotRings);

                vec3 seamColor = vec3(0.235, 0.145, 0.082);
                totalLight = mix(woodColor, seamColor, boardSeam);

                // Keep the wall in a natural medium-brown range without washing out the detail.
                totalLight *= 0.99 + 0.015 * smoothstep(0.1, 0.12, v_pos.y);
            }

            float alpha = .98 + smoothstep(150., 0., dist) - v_normal.y;
            gl_FragColor = vec4(totalLight, ${useReflexion ? "alpha" : "1.0"});
        }`,

        vert: `
        precision highp float;
        uniform mat4 proj, view;
        attribute vec3 position, normal;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform float yScale;
        void main() {
            vec3 pos = position;
            v_pos = pos;
            v_relativepos = (view * vec4(pos, 1)).xyz;
            pos.y *= yScale;
            v_normal = normal;
            gl_Position = proj * view * vec4(pos, 1);
        }`,

        attributes: {
            position: data.position,
            normal: data.normal
        },

        blend: useReflexion ? {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha'
            },
        } : {},

        uniforms: {
            wallTexture,
            floorTexture
        },

        elements: new Uint32Array(data.elements)
    });
};
