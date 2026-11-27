<template>
	<section class="glv" :aria-labelledby="uid + '-title'">
		<div class="d-flex align-center flex-wrap" style="gap:4px">
			<v-icon small aria-hidden="true">mdi-text-search</v-icon>
			<h3 :id="uid + '-title'" class="text-subtitle-1 font-weight-medium">{{ tx('title') }}</h3>
			<pc-help :title="tx('title')" :what="tx('help_what')" :why="tx('help_why')" :if-missing="tx('help_miss')" :how="tx('help_how')" />
		</div>
		<p class="glv-lead mt-1 mb-2">{{ tx('lead') }} {{ tx('read_only') }}</p>

		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small outlined class="glv-btn" :loading="loading" :disabled="loading" @click="$emit('read')"><v-icon small left>mdi-file-search-outline</v-icon>{{ tx(data ? 'read_again' : 'read') }}</v-btn>
		</div>

		<error-notice v-if="error" :error="error" :action="tx('acting')" class="mt-2" />

		<div v-if="loading && !data" class="text-caption mt-2" role="status">{{ tx('loading') }}</div>
		<div v-if="!data && !loading && !error" class="text-caption mt-2">{{ tx('not_read') }}</div>

		<template v-if="data">
			<div class="text-body-2 mt-3 glv-wrap" role="status">{{ tx('file_summary', { file: data.file || '-', layers: data.layers }) }}</div>
			<dl class="glv-stats mt-2" :aria-label="tx('stats_label')">
				<div v-if="fileInfo.known"><dt>{{ tx('stat_lines') }}</dt><dd>{{ fileInfo.count }}</dd></div>
				<div><dt>{{ tx('stat_changes') }}</dt><dd>{{ data.changes.length }}</dd></div>
				<div><dt>{{ tx('stat_layers') }}</dt><dd>{{ data.layers }}</dd></div>
				<div><dt>{{ tx('stat_material') }}</dt><dd class="glv-wrap">{{ recipeName || '-' }}</dd></div>
			</dl>
			<ul class="glv-colors mt-2" :aria-label="tx('legend_title')">
				<li class="glv-tag glv-tag-bed">{{ tx('kind_bed') }}</li>
				<li class="glv-tag glv-tag-extruder">{{ tx('kind_extruder') }}</li>
				<li class="glv-tag glv-tag-insert">{{ tx('line_insert') }}</li>
				<li class="glv-colors-hint">{{ tx('legend_hint') }}</li>
			</ul>

			<section v-if="fileInfo.known" class="glv-file mt-3" :aria-labelledby="uid + '-file'">
				<h4 :id="uid + '-file'" class="glv-h"><v-icon small aria-hidden="true">mdi-file-code-outline</v-icon>{{ tx(fileInfo.none ? 'file_sets_none_title' : (fileInfo.count === 1 ? 'file_sets_title_one' : 'file_sets_title'), { count: fileInfo.count }) }}</h4>
				<div v-if="fileInfo.none" class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('file_sets_none') }}</span></div>
				<details v-else class="pc-fold glv-fold mt-1" :open="fileInfo.inPrinting">
					<summary class="pc-fold-sum">{{ tx('file_lines_open') }}</summary>
					<div v-if="!fileInfo.inPrinting" class="wf-field-msg is-hint">{{ tx('file_sets_start_only') }}</div>
					<div class="glv-code glv-code-file mt-1" role="region" tabindex="0" :aria-label="tx('file_sets_label')">
						<div v-for="l in fileLines" :key="l.line" class="glv-line">
							<span class="glv-n" aria-hidden="true">{{ l.line }}</span>
							<span class="glv-text"><span class="sr-only">{{ tx('line_n', { n: l.line }) }} </span><span v-for="(tk, j) in tokensOf(l.text)" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></span>
							<span :class="'glv-tag glv-tag-' + l.kind">{{ tx('kind_' + l.kind) }}</span>
						</div>
					</div>
					<div v-if="fileInfo.truncated" class="text-caption mt-1">{{ tx('file_sets_truncated', { shown: fileInfo.lines.length, count: fileInfo.count }) }}</div>
					<v-btn v-if="fileInfo.lines.length > FILE_HEAD" small outlined class="glv-btn mt-1" :aria-expanded="fileAll ? 'true' : 'false'" @click="fileAll = !fileAll"><v-icon small left>{{ fileAll ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ fileAll ? tx('file_show_less') : tx('file_show_all', { n: fileInfo.lines.length }) }}</v-btn>
				</details>
			</section>

			<div v-if="warns.length" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span class="glv-wrap">{{ warns[0] }}</span></div>
			<details v-if="warns.length > 1" class="glv-more-warns mt-1">
				<summary class="glv-more-sum wf-hit">{{ txc('more_warns', warns.length - 1, { n: warns.length - 1 }) }}</summary>
				<div v-for="(w, i) in warns.slice(1)" :key="i" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span class="glv-wrap">{{ w }}</span></div>
			</details>

			<div v-if="!data.changes.length" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('no_changes') }}</span></div>

			<template v-else>
				<ul class="glv-chips mt-2" :aria-label="tx('summary_label')">
					<li><v-chip small outlined>{{ txc('sum_changes', sum.count, { n: sum.count }) }}</v-chip></li>
					<li><v-chip small outlined>{{ tx('sum_layers', { first: sum.firstLayer, last: sum.lastLayer }) }}</v-chip></li>
					<li v-if="sum.extruder"><v-chip small outlined class="glv-chip-extruder">{{ txc('sum_extruder', sum.extruderCount, { count: sum.extruderCount, min: sum.extruder.min, max: sum.extruder.max }) }}</v-chip></li>
					<li v-if="sum.bed"><v-chip small outlined class="glv-chip-bed">{{ txc('sum_bed', sum.bedCount, { count: sum.bedCount, min: sum.bed.min, max: sum.bed.max }) }}</v-chip></li>
					<li v-if="sum.limitedCount"><v-chip small outlined>{{ txc('sum_limited', sum.limitedCount, { n: sum.limitedCount }) }}</v-chip></li>
				</ul>

				<div class="glv-filters mt-3" role="group" :aria-label="tx('filter_label')">
					<div class="glv-f">
						<div :id="uid + '-track'" class="glv-fl">{{ tx('filter_track') }}</div>
						<v-btn-toggle v-model="track" mandatory dense class="glv-toggle" :aria-labelledby="uid + '-track'">
							<v-btn v-for="t in trackItems" :key="t.value" :value="t.value" class="glv-btn" :aria-label="t.text"><v-icon small left aria-hidden="true">{{ t.icon }}</v-icon>{{ t.text }}</v-btn>
						</v-btn-toggle>
					</div>
					<div class="glv-f">
						<label :for="uid + '-from'" class="glv-fl">{{ tx('filter_from') }}</label>
						<v-text-field :id="uid + '-from'" v-model="layerFrom" type="number" min="0" inputmode="numeric" dense outlined hide-details class="glv-range" :placeholder="tx('all_layers')" persistent-placeholder :suffix="tx('layer_unit')" :aria-label="tx('filter_from')" />
					</div>
					<div class="glv-f">
						<label :for="uid + '-to'" class="glv-fl">{{ tx('filter_to') }}</label>
						<v-text-field :id="uid + '-to'" v-model="layerTo" type="number" min="0" inputmode="numeric" dense outlined hide-details class="glv-range" :placeholder="tx('all_layers')" persistent-placeholder :suffix="tx('layer_unit')" :aria-label="tx('filter_to')" />
					</div>
				</div>

				<div class="text-caption mt-2" role="status" aria-live="polite">{{ tx('showing', { shown: visible.length, total: filtered.length }) }}</div>
				<div v-if="!filtered.length" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('filter_none') }}</span></div>

				<ol class="glv-list mt-2">
					<li v-for="(c, i) in visible" :key="c.layer + ':' + i" class="glv-card" :aria-labelledby="uid + '-h' + i">
						<h4 :id="uid + '-h' + i" class="glv-head glv-h"><v-icon small aria-hidden="true">mdi-layers-outline</v-icon>{{ heading(c) }}</h4>
						<div v-if="legend(c).length" class="glv-legend text-caption">
							<v-chip v-for="p in legend(c)" :key="p.track" small outlined :class="'glv-chip-' + p.track"><v-icon x-small left aria-hidden="true">{{ p.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon>{{ p.text }}</v-chip>
						</div>

						<div v-if="columnsOf(c)" class="glv-cols mt-2" role="group" :aria-label="tx('cols_label', { layer: c.layer })">
							<div class="glv-col">
								<div class="glv-ch"><v-icon small aria-hidden="true">mdi-file-document-outline</v-icon>{{ tx('col_file') }}</div>
								<div v-for="g in columnsOf(c)" :key="g.track" class="text-body-2 glv-wrap">
									<template v-if="g.notSet"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ tx('track_' + g.track) }}: {{ tx('col_file_none') }}</template>
									<template v-else><div v-for="z in g.zones" :key="z.name"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ tx('zone_file_value', { name: z.name, file: z.file === null ? '-' : z.file }) }}</div></template>
								</div>
							</div>
							<v-icon class="glv-arrow" aria-hidden="true">mdi-arrow-right-bold-outline</v-icon>
							<div class="glv-col">
								<div class="glv-ch"><v-icon small aria-hidden="true">mdi-flask-outline</v-icon>{{ tx('col_recipe') }}</div>
								<div v-for="g in columnsOf(c)" :key="g.track" class="text-body-2 glv-wrap">
									<div v-for="z in g.zones" :key="z.name"><v-icon x-small aria-hidden="true">{{ g.track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon> {{ z.name }}: {{ z.text }}</div>
								</div>
							</div>
						</div>

						<div class="glv-ch mt-2"><v-icon small aria-hidden="true">mdi-format-list-numbered</v-icon>{{ tx('context_title') }}</div>
						<div class="glv-code" role="region" tabindex="0" :aria-label="tx('context_label', { layer: c.layer })">
							<div v-for="l in rowsOf(c).lines" :key="l.n" class="glv-line" :class="{ 'is-start': l.start, 'is-conflict': l.conflict }" :aria-current="l.start ? 'location' : null">
								<span class="glv-n" aria-hidden="true">{{ l.n }}</span>
								<span class="glv-text"><span class="sr-only">{{ tx('line_n', { n: l.n }) }} </span><span v-for="(tk, j) in l.tokens" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></span>
								<span v-if="l.start" class="glv-tag glv-tag-insert">{{ tx(l.insert ? 'line_insert' : 'line_start') }}</span>
								<span v-if="l.conflict" class="glv-tag glv-tag-warn">{{ tx('line_conflict') }}</span>
							</div>
						</div>

						<div v-if="conflictsOf(c).length" class="glv-conflicts mt-2" role="group" :aria-label="tx('conflicts_label', { layer: c.layer })">
							<div v-for="x in conflictsOf(c)" :key="x.line" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span class="glv-wrap">{{ tx(x.sameLayer ? 'conflict_text' : 'conflict_text_other', { line: x.line }) }} <code class="glv-code-inline"><span v-for="(tk, j) in x.tokens" :key="j" :class="'glv-t-' + tk.kind">{{ tk.text }}</span></code></span></div>
						</div>

						<div v-if="rowsOf(c).commands.length" class="glv-send mt-2" role="group" :aria-label="tx('send_title')">
							<div class="glv-ch"><v-icon small aria-hidden="true">mdi-send-clock-outline</v-icon>{{ tx('send_title') }}</div>
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

import PcHelp from './PcHelp.vue' // the "?" of the title, folded by the section
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import { normalize, noteKey, filterChanges, summary, buildRows, describeChange, formatZ, formatTemps, fileSummary, compareChange, conflictLines, tableRows, tokenizeLine } from './gcode-layer-view.js'

const AREA = 'plugins.WorkshopPrinting.gcodeView.'
const PAGE = 20
const FILE_HEAD = 5 // lines of the file's own temperature commands listed before 'show all'
const TABLE_PAGE = 50
let counter = 0

export default {
	components: { PcHelp, ErrorNotice },
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
			return [{ value: 'all', text: this.tx('track_all'), icon: 'mdi-layers-outline' }, { value: 'extruder', text: this.tx('track_extruder'), icon: 'mdi-printer-3d-nozzle-outline' }, { value: 'bed', text: this.tx('track_bed'), icon: 'mdi-radiator' }]
		},
		// ONE warning in yellow (the first); the others are behind "more": the in-print line of the file, the notes of the service and the truncation
		warns() {
			if (!this.data) return [];
			const out = [];
			if (this.fileInfo.known && !this.fileInfo.none && this.fileInfo.inPrinting) out.push(this.tx('file_sets_in_print'));
			this.noteKeys.forEach(k => out.push(this.noteText(k)));
			if (this.data.truncated && this.noteKeys.indexOf('preview_truncated') < 0) out.push(this.tx('truncated'));
			return out;
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
		// a phrase with its singular and its plural ("1 cambio" / "2 cambios"), by the plural of the catalog
		txc(key, n, params) {
			return this.$tc(AREA + key, n, params)
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
.glv-lead { font-size: 13px; opacity: 0.85; }
.glv-h { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 14px; font-weight: 600; }
.glv-ch { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; opacity: 0.85; }
.glv-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin: 0; }
.glv-stats > div { padding: 6px 10px; border: 1px solid var(--wf-line); border-radius: 8px; min-width: 0; }
.glv-stats dt { font-size: 12px; opacity: 0.75; }
.glv-stats dd { margin: 0; font-family: var(--tp-font-mono, monospace); font-size: 14px; font-weight: 600; }
.glv-colors { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.glv-colors-hint { font-size: 12px; opacity: 0.75; }
.glv-filters { display: flex; flex-flow: row wrap; justify-content: flex-start; align-items: flex-end; align-content: flex-start; gap: 12px; }
.glv-f { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.glv-fl { font-size: 12px; opacity: 0.8; }
.glv-range { width: 140px; flex: 0 1 140px; min-width: 0; }
.glv-wrap { overflow-wrap: anywhere; }
.glv-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.glv-chip-bed { border-color: var(--wf-warn) !important; }
.glv-chip-extruder { border-color: var(--wf-info) !important; }
.glv-more-sum { cursor: pointer; display: inline-flex; align-items: center; min-height: var(--wf-size-s, 32px); font-size: 12px; font-weight: 600; text-decoration: underline; }
.glv-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.glv-card { min-width: 0; padding: 10px; border: 1px solid var(--wf-line); border-radius: 8px; }
.glv-head { overflow-wrap: anywhere; }
.glv-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.glv-code { max-width: 100%; max-height: 260px; overflow: auto; border: 1px solid var(--wf-line); border-radius: 4px; font-family: var(--tp-font-mono, monospace); font-size: 12px; line-height: 1.5; }
.glv-code:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 1px; }
.glv-line { display: flex; align-items: flex-start; gap: 8px; padding: 0 8px; border-left: 4px solid transparent; }
.glv-line.is-start { border-left-color: var(--wf-accent); font-weight: 700; background: var(--wf-soft); }
.glv-n { flex: none; min-width: 5ch; text-align: right; opacity: 0.7; user-select: none; }
.glv-text { flex: 1 1 auto; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.glv-tag { flex: none; align-self: center; padding: 0 6px; border: 1px solid var(--wf-accent); border-radius: 4px; font-family: inherit; font-size: 11px; font-weight: 700; white-space: nowrap; }
.glv-tag-bed { border-color: var(--wf-warn); }
.glv-tag-extruder { border-color: var(--wf-info); }
.glv-tag-chamber { border-color: var(--wf-line-strong); }
.glv-tag-insert { border-color: var(--wf-accent); color: var(--wf-accent); background: var(--wf-soft); }
.glv-t-code, .glv-t-temp { font-weight: 700; }
.glv-t-temp { text-decoration: underline; }
.glv-t-conflict { font-weight: 700; text-decoration: underline wavy; }
.glv-line.is-conflict { border-left-color: var(--wf-warn); background: var(--wf-soft); }
.glv-tag-warn { border-color: var(--wf-warn); }
.glv-code-file { max-height: 320px; }
.glv-code-inline { font-family: var(--tp-font-mono, monospace); font-size: 12px; }
.glv-cols { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 8px; }
.glv-col { min-width: 0; padding: 8px 10px; border: 1px solid var(--wf-line); border-radius: 8px; background: var(--wf-soft); }
.glv-arrow { align-self: center; opacity: 0.7; }
.glv-tablewrap { max-width: 100%; max-height: 360px; overflow: auto; border: 1px solid var(--wf-line); border-radius: 4px; margin-top: 4px; }
.glv-tablewrap:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 1px; }
.glv-table { border-collapse: collapse; width: 100%; font-size: 13px; }
.glv-table th, .glv-table td { padding: 4px 8px; border-bottom: 1px solid var(--wf-line); text-align: left; white-space: nowrap; }
.glv-table tr.is-differs th, .glv-table tr.is-differs td { font-weight: 700; background: var(--wf-soft); }
.glv-t-comment { font-style: italic; opacity: 0.75; }
.glv-send { padding: 8px 10px; border: 2px dashed var(--wf-line-strong); border-radius: 8px; }
.glv-code-send { margin-top: 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@container pg (max-width: 640px) {
	.glv-cols { grid-template-columns: minmax(0, 1fr); }
	.glv-arrow { transform: rotate(90deg); justify-self: center; }
	.glv-range { flex: 1 1 120px; width: auto; }
}
@media (max-width: 480px) {
	.glv-card { padding: 8px; }
	.glv-n { min-width: 4ch; }
}
</style>
