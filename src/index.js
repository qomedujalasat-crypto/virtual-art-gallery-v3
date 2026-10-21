'use strict';

// Disable the inverted mirrored pass while keeping the gallery view upright.
var useReflexion = false;
var showStats = false;

// Handle different screen ratios
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);
var fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.7, Math.PI / 3);

if (navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)) {
	useReflexion = false;
	// Account for the searchbar
	fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.5, Math.PI / 3);
}
var fovY = () => 2 * Math.atan(Math.tan(fovX() * 0.5) * window.innerHeight / window.innerWidth);

const Stats = require('stats.js');
var stats = new Stats();
stats.showPanel(0);
if(showStats) {
	document.body.appendChild( stats.dom );
}

let regl, map, drawMap, placement, drawPainting, fps;

regl = require('regl')({
	extensions: [
		//'angle_instanced_arrays',
		'OES_element_index_uint',
		'OES_standard_derivatives'
	],
	optionalExtensions: [
		//'oes_texture_float',
		'EXT_texture_filter_anisotropic'
	],
	attributes: { alpha : true }
});

map = require('./map')();
const mesh = require('./mesh');
drawMap = mesh(regl, map, useReflexion);
placement = require('./placement')(regl, map);
drawPainting = require('./painting')(regl);
fps = require('./fps')(map, fovY);

const context = regl({
	cull: {
		enable: true,
		face: 'back'
	},
	uniforms: {
		view: fps.view,
		proj: fps.proj,
		yScale: 1.0
	}
});

const reflexion = regl({
	cull: {
		enable: true,
		face: 'front'
	},
	uniforms: {
		yScale: -1.0
	},
	depth: { enable: true, mask: false }
});

// Click a wall flyer to open the survey, or an artwork to download it.
document.addEventListener('click', (event) => {
	if (!event.target || event.target.tagName !== 'CANVAS') return;
	const clickYaw = fps.fmouse[1] + ((event.clientX / window.innerWidth) - 0.5) * fovX();
	const candidates = placement.batch().filter(p => p.file && !p.isMannequinPrototype);
	let best = null, bestDiff = Infinity;
	for (const p of candidates) {
		if (!p.pos || !p.dir || !p.segLen || !p.width) continue;
		const cx = p.pos[0] + (p.dir[0] / p.segLen) * p.width;
		const cz = p.pos[2] + (p.dir[1] / p.segLen) * p.width;
		const targetYaw = Math.atan2(cx - fps.pos[0], fps.pos[2] - cz);
		const diff = Math.abs(Math.atan2(Math.sin(targetYaw - clickYaw), Math.cos(targetYaw - clickYaw)));
		const distance = Math.hypot(cx - fps.pos[0], cz - fps.pos[2]);
		if (diff < bestDiff && diff < 0.28 && distance < 25) {
			best = p;
			bestDiff = diff;
		}
	}
	if (!best) return;
	if (best.isSurveyFlyer) {
		window.open('https://digiform.ir/wab710d2e6', '_blank', 'noopener,noreferrer');
		return;
	}
	const link = document.createElement('a');
	link.href = 'images/' + encodeURIComponent(best.file).replace(/%2F/g, '/');
	link.download = best.file;
	document.body.appendChild(link);
	link.click();
	link.remove();
});

regl.frame(({
	time
}) => {
	stats.begin();
	fps.tick({
		time
	});
	placement.update(fps.pos, fps.fmouse[1], fovX());
	regl.clear({
		color: [0, 0, 0, 1],
		depth: 1
	});
	context(() => {
		if(useReflexion) {
			reflexion(() => {
				drawMap();
				drawPainting(placement.batch());
			});
		}
		drawMap();
		drawPainting(placement.batch());
	});
	stats.end();
});