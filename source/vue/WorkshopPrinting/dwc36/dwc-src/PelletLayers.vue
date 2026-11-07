<template>
	<v-card outlined class="pl-card pa-3" aria-labelledby="pl-title">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small>mdi-layers-triple-outline</v-icon>
			<span id="pl-title" class="text-subtitle-1">{{ tx('pellet_layers_title') }}</span>
			<v-chip x-small outlined :color="live.phase === 'off' ? undefined : (live.phase === 'running' ? 'success' : 'warning')">{{ tx(live.key) }}</v-chip>
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('pellet_layers_lead') }}</div>

		<help-guide :title="$t('plugins.WorkshopPrinting.common.how_it_works')" class="mt-2">
			<p>{{ tx('pellet_layers_guide_1') }}</p>
			<p>{{ tx('pellet_layers_guide_2') }}</p>
			<p>{{ tx('pellet_layers_guide_3') }}</p>
			<p class="mb-0">{{ tx('pellet_layers_guide_4') }}</p>
		</help-guide>

		<error-notice v-if="failure" :error="failure" :action="tx('pellet_layers_acting')" retry class="mt-2" @retry="load()" />
		<lock-reason v-if="!canEdit" op="pelletlayers.set" need="technician" :action="tx('pellet_layers_acting')" class="mt-2" />

		<!-- the live state: what layer it is on, what was applied, when the next change comes -->
		<div class="pl-live mt-3" role="status" aria-live="polite">
			<div class="text-subtitle-2">{{ tx('pellet_layers_live_title') }}</div>
			<div v-if="status && status.armed" class="text-body-2">
				<div>{{ tx('pellet_layers_live_profile', { name: status.profile, file: status.file }) }}</div>
				<div>{{ status.layer ? tx('pellet_layers_live_layer', { layer: status.layer }) : tx('pellet_layers_live_no_layer') }}
					<template v-if="status.applied"> - {{ tx('pellet_layers_live_applied', { temps: appliedText }) }}</template>
				</div>
				<div v-if="status.next">{{ tx('pellet_layers_live_next', { at: status.next.at, temps: nextText }) }}</div>
				<div v-else class="grey--text">{{ tx('pellet_layers_live_no_next') }}</div>
				<div v-if="status.limited && status.limited.length" class="warning--text text-caption">{{ tx('pellet_layers_live_limited') }}</div>
			</div>
			<div v-else-if="live.reason" class="wf-note is-warn" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('pellet_layers_live_ended_why', { why: tx(live.reason.key, live.reason.params) }) }}</span></div>
			<div v-else class="text-body-2 grey--text">{{ tx('pellet_layers_live_off_note') }}</div>
		</div>

		<!-- turn it on for ONE job: two taps; turning it off is safe (one tap) and leaves the temperatures as they are -->
		<div class="d-flex align-end flex-wrap mt-2" style="gap:12px">
			<wf-field id="pl-file" :label="tx('pellet_layers_f_file')" :message="fileHint">
				<template #help><help-tip v-bind="help('file')" /></template>
				<v-text-field id="pl-file" v-model="file" dense outlined hide-details style="min-width:220px" :aria-label="tx('pellet_layers_f_file')" :disabled="!canArm || armedNow" />
			</wf-field>
			<v-btn small :color="armed === 'arm' ? 'amber darken-3' : 'primary'" :loading="busy === 'arm'" :disabled="!canArm || armedNow || !canArmNow" @click="touch('arm', arm)">
				<v-icon small left>mdi-fire</v-icon>{{ armed === 'arm' ? tx('pellet_layers_tap_again_arm') : tx('pellet_layers_arm') }}
			</v-btn>
			<v-btn small outlined :loading="busy === 'disarm'" :disabled="!armedNow" @click="disarm()"><v-icon small left>mdi-stop-circle-outline</v-icon>{{ tx('pellet_layers_disarm') }}</v-btn>
		</div>
		<lock-reason v-if="!canArm" op="pelletlayers.arm" need="technician" :action="tx('pellet_layers_arming')" class="mt-2" />
		<div v-else-if="armReason" class="wf-note is-info mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ armReason }}</span></div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

		<v-divider class="my-3" />

		<!-- the profile: name, mode, limits, points -->
		<div class="d-flex align-end flex-wrap" style="gap:12px">
			<wf-field id="pl-pick" :label="tx('pellet_layers_f_profile')">
				<template #help><help-tip v-bind="help('profile')" /></template>
				<v-select id="pl-pick" v-model="picked" :items="pickItems" dense outlined hide-details style="min-width:200px" :aria-label="tx('pellet_layers_f_profile')" @change="choose" />
			</wf-field>
			<wf-field id="pl-name" :label="tx('pellet_layers_f_name')" :message="nameError" level="error">
				<v-text-field id="pl-name" v-model="name" dense outlined hide-details style="min-width:180px" :aria-label="tx('pellet_layers_f_name')" :disabled="!canEdit" />
			</wf-field>
		</div>

		<div v-if="draft" class="mt-3">
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field id="pl-mode" :label="tx('pellet_layers_f_mode')">
					<template #help><help-tip v-bind="help('mode')" /></template>
					<v-select id="pl-mode" v-model="draft.mode" :items="modeItems" dense outlined hide-details style="max-width:170px" :aria-label="tx('pellet_layers_f_mode')" :disabled="!canEdit" />
				</wf-field>
				<wf-field id="pl-axis" :label="tx('pellet_layers_f_axis')">
					<template #help><help-tip v-bind="help('axis')" /></template>
					<v-select id="pl-axis" v-model="draft.axis" :items="axisItems" dense outlined hide-details style="max-width:170px" :aria-label="tx('pellet_layers_f_axis')" :disabled="!canEdit" />
				</wf-field>
				<wf-field id="pl-max" :label="tx('pellet_layers_f_max_temp')" :message="fieldError('max_temp')" level="error">
					<template #help><help-tip v-bind="help('max_temp')" /></template>
					<v-text-field id="pl-max" v-model="draft.max_temp" dense outlined hide-details suffix="C" inputmode="decimal" style="max-width:110px" :aria-label="tx('pellet_layers_f_max_temp')" :disabled="!canEdit" />
				</wf-field>
				<wf-field id="pl-step" :label="tx('pellet_layers_f_max_step')" :message="fieldError('max_step')" level="error">
					<template #help><help-tip v-bind="help('max_step')" /></template>
					<v-text-field id="pl-step" v-model="draft.max_step" dense outlined hide-details suffix="C" inputmode="decimal" style="max-width:110px" :aria-label="tx('pellet_layers_f_max_step')" :disabled="!canEdit" />
				</wf-field>
				<wf-field id="pl-spread" :label="tx('pellet_layers_f_max_spread')" :message="fieldError('max_spread')" level="error">
					<template #help><help-tip v-bind="help('max_spread')" /></template>
					<v-text-field id="pl-spread" v-model="draft.max_spread" dense outlined hide-details suffix="C" inputmode="decimal" style="max-width:110px" :aria-label="tx('pellet_layers_f_max_spread')" :disabled="!canEdit" />
				</wf-field>
			</div>

			<div class="d-flex align-center mt-3" style="gap:6px">
				<span class="text-subtitle-2">{{ tx('pellet_layers_points') }}</span>
				<help-tip v-bind="help('points')" />
			</div>
			<div class="pl-scroll">
				<table class="pl-table">
					<thead>
						<tr>
							<th scope="col">{{ draft.axis === 'z' ? tx('pellet_layers_col_z') : tx('pellet_layers_col_layer') }}</th>
							<th v-for="(h, k) in draft.heaters" :key="'h' + h" scope="col">{{ tx('pellet_layers_col_zone', { n: k + 1, h: h }) }}</th>
							<th v-if="preview" scope="col">{{ tx('pellet_layers_col_falls') }}</th>
							<th scope="col"><span class="sr-only">{{ tx('pellet_layers_col_remove') }}</span></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(pt, i) in draft.points" :key="i">
							<td><v-text-field v-model="pt.at" dense outlined hide-details inputmode="decimal" class="pl-cell" :aria-label="tx('pellet_layers_point_at_aria', { n: i + 1 })" :error="!!pointError(i, 'at')" :disabled="!canEdit" /></td>
							<td v-for="(h, k) in draft.heaters" :key="'t' + h"><v-text-field v-model="pt.temps[k]" dense outlined hide-details inputmode="decimal" class="pl-cell" suffix="C" :aria-label="tx('pellet_layers_point_temp_aria', { n: i + 1, zone: k + 1 })" :error="!!pointError(i, 'temps')" :disabled="!canEdit" /></td>
							<td v-if="preview" class="pl-falls">{{ fallsText(i) }}</td>
							<td><v-btn icon small :disabled="!canEdit || draft.points.length < 2" :aria-label="tx('pellet_layers_remove_point', { n: i + 1 })" @click="removePoint(i)"><v-icon small>mdi-close</v-icon></v-btn></td>
						</tr>
					</tbody>
				</table>
			</div>
			<div v-for="e in errorsShown" :key="e.field" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ errorText(e) }}</span></div>
			<v-btn small outlined class="mt-2" :disabled="!canEdit || draft.points.length >= maxPoints" @click="addPoint()"><v-icon small left>mdi-plus</v-icon>{{ tx('pellet_layers_add_point') }}</v-btn>

			<!-- the curve -->
			<div v-if="chart" class="mt-3">
				<svg :viewBox="'0 0 ' + G.w + ' ' + G.h" class="pl-svg" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="tx('pellet_layers_chart_label')">
					<g v-for="v in chart.ticksY" :key="'y' + v">
						<line :x1="G.l" :x2="G.w - G.r" :y1="chart.y(v)" :y2="chart.y(v)" class="pl-grid" />
						<text :x="G.l - 5" :y="chart.y(v) + 4" text-anchor="end" class="pl-axis">{{ v }}</text>
					</g>
					<g v-for="v in chart.ticksX" :key="'x' + v">
						<line :x1="chart.x(v)" :x2="chart.x(v)" :y1="G.t" :y2="G.h - G.b" class="pl-grid" />
						<text :x="chart.x(v)" :y="G.h - 8" text-anchor="middle" class="pl-axis">{{ v }}</text>
					</g>
					<g v-for="ln in chart.lines" :key="'l' + ln.heater">
						<path :d="ln.d" fill="none" :stroke="ln.color" stroke-width="2.5" stroke-linejoin="round" />
						<circle v-for="(d, i) in ln.dots" :key="i" :cx="d.cx" :cy="d.cy" r="3.5" :fill="ln.color" />
					</g>
				</svg>
				<div class="text-body-2 pl-legend">
					<span v-for="ln in chart.lines" :key="'k' + ln.heater"><i class="pl-key" :style="{ borderTopColor: ln.color }" />{{ tx('pellet_layers_col_zone', { n: ln.zone + 1, h: ln.heater }) }}</span>
				</div>
				<div class="text-caption grey--text">{{ tx('pellet_layers_chart_help', { x: draft.axis === 'z' ? tx('pellet_layers_col_z') : tx('pellet_layers_col_layer') }) }}</div>
			</div>

			<!-- preview against the loaded job -->
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<span class="text-subtitle-2">{{ tx('pellet_layers_preview') }}</span>
				<help-tip v-bind="help('preview')" />
				<v-btn small outlined :loading="busy === 'preview'" :disabled="!jobPath" @click="readJob()"><v-icon small left>mdi-eye-outline</v-icon>{{ tx('pellet_layers_preview_read') }}</v-btn>
			</div>
			<div v-if="!jobPath" class="text-caption grey--text mt-1">{{ tx('pellet_layers_preview_no_job') }}</div>
			<div v-if="preview" class="text-body-2 mt-1">{{ tx('pellet_layers_preview_summary', { layers: preview.layers, file: previewFile }) }}</div>
			<div v-for="w in warnings" :key="w.key + JSON.stringify(w.params)" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx(w.key, w.params) }}</span></div>

			<!-- save / delete: saving never heats anything -->
			<div class="d-flex flex-wrap mt-3" style="gap:8px">
				<v-btn small color="primary" :loading="busy === 'save'" :disabled="!canEdit || !!errors.length || !nameOk" @click="save()"><v-icon small left>mdi-content-save-outline</v-icon>{{ tx('pellet_layers_save') }}</v-btn>
				<v-btn small outlined :color="armed === 'remove' ? 'amber darken-3' : undefined" :loading="busy === 'remove'" :disabled="!canEdit || !isSaved" @click="touch('remove', remove)"><v-icon small left>mdi-delete-outline</v-icon>{{ armed === 'remove' ? tx('pellet_layers_tap_again_remove') : tx('pellet_layers_remove') }}</v-btn>
			</div>
			<div class="text-caption grey--text mt-1">{{ tx('pellet_layers_save_note') }}</div>
		</div>
	</v-card>
