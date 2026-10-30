<template>
	<!-- Pellet / screw extruder as an industrial panel: every part is tappable (the parent opens its editor).
	     READ ONLY here: the component only draws and says what was tapped. -->
	<div class="hmi">
		<svg :viewBox="'0 0 ' + view.w + ' ' + view.h" role="img" :aria-label="$t('plugins.WorkshopPrinting.pellet.hmi_aria')">
			<defs>
				<linearGradient id="hmiMetal" x1="0" x2="1">
					<stop offset="0" stop-color="#90a4ae" stop-opacity="0.35" />
					<stop offset="0.5" stop-color="#eceff1" stop-opacity="0.28" />
					<stop offset="1" stop-color="#78909c" stop-opacity="0.4" />
				</linearGradient>
			</defs>

			<template v-if="!horizontal">
			<!-- hopper and feeding: the pellet enters through the throat; tap it to define or run the feeding -->
			<g class="part" :class="{ sel: isSel('feed', 0) }" @click="$emit('select', { type: 'feed', id: 0 })">
				<polygon points="40,70 200,70 262,132 262,160 200,160 150,128 40,128" class="hopper" />
				<circle v-for="(q, n) in g.pellets" :key="'p' + n" :cx="q[0]" :cy="q[1]" r="4" class="pellet" />
				<text x="120" y="62" class="lab dim" text-anchor="middle">{{ $t('plugins.WorkshopPrinting.pellet.hopper_pellet') }}</text>
				<text x="40" y="146" class="lab bold" :fill="feed.color">{{ feed.title }}: {{ feed.modeText }}</text>
				<text x="40" y="162" class="lab" :fill="feed.color">{{ feed.levelText }}</text>
			</g>

			<!-- motor + gearbox -->
			<g class="part" :class="{ sel: isSel('motor', 0) }" @click="$emit('select', { type: 'motor', id: 0 })">
				<rect x="300" y="8" width="100" height="62" rx="6" class="body" />
				<rect x="320" y="70" width="60" height="22" class="metal" />
				<circle cx="350" cy="39" r="19" class="rotor" />
				<g :style="spin(motor.speedTurn)" class="spinner"><path d="M350 24 L354 39 L350 54 L346 39 Z M335 39 L350 35 L365 39 L350 43 Z" class="blades" /></g>
				<text x="350" y="44" class="lab bold" text-anchor="middle" fill="#fff">{{ motor.label }}</text>
				<circle cx="388" cy="18" r="5" :fill="motor.running ? '#2e7d32' : '#616161'" />
			</g>

			<!-- throat with its cooling fans (left of the barrel) -->
			<rect x="320" y="92" width="60" height="58" class="throat" />
			<text x="312" y="126" class="lab dim" text-anchor="end">{{ $t('plugins.WorkshopPrinting.pellet.throat') }}</text>

			<!-- barrel -->
			<rect x="320" y="150" width="60" :height="g.barrelEnd - 150" class="body" fill="url(#hmiMetal)" />
			<path :d="g.helix" class="screw" :class="{ run: motor.running }" :style="motor.running ? spin2(motor.speedTurn) : null" />
			<!-- heater bands: colour = temperature, bar on the left = heater power -->
			<g v-for="b in g.bands" :key="'z' + b.z.id" class="part band" :class="{ sel: isSel('zone', b.k) }" @click="$emit('select', { type: 'zone', id: b.k })">
				<rect x="306" :y="b.y" width="88" :height="b.h" rx="5" :fill="b.glow" class="bandrect" />
				<rect x="294" :y="b.y" width="7" :height="b.h" rx="2" class="pwmback" />
				<rect x="294" :y="b.y + b.h * (1 - b.pwm)" width="7" :height="b.h * b.pwm" rx="2" :fill="b.color" />
				<text x="350" :y="b.y + b.h / 2 + 5" class="etb" text-anchor="middle">{{ b.k + 1 }}</text>
				<!-- the callout, like the value boxes of an industrial panel -->
				<line x1="394" :y1="b.y + b.h / 2" x2="440" :y2="b.y + b.h / 2" class="lead" />
				<rect x="440" :y="b.y - 2" width="240" :height="b.h + 4" rx="5" class="box" :stroke="b.color" />
				<text x="450" :y="b.y + 14" class="lab dim">{{ b.title }}</text>
				<text x="450" :y="b.y + b.h - 6" class="pv" :fill="b.color">{{ b.pv }}</text>
				<text x="538" :y="b.y + b.h - 6" class="lab">{{ b.sp }}</text>
				<text x="670" :y="b.y + 14" class="lab dim" text-anchor="end">{{ b.pwmText }}</text>
				<text x="674" :y="b.y + b.h - 6" class="lab" :fill="b.color" text-anchor="end" style="font-size:10px">{{ b.stateText.length > 15 ? b.stateText.slice(0, 14) + '…' : b.stateText }}</text>
			</g>

			<!-- nozzle -->
			<polygon :points="'332,' + g.barrelEnd + ' 368,' + g.barrelEnd + ' 357,' + (g.barrelEnd + 26) + ' 343,' + (g.barrelEnd + 26)" class="metal" />
			<circle v-if="motor.running" cx="350" :cy="g.barrelEnd + 34" r="3.5" class="drop" />

			<!-- fans: throat cooling (left of the throat) and the ones that blow at the nozzle / part -->
			<g v-for="f in g.fans" :key="'f' + f.id" class="part" :class="{ sel: isSel('fan', f.id) }" @click="$emit('select', { type: 'fan', id: f.id })">
				<rect :x="f.x - 22" :y="f.y - 22" width="44" height="44" rx="6" class="fanbox" />
				<circle :cx="f.x" :cy="f.y" r="15" class="fan" />
				<circle :cx="f.x" :cy="f.y" r="20" class="ringtrack" />
				<circle :cx="f.x" :cy="f.y" r="20" class="ring" :class="'ring-' + f.state" :stroke-dasharray="(125.66 * f.ring) + ' 125.66'" :transform="'rotate(-90 ' + f.x + ' ' + f.y + ')'" />
				<g :style="spin(f.turn)" class="spinner" :transform-origin="f.x + ' ' + f.y"><path :d="f.blades" class="blades" /></g>
				<line :x1="f.side === 'right' ? f.x - 22 : f.x + 22" :y1="f.y" :x2="f.target" :y2="f.y" class="lead dashed" />
				<text :x="f.x" :y="f.y + 36" class="lab" text-anchor="middle">{{ f.label }}</text>
				<text :x="f.x" :y="f.y + 50" class="lab dim" text-anchor="middle">{{ f.text }}</text>
			</g>

			<!-- motor callout -->
			<g class="part" :class="{ sel: isSel('motor', 0) }" @click="$emit('select', { type: 'motor', id: 0 })">
				<rect x="440" y="8" width="240" height="62" rx="5" class="box" :stroke="motor.running ? '#2e7d32' : '#616161'" />
				<text x="450" y="24" class="lab dim">{{ motor.title }}</text>
				<text x="450" y="54" class="pv" :fill="motor.running ? '#2e7d32' : 'currentColor'">{{ motor.rateText }}</text>
				<text x="670" y="24" class="lab dim" text-anchor="end">{{ motor.driveText }}</text>
				<text x="670" y="54" class="lab" text-anchor="end">{{ motor.stateText }}</text>
			</g>
			</template>
			<!-- HORIZONTAL: the motor on the left, the barrel to the right, the nozzle at the end; values below each band -->
			<template v-else>
				<g class="part" :class="{ sel: isSel('feed', 0) }" @click="$emit('select', { type: 'feed', id: 0 })">
					<polygon :points="'108,24 222,24 198,76 198,102 134,102 134,76'" class="hopper" />
					<circle v-for="(q, n) in h.pellets" :key="'p' + n" :cx="q[0]" :cy="q[1]" r="4" class="pellet" />
					<text x="165" y="16" class="lab dim" text-anchor="middle">{{ $t('plugins.WorkshopPrinting.pellet.hopper_pellet') }}</text>
					<text x="8" y="34" class="lab bold" :fill="feed.color">{{ feed.title }}</text>
					<text x="8" y="50" class="lab" :fill="feed.color">{{ feed.modeText }}</text>
					<text x="8" y="66" class="lab" :fill="feed.color">{{ feed.levelText }}</text>
				</g>

				<g class="part" :class="{ sel: isSel('motor', 0) }" @click="$emit('select', { type: 'motor', id: 0 })">
					<rect x="8" y="99" width="104" height="62" rx="6" class="body" />
					<rect x="112" y="110" width="22" height="40" class="metal" />
					<circle cx="60" cy="130" r="19" class="rotor" />
					<g :style="spin(motor.speedTurn)" class="spinner"><path d="M60 115 L64 130 L60 145 L56 130 Z M45 130 L60 126 L75 130 L60 134 Z" class="blades" /></g>
					<text x="60" y="135" class="lab bold" text-anchor="middle" fill="#fff">{{ motor.label }}</text>
					<circle cx="100" cy="109" r="5" :fill="motor.running ? '#2e7d32' : '#616161'" />
				</g>

				<rect x="134" y="102" width="64" height="56" class="throat" />
				<text x="166" y="170" class="lab dim" text-anchor="middle">{{ $t('plugins.WorkshopPrinting.pellet.throat') }}</text>

				<rect :x="h.x0" y="102" :width="h.end - h.x0" height="56" class="body" fill="url(#hmiMetal)" />
				<path :d="h.helix" class="screw" :class="{ run: motor.running }" :style="motor.running ? spin2(motor.speedTurn) : null" />
				<g v-for="b in h.bands" :key="'z' + b.z.id" class="part band" :class="{ sel: isSel('zone', b.k) }" @click="$emit('select', { type: 'zone', id: b.k })">
					<rect :x="b.x" y="94" :width="b.w" height="72" rx="5" :fill="b.glow" class="bandrect" />
					<rect :x="b.x" y="170" :width="b.w" height="7" rx="2" class="pwmback" />
					<rect :x="b.x" y="170" :width="b.w * b.pwm" height="7" rx="2" :fill="b.color" />
					<text :x="b.x + b.w / 2" y="136" class="etb" text-anchor="middle">{{ b.k + 1 }}</text>
					<line :x1="b.x + b.w / 2" y1="177" :x2="b.x + b.w / 2" y2="196" class="lead" />
					<rect :x="b.x" y="196" :width="b.w" height="86" rx="5" class="box" :stroke="b.color" />
					<text :x="b.x + 6" y="212" class="lab dim">{{ b.titleShort }}</text>
					<text :x="b.x + 6" y="236" class="pv" :fill="b.color">{{ b.pv }}</text>
					<text :x="b.x + 6" y="254" class="lab">{{ b.sp }}</text>
					<text :x="b.x + 6" y="266" class="lab dim">{{ b.pwmText }}</text>
					<text :x="b.x + 6" y="276" class="lab" :fill="b.color" style="font-size:11px">{{ b.stateText.length > 15 ? b.stateText.slice(0, 14) + '…' : b.stateText }}</text>
				</g>
				<polygon :points="h.end + ',114 ' + h.end + ',146 ' + (h.end + 30) + ',136 ' + (h.end + 30) + ',124'" class="metal" />
				<circle v-if="motor.running" :cx="h.end + 34" cy="140" r="3.5" class="drop" />

				<g v-for="f in h.fans" :key="'f' + f.id" class="part" :class="{ sel: isSel('fan', f.id) }" @click="$emit('select', { type: 'fan', id: f.id })">
					<rect :x="f.x - 22" :y="f.y - 22" width="44" height="44" rx="6" class="fanbox" />
					<circle :cx="f.x" :cy="f.y" r="15" class="fan" />
				<circle :cx="f.x" :cy="f.y" r="20" class="ringtrack" />
				<circle :cx="f.x" :cy="f.y" r="20" class="ring" :class="'ring-' + f.state" :stroke-dasharray="(125.66 * f.ring) + ' 125.66'" :transform="'rotate(-90 ' + f.x + ' ' + f.y + ')'" />
					<g :style="spin(f.turn)" class="spinner"><path :d="f.blades" class="blades" /></g>
					<line :x1="f.x" :y1="f.y + (f.up ? 22 : -22)" :x2="f.x" :y2="f.up ? 102 : 158" class="lead dashed" />
					<text :x="f.x" :y="f.y + (f.up ? -30 : 36)" class="lab" text-anchor="middle">{{ f.label }}</text>
					<text :x="f.x" :y="f.y + (f.up ? -43 : 50)" class="lab dim" text-anchor="middle">{{ f.text }}</text>
				</g>

				<g class="part" :class="{ sel: isSel('motor', 0) }" @click="$emit('select', { type: 'motor', id: 0 })">
					<rect x="8" y="196" width="150" height="86" rx="5" class="box" :stroke="motor.running ? '#2e7d32' : '#616161'" />
					<text x="14" y="212" class="lab dim">{{ motor.title }}</text>
					<text x="14" y="240" class="pv" :fill="motor.running ? '#2e7d32' : 'currentColor'">{{ motor.rateText }}</text>
					<text x="14" y="258" class="lab">{{ motor.stateText }}</text>
					<text x="14" y="274" class="lab dim">{{ motor.driveText }}</text>
				</g>
			</template>
		</svg>
		<div class="legend text-caption">
			<span><i style="background:#2e7d32" />{{ $t('plugins.WorkshopPrinting.pellet.at_temperature') }}</span>
			<span><i style="background:#ff8f00" />{{ $t('plugins.WorkshopPrinting.pellet.heating') }}</span>
			<span><i style="background:#e65100" />{{ $t('plugins.WorkshopPrinting.pellet.overshot') }}</span>
			<span><i style="background:#c62828" />{{ $t('plugins.WorkshopPrinting.pellet.fault_no_sensor') }}</span>
			<span><i style="background:#616161" />{{ $t('plugins.WorkshopPrinting.pellet.off') }}</span>
			<span class="grey--text">{{ $t('plugins.WorkshopPrinting.pellet.hmi_legend_bar') }}</span>
			<span class="grey--text">{{ $t('plugins.WorkshopPrinting.pellet.hmi_legend_fan') }}</span>
		</div>
	</div>
