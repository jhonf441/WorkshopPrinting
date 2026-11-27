<template>
	<div class="pp">
		<div class="pc-actions">
			<span v-if="tools.length > 1" class="text-body-2">{{ tx('preheat_on') }}</span>
			<v-btn-toggle v-if="tools.length > 1" v-model="toolSel" mandatory dense color="primary">
				<v-btn v-for="t in tools" :key="t.number" x-small :value="t.number">{{ t.name || ('T' + t.number) }}</v-btn>
			</v-btn-toggle>
			<v-btn small class="pp-btn" :color="isArmed('preheat') ? 'amber darken-3' : 'primary'" :outlined="outlined && !isArmed('preheat')" :disabled="!isFff || !!problem || !canPreheat || !!heatReason" :title="problem || heatReason" @click="arm()">
				<v-icon small left>mdi-fire</v-icon>{{ isArmed('preheat') ? $t('plugins.WorkshopPrinting.common.tap_again') : tx('preheat') }}
			</v-btn>
			
		</div>
		<div v-if="why" class="text-caption pc-muted mt-1" role="status">{{ why }}</div>
		<lock-reason v-if="!canPreheat" :min="needPreheat" class="mt-1" :subject="$t('plugins.WorkshopPrinting.subjects.preheat')" />
		<pc-result :text="msg || ''" :kind="msgKind" class="mt-2" />
	</div>
</template>

<script>
'use strict'

// The Preheat button of a profile (used by the Profiles page and by Prepare job step 3): sets the zones of the tool, the bed, the chamber and the layer fan to the numbers of the
// profile. Two taps, an operator's action, never during a job, never with the machine busy. The tool is NOT selected: only its heaters are set.
import { mapActions } from 'vuex'
import i18n from '../../i18n'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { tapArmMixin } from './tap-arm-mixin.js' // the double tap of the page (4 s)
import PcResult from './PcResult.vue' // the result of an action, one line
import LockReason from './LockReason.vue' // vue/_shared36
import { isError } from './util.js'
import { printingConfig } from './printing-config.js' // the one copy of printing.json of the page
import { NEED } from './print-sections.js'
import { heatBlock } from './filament-load.js'
import { heatZonesCode } from './tool-codes.js'
import { jobRunning } from './job-control.js'
import { machineFree } from './machine-free.js' // vue/_shared36
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { extruderTemps, bedTemps } from './material-profile.js'