</template>

<script>
'use strict'

import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpGuide from './HelpGuide.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import {
	MAX_POINTS, draftOf, profileOf, emptyProfile, validateProfile, chartModel, jobLayers, pointLayers, previewWarnings, previewPath,
	fileForJob, liveState, tempsText, toolZones, parseNumber, NAME_MAX
} from './pellet-layers.js'

const HELP = ['profile', 'mode', 'axis', 'max_temp', 'max_step', 'max_spread', 'points', 'preview', 'file']

export default {
	mixins: [roleMixin],
	// what the person who left read, did or was refused stays nowhere (role-mixin.js)
	sessionData: ['armed', 'msg', 'msgKind'],
	sessionErrors: ['failure', 'msg', 'msgKind'],
	components: { HelpGuide, HelpTip, ErrorNotice, LockReason, WfField },
	props: {
		tool: { type: Object, default: null } // the current tool of the page (its heaters are the zones of the profile)
	},
	data() {
		return {
			G: { w: 600, h: 220, l: 42, r: 12, t: 10, b: 26 },
			maxPoints: MAX_POINTS,
			list: [], picked: '', name: '', draft: null, saved: null,
			status: null, preview: null, previewFile: '', file: '', fileTouched: false,
			armed: null, armedTimer: null, busy: null, msg: null, msgKind: 'info', failure: null, timer: null
		}
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		canEdit() {
			return this.canDo('pelletlayers.set')
		},
		canArm() {
			return this.canDo('pelletlayers.arm')
		},
		armedNow() {
			return !!(this.status && this.status.armed)
		},
		live() {
			return liveState(this.status)
		},
		appliedText() {
			return tempsText(this.status && this.status.applied)
		},
		nextText() {
			return tempsText(this.status && this.status.next && this.status.next.temps)
		},
		pickItems() {
			return [{ text: this.tx('pellet_layers_new'), value: '' }].concat(this.list.map(p => ({ text: p.name, value: p.name })))
		},
		modeItems() {
			return ['steps', 'ramp'].map(m => ({ text: this.tx('pellet_layers_mode_' + m), value: m }))
		},
		axisItems() {
			return ['layer', 'z'].map(a => ({ text: this.tx('pellet_layers_axis_' + a), value: a }))
		},
		profile() {
			return this.draft ? profileOf(this.draft) : null
		},
		errors() {
			return this.profile ? validateProfile(this.profile) : []
		},
		errorsShown() {
			return this.errors.filter(e => /^points/.test(e.field) || e.field === 'heaters' || e.field === 'tool' || e.field === 'profile')
		},
		nameOk() {
			const n = this.name.trim()
			return n.length >= 1 && n.length <= NAME_MAX
		},
		nameError() {
			return this.name !== '' && !this.nameOk ? this.tx('pellet_layers_err_name', { max: NAME_MAX }) : ''
		},
		isSaved() {
			return !!this.name.trim() && this.list.some(p => p.name === this.name.trim())
		},
		job() {
			return this.preview || { layers: 0, layerZ: [], approximate: true }
		},
		chart() {
			return this.profile && !this.errors.length ? chartModel(this.profile, this.job, this.G, this.startTemps) : null
		},
		startTemps() {
			const z = toolZones(this.model, this.draft ? parseNumber(this.draft.tool) : null)
			return z.length && z.every(r => r.target !== null && r.target >= 30) ? z.map(r => r.target) : null
		},
		warnings() {
			return this.preview && this.profile && !this.errors.length ? previewWarnings(this.profile, this.preview) : []
		},
		falls() {
			return this.preview && this.profile && !this.errors.length ? pointLayers(this.profile, this.preview) : []
		},
		// the file of the job the model has loaded (RRF reports it as 0:/gcodes/name.gcode)
		jobName() {
			const j = this.model && this.model.job
			return (j && j.file && j.file.fileName) || ''
		},
		jobPath() {
			return previewPath(this.jobName)
		},
		fileName() {
			return fileForJob(this.file)
		},
		canArmNow() {
			return !!this.fileName && !!this.status && !!this.saved && !this.dirty
		},
		dirty() {
			return !!this.draft && !!this.saved && JSON.stringify(this.profile) !== JSON.stringify(profileOf(draftOf(this.saved)))
		},
		fileHint() {
			return this.fileName ? '' : this.tx('pellet_layers_file_missing')
		},
		armReason() {
			if (this.armedNow) return ''
			if (!this.saved) return this.tx('pellet_layers_arm_needs_saved')
			if (this.dirty) return this.tx('pellet_layers_arm_needs_save')
			return ''
		}
	},
	watch: {
		jobName(v) {
			if (!this.fileTouched) this.file = v
		},
		'tool.number'() {
			if (!this.saved && !this.draft) this.fresh()
		}
	},
	mounted() {
		this.file = this.jobName
		this.load()
		this.timer = setInterval(() => this.poll(), 3000)
	},
	beforeDestroy() {
		clearInterval(this.timer)
		clearTimeout(this.armedTimer)
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.pellet.' + key, params || {})
		},
		help(k) {
			return HELP.indexOf(k) < 0 ? {} : {
				title: this.tx('pellet_layers_help_' + k + '_title'), what: this.tx('pellet_layers_help_' + k + '_what'), why: this.tx('pellet_layers_help_' + k + '_why'),
				ifMissing: this.tx('pellet_layers_help_' + k + '_miss'), how: this.tx('pellet_layers_help_' + k + '_how')
			}
		},
		onSessionChange() {
			this.load()
		},
		errorText(e) {
			const m = /^points\[(\d+)\]/.exec(e.field)
			return this.tx(e.key, Object.assign({ field: e.field, n: m ? Number(m[1]) + 1 : 0 }, e.params))
		},
		fieldError(field) {
			const e = this.errors.find(x => x.field === field)
			return e ? this.errorText(e) : ''
		},
		pointError(i, part) {
			return this.errors.find(e => e.field === 'points[' + i + '].' + part)
		},
		fallsText(i) {
			const f = this.falls[i]
			return f ? this.tx(f.beyond ? 'pellet_layers_falls_beyond' : 'pellet_layers_falls_at', { layer: f.layer }) : ''
		},
		async load(keep) {
			try {
				const g = await api('pelletlayers.list', {}, { quiet: true })
				this.list = g.profiles || []
				await this.poll()
				this.failure = null
				if (!keep && !this.draft) this.fresh()
			} catch (e) {
				this.failure = e
			}
		},
		async poll() {
			try {
				this.status = await api('pelletlayers.status', {}, { quiet: true })
			} catch (e) {
				// the page keeps the last state it knew; a refusal of the session shows through load()
			}
		},
		// a new profile for the tool of the page: its heaters and the temperatures it has now
		fresh() {
			const t = this.tool
			if (!t || !(t.heaters || []).length) {
				this.draft = null
				return
			}
			this.saved = null
			this.picked = ''
			this.name = ''
			this.draft = draftOf(emptyProfile(t.number, t.heaters, t.active))
		},
		async choose(name) {
			if (!name) return this.fresh()
			try {
				const g = await api('pelletlayers.get', { name })
				this.saved = g.profile
				this.name = name
				this.draft = draftOf(g.profile)
				this.failure = null
			} catch (e) {
				this.failure = e
			}
		},
		addPoint() {
			const pts = this.draft.points
			const last = pts[pts.length - 1]
			const at = parseNumber(last.at)
			const next = this.draft.axis === 'z' ? String(Math.round(((at || 0) + 5) * 100) / 100) : String(Math.round(at || 0) + 10)
			pts.push({ at: next, temps: last.temps.slice() })
		},
		removePoint(i) {
			this.draft.points.splice(i, 1)
		},
		say(kind, text) {
			this.msgKind = kind
			this.msg = text
		},
		// level 2 (DESIGN.md 5): the first tap arms the button (amber, 4 s), the second does it
		touch(id, fn) {
			if (this.armed !== id) {
				this.armed = id
				clearTimeout(this.armedTimer)
				this.armedTimer = setTimeout(() => { this.armed = null }, 4000)
				return
			}
			this.armed = null
			fn.call(this)
		},
		async save() {
			if (!this.canEdit || this.errors.length || !this.nameOk) return
			this.busy = 'save'
			try {
				const out = await api('pelletlayers.set', { name: this.name.trim(), profile: this.profile })
				this.saved = out.profile
				this.name = out.name
				this.picked = out.name
				this.draft = draftOf(out.profile)
				await this.load(true)
				this.say('success', this.tx('pellet_layers_saved', { name: out.name }))
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async remove() {
			if (!this.canEdit || !this.isSaved) return
			this.busy = 'remove'
			try {
				const name = this.name.trim()
				await api('pelletlayers.remove', { name })
				this.say('success', this.tx('pellet_layers_removed', { name }))
				this.draft = null
				await this.load()
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async arm() {
			if (!this.canArm || !this.canArmNow || this.armedNow) return
			this.busy = 'arm'
			try {
				this.status = await api('pelletlayers.arm', { name: this.name.trim(), file: this.fileName })
				this.say('success', this.tx('pellet_layers_armed', { name: this.name.trim() }))
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		// stopping is never blocked and takes one tap; it leaves the temperatures as they are
		async disarm() {
			this.busy = 'disarm'
			try {
				this.status = await api('pelletlayers.disarm', {})
				this.say('success', this.tx('pellet_layers_disarmed'))
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async readJob() {
			if (!this.jobPath) return
			this.busy = 'preview'
			try {
				const r = await api('jobs.preview', { file: this.jobPath, mode: 'FFF' })
				this.preview = jobLayers(r)
				this.previewFile = this.jobPath
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		// a refusal of the service (limits, a profile that is on) says why in its own words; a missing session / role / service goes to ErrorNotice
		fail(e) {
			if (e && e.code === 'cancelled') return
			if (e && (e.code === 'invalid_args' || e.code === 'conflict')) this.say('error', e.message)
			else this.failure = e
		}
	}
}
</script>

<style scoped>
.pl-live { border-left: 3px solid var(--wf-line, rgba(128, 128, 128, 0.4)); padding-left: 10px; }
.pl-scroll { overflow-x: auto; max-width: 100%; }
.pl-table { border-collapse: collapse; min-width: 100%; }
.pl-table th { text-align: left; font-weight: 500; font-size: 12px; padding: 2px 6px; white-space: nowrap; }
.pl-table td { padding: 3px 4px; vertical-align: middle; }
.pl-cell { min-width: 84px; max-width: 120px; }
.pl-falls { font-size: 12px; white-space: nowrap; }
.pl-svg { display: block; width: 100%; max-width: 720px; height: auto; }
.pl-grid { stroke: rgba(128, 128, 128, 0.2); stroke-width: 1; }
.pl-axis { fill: var(--tp-faint, #9e9e9e); font-size: 11px; }
.pl-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; }
.pl-key { display: inline-block; width: 18px; height: 0; border-top: 3px solid currentColor; margin-right: 6px; vertical-align: middle; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 400px) {
	.pl-cell { min-width: 72px; }
	.pl-card { padding: 8px !important; }
}
</style>