</template>

<script>
'use strict'

import { COLORS, zoneState, glow, glowColor, spinSeconds, fanSpin, fanState } from './pellet-hmi.js'

export default {
	props: {
		zones: { type: Array, default: () => [] }, // heaters of the tool, zone 1 = nozzle (bottom)
		fansThroat: { type: Array, default: () => [] },
		fansTool: { type: Array, default: () => [] },
		motor: { type: Object, required: true }, // {label, title, rateText, driveText, stateText, running, speedTurn}
		selected: { type: Object, default: () => ({ type: 'zone', id: 0 }) },
		orientation: { type: String, default: 'vertical' }, // 'vertical' | 'horizontal'
		feed: { type: Object, default: () => ({ title: '', modeText: '', levelText: '', color: '#9e9e9e' }) }
	},
	computed: {
		horizontal() {
			return this.orientation === 'horizontal';
		},
		view() {
			return this.horizontal ? { w: this.h.width, h: this.h.height } : { w: 700, h: this.g.height };
		},
		// horizontal layout: same data, the barrel runs to the right and every value sits under its band
		h() {
			const n = Math.max(1, this.zones.length);
			const bw = 104;
			const x0 = 198;
			const end = x0 + n * bw;
			const bands = this.zones.map((z, k) => {
				const x = end - (k + 1) * bw + 4;
				const st = zoneState(z);
				const pwm = Math.max(0, Math.min(1, Number(z.pwm) || 0));
				const base = this.bandData(z, k, st, pwm);
				return Object.assign(base, { x, w: bw - 8, titleShort: k === 0 ? 'Z1 · ' + this.$t('plugins.WorkshopPrinting.pellet.nozzle') : 'Z' + (k + 1) });
			});
			let helix = '';
			for (let x = 140; x < end - 6; x += 14) helix += 'M' + x + ' 106 L' + (x + 9) + ' 154 ';
			const aspas = (x, y) => `M${x} ${y - 11} L${x + 3.5} ${y} L${x} ${y + 11} L${x - 3.5} ${y} Z M${x - 11} ${y} L${x} ${y - 3.5} L${x + 11} ${y} L${x} ${y + 3.5} Z`;
			const fans = [];
			// throat fans under the throat; the ones that blow at the nozzle above the end of the barrel
			this.fansThroat.forEach((f, i) => {
				const x = 166, y = 316 + i * 78;
				fans.push({ id: f.id, x, y, up: false, blades: aspas(x, y), turn: fanSpin(f), state: fanState(f), ring: Math.min(1, f.value || 0), label: f.name, text: this.fanText(f) });
			});
			this.fansTool.forEach((f, i) => {
				const x = end + 20 + (i % 2) * 70, y = 56 + Math.floor(i / 2) * 78;
				fans.push({ id: f.id, x, y, up: true, blades: aspas(x, y), turn: fanSpin(f), state: fanState(f), ring: Math.min(1, f.value || 0), label: f.name, text: this.fanText(f) });
			});
			const nTool = this.fansTool.length;
			const cols = Math.min(2, Math.max(1, nTool));
			const width = Math.max(420, end + 30 + 20 + cols * 70 + 12);
			const height = this.fansThroat.length ? 316 + this.fansThroat.length * 78 : 296;
			return {
				x0, end, bands, helix, fans, width, height,
				pellets: [[130, 40], [150, 48], [172, 38], [196, 46], [160, 62], [186, 62], [142, 70], [208, 36], [120, 34], [176, 74]]
			};
		},
		g() {
			const n = Math.max(1, this.zones.length);
			const h1 = 58;
			const barrelEnd = 150 + n * h1;
			const bands = this.zones.map((z, k) => {
				const y = barrelEnd - (k + 1) * h1 + 4;
				const pwm = Math.max(0, Math.min(1, Number(z.pwm) || 0));
				return Object.assign(this.bandData(z, k, zoneState(z), pwm), { y, h: h1 - 8 });
			});
			let helix = '';
			for (let y = 96; y < barrelEnd - 6; y += 14) helix += 'M324 ' + y + ' L376 ' + (y + 9) + ' ';
			const aspas = (x, y) => `M${x} ${y - 11} L${x + 3.5} ${y} L${x} ${y + 11} L${x - 3.5} ${y} Z M${x - 11} ${y} L${x} ${y - 3.5} L${x + 11} ${y} L${x} ${y + 3.5} Z`;
			const fans = [];
			const place = (list, y0, targetX, x0) => list.forEach((f, i) => {
				const x = x0 - (i % 2) * 70;
				const y = y0 + Math.floor(i / 2) * 78;
				fans.push({
					id: f.id, x, y, target: targetX, blades: aspas(x, y), turn: fanSpin(f), state: fanState(f), ring: Math.min(1, f.value || 0),
					label: f.name, text: this.fanText(f)
				});
			});
			// the throat fans go to the RIGHT of the throat (the hopper is on its left), in a row between the motor box and the first zone box
			this.fansThroat.forEach((f, i) => {
				const x = 445 + (i % 3) * 100, y = 100 + Math.floor(i / 3) * 78;
				fans.push({
					id: f.id, x, y, target: 382, side: 'right', blades: aspas(x, y), turn: fanSpin(f), state: fanState(f), ring: Math.min(1, f.value || 0),
					label: f.name, text: this.fanText(f)
				});
			});
			place(this.fansTool, barrelEnd - 30, 330, 262);
			const maxY = fans.reduce((m, f) => Math.max(m, f.y + 56), 0);
			return {
				bands, helix, fans, barrelEnd,
				pellets: [[60, 100], [80, 108], [100, 96], [124, 110], [146, 102], [168, 118], [98, 118], [190, 132], [70, 120], [132, 122]],
				height: Math.max(barrelEnd + 70, maxY + 10)
			};
		}
	},
	methods: {
		// what a band shows, the same in both layouts
		bandData(z, k, st, pwm) {
			return {
				z, k, color: COLORS[st], glow: glowColor(glow(z)), pwm,
				title: (k === 0 ? this.$t('plugins.WorkshopPrinting.common.zone_1_nozzle') : this.$t('plugins.WorkshopPrinting.common.zone') + (k + 1)) + ' · H' + z.id,
				pv: (z.sensorBad ? '--' : Math.round(z.current)) + ' °C',
				sp: 'SP ' + (z.target > 0 ? Math.round(z.target) + ' °C' : '--'),
				pwmText: z.pwm != null ? this.$t('plugins.WorkshopPrinting.pellet.hmi_power', { n: Math.round(pwm * 100) }) : '',
				stateText: this.stateText(z, st)
			};
		},
		// the board only reports the ORDER; a fan is said to turn only when its tachometer reads rpm
		fanText(f) {
			const n = Math.round((f.value || 0) * 100);
			const st = fanState(f);
			let t = st === 'ordered' ? this.$t('plugins.WorkshopPrinting.pellet.hmi_ordered', { n }) : n + ' %';
			if (st === 'turning') t += ' · ' + Math.round(f.rpm) + ' rpm';
			if (st === 'stalled') t += ' · ' + this.$t('plugins.WorkshopPrinting.pellet.hmi_no_spin');
			return t + (f.thermostatic ? ' · ' + this.$t('plugins.WorkshopPrinting.pellet.hmi_auto') : '');
		},
		isSel(type, id) {
			return !!this.selected && this.selected.type === type && this.selected.id === id;
		},
		stateText(z, st) {
			if (st === 'fault') return z.sensorBad ? this.$t('plugins.WorkshopPrinting.common.no_sensor') : this.$t('plugins.WorkshopPrinting.pellet.st_fault');
			if (st === 'tuning') return this.$t('plugins.WorkshopPrinting.pellet.st_tuning');
			if (st === 'off') return z.current > 50 ? this.$t('plugins.WorkshopPrinting.pellet.off_still_hot') : this.$t('plugins.WorkshopPrinting.pellet.st_off');
			if (st === 'over') return this.$t('plugins.WorkshopPrinting.pellet.hotter_than_the_target');
			if (st === 'ok') return this.$t('plugins.WorkshopPrinting.pellet.at_temperature');
			return this.$t('plugins.WorkshopPrinting.pellet.st_heating');
		},
		// one turn takes `s` seconds (0 = still); the screw uses a faster look than the blades
		spin(s) {
			return s > 0 ? { animationDuration: s + 's', animationPlayState: 'running' } : { animation: 'none' };
		},
		spin2(s) {
			return { animationDuration: Math.max(0.4, s / 2) + 's' };
		}
	}
};
</script>

