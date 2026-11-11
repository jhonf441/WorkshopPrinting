<template>
	<div class="gl-picker">
		<div class="gl-pick-line">
			<v-autocomplete :id="id || undefined" :value="selected" :items="items" item-text="text" item-value="value" :search-input.sync="typed" no-filter dense outlined hide-details :clearable="clearable" :loading="loading" :disabled="disabled" class="gl-pick-field" :placeholder="tx('picker_none')" :aria-label="ariaLabel || tx('picker2.field')" :no-data-text="unsupported ? tx('picker2.unsupported') : failed ? tx('picker2.failed') : (loading ? tx('picker2.loading') : (query ? tx('no_match') : tx('empty')))" @change="onChange" @focus="onFocus">
				<template #prepend-item>
					<gcode-kind-filter :value="kinds" :counts="counts" small :help="false" @input="setKinds" />
				</template>
				<template #item="{ item }">
					<v-list-item-content class="gl-pi">
						<v-list-item-title :class="{ 'gl-pi-muted': item.muted }">{{ item.text }}<v-chip v-if="item.current" x-small outlined color="primary" class="ml-2">{{ tx('picker2.current') }}</v-chip></v-list-item-title>
						<v-list-item-subtitle v-if="item.chip || item.sub" class="gl-pi-sub"><v-chip v-if="item.chip" x-small outlined>{{ tx('state_' + item.chip) }}</v-chip><template v-else><gcode-kind-badge :kind="item.kind" /> <span>{{ item.sub }}</span></template></v-list-item-subtitle>
					</v-list-item-content>
				</template>
			</v-autocomplete>
			<v-btn icon class="gl-pick-browse" :disabled="disabled" :aria-label="tx('picker_open')" :title="tx('picker_open')" @click="open = true"><v-icon>mdi-folder-search-outline</v-icon></v-btn>
			<help-tip v-if="showHelp" v-bind="help('picker')" />
		</div>
		<div v-if="onlyKinds" class="gl-pick-only" role="status">{{ tx('kinds.picker_only', { kinds: kindsText }) }}<v-btn x-small text class="gl-pick-widen" @click="setKinds([])">{{ tx('kinds.show_all') }}</v-btn><help-tip v-bind="helpKind('picker')" /></div>
		<div v-if="showLine && value && line" class="gl-pick-sub">{{ line }}</div>
		<v-dialog v-model="open" max-width="760" :fullscreen="narrow" scrollable content-class="workshop-theme">
			<v-card class="gl-pick-card">
				<v-card-title class="text-subtitle-1">{{ tx('picker_title') }}</v-card-title>
				<v-card-text class="gl-pick-body">
					<gcode-lib-list v-if="open" compact :value="chosen ? chosen.path : value" :initial-kinds="kinds" :persist-kinds="false" @kinds="setKinds" @select="chosen = $event" @status="status = $event" />
				</v-card-text>
				<div v-if="chosen" class="gl-pick-info"><gcode-info-card :file="chosen.path" /></div>
				<v-card-actions>
					<v-spacer />
					<v-btn text class="gl-act" @click="open = false">{{ tx('cancel') }}</v-btn>
					<v-btn color="primary" class="gl-act" :disabled="!chosen" @click="confirm()">{{ tx('picker_use') }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script>
'use strict'

// The select of the G-code library: the ONLY way to choose the job's file is from the library list (decision of the owner, 2026-11-11): there is no
// free text and no typed path, typing only filters the list. A searchable dropdown (v-autocomplete) of the files the library lists, newest first (the job's current file first). Each item is
// light (name and one line of numbers, no thumbnail). Typing sends a debounced `query` to the service, so the dropdown never holds the whole library (200 rows at
// most). The small button beside it opens the dialog (folders, thumbnails, info card) for navigating subfolders. It emits `input` with the path (v-model) and `info`
// with the summary of the file (from the list row, no extra call). An old service without the library gets an empty select that says so (never a text field); a failed read never throws.
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeLibList from './GcodeLibList.vue'
import GcodeInfoCard from './GcodeInfoCard.vue'
import GcodeKindFilter from './GcodeKindFilter.vue'
import GcodeKindBadge from './GcodeKindBadge.vue'
import { libText } from './gcode-lib-text.js'
import { baseName, shortLine, fullPath } from './gcode-lib-format.js'
import { isUnsupported } from './gcode-lib-list.js'
import { normalizeFilter, isAll, kindMeta } from './gcode-lib-kinds.js'
import { lib } from './gcode-lib-shared.js'
import { PICK_DEBOUNCE, pickListArgs, nextSearch, buildPickItems } from './gcode-pick-items.js'

export default {
	mixins: [libText],
	components: { HelpTip, GcodeLibList, GcodeInfoCard, GcodeKindFilter, GcodeKindBadge },
	props: {
		value: { type: String, default: '' },
		disabled: { type: Boolean, default: false },
		clearable: { type: Boolean, default: false },
		jobFile: { type: String, default: '' }, // the file the machine has loaded: the first item, "Current job"
		id: { type: String, default: '' }, // the id of the field (the page's label points at it)
		ariaLabel: { type: String, default: '' },
		showHelp: { type: Boolean, default: true }, // false when the page puts its own "?" next to the label
		defaultKinds: { type: Array, default: () => [] }, // the kinds listed at first ([] = all; ['fff'] = 3D prints only, with a visible way to widen it)
		showLine: { type: Boolean, default: true } // the numbers of the chosen file under the field (a page with an info card turns it off)
	},
	data() {
		return { open: false, chosen: null, status: null, known: null, rows: [], typed: '', query: '', loading: false, failed: false, unsupported: false, jobInfo: null, kinds: normalizeFilter(this.defaultKinds), counts: null }
	},
	computed: {
		onlyKinds() {
			return !isAll(this.kinds)
		},
		kindsText() {
			return this.kinds.map((k) => this.tx('kinds.' + kindMeta(k).short)).join(', ')
		},
		selected() {
			return this.value ? fullPath(this.value) : null
		},
		name() {
			return baseName(this.value)
		},
		narrow() {
			return !!(this.$vuetify && this.$vuetify.breakpoint && this.$vuetify.breakpoint.smAndDown)
		},
		summary() {
			if (!this.value) return null
			const k = this.known && fullPath(this.known.path) === this.selected ? this.known.summary : null
			return k || (lib.cachedInfo(this.selected) || {}).summary || (lib.cachedInfo(this.value) || {}).summary || null
		},
		line() {
			return this.summary ? shortLine(this.summary).join('  ') : ''
		},
		items() {
			return buildPickItems(this.rows, { jobFile: this.jobFile, jobInfo: this.jobInfo, value: this.value, valueInfo: this.summary })
		}
	},
	watch: {
		open(v) {
			if (v) this.chosen = null
		},
		typed(t) {
			clearTimeout(this.typeTimer)
			if (nextSearch(t, this.name, this.query) === null) return
			this.typeTimer = setTimeout(() => this.search(), PICK_DEBOUNCE)
		},
		jobFile() {
			this.loadJobInfo()
		}
	},
	mounted() {
		this.load()
		this.loadJobInfo()
	},
	beforeDestroy() {
		this.generation = (this.generation || 0) + 1
		clearTimeout(this.typeTimer)
	},
	methods: {
		// runs the search of the typed text (once the person stopped typing)
		search() {
			const q = nextSearch(this.typed, this.name, this.query)
			if (q === null) return Promise.resolve()
			this.query = q
			return this.load()
		},
		// the rows of the dropdown: the first 200 of the folder, or of the search
		load() {
			this.generation = (this.generation || 0) + 1
			const gen = this.generation
			this.loading = true
			return lib.list(pickListArgs(this.query, '', this.kinds)).then((out) => {
				if (gen !== this.generation) return
				this.unsupported = false
				this.failed = false
				this.rows = (out && out.rows) || []
				if (out && out.counts && typeof out.counts === 'object') this.counts = out.counts
				this.loading = false
			}, (e) => {
				if (gen !== this.generation) return
				this.loading = false
				if (isUnsupported(e)) this.unsupported = true
				else if (!e || e.code !== 'cancelled') this.failed = true
			})
		},
		// the chips of the dropdown or of the dialog: list again with the new kinds
		setKinds(list) {
			this.kinds = normalizeFilter(list)
			this.load()
		},
		onFocus() {
			// a failed read is tried again when the person opens the field
			if (this.failed && !this.loading) this.load()
		},
		// the numbers of the job file when the library knows it (one cached call)
		loadJobInfo() {
			this.jobInfo = null
			const path = this.jobFile ? fullPath(this.jobFile) : ''
			if (!path) return
			const cached = lib.cachedInfo(path)
			if (cached && cached.summary) { this.jobInfo = cached.summary; return }
			lib.info(path).then((o) => { if (o && o.summary && fullPath(this.jobFile) === path) this.jobInfo = o.summary }, () => {})
		},
		// the select changed: a path from an item, or null when it was cleared
		onChange(path) {
			if (!path) {
				this.known = null
				this.$emit('input', '')
				this.$emit('info', null)
				return
			}
			const item = this.items.find((i) => i.value === path)
			this.pick({ path, summary: item ? item.summary : null })
		},
		pick(row) {
			this.known = { path: row.path, summary: row.summary || null }
			this.$emit('input', row.path)
			this.$emit('info', row.summary || null)
			if (!row.summary) lib.info(row.path).then((o) => { if (o && o.summary && this.selected === fullPath(row.path)) { this.known = { path: row.path, summary: o.summary }; this.$emit('info', o.summary) } }, () => {})
		},
		confirm() {
			const row = this.chosen
			if (!row) return
			this.pick(row)
			this.open = false
		}
	}
}
</script>

<style scoped>
.gl-pick-line { display: flex; align-items: center; gap: 4px; }
.gl-pick-field { min-width: 240px; max-width: 100%; }
.gl-pick-browse.v-btn { width: 44px; height: 44px; }
.gl-pi-muted { opacity: 0.6; }
.gl-pi-sub { font-size: 12px; }
.gl-pick-only { font-size: 12px; margin-top: 2px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.gl-pick-widen.v-btn { min-height: 44px; }
.gl-pick-sub { font-size: 12px; opacity: 0.75; margin-top: 2px; }
.gl-pick-body { height: 60vh; padding: 0 !important; }
.gl-pick-info { padding: 6px 16px; }
.gl-act.v-btn { min-height: 44px; }
</style>
