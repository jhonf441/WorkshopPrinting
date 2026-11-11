<template>
	<!-- Save to the configuration: the service builds the change (machine.config.plan), the exact lines are shown, and applying keeps a backup of the whole set first (machine.config.apply).
	     Same flow as every other configuration change of the workshop; the page never writes a file. -->
	<div class="bcs">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn small color="primary" :disabled="!!why || step === 'planning' || step === 'applying'" :loading="step === 'planning'" @click="review()">
				<v-icon small left>mdi-file-compare</v-icon>{{ t(kindKey + '_review') }}
			</v-btn>
			<help-tip v-bind="help" />
			<span v-if="why" class="text-caption grey--text">{{ why }}</span>
		</div>
		<v-alert v-if="error" dense text type="error" class="mt-2 mb-0">{{ error }}</v-alert>
		<template v-if="plan && (step === 'review' || step === 'applying')">
			<div class="text-body-2 mt-2">{{ plan.files.some(f => f.changed) ? t('save_summary', { n: plan.files.filter(f => f.changed).length }) : t('save_nothing') }}</div>
			<v-alert v-for="w in plan.warnings" :key="'w' + w" dense text type="warning" class="mt-1 mb-0">{{ warning(w) }}</v-alert>
			<div v-for="f in plan.files.filter(f => f.changed)" :key="f.path" class="mt-2">
				<div class="text-body-2 font-weight-medium bcs-path">{{ f.path }}</div>
				<pre class="bcs-diff"><span v-for="(l, i) in f.diff" :key="i" :class="'bcs-' + lineClass(l)">{{ l }}
</span></pre>
			</div>
			<div class="text-caption grey--text">{{ t('save_backup') }}</div>
			<div class="d-flex flex-wrap mt-1" style="gap:8px">
				<v-btn small color="primary" :disabled="!plan.files.some(f => f.changed)" :loading="step === 'applying'" @click="apply()">
					<v-icon small left>mdi-content-save-check-outline</v-icon>{{ t('save_apply') }}
				</v-btn>
				<v-btn small text :disabled="step === 'applying'" @click="reset()">{{ t('save_cancel') }}</v-btn>
			</div>
		</template>
		<v-alert v-if="step === 'done' && result" dense text type="success" class="mt-2 mb-0">
			<div>{{ t('save_done') }}</div>
			<div v-if="result.snapshot" class="text-caption">{{ t('save_snapshot', { id: result.snapshot }) }}</div>
			<div v-if="result.restart_needed" class="text-caption">{{ t('save_restart') }}</div>
		</v-alert>
	</div>
</template>

<script>
'use strict'

import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36

// the lines of a unified diff, classified for the colour (the first character is printed too: colour is never the only signal)
function lineClass(l) {
	const s = String(l)
	return s.startsWith('+++') || s.startsWith('---') ? 'file' : s.startsWith('@@') ? 'hunk' : s.startsWith('+') ? 'add' : s.startsWith('-') ? 'del' : 'ctx'
}

const WARNINGS = ['restart', 'nothing_changes', 'line_added', 'cap_raised']

export default {
	mixins: [roleMixin],
	components: { HelpTip },
	props: {
		kind: { type: String, required: true }, // 'config.heater_model' | 'config.heater_cap'
		heaters: { type: Array, default: () => [] }, // the values of the plan: [{heater, r, k, ...}] | [{heater, max}]
		busy: { type: Boolean, default: false } // a calibration is running: nothing is saved meanwhile
	},
	data() {
		return { step: 'idle', plan: null, result: null, error: '' }
	},
	computed: {
		// why the button is off ('' = it is on): the role of the technician (the service decides again) or a calibration in progress
		why() {
			if (!this.canDo('machine.config.apply')) return this.lockTextOp('machine.config.apply', 'technician')
			return this.busy ? this.t('why_running') : ''
		},
		kindKey() {
			return this.kind === 'config.heater_cap' ? 'save_caps' : 'save_models'
		},
		help() {
			const k = this.kind === 'config.heater_cap' ? 'caps' : 'models_save'
			return { title: this.t('help_' + k + '_title'), what: this.t('help_' + k + '_what'), why: this.t('help_' + k + '_why'), ifMissing: this.t('help_' + k + '_miss'), how: this.t('help_' + k + '_how') }
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		},
		lineClass,
		warning(w) {
			return this.t('save_warn_' + (WARNINGS.indexOf(w) >= 0 ? w : 'other'))
		},
		reset() {
			this.step = 'idle'
			this.plan = null
			this.error = ''
		},
		async review() {
			this.step = 'planning'
			this.error = ''
			this.result = null
			try {
				this.plan = await api('machine.config.plan', { kind: this.kind, values: { heaters: this.heaters } }, { quiet: true })
				this.step = 'review'
			} catch (e) {
				this.plan = null
				this.step = 'idle'
				this.error = (e && e.message) || String(e)
			}
		},
		// the lines on screen are the confirmation: nothing is written before this button
		async apply() {
			if (!this.plan || this.step !== 'review') return
			this.step = 'applying'
			this.error = ''
			try {
				this.result = await api('machine.config.apply', { plan_id: this.plan.plan_id, kind: this.kind }, { confirm: true })
				this.step = 'done'
				this.plan = null
			} catch (e) {
				this.step = 'review'
				this.error = (e && e.message) || String(e)
			}
		}
	}
}
</script>

<style scoped>
.bcs { margin-top: 8px; }
.bcs-path { font-family: var(--tp-font-mono, monospace); font-size: 12px; }
.bcs-diff { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: pre; overflow-x: auto; padding: 8px; margin: 4px 0; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 8px; }
.bcs-add { color: var(--v-success-base, #2e7d32); }
.bcs-del { color: var(--v-error-base, #c62828); }
.bcs-hunk, .bcs-file { opacity: 0.7; }
</style>