export default {
	mixins: [roleMixin, tapArmMixin],
	sessionData: ['armed', 'msg', 'msgKind'],
	sessionErrors: ['msg', 'msgKind'],
	components: { PcResult, LockReason },
	props: {
		profile: { type: Object, default: null },
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null },
		bedConfig: { type: Object, default: null },
		state: { type: String, default: '' },
		outlined: { type: Boolean, default: false } // the page has another main (filled) button next to this one
	},
	data() {
		return { toolSel: null, msg: null, msgKind: 'info' }
	},
	computed: {
		canPreheat() {
			return this.atLeast(NEED.operate)
		},
		needPreheat() {
			return NEED.operate
		},
		selectedTool() {
			return this.tools.find(t => t.number === this.toolSel) || this.currentTool
		},
		nozzleZones() {
			const t = this.selectedTool
			return this.heaters.filter(h => h.paper === 'nozzle' && t && h.tool === t.number)
		},
		nozzle() {
			return this.nozzleZones.find(h => h.zone === 0) || this.nozzleZones[0] || null
		},
		bed() {
			return this.heaters.find(h => h.paper === 'bed') || null
		},
		camera() {
			return this.heaters.find(h => h.paper === 'camera') || null
		},
		bedHeaters() {
			const zs = ((this.bedConfig && this.bedConfig.zones) || []).filter(z => z && z.active !== false && Number.isInteger(z.bed))
			return zs.map(z => ({ id: z.bed, max: ((this.heaters.find(h => h.id === z.bed) || this.bed || {}).max) || null }))
		},
		free() {
			return machineFree(this.$store.state.machine.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' })
		},
		heatReason() {
			const why = heatBlock({ tool: this.selectedTool, nozzle: this.nozzle, busyJob: jobRunning(this.state), notFree: !this.free.free })
			if (!why) return ''
			if (why === 'machine') return this.free.reason
			return i18n.t('plugins.WorkshopPrinting.' + (why === 'job' ? 'filament.heat_block_job' : 'filament.block_' + why))
		},
		outside() {
			const m = this.profile || {}
			const over = (t, h) => !!h && h.max != null && t > h.max
			return { nozzle: over(m.nozzle, this.nozzle), bed: over(m.bed, this.bed), camera: over(m.camera, this.camera) }
		},
		// why the button is off in words about the PROFILE (a missing number, a number above the machine's cap, no tool)
		problem() {
			const m = this.profile
			if (!m) return this.tx('preheat_pick_profile')
			if (!(m.nozzle > 0)) return this.tx('nozzle_temperature_missing')
			if (this.outside.nozzle) return this.tx('nozzle_above_the_machine_limit')
			if (this.outside.bed) return this.tx('bed_above_the_machine_limit')
			if (this.outside.camera) return this.tx('chamber_above_the_machine_limit')
			if (!this.selectedTool) return this.tx('no_tool_fff_mode')
			return ''
		},
		// the one sentence under the button: why it is off (never a mute button)
		why() {
			if (!this.isFff) return this.tx('preheat_only_in_fff_mode')
			return this.problem || this.heatReason
		}
	},
	watch: {
		currentTool: {
			immediate: true,
			handler(t) {
				if (t && this.toolSel == null) this.toolSel = t.number
			}
		}
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		tx(key, params) {
			return i18n.t('plugins.WorkshopPrinting.profiles.' + key, params || {})
		},
		arm() {
			this.tapArm('preheat', () => this.preheat())
		},
		fail(text) {
			this.msgKind = 'error'
			this.msg = this.tx('could_not_preheat', { error: text })
		},
		async preheat() {
			const m = this.profile
			if (!m) return
			// the state may have changed since the button was tapped (a job started, the machine went busy)
			if (this.heatReason) return this.fail(this.heatReason)
			const cfg = await printingConfig.load(true) // the staging may have changed in another tab
			const t = this.selectedTool
			// a zone with its own number takes it (never above its cap); without one: the nozzle temperature plus the stagger of the zone
			const temps = extruderTemps(m, (t.heaters && t.heaters.length ? t.heaters : [null]).map(h => ({ id: h, max: ((this.heaters.find(c => c.id === h) || {}).max) || null })), cfg.step || {})
			const heat = heatZonesCode(t.number, temps)
			if (!heat) return this.fail(this.tx('nozzle_temperature_missing'))
			const codes = [heat]
			const shown = bedTemps(m, this.bedHeaters)
			if (shown.some(z => z.own)) shown.forEach(z => codes.push(`M140 P${z.id} S${z.t}`)) // zones with their own number: every zone gets its own set point
			else if (this.bed && m.bed > 0) codes.push(`M140 S${Math.round(m.bed)}`)
			if (this.camera && m.camera > 0) codes.push(`M141 S${Math.round(m.camera)}`)
			const fan = (t.fans || [])[0]
			if (fan != null && m.fan >= 0) codes.push(`M106 P${fan} S${Math.max(0, Math.min(1, m.fan / 100)).toFixed(2)}`)
			try {
				for (const c of codes) {
					const r = await this.sendCode({ code: c, log: true })
					if (isError(r)) throw new Error(r)
				}
				this.msgKind = 'success'
				this.msg = this.tx('preheating', { name: m.name, c: m.nozzle }) + (this.bed && m.bed > 0 ? ', ' + this.tx('bed_c_value', { c: m.bed }) : '') + (this.camera && m.camera > 0 ? ', ' + this.tx('chamber_c_value', { c: m.camera }) : '') + '. ' + this.tx('see_status_tab')
				printingConfig.update({ last: m.name }).catch(() => {}) // remember the last profile (used by the Extruder tab and by Prepare job)
				this.$emit('preheated', m.name)
			} catch (e) {
				this.fail(e.message || String(e))
			}
		}
	}
}
</script>

<style scoped>
</style>
