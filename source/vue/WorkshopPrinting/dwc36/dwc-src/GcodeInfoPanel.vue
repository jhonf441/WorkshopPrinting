<template>
	<div class="gl-info">
		<div class="gl-info-head">
			<gcode-thumb v-if="row" :file="row.path" :size="96" :width="192" />
			<div class="gl-info-title">
				<b :title="row && row.path">{{ row ? row.name : '' }}</b>
				<help-tip v-bind="help('info')" />
			</div>
		</div>
		<div v-if="kind" class="gl-kinds">
			<gcode-kind-badge :kind="kind" :tags="tags" :max="3" />
			<help-tip v-bind="helpKind('badge')" />
		</div>
		<div v-if="notPrint" class="gl-note" role="note">{{ tx('kinds.not_a_print') }}</div>
		<dl v-if="rows.length" class="gl-dl">
			<template v-for="r in rows"><dt :key="'k' + r.key">{{ tx(r.labelKey || ('f_' + r.key)) }}</dt><dd :key="'v' + r.key">{{ r.value }}</dd></template>
		</dl>
		<div v-else class="gl-none">{{ tx('info_none') }}</div>
		<div v-if="features.length" class="gl-feats">
			<div class="gl-sub">{{ tx('f_features') }}</div>
			<v-chip v-for="f in features" :key="f" x-small outlined class="mr-1 mb-1">{{ f }}</v-chip>
		</div>
		<!-- the header of the file (key / value comments the slicer wrote), collapsed -->
		<details v-if="headerRows.length" class="gl-header">
			<summary>{{ tx('header') }} ({{ headerRows.length }})<help-tip v-bind="help('header')" /></summary>
			<dl class="gl-dl is-small">
				<template v-for="h in headerRows"><dt :key="'hk' + h[0]">{{ h[0] }}</dt><dd :key="'hv' + h[0]">{{ h[1] }}</dd></template>
			</dl>
		</details>
	</div>
</template>

<script>
'use strict'

// The info panel of the selected file (right side of the library page): the numbers of its summary (slicer, layers, layer height, time, filament, temperatures,
// bbox, size, date), its features and the header key/values of the file in a collapsed section. Read only. `info` is the answer of gcodelib.info; `row` the list row.
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeThumb from './GcodeThumb.vue'
import GcodeKindBadge from './GcodeKindBadge.vue'
import { libText } from './gcode-lib-text.js'
import { kindOf, kindInfoRows, isNotPrint } from './gcode-lib-kinds.js'

const HEADER_MAX = 200

export default {
	mixins: [libText],
	components: { HelpTip, GcodeThumb, GcodeKindBadge },
	props: {
		row: { type: Object, default: null },
		info: { type: Object, default: null }
	},
	computed: {
		summary() {
			return (this.info && this.info.summary) || (this.row && this.row.summary) || null
		},
		rows() {
			return kindInfoRows(this.summary, this.row, this.info && this.info.layers_table)
		},
		kind() {
			return kindOf(this.summary)
		},
		tags() {
			return (this.summary && this.summary.tags) || []
		},
		notPrint() {
			return isNotPrint(this.kind)
		},
		features() {
			return (this.summary && Array.isArray(this.summary.features) ? this.summary.features : []).map(String)
		},
		headerRows() {
			const h = this.info && this.info.header
			return h && typeof h === 'object' ? Object.keys(h).slice(0, HEADER_MAX).map((k) => [k, String(h[k])]) : []
		}
	}
}
</script>

<style scoped>
.gl-info { padding: 8px 10px; overflow-y: auto; height: 100%; box-sizing: border-box; }
.gl-info-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.gl-info-title { min-width: 0; flex: 1 1 auto; display: flex; align-items: center; gap: 4px; }
.gl-info-title b { overflow-wrap: anywhere; }
.gl-dl { display: grid; grid-template-columns: minmax(90px, auto) 1fr; gap: 4px 12px; margin: 0; font-size: 13px; }
.gl-dl dt { opacity: 0.7; }
.gl-dl dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.gl-dl.is-small { font-size: 12px; margin-top: 6px; }
.gl-none { opacity: 0.7; font-size: 13px; }
.gl-kinds { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.gl-note { font-size: 12px; margin: 0 0 8px; padding: 6px 8px; border-radius: 6px; background: rgba(255, 152, 0, 0.14); }
.gl-sub { font-size: 12px; opacity: 0.7; margin: 10px 0 4px; }
.gl-header { margin-top: 12px; }
.gl-header summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
</style>
