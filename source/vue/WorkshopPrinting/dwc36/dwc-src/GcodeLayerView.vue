<template>
	<section class="glv" :aria-labelledby="uid + '-title'">
		<div class="d-flex align-center flex-wrap" style="gap:4px">
			<v-icon small aria-hidden="true">mdi-text-search</v-icon>
			<h3 :id="uid + '-title'" class="text-subtitle-1 font-weight-medium">{{ tx('title') }}</h3>
			<help-tip :title="tx('title')" :what="tx('help_what')" :why="tx('help_why')" :if-missing="tx('help_miss')" :how="tx('help_how')" />
		</div>
		<p class="text-caption mt-1 mb-2">{{ tx('lead') }}</p>
		<div class="wf-note" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('read_only') }}</span></div>

		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small outlined class="glv-btn" :loading="loading" :disabled="loading" @click="$emit('read')"><v-icon small left>mdi-file-search-outline</v-icon>{{ tx(data ? 'read_again' : 'read') }}</v-btn>
			<span v-if="recipeName" class="text-caption glv-wrap">{{ tx('recipe', { name: recipeName }) }}</span>
		</div>

		<error-notice v-if="error" :error="error" :action="tx('acting')" class="mt-2" />

		<div v-if="loading && !data" class="text-caption mt-2" role="status">{{ tx('loading') }}</div>
		<div v-if="!data && !loading && !error" class="text-caption mt-2">{{ tx('not_read') }}</div>

		<template v-if="data">
			<div class="text-body-2 mt-3 glv-wrap" role="status">{{ tx('file_summary', { file: data.file || '-', layers: data.layers }) }}</div>

			<section v-if="fileInfo.known" class="glv-file mt-2" :aria-labelledby="uid + '-file'">
				<h4 :id="uid + '-file'" class="text-subtitle-2">{{ tx(fileInfo.none ? 'file_sets_none_title' : (fileInfo.count === 1 ? 'file_sets_title_one' : 'file_sets_title'), { count: fileInfo.count }) }}</h4>
				<div v-if="fileInfo.none" class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('file_sets_none') }}</span></div>
				<template v-else>
					<div v-if="fileInfo.inPrinting" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('file_sets_in_print') }}</span></div>
					<div v-else class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('file_sets_start_only') }}</span></div>
					<div class="glv-code glv-code-file mt-1" role="region" tabindex="0" :aria-label="tx('file_sets_label')">
						<div v-for="l in fileLines" :key="l.line" class="glv-line">
							<span class="glv-n" aria-hidden="true">{{ l.line }}</span>
							<span class="glv-text"><span class="sr-only">{{ tx('line_n', { n: l.line }) }} </span><span v-for="(tk, j) in tokensOf(l.text)" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></span>
							<span class="glv-tag glv-tag-soft">{{ tx('kind_' + l.kind) }}</span>
						</div>
					</div>
					<div v-if="fileInfo.truncated" class="text-caption mt-1">{{ tx('file_sets_truncated', { shown: fileInfo.lines.length, count: fileInfo.count }) }}</div>
					<v-btn v-if="fileInfo.lines.length > FILE_HEAD" small outlined class="glv-btn mt-1" :aria-expanded="fileAll ? 'true' : 'false'" @click="fileAll = !fileAll"><v-icon small left>{{ fileAll ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ fileAll ? tx('file_show_less') : tx('file_show_all', { n: fileInfo.lines.length }) }}</v-btn>
				</template>
			</section>

			<div v-for="k in noteKeys" :key="k" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ noteText(k) }}</span></div>
			<div v-if="data.truncated && noteKeys.indexOf('preview_truncated') < 0" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('truncated') }}</span></div>

			<div v-if="!data.changes.length" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('no_changes') }}</span></div>

			<template v-else>
				<ul class="glv-summary mt-2" :aria-label="tx('summary_label')">
					<li>{{ tx('sum_changes', { n: sum.count }) }}</li>
					<li>{{ tx('sum_layers', { first: sum.firstLayer, last: sum.lastLayer }) }}</li>
					<li v-if="sum.extruder">{{ tx('sum_extruder', { count: sum.extruderCount, min: sum.extruder.min, max: sum.extruder.max }) }}</li>
					<li v-if="sum.bed">{{ tx('sum_bed', { count: sum.bedCount, min: sum.bed.min, max: sum.bed.max }) }}</li>
					<li v-if="sum.limitedCount">{{ tx('sum_limited', { n: sum.limitedCount }) }}</li>
				</ul>

				<div class="d-flex align-end flex-wrap mt-3" style="gap:12px" role="group" :aria-label="tx('filter_label')">
					<div>
						<div :id="uid + '-track'" class="text-caption">{{ tx('filter_track') }}</div>
						<v-btn-toggle v-model="track" mandatory dense class="glv-toggle" :aria-labelledby="uid + '-track'">
							<v-btn v-for="t in trackItems" :key="t.value" :value="t.value" class="glv-btn" :aria-label="t.text">{{ t.text }}</v-btn>
						</v-btn-toggle>
					</div>
					<v-text-field v-model="layerFrom" type="number" min="0" inputmode="numeric" dense outlined hide-details class="glv-range" :label="tx('filter_from')" :aria-label="tx('filter_from')" />
					<v-text-field v-model="layerTo" type="number" min="0" inputmode="numeric" dense outlined hide-details class="glv-range" :label="tx('filter_to')" :aria-label="tx('filter_to')" />
				</div>

				<div class="text-caption mt-2" role="status" aria-live="polite">{{ tx('showing', { shown: visible.length, total: filtered.length }) }}</div>
				<div v-if="!filtered.length" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('filter_none') }}</span></div>

				<ol class="glv-list mt-2">
					<li v-for="(c, i) in visible" :key="c.layer + ':' + i" class="glv-card" :aria-labelledby="uid + '-h' + i">
						<h4 :id="uid + '-h' + i" class="glv-head text-subtitle-2">{{ heading(c) }}</h4>
						<div v-if="legend(c).length" class="glv-legend text-caption">
							<span v-for="p in legend(c)" :key="p.track" class="glv-wrap"><v-icon x-small aria-hidden="true">{{ p.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ p.text }}</span>
						</div>

						<div v-if="columnsOf(c)" class="glv-cols mt-2" role="group" :aria-label="tx('cols_label', { layer: c.layer })">
							<div class="glv-col">
								<div class="text-caption font-weight-medium">{{ tx('col_file') }}</div>
								<div v-for="g in columnsOf(c)" :key="g.track" class="text-body-2 glv-wrap">
									<template v-if="g.notSet"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ tx('track_' + g.track) }}: {{ tx('col_file_none') }}</template>
									<template v-else><div v-for="z in g.zones" :key="z.name"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ tx('zone_file_value', { name: z.name, file: z.file === null ? '-' : z.file }) }}</div></template>
								</div>
							</div>
							<div class="glv-col">
								<div class="text-caption font-weight-medium">{{ tx('col_recipe') }}</div>
								<div v-for="g in columnsOf(c)" :key="g.track" class="text-body-2 glv-wrap">
									<div v-for="z in g.zones" :key="z.name"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ z.name }}: {{ z.text }}</div>
								</div>
							</div>
						</div>

						<div class="text-caption mt-2">{{ tx('context_title') }}</div>
						<div class="glv-code" role="region" tabindex="0" :aria-label="tx('context_label', { layer: c.layer })">
							<div v-for="l in rowsOf(c).lines" :key="l.n" class="glv-line" :class="{ 'is-start': l.start, 'is-conflict': l.conflict }" :aria-current="l.start ? 'location' : null">
								<span class="glv-n" aria-hidden="true">{{ l.n }}</span>
								<span class="glv-text"><span class="sr-only">{{ tx('line_n', { n: l.n }) }} </span><span v-for="(tk, j) in l.tokens" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></span>
								<span v-if="l.start" class="glv-tag">{{ tx(l.insert ? 'line_insert' : 'line_start') }}</span>
								<span v-if="l.conflict" class="glv-tag glv-tag-warn">{{ tx('line_conflict') }}</span>
							</div>
						</div>

						<div v-if="conflictsOf(c).length" class="glv-conflicts mt-2" role="group" :aria-label="tx('conflicts_label', { layer: c.layer })">
							<div v-for="x in conflictsOf(c)" :key="x.line" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span class="glv-wrap">{{ tx(x.sameLayer ? 'conflict_text' : 'conflict_text_other', { line: x.line }) }} <code class="glv-code-inline"><span v-for="(tk, j) in x.tokens" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></code></span></div>
						</div>

						<div v-if="rowsOf(c).commands.length" class="glv-send mt-2" role="group" :aria-label="tx('send_title')">
							<div class="text-caption font-weight-medium">{{ tx('send_title') }}</div>
							<div class="glv-code glv-code-send" role="region" tabindex="0" :aria-label="tx('send_label', { layer: c.layer })">
								<div v-for="(cmd, j) in rowsOf(c).commands" :key="j" class="glv-line">
									<span class="glv-n" aria-hidden="true"><v-icon x-small>{{ cmd.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon></span>
									<span class="glv-text"><span class="sr-only">{{ tx(cmd.track === 'bed' ? 'track_bed' : 'track_extruder') }}: </span><span v-for="(tk, k) in cmd.tokens" :key="k" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></span>
								</div>
							</div>
							<div v-for="cmd in limitedOf(c)" :key="cmd.track" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx(cmd.track === 'bed' ? 'limited_bed' : 'limited_extruder', { temps: temps(cmd) }) }}</span></div>
						</div>
					</li>
				</ol>

				<v-btn v-if="rest > 0" small outlined class="glv-btn mt-3" @click="more()"><v-icon small left>mdi-chevron-down</v-icon>{{ tx('show_more', { n: Math.min(page, rest), rest: rest }) }}</v-btn>
			</template>

			<section v-if="data.layersTable.length" class="glv-glance mt-4" :aria-labelledby="uid + '-glance'">
				<h4 :id="uid + '-glance'" class="text-subtitle-2">{{ tx('glance_title') }}</h4>
				<p class="text-caption mb-1">{{ tx('glance_lead') }}</p>
				<v-switch v-model="tableAll" dense hide-details class="mt-0" :label="tx('glance_all')" />
				<div class="text-caption mt-1" role="status" aria-live="polite">{{ tx('glance_showing', { shown: tableVisible.length, total: tableList.length }) }}</div>
				<div v-if="!tableList.length" class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('glance_none') }}</span></div>
				<div v-else class="glv-tablewrap" role="region" tabindex="0" :aria-label="tx('glance_title')">
					<table class="glv-table">
						<caption class="sr-only">{{ tx('glance_title') }}</caption>
						<thead>
							<tr>
								<th scope="col" rowspan="2">{{ tx('glance_layer') }}</th>
								<th v-if="track !== 'bed'" scope="colgroup" colspan="2">{{ tx('track_extruder') }}</th>
								<th v-if="track !== 'extruder'" scope="colgroup" colspan="2">{{ tx('track_bed') }}</th>
								<th scope="col" rowspan="2">{{ tx('glance_state') }}</th>
							</tr>
							<tr>
								<template v-if="track !== 'bed'"><th scope="col">{{ tx('glance_file') }}</th><th scope="col">{{ tx('glance_recipe') }}</th></template>
								<template v-if="track !== 'extruder'"><th scope="col">{{ tx('glance_file') }}</th><th scope="col">{{ tx('glance_recipe') }}</th></template>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in tableVisible" :key="r.layer" :class="{ 'is-differs': r.differs }">
								<th scope="row">{{ r.layer }}</th>
								<template v-if="track !== 'bed'"><td>{{ r.cells.extruder.file || '-' }}</td><td>{{ r.cells.extruder.recipe || '-' }}</td></template>
								<template v-if="track !== 'extruder'"><td>{{ r.cells.bed.file || '-' }}</td><td>{{ r.cells.bed.recipe || '-' }}</td></template>
								<td>{{ tx(r.differs ? 'glance_differs' : (r.change ? 'glance_change' : 'glance_same')) }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<v-btn v-if="tableRest > 0" small outlined class="glv-btn mt-2" @click="tableLimit += TABLE_PAGE"><v-icon small left>mdi-chevron-down</v-icon>{{ tx('show_more', { n: Math.min(TABLE_PAGE, tableRest), rest: tableRest }) }}</v-btn>
			</section>
		</template>
	</section>
</template>

<script>
'use strict'

// Read-only viewer: the real lines of the job file around every layer where a temperature recipe changes a temperature, the command the service would
// send there and the temperatures after the limits. It never changes the file and never sends anything: the parent makes the call
// (layerrecipes.preview) and hands the answer in `preview`.
//
//   <gcode-layer-view :preview="answer" :loading="busy" :error="failure" recipe-name="PLA" @read="readJob()" />
//
// Events: read (the person asks to read the job file again).

import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import { normalize, noteKey, filterChanges, summary, buildRows, describeChange, formatZ, formatTemps, fileSummary, compareChange, conflictLines, tableRows, tokenizeLine } from './gcode-layer-view.js'

const AREA = 'plugins.WorkshopPrinting.gcodeView.'
const PAGE = 20
const FILE_HEAD = 5 // lines of the file's own temperature commands listed before 'show all'
const TABLE_PAGE = 50
let counter = 0

export default {
	components: { HelpTip, ErrorNotice },
	props: {
		preview: { type: Object, default: null },
		loading: { type: Boolean, default: false },
		error: { type: [Error, Object, String], default: null },
		recipeName: { type: String, default: '' }
	},
	data() {
		counter += 1
		return { uid: 'glv' + counter, track: 'all', layerFrom: '', layerTo: '', page: PAGE, limit: PAGE, fileAll: false, tableAll: false, tableLimit: TABLE_PAGE, FILE_HEAD, TABLE_PAGE }
	},
	computed: {
		data() {
			return normalize(this.preview)
		},
		noteKeys() {
			// the file-sets note is the header block of the file's own lines (same sentence), not a second warning
			return this.data ? this.data.notes.filter((k) => noteKey(k) !== 'preview_file_sets') : []
		},
		fileInfo() {
			return fileSummary(this.data, this.fileAll ? 60 : FILE_HEAD)
		},
		fileLines() {
			return this.fileAll ? this.fileInfo.lines : this.fileInfo.shown
		},
		tableList() {
			return this.data ? tableRows(this.data, { all: this.tableAll, track: this.track, layerFrom: this.layerFrom, layerTo: this.layerTo }) : []
		},
		tableVisible() {
			return this.tableList.slice(0, this.tableLimit)
		},
		tableRest() {
			return Math.max(0, this.tableList.length - this.tableLimit)
		},
		trackItems() {
			return [{ value: 'all', text: this.tx('track_all') }, { value: 'extruder', text: this.tx('track_extruder') }, { value: 'bed', text: this.tx('track_bed') }]
		},
		filtered() {
			return this.data ? filterChanges(this.data.changes, { layerFrom: this.layerFrom, layerTo: this.layerTo, track: this.track }) : []
		},
		sum() {
			return summary(this.filtered)
		},
		visible() {
			return this.filtered.slice(0, this.limit)
		},
		rest() {
			return Math.max(0, this.filtered.length - this.limit)
		}
	},
	watch: {
		// a new answer or another filter starts again from the first cards
		preview() { this.limit = PAGE; this.tableLimit = TABLE_PAGE },
		track() { this.limit = PAGE; this.tableLimit = TABLE_PAGE },
		layerFrom() { this.limit = PAGE; this.tableLimit = TABLE_PAGE },
		layerTo() { this.limit = PAGE; this.tableLimit = TABLE_PAGE },
		tableAll() { this.tableLimit = TABLE_PAGE }
	},
	methods: {
		tx(key, params) {
			return this.$t(AREA + key, params)
		},
		noteText(key) {
			const k = noteKey(key)
			if (k === 'preview_unknown') return this.tx('preview_unknown', { key })
			const p = (this.data && this.data.noteParams[key]) || {}
			const track = p.track === 'bed' || p.track === 'extruder' ? this.tx('track_' + p.track) : (typeof p.track === 'string' ? p.track : '')
			return this.tx(k, { track, count: this.fileInfo.count })
		},
		heading(c) {
			const layer = c.z === null ? this.tx('head_layer', { layer: c.layer }) : this.tx('head_layer_z', { layer: c.layer, z: formatZ(c.z) })
			return c.line === null ? layer : layer + ' - ' + this.tx('head_line', { line: c.line })
		},
		legend(c) {
			return describeChange(c, (key, params) => this.tx(key, params))
		},
		columnsOf(c) {
			return compareChange(c, (key, params) => this.tx(key, params))
		},
		conflictsOf(c) {
			return conflictLines(c)
		},
		tokensOf(text) {
			return tokenizeLine(text)
		},
		rowsOf(c) {
			return buildRows(c, this.track)
		},
		limitedOf(c) {
			const seen = {}
			return this.rowsOf(c).commands.filter((x) => x.limited && !seen[x.track] && (seen[x.track] = true))
		},
		temps(cmd) {
			return formatTemps(cmd.temps)
		},
		more() {
			this.limit += PAGE
		}
	}
}
</script>

<style scoped>
.glv { min-width: 0; max-width: 100%; }
.glv-btn.v-btn:not(.v-btn--icon) { height: 44px; min-height: 44px; }
.glv-range { max-width: 140px; }
.glv-wrap { overflow-wrap: anywhere; }
.glv-summary { list-style: none; margin: 0; padding: 0 0 0 10px; border-left: 3px solid var(--wf-line); font-size: 13px; }
.glv-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.glv-card { min-width: 0; padding: 10px; border: 1px solid var(--wf-line); border-radius: 6px; }
.glv-head { margin: 0; overflow-wrap: anywhere; }
.glv-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.glv-code { max-width: 100%; max-height: 260px; overflow: auto; border: 1px solid var(--wf-line); border-radius: 4px; font-family: var(--tp-font-mono, monospace); font-size: 12px; line-height: 1.5; }
.glv-code:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 1px; }
.glv-line { display: flex; align-items: flex-start; gap: 8px; padding: 0 8px; border-left: 4px solid transparent; }
.glv-line.is-start { border-left-color: var(--wf-accent); font-weight: 700; background: var(--wf-soft); }
.glv-n { flex: none; min-width: 5ch; text-align: right; opacity: 0.7; user-select: none; }
.glv-text { flex: 1 1 auto; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.glv-tag { flex: none; align-self: center; padding: 0 6px; border: 1px solid var(--wf-accent); border-radius: 4px; font-family: inherit; font-size: 11px; font-weight: 700; white-space: nowrap; }
.glv-t-code, .glv-t-temp { font-weight: 700; }
.glv-t-temp { text-decoration: underline; }
.glv-t-conflict { font-weight: 700; text-decoration: underline wavy; }
.glv-line.is-conflict { border-left-color: var(--wf-warn); background: var(--wf-soft); }
.glv-tag-warn { border-color: var(--wf-warn); }
.glv-tag-soft { border-color: var(--wf-line-strong); font-weight: 400; }
.glv-code-file { max-height: 320px; }
.glv-code-inline { font-family: var(--tp-font-mono, monospace); font-size: 12px; }
.glv-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
.glv-col { min-width: 0; padding-left: 8px; border-left: 3px solid var(--wf-line); }
.glv-tablewrap { max-width: 100%; max-height: 360px; overflow: auto; border: 1px solid var(--wf-line); border-radius: 4px; margin-top: 4px; }
.glv-tablewrap:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 1px; }
.glv-table { border-collapse: collapse; width: 100%; font-size: 13px; }
.glv-table th, .glv-table td { padding: 4px 8px; border-bottom: 1px solid var(--wf-line); text-align: left; white-space: nowrap; }
.glv-table tr.is-differs th, .glv-table tr.is-differs td { font-weight: 700; background: var(--wf-soft); }
.glv-t-comment { font-style: italic; opacity: 0.75; }
.glv-send { padding-top: 8px; border-top: 2px dashed var(--wf-line-strong); }
.glv-code-send { margin-top: 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 480px) {
	.glv-card { padding: 8px; }
	.glv-cols { grid-template-columns: 1fr; }
	.glv-n { min-width: 4ch; }
	.glv-range { max-width: none; flex: 1 1 120px; }
}
</style>
