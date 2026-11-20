<template>
	<!-- The offsets a thermal map gives: the numbers are shown first (zone, reading, offset it has, offset it would get) and one button saves them with bedzones.set (technician). -->
	<div class="bco">
		<v-simple-table v-if="map.ready" dense class="mt-2">
			<thead><tr><th>{{ t('col_zone') }}</th><th>{{ t('col_measured') }}</th><th>{{ t('col_offset_now') }}</th><th>{{ t('col_offset_new') }}</th></tr></thead>
			<tbody>
				<tr v-for="x in map.rows" :key="'o' + x.bed">
					<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: x.n }) }} <span class="pc-muted text-caption">(P{{ x.bed }})</span></td>
					<td class="bco-mono">{{ x.measured }} °C</td>
					<td class="bco-mono">{{ signed(current[x.bed]) }}</td>
					<td class="bco-mono">{{ signed(x.offset) }}<span v-if="x.clamped" class="text-caption wf-state warn"> {{ t('offsets_clamped', { max: config.max_offset }) }}</span></td>
				</tr>
			</tbody>
		</v-simple-table>
		<div class="pc-actions mt-2">
			<v-btn small color="primary" :disabled="!map.ready || !!why || saving" :loading="saving" @click="save()">
				<v-icon small left>mdi-content-save-outline</v-icon>{{ t('offsets_apply') }}
			</v-btn>
			<span v-if="why" class="text-caption pc-muted">{{ why }}</span>
			<span v-else-if="!map.ready" class="text-caption pc-muted">{{ t('offsets_need_two') }}</span>
		</div>
		<div v-if="error" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ error }}</span></div>
		<div v-if="done" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-check-circle-outline</v-icon><span>{{ t('offsets_saved') }}</span></div>
	</div>
</template>

<script>
'use strict'

import { api } from './workshop-api.js'
import { offsetsConfig } from './bed-calibration.js'

export default {
	props: {
		map: { type: Object, required: true }, // offsetsFromMap()
		config: { type: Object, required: true }, // the settings as read (bedzones.get)
		rev: { type: String, default: '0' }, // its revision: a change by someone else answers `conflict`
		why: { type: String, default: '' }
	},
	data() {
		return { saving: false, error: '', done: false }
	},
	computed: {
		current() {
			const out = {}
			;(this.config.zones || []).forEach(z => { out[z.bed] = z.offset })
			return out
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		},
		signed(v) {
			const n = Number(v) || 0
			return (n > 0 ? '+' : '') + n + ' °C'
		},
		async save() {
			if (!this.map.ready || this.saving) return
			this.saving = true
			this.error = ''
			this.done = false
			try {
				const r = await api('bedzones.set', { config: offsetsConfig(this.config, this.map), base_rev: this.rev })
				this.done = true
				this.$emit('saved', r)
			} catch (e) {
				this.error = e && e.code === 'conflict' ? this.t('offsets_conflict') : (e && e.message) || String(e)
				if (e && e.code === 'conflict') this.$emit('conflict')
			} finally {
				this.saving = false
			}
		}
	}
}
</script>

<style scoped>
.bco-mono { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
</style>
