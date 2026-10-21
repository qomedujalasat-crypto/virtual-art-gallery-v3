const textHeight = 38;
const textCanvas = document.createElement('canvas');
const maxWidth = textCanvas.width = textCanvas.height = 1024;
const ctx = textCanvas.getContext('2d');
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.textAlign = "center";
ctx.textBaseline = "middle";

module.exports = {
    init(texture, textToWrite, paintingWidth = maxWidth) {
        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);

        // Fit the complete caption on one centered line.
        const availableWidth = Math.max(180, Math.min(paintingWidth * maxWidth, maxWidth) - 36);
        let fontSize = textHeight;
        ctx.font = fontSize + 'px Tahoma, Arial, sans-serif';
        while (ctx.measureText(textToWrite).width > availableWidth && fontSize > 14) {
            fontSize -= 1;
            ctx.font = fontSize + 'px Tahoma, Arial, sans-serif';
        }

        const measuredWidth = Math.min(ctx.measureText(textToWrite).width, availableWidth);
        const paddingX = 14;
        const paddingY = 8;
        const labelHeight = fontSize + paddingY * 2;
        // Shift the caption slightly left so it sits more naturally beneath the artwork.
        const centerX = textCanvas.width / 2 - 38;
        const centerY = textCanvas.height - 62;

        // Opaque white label behind dark text; the rest of the canvas stays transparent.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(centerX - measuredWidth / 2 - paddingX, centerY - labelHeight / 2,
            measuredWidth + paddingX * 2, labelHeight);
        ctx.fillStyle = "#242424";
        ctx.fillText(textToWrite, centerX, centerY, availableWidth);

        return texture({
            data: textCanvas,
            min: 'mipmap',
            mipmap: 'nice',
            flipY: true
        });
    },
    draw(regl) {
        return regl({
            frag: `
            precision mediump float;
            uniform sampler2D tex;
            varying vec2 uv;
        
            void main () {
                gl_FragColor = texture2D(tex, uv);
            }`,
            vert: `
            precision highp float;
            uniform mat4 proj, view, model;
            uniform float yScale;
            attribute vec2 pos;
            varying vec2 uv;
            void main () {
                uv = pos;
                vec4 mpos = model * vec4(pos, 0.001, 1);
                mpos.y *= yScale;
                gl_Position = proj * view * mpos;
            }`,
            attributes: {
                pos: [0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0]
            },
            uniforms: {
                model: regl.prop('textmodel'),
                tex: regl.prop('text')
            },
            count: 6,

            blend: {
                enable: true,
                func: {
                    srcRGB: 'src alpha',
                    srcAlpha: 'one minus src alpha',
                    dstRGB: 'one minus src alpha',
                    dstAlpha: 1
                },
                color: [0, 0, 0, 0]
            }
        });
    }
};