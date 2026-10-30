<template>
	<pc-section icon="mdi-swap-horizontal" :title="$t('plugins.WorkshopPrinting.printing.head_change')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.headChange.wizard_to_change_the_head_steps') }}
			</p>
		</details>

		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.headChange.switch_from') }} <b>{{ nameMode(origin) || '...' }}</b> {{ $t('plugins.WorkshopPrinting.headChange.to') }}</span>
			<v-btn v-if="origin !== mode && mode" x-small text @click="beginOfNew()">{{ $t('plugins.WorkshopPrinting.headChange.start_over_from', { mode: nameMode(mode) }) }}</v-btn>
			<v-btn-toggle v-model="destination" mandatory dense color="primary">
				<v-btn v-for="m in targets" :key="m" small :value="m">{{ nameMode(m) }}</v-btn>
			</v-btn-toggle>
		</div>

		<div class="mt-3">
			<div v-for="(p, k) in steps" :key="destination + k" class="step" :class="{ done: done(k), current: k === next }">
				<div class="step-num">
					<v-icon v-if="done(k)" small color="white">mdi-check</v-icon>
					<span v-else>{{ k + 1 }}</span>
				</div>
				<div class="step-body">
					<div class="text-body-2" :class="{ 'font-weight-medium': k === next }">{{ p.text }}</div>
					<div v-if="p.detail" class="text-caption grey--text">{{ p.detail }}</div>
					<div class="mt-1">
						<v-checkbox v-if="p.kind === 'manual'" :input-value="done(k)" :disabled="k > next" dense hide-details class="mt-0"
							:label="p.check || $t('plugins.WorkshopPrinting.headChange.done')" @change="mark(k, $event)" />
						<template v-else-if="p.kind === 'action'">
							<v-btn x-small :color="armed === k ? 'amber darken-3' : done(k) ? '' : 'primary'" :outlined="done(k)"
								:disabled="k > next || busy || !!block(p) || (p.can && !p.can())" @click="touch(k)">
								{{ armed === k ? $t('plugins.WorkshopPrinting.common.tap_again') : done(k) ? $t('plugins.WorkshopPrinting.headChange.again') : p.button }}
							</v-btn>
							<span v-if="k === next && block(p)" class="text-caption warning--text ml-2">{{ block(p) }}</span>
							<span v-else-if="p.can && !p.can() && p.because" class="text-caption warning--text ml-2">{{ p.because() }}</span>
						</template>
						<div v-else-if="p.kind === 'auto'" class="text-caption" :class="p.ok() ? 'success--text' : 'warning--text'">
							{{ p.state() }}
						</div>
					</div>
				</div>
			</div>
		</div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
		<v-alert v-if="next >= steps.length" dense text type="success" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopPrinting.headChange.ready_machine_in_mode', { mode: nameMode(destination) }) }}
		</v-alert>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)

'use strict'

import { mapActions } from 'vuex'
import { isError } from './util.js'
import { pathExists } from './workshop-ids.js' // the Workbench is another plugin: nothing about it when it is absent
import { nozzleState } from './nozzle-state.js'
import { machineFree } from './machine-free.js' // trabajo de archivo, pausado o en vivo (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'

const MACRO_MODE = { FFF: '0:/macros/mode/selectfff.g', Laser: '0:/macros/mode/selectlaser.g', CNC: '0:/macros/mode/selectcnc.g' };
const cold = 50; // °C: below it the nozzle can be removed

