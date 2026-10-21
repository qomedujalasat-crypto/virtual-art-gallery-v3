'use strict';
const texture = require('./image');
const mat4 = require('gl-mat4');

const renderDist = 40;
const loadDist = 20;
const unloadDist = 80;
const fovxMargin = Math.PI/32;

const dynamicResPeriod = 3000;
let dynamicRes = "high";
let dynamicResTimer;

const culling = (ppos, pangle, fovx, {vseg, angle}) => {
    const sx1 = vseg[0][0] - ppos[0];
    const sy1 = vseg[0][1] - ppos[2];
    const sx2 = vseg[1][0] - ppos[0];
    const sy2 = vseg[1][1] - ppos[2];
    const angles = [angle, pangle - fovx/2 - fovxMargin + Math.PI/2, pangle + fovx/2 + fovxMargin - Math.PI/2];
    for(let a of angles) {
        const nx = Math.sin(a);
        const ny = -Math.cos(a);
        if(nx * sx1 + ny * sy1 < 0 && nx * sx2 + ny * sy2 < 0)
            return false;
    }
    return true;
};

module.exports = (regl, {placements, getAreaIndex}) => {
    let batch = [], shownBatch = [];
    const surveyBatch = [];
    const surveyTexture = regl.texture();
    let surveyReady = false;
    let surveyAspect = 0.62;
    let fetching = true;

    fetch('images/' + encodeURIComponent('فرم نظر سنجی .png'))
        .then(response => {
            if (!response.ok) throw new Error('Could not load survey flyer');
            return response.blob();
        })
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
            surveyAspect = bitmap.width / bitmap.height;
            const flyerCanvas = document.createElement('canvas');
            flyerCanvas.width = bitmap.width;
            flyerCanvas.height = bitmap.height;
            flyerCanvas.getContext('2d').drawImage(bitmap, 0, 0);
            surveyTexture({ data: flyerCanvas, flipY: true });
            surveyReady = true;
            batch.forEach((painting, i) => { if (painting) addSurveyFlyer(painting, i); });
        })
        .catch(error => console.error(error));

    const addSurveyFlyer = (painting, index) => {
        if (!surveyReady || !painting || painting.file === '1.jpg' || painting.isSurveyFlyer) return;
        const { pos, dir, segLen, width, horiz, vert, angle } = painting;
        const ux = dir[0] / segLen;
        const uz = dir[1] / segLen;
        const flyerHalfWidth = width / 2.5;
        const flyerHalfHeight = width / (2.5 * surveyAspect);
        const flyerPos = [pos[0] + ux * (2 * width + 0.035), 2.1 - flyerHalfHeight, pos[2] + uz * (2 * width + 0.035)];
        const paperThickness = 0.1;
        const flyerScale = [2 * flyerHalfWidth * horiz + paperThickness * vert, 2 * flyerHalfHeight, 2 * flyerHalfWidth * vert + paperThickness * horiz];
        const model = [];
        mat4.fromTranslation(model, flyerPos);
        mat4.scale(model, model, flyerScale);
        mat4.rotateY(model, model, -angle);
        surveyBatch[index] = {
            ...painting,
            // Store the flyer position so click hit-testing targets the flyer, not its artwork.
            pos: [...flyerPos],
            tex: surveyTexture,
            text: null,
            textmodel: null,
            model,
            width: flyerHalfWidth,
            clickHalfHeight: flyerHalfHeight,
            isSurveyFlyer: true
        };
    };

    const mannequinTexture = regl.texture();
    let mannequinReady = false;
    let mannequinBatch = null;
    const createMannequin = (painting) => {
        if (mannequinReady || !painting || painting.file === '1.jpg') return;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath(); ctx.ellipse(128, 492, 63, 10, 0, 0, Math.PI * 2); ctx.fill();
        const white = '#f4f3ef';
        ctx.fillStyle = white;
        ctx.beginPath(); ctx.ellipse(128, 48, 31, 40, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(117, 80, 22, 25);
        ctx.beginPath();
        ctx.moveTo(95, 101); ctx.lineTo(161, 101);
        ctx.lineTo(178, 178); ctx.lineTo(151, 208);
        ctx.lineTo(105, 208); ctx.lineTo(78, 178); ctx.closePath(); ctx.fill();
        ctx.lineCap = 'round'; ctx.strokeStyle = white; ctx.lineWidth = 19;
        ctx.beginPath(); ctx.moveTo(91, 112); ctx.lineTo(69, 190); ctx.lineTo(61, 251); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(165, 112); ctx.lineTo(187, 190); ctx.lineTo(195, 251); ctx.stroke();
        ctx.fillStyle = white;
        ctx.beginPath(); ctx.ellipse(60, 263, 10, 20, -0.1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(196, 263, 10, 20, 0.1, 0, Math.PI*2); ctx.fill();
        const dress = ctx.createLinearGradient(80, 130, 180, 470);
        dress.addColorStop(0, '#07564b'); dress.addColorStop(0.5, '#063f37'); dress.addColorStop(1, '#022c27');
        ctx.fillStyle = dress;
        ctx.beginPath();
        ctx.moveTo(99, 119); ctx.lineTo(157, 119);
        ctx.lineTo(169, 205); ctx.lineTo(204, 470);
        ctx.quadraticCurveTo(128, 491, 52, 470);
        ctx.lineTo(87, 205); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c5a76a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(94, 220); ctx.quadraticCurveTo(128, 202, 162, 220); ctx.stroke();
        for (let i = 0; i < 7; i++) {
            const x = 101 + i * 9;
            ctx.beginPath(); ctx.moveTo(128, 240); ctx.lineTo(x, 215 + (i % 2) * 8); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(x, 214 + (i % 2) * 8, 3, 7, -0.4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = white;
        ctx.fillRect(117, 91, 22, 18);
        ctx.beginPath(); ctx.ellipse(60, 263, 8, 16, -0.1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(196, 263, 8, 16, 0.1, 0, Math.PI*2); ctx.fill();
        mannequinTexture({ data: canvas, flipY: true, min: 'linear', mag: 'linear' });
        mannequinReady = true;
        const { pos, dir, segLen, width, angle, horiz, vert } = painting;
        const mannequinWidth = Math.min(0.72, width * 0.7);
        const mannequinHeight = 1.75;
        const mannequinPos = [
            pos[0] + (dir[1] / segLen) * 0.22,
            0.02,
            pos[2] - (dir[0] / segLen) * 0.22
        ];
        const model = [];
        mat4.fromTranslation(model, mannequinPos);
        mat4.scale(model, model, [2 * mannequinWidth * horiz + 0.025 * vert, mannequinHeight, 2 * mannequinWidth * vert + 0.025 * horiz]);
        mat4.rotateY(model, model, -angle);
        mannequinBatch = {
            ...painting, tex: mannequinTexture, text: null, textmodel: null,
            model, width: mannequinWidth, isMannequinPrototype: true,
            vseg: painting.vseg,
            pos: mannequinPos, angle
        };
    };

    const loadPainting = (p) => {
        const placementIndex = Number.isInteger(p.image_id) ? p.image_id : batch.length;
        const seg = placements[placementIndex];
        const dir = [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]];
        const norm = [seg[1][1] - seg[0][1], seg[0][0] - seg[1][0]];
        const segLen = Math.hypot(dir[0], dir[1]);
        let globalScale = 4.5 / (3 + p.aspect);
        globalScale = Math.min(globalScale, segLen / p.aspect / 2.2);
        globalScale = Math.min(globalScale, 2 / 1.2);
        if (p.file === '1.jpg') {
            globalScale = Math.min(1.95, segLen / p.aspect / 2.2);
        }
        const pos = [(seg[0][0] + seg[1][0]) / 2, 2.1 - globalScale, (seg[0][1] + seg[1][1]) / 2];
        const angle = Math.atan2(dir[1], dir[0]);
        const horiz = Math.abs(angle % 3) < 1 ? 1 : 0;
        const vert = 1 - horiz;
        const width = globalScale * p.aspect;
        const scale = [
            2 * width * horiz + 0.1 * vert,
            2 * globalScale,
            2 * width * vert + 0.1 * horiz];
        const text = null;
        const d1 = width / segLen;
        const d2 = 0.005 / Math.hypot(norm[0], norm[1]);
        const vseg = [
            [pos[0] - dir[0] * d1 * 2, pos[2] - dir[1] * d1],
            [pos[0] + dir[0] * d1 * 2, pos[2] + dir[1] * d1]
        ];
        pos[0] -= dir[0] * d1 + norm[0] * d2;
        pos[2] -= dir[1] * d1 + norm[1] * d2;
        const model = [];
        mat4.fromTranslation(model, pos);
        mat4.scale(model, model, scale);
        mat4.rotateY(model, model, -angle);
        const textmodel = [];
        mat4.fromTranslation(textmodel, [pos[0], 2.1 + globalScale, pos[2]]);
        mat4.scale(textmodel, textmodel, [2,2,2]);
        mat4.rotateY(textmodel, textmodel, -angle);
        batch[placementIndex] = { ...p, vseg, angle, model, textmodel, text, width, clickHalfHeight: globalScale, textGen:null,
            pos: [...pos], dir: [...dir], segLen, globalScale, horiz, vert };
        addSurveyFlyer(batch[placementIndex], placementIndex);
        createMannequin(batch[placementIndex]);
    };

    texture.fetch(regl, 40, dynamicRes, loadPainting, () => fetching = false);
    return {
        update: (pos, angle, fovX) => {
            let index = getAreaIndex(pos[0], pos[2], 4);
            if (index === -1) return;
            batch.slice(0, Math.max(0, index - unloadDist)).map(t => texture.unload(t));
            batch.slice(index + unloadDist).map(t => texture.unload(t));
            shownBatch = batch.slice(Math.max(0, index - renderDist), index + renderDist).filter(Boolean);
            shownBatch = shownBatch.concat(surveyBatch.slice(Math.max(0, index - renderDist), index + renderDist).filter(Boolean));
            if (mannequinBatch) shownBatch = shownBatch.concat([mannequinBatch]);
            shownBatch.map(t => texture.load(regl, t, dynamicRes));
            shownBatch = shownBatch.filter(t => t.tex && (t.isMannequinPrototype || culling(pos, angle, fovX, t)));
            if (index <= batch.length - loadDist) return;
            if (!fetching) {
                texture.fetch(regl, 10, dynamicRes, loadPainting, () => fetching = false);
                fetching = true;
            }
            dynamicRes = "low";
            if (dynamicResTimer) clearTimeout(dynamicResTimer);
            dynamicResTimer = setTimeout(() => dynamicRes = "high", dynamicResPeriod);
        },
        batch: () => shownBatch
    };
};
