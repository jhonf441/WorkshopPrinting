<template>
	<!-- assistant for the motion of the extruder motor: acceleration, jerk, top speed and retraction. Runs the codes now and WRITES modefff.g -->
	<v-card outlined class="pa-3">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small>mdi-engine-outline</v-icon>
			<span class="text-subtitle-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_title') }}</span>
		</div>
		<div class="text-caption grey--text mt-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_intro') }}</div>

		<div class="text-subtitle-2 mt-3">{{ $t('plugins.WorkshopPrinting.pellet.asst_presets') }}</div>
		<div class="d-flex flex-wrap mt-1" style="gap:8px">
			<v-btn v-for="p in presets" :key="p.id" small :outlined="!(current && current.id === p.id)" :color="current && current.id === p.id ? 'primary' : undefined" :disabled="!configure" @click="usePreset(p)">
				{{ $t('plugins.WorkshopPrinting.pellet.asst_preset_' + p.id) }}
			</v-btn>
		</div>
		<div class="text-caption grey--text mt-1">{{ current ? $t('plugins.WorkshopPrinting.pellet.asst_preset_' + current.id + '_note') : $t('plugins.WorkshopPrinting.pellet.asst_preset_none') }}</div>

		<div v-for="r in rows" :key="r.key" class="mt-3">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.pellet.asst_' + r.key) }}</span>
				<input v-model.number="form[r.key]" type="number" :step="r.step" :min="limits[r.key].min" :max="limits[r.key].max" class="field" :disabled="!configure" />
				<span class="text-caption grey--text">{{ r.unit }}</span>
				<span v-if="now[r.key] !== null" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.asst_now', { n: now[r.key] }) }}</span>
			</div>
			<div class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.asst_' + r.key + '_help') }}</div>
		</div>

		<div class="text-subtitle-2 mt-4">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_title') }}</div>
		<div class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.pellet.asst_retractLength') }}</span>
			<input v-model.number="form.retractLength" type="number" step="0.1" :min="limits.retractLength.min" :max="limits.retractLength.max" class="field" :disabled="!configure" /> mm
			<template v-if="form.retractLength > 0">
				<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.pellet.asst_retractSpeed') }}</span>
				<input v-model.number="form.retractSpeed" type="number" step="1" :min="limits.retractSpeed.min" :max="limits.retractSpeed.max" class="field" :disabled="!configure" /> mm/s
			</template>
		</div>
		<div v-if="form.retractLength > 0 && !retract.ok" class="text-caption warning--text mt-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_cold', { limit: retract.limit, cold: retract.cold.join(', ') }) }}</div>
		<div v-else-if="form.retractLength > 0" class="text-caption grey--text mt-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_g10') }}</div>

		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small :color="armed === 'apply' ? 'amber darken-3' : 'primary'" :loading="saving" :disabled="!configure" @click="arm('apply', apply)">
				{{ armed === 'apply' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.asst_apply') }}
			</v-btn>
			<v-btn small outlined @click="$emit('goto', { section: 'pellet' })"><v-icon small left>mdi-flask-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.asst_test') }}</v-btn>
		</div>
		<div class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.pellet.asst_note') }}</div>
	</v-card>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { changeOAddLineMode, note } from './util.js'
import { LIMITS, PRESETS, fromModel, presetOf, normalize, plan, retractCheck } from './motor-assist.js'

export default {
	props: {
		busy: { type: Boolean, default: false },
		configure: { type: Boolean, default: false }, // the role writes the configuration (technician) and the setup view
		extruders: { type: Array, default: () => [] }, // model.move.extruders
		index: { type: Number, default: 0 }, // the extruder of the tool
		coldRetract: { type: Number, default: 0 }, // model.heat.coldRetractTemperature
		targets: { type: Array, default: () => [] } // active temperature of each heater of the tool
	},
	data() {
		return {
			limits: LIMITS,
			presets: PRESETS,
			rows: [
				{ key: 'accel', unit: 'mm/s²', step: 10 },
				{ key: 'jerk', unit: 'mm/min', step: 10 },
				{ key: 'speed', unit: 'mm/s', step: 1 }
			],
			form: { accel: 0, jerk: 0, speed: 0, retractLength: 0, retractSpeed: 20 },
			filled: false, saving: false, armed: null, armedTimer: null
		};
	},
	computed: {
		now() {
			return fromModel(this.extruders[this.index]);
		},
		current() {
			return presetOf(this.form);
		},
		retract() {
			return retractCheck(this.coldRetract, this.targets);
		}
	},
	watch: {
		// the form starts with what the machine has now (once, when the model arrives)
		now: {
			immediate: true,
			handler(v) {
				if (this.filled || v.accel === null) return;
				this.filled = true;
				this.form = Object.assign({}, this.form, { accel: v.accel, jerk: v.jerk, speed: v.speed });
			}
		}
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		arm(id, fn) {
			if (this.armed !== id) {
				this.armed = id;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = null; }, 4000);
				return;
			}
			this.armed = null;
			fn();
		},
		usePreset(p) {
			this.form = Object.assign({}, this.form, { accel: p.accel, jerk: p.jerk, speed: p.speed });
		},
		say(kind, text) {
			this.$emit('msg', { kind, text });
		},
		async apply() {
			if (this.saving || !this.configure) return;
			this.saving = true;
			try {
				if (this.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
				const v = normalize(this.form);
				if (!v.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.asst_err', { field: i18n.t('plugins.WorkshopPrinting.pellet.asst_' + v.field) }));
				const p = plan(v.value, this.extruders, this.index);
				for (const code of p.codes) {
					const r = await this.sendCode({ code, log: true });
					if (/error|abort/i.test(r || '')) throw new Error(code + ': ' + r);
				}
				for (const l of p.lines) await changeOAddLineMode(l.start, l.text, 'M92 E');
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.asst_log', { codes: p.codes.join(' ') }));
				this.say('success', i18n.t('plugins.WorkshopPrinting.pellet.asst_saved'));
				this.$emit('saved');
			} catch (e) {
				this.say('error', e.message || String(e));
			} finally {
				this.saving = false;
			}
		}
	}
};
</script>

<style scoped>
.field {
	width: 72px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
</style>