export default {
	components: { PcSection },
	props: {
		mode: { type: String, default: '' },
		state: { type: String, default: '' },
		homed: { type: Boolean, default: false },
		nozzle: { type: Object, default: null },
		// names of the modes the machine uses (machine-modes.js); null = not known, all of them
		modes: { type: Array, default: null }
	},
	data() {
		return { origin: '', destination: null, doneMap: {}, armed: null, armedTimer: null, busy: false, msg: null, msgKind: 'info' };
	},
	computed: {
		targets() {
			return ['FFF', 'Laser', 'CNC'].filter(m => m !== this.origin && (!this.modes || this.modes.indexOf(m) >= 0));
		},
		z() {
			const ax = (this.$store.state.machine.model.move && this.$store.state.machine.model.move.axes) || [];
			return ax.find(a => a && a.letter === 'Z') || null;
		},
		steps() {
			const aFFF = this.destination === 'FFF';
			const hasWorkbench = pathExists(this.$router, '/Plugins/Workbench');
			const since = this.origin === 'FFF'; // the mode it started with (does not change when changing mode)
			const raiseZ = {
				kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.raise_z_30_mm_to_make'), button: i18n.t('plugins.WorkshopPrinting.headChange.raise_z'),
				detail: i18n.t('plugins.WorkshopPrinting.headChange.moves_the_machine_if_z_is'),
				can: () => !!this.z && this.z.homed && this.z.machinePosition + 30 <= this.z.max,
				because: () => (!this.z || !this.z.homed ? i18n.t('plugins.WorkshopPrinting.headChange.z_not_homed') : i18n.t('plugins.WorkshopPrinting.headChange.there_are_not_30_mm_above')),
				free: 'move',
				// a single request (motion audit, finding 10): separate, another client of the same
				// channel could end up between the G91 and the G90 and move in relative
				codes: ['G91\nG1 Z30 F600 S0\nG90']
			};
			const p = [];
			if (since) {
				p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.turn_off_the_nozzle_and_the'), button: i18n.t('plugins.WorkshopPrinting.headChange.turn_off'), codes: this.codesPowerOff() });
				// a sensor that is not connected reads -273 C: that is not "cold", nobody knows: the person checks it by hand
				const ns = nozzleState(this.nozzle, cold);
				if (ns === 'unreadable') {
					p.push({
						kind: 'manual', text: i18n.t('plugins.WorkshopPrinting.headChange.wait_for_nozzle_to_cool', { c: cold }),
						check: i18n.t('plugins.WorkshopPrinting.headChange.nozzle_no_reading_check')
					});
				} else {
					p.push({
						kind: 'auto', text: i18n.t('plugins.WorkshopPrinting.headChange.wait_for_nozzle_to_cool', { c: cold }),
						ok: () => nozzleState(this.nozzle, cold) !== 'hot',
						state: () => {
							if (!this.nozzle) return i18n.t('plugins.WorkshopPrinting.headChange.no_nozzle_ready');
							const c = Math.round(this.nozzle.current);
							return nozzleState(this.nozzle, cold) === 'hot' ? i18n.t('plugins.WorkshopPrinting.headChange.nozzle_at_c_still_hot', { c }) : i18n.t('plugins.WorkshopPrinting.headChange.nozzle_at_c_ready', { c });
						}
					});
				}
			} else {
				p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.turn_off_the_laser_or_the'), button: i18n.t('plugins.WorkshopPrinting.headChange.turn_off'), codes: ['M5'] });
			}
			p.push(raiseZ);
			p.push({
				kind: 'manual',
				text: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.remove_the_laser_or_the_spindle') : (this.destination === 'Laser' ? i18n.t('plugins.WorkshopPrinting.headChange.remove_pellet_extruder_mount_laser') : i18n.t('plugins.WorkshopPrinting.headChange.remove_pellet_extruder_mount_spindle')),
				detail: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.connect_the_heater_the_thermistor_the') : i18n.t('plugins.WorkshopPrinting.headChange.disconnect_the_extruder_s_heater_and'),
				check: i18n.t('plugins.WorkshopPrinting.headChange.i_changed_the_head')
			});
			if (aFFF) p.push({ kind: 'manual', text: i18n.t('plugins.WorkshopPrinting.headChange.put_the_print_surface_on_and'), check: i18n.t('plugins.WorkshopPrinting.headChange.bed_ready') });
			p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.switch_machine_to_mode', { mode: this.nameMode(this.destination) }), button: i18n.t('plugins.WorkshopPrinting.headChange.change_mode'), free: 'settings', codes: ['M98 P"' + MACRO_MODE[this.destination] + '"'] });
			p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.home_g28'), button: i18n.t('plugins.WorkshopPrinting.headChange.homing'), detail: i18n.t('plugins.WorkshopPrinting.headChange.moves_the_machine'), free: 'move', codes: ['G28'] });
			p.push({
				kind: 'manual',
				text: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.check_the_nozzle_z_height_before') : this.destination === 'Laser' ? i18n.t('plugins.WorkshopPrinting.headChange.check_the_laser_pointer_correction_and') : i18n.t('plugins.WorkshopPrinting.headChange.check_the_cutter_s_z_zero'),
				detail: hasWorkbench
					? (aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.the_bltouch_offset_is_specific_to') : i18n.t('plugins.WorkshopPrinting.headChange.in_work_zones_offsets'))
					: (aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.the_bltouch_offset_is_specific_to_no_map') : ''),
				check: i18n.t('plugins.WorkshopPrinting.headChange.checked')
			});
			return p;
		},
		next() {
			for (let k = 0; k < this.steps.length; k++) {
				if (!this.done(k)) return k;
			}
			return this.steps.length;
		}
	},
	watch: {
		mode(m) {
			// the model arrived after creating the component
			if (!this.origin && m) this.beginOfNew();
		},
		destination() {
			this.doneMap = {};
			this.msg = null;
		}
	},
	created() {
		if (this.mode) this.beginOfNew();
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		beginOfNew() {
			this.origin = this.mode;
			this.destination = this.mode === 'FFF' ? 'Laser' : 'FFF';
			this.doneMap = {};
			this.msg = null;
		},
		nameMode(m) {
			return { FFF: i18n.t('plugins.WorkshopPrinting.headChange.fff_printing'), Laser: i18n.t('plugins.WorkshopPrinting.headChange.laser'), CNC: 'CNC' }[m] || m;
		},
		codesPowerOff() {
			const tools = (this.$store.state.machine.model.tools || []).filter(t => t);
			return tools.map(t => `M568 P${t.number} S0 R0 A0`).concat(['M140 S0']);
		},
		// Steps that move or change the mode (libre: 'mover' / 'settings'): never with a file job,
		// paused or live, nor with the machine busy (motion audit,
		// finding 7). Turning off (M5, heaters) is never blocked. '' = allowed.
		block(p) {
			if (!p || !p.free) return '';
			const ml = machineFree(this.$store.state.machine.model, { t: ts, serviceText, serviceDefaultKey, purpose: p.free });
			return ml.free || ml.confirm ? '' : ml.reason; // confirm: allowed with a double tap (see tocar)
		},
		// live job open but still: moving asks for a second double tap with the reason (only on the page)
		confirmLive(p) {
			if (!p || !p.free) return null;
			const ml = machineFree(this.$store.state.machine.model, { t: ts, serviceText, serviceDefaultKey, purpose: p.free });
			return ml.confirm ? ml : null;
		},
		done(k) {
			const p = this.steps[k];
			if (!p) return false;
			if (p.kind === 'auto') return p.ok();
			// the change mode step is done if the machine is already in the target
			if (p.codes && p.codes[0].startsWith('M98') && this.mode === this.destination) return true;
			return !!this.doneMap[k];
		},
		mark(k, v) {
			this.$set(this.doneMap, k, !!v);
			if (!v) {
				// desmarcar uno deshace los siguientes
				Object.keys(this.doneMap).forEach(i => { if (+i > k) this.$delete(this.doneMap, i); });
			}
		},
		touch(k) {
			const p = this.steps[k];
			const moves = p.codes.some(c => /^G(1|28)\b/m.test(c)); // m: the G1 may come after a G91 in the same block
			const cv = this.confirmLive(p);
			if ((moves || cv) && this.armed !== k) {
				this.armed = k;
				if (cv) {
					this.msgKind = 'warning';
					this.msg = p.text + ': ' + cv.reason + i18n.t('plugins.WorkshopPrinting.headChange.tap_again_to_confirm');
				}
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = null; }, 4000);
				return;
			}
			this.armed = null;
			this.run(k, p);
		},
		async run(k, p) {
			const b = this.block(p); // se vuelve a mirar al tocar
			if (b) {
				this.msgKind = 'error';
				this.msg = p.text + ': ' + b;
				return;
			}
			this.busy = true;
			this.msg = null;
			try {
				for (const c of p.codes) {
					const r = await this.sendCode({ code: c, log: true });
					if (isError(r)) throw new Error(r);
				}
				this.$set(this.doneMap, k, true);
			} catch (e) {
				this.msgKind = 'error';
				this.msg = p.text + ': ' + (e.message || e);
			} finally {
				this.busy = false;
			}
		}
	}
};
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.step {
	display: flex;
	gap: 10px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(128, 128, 128, 0.15);
	opacity: 0.6;
}
.step.current,
.step.done {
	opacity: 1;
}
.step-num {
	flex: none;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: #607d8b;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	font-weight: 700;
}
.step.current .step-num {
	background: #1976d2;
}
.step.done .step-num {
	background: #2e7d32;
}
.step-body {
	flex: 1;
	min-width: 0;
}
</style>