<style scoped>
.hmi {
	width: 100%;
}
.hmi svg {
	width: 100%;
	display: block;
	max-width: 760px;
}
.lab {
	font-size: 12px;
	fill: currentColor;
}
.lab.dim,
.dim {
	opacity: 0.7;
}
.lab.bold {
	font-weight: 700;
}
.pv {
	font-size: 20px;
	font-weight: 700;
}
.etb {
	font-size: 16px;
	font-weight: 700;
	fill: #fff;
	pointer-events: none;
}
.body,
.metal {
	fill: rgba(128, 128, 128, 0.28);
	stroke: rgba(128, 128, 128, 0.7);
	stroke-width: 1.5;
}
.throat {
	fill: rgba(25, 118, 210, 0.14);
	stroke: rgba(128, 128, 128, 0.7);
	stroke-width: 1.5;
}
.hopper {
	fill: rgba(128, 128, 128, 0.12);
	stroke: rgba(128, 128, 128, 0.7);
	stroke-width: 1.5;
}
.pellet {
	fill: rgba(128, 128, 128, 0.55);
}
.rotor {
	fill: rgba(33, 33, 33, 0.55);
	stroke: rgba(255, 255, 255, 0.35);
}
.screw {
	fill: none;
	stroke: rgba(236, 239, 241, 0.75);
	stroke-width: 3;
	stroke-linecap: round;
	pointer-events: none;
}
.screw.run {
	stroke-dasharray: 9 6;
	animation: hmi-screw 1.2s linear infinite;
}
@keyframes hmi-screw {
	to {
		stroke-dashoffset: -15;
	}
}
.spinner {
	transform-box: fill-box;
	transform-origin: center;
	animation: hmi-spin 1s linear infinite;
}
@keyframes hmi-spin {
	to {
		transform: rotate(360deg);
	}
}
.blades {
	fill: rgba(236, 239, 241, 0.85);
}
.drop {
	fill: #ff8f00;
	animation: hmi-drop 0.9s ease-in infinite;
}
@keyframes hmi-drop {
	from {
		transform: translateY(0);
		opacity: 1;
	}
	to {
		transform: translateY(16px);
		opacity: 0;
	}
}
.part {
	cursor: pointer;
}
.part:hover .hopper,
.part.sel .hopper,
.part:hover .bandrect,
.part:hover .box,
.part:hover .fanbox,
.part:hover .body {
	stroke: currentColor;
	stroke-width: 2.5;
}
.part.sel .bandrect,
.part.sel .box,
.part.sel .fanbox,
.part.sel .body {
	stroke: #1976d2;
	stroke-width: 3.5;
}
.bandrect {
	stroke: rgba(0, 0, 0, 0.35);
	stroke-width: 1;
	opacity: 0.92;
}
.pwmback {
	fill: rgba(128, 128, 128, 0.3);
}
.box,
.fanbox {
	fill: rgba(0, 0, 0, 0.18);
	stroke: rgba(128, 128, 128, 0.6);
	stroke-width: 1.5;
}
.lead {
	stroke: rgba(128, 128, 128, 0.7);
	stroke-width: 1.5;
}
.lead.dashed {
	stroke-dasharray: 4 4;
}
.ringtrack {
	fill: none;
	stroke: rgba(128, 128, 128, 0.25);
	stroke-width: 3;
}
.ring {
	fill: none;
	stroke: #ff8f00;
	stroke-width: 3;
	pointer-events: none;
}
.ring-turning {
	stroke: #2e7d32;
}
.ring-stalled {
	stroke: #c62828;
}
.fan {
	fill: rgba(128, 128, 128, 0.15);
	stroke: rgba(128, 128, 128, 0.7);
	stroke-width: 1.5;
}
.legend {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 12px;
	margin-top: 4px;
}
.legend i {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 2px;
	margin-right: 4px;
	vertical-align: -1px;
}
</style>
