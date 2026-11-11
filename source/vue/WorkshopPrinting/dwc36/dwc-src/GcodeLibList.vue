<template>
	<div class="gl-list" :class="{ 'is-compact': compact }">
		<!-- search and sort (the service filters and sorts: this page never has all the files) -->
		<div class="gl-bar">
			<v-text-field v-model="query" dense outlined hide-details clearable prepend-inner-icon="mdi-magnify" class="gl-search" :placeholder="tx('search')" :aria-label="tx('search')" />
			<help-tip v-bind="help('search')" />
		</div>
		<div class="gl-bar">
			<v-select v-model="sort" :items="sortItems" dense outlined hide-details class="gl-sort" :aria-label="tx('sort')" />
			<v-btn icon class="gl-btn" :aria-label="desc ? tx('sort_desc') : tx('sort_asc')" :title="desc ? tx('sort_desc') : tx('sort_asc')" @click="desc = !desc"><v-icon>{{ desc ? 'mdi-sort-descending' : 'mdi-sort-ascending' }}</v-icon></v-btn>
			<v-btn icon class="gl-btn" :aria-label="tx('reload')" :title="tx('reload')" @click="reload()"><v-icon>mdi-refresh</v-icon></v-btn>
			<help-tip v-bind="help('sort')" />
		</div>

		<gcode-kind-filter :value="kinds" :counts="counts" @input="setKinds" />

		<!-- sub-folders of the folder shown, and the way back up -->
		<div v-if="cur || dirs.length" class="gl-dirs">
			<button v-if="cur" type="button" class="gl-dir" @click="up()"><v-icon small>mdi-arrow-up-left</v-icon>{{ tx('dir_up') }}</button>
			<button v-for="d in dirs" :key="d" type="button" class="gl-dir" @click="enter(d)"><v-icon small>mdi-folder-outline</v-icon>{{ d }}</button>
			<help-tip v-bind="help('folders')" />
		</div>

		<v-alert v-if="unsupported" dense text type="warning" class="ma-2" role="alert">{{ tx('service_old') }}</v-alert>
		<error-notice v-else-if="failure" :error="failure" :action="tx('listing')" retry class="ma-2" @retry="reload()" />

		<div v-if="pending > 0" class="gl-pending" role="status">
			<span>{{ tx('indexing', { n: pending }) }}</span>
			<v-progress-linear indeterminate height="3" />
		</div>

		<div v-if="empty" class="gl-empty" role="status">{{ query || kinds.length ? tx('no_match') : tx('empty') }}</div>

		<!-- only the visible rows exist in the DOM: the scroll area is as tall as the whole list, the rows sit at their position -->
		<div v-show="!empty && !unsupported" ref="scroll" class="gl-scroll" role="listbox" :aria-label="tx('list_label')" @scroll.passive="onScroll">
			<div class="gl-space" :style="{ height: total * rowHeight + 'px' }">
				<div v-for="i in indexes" :key="i" class="gl-row" role="option" tabindex="0" :class="{ 'is-sel': rowAt(i) && rowAt(i).path === value, 'is-wait': !rowAt(i) }" :aria-selected="rowAt(i) && rowAt(i).path === value ? 'true' : 'false'" :style="{ top: i * rowHeight + 'px', height: rowHeight + 'px' }" @click="pick(rowAt(i))" @keydown.enter.prevent="pick(rowAt(i))" @keydown.space.prevent="pick(rowAt(i))">
					<template v-if="rowAt(i)">
						<gcode-thumb :key="rowAt(i).path + ':' + rowAt(i).state" :file="rowAt(i).path" :size="compact ? 40 : 48" />
						<div class="gl-main">
							<div class="gl-name" :title="rowAt(i).path">{{ rowAt(i).name }}</div>
							<div v-if="chip(rowAt(i))" class="gl-sub">
								<v-chip x-small outlined :color="chip(rowAt(i)).color"><v-icon x-small left>{{ chip(rowAt(i)).icon }}</v-icon>{{ tx('state_' + chip(rowAt(i)).kind) }}</v-chip>
								<span v-if="rowAt(i).error" class="gl-err" :title="rowAt(i).error">{{ rowAt(i).error }}</span>
							</div>
							<div v-else class="gl-sub"><gcode-kind-badge :kind="kindOfRow(rowAt(i))" :tags="tagsOf(rowAt(i))" :max="compact ? 0 : 2" />{{ lineOf(rowAt(i)) }}</div>
						</div>
						<v-btn v-if="rowAt(i).state === 'error'" icon class="gl-btn" :aria-label="tx('retry')" :title="tx('retry')" @click.stop="retry(rowAt(i))"><v-icon>mdi-reload</v-icon></v-btn>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
'use strict'

// The searchable, sortable, WINDOWED list of the G-code library (left side of PrusaSlicer's preview): the service pages it (limit / offset), this list
// fetches only the pages the visible rows need and draws only those rows (gcode-lib-list.js). While the service reports `pending` files it asks again
// the visible pages every few seconds (backing off) and stops by itself when nothing is pending. Reused by the library page and by the picker.
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeThumb from './GcodeThumb.vue'
import GcodeKindBadge from './GcodeKindBadge.vue'
import GcodeKindFilter from './GcodeKindFilter.vue'
import { lib } from './gcode-lib-shared.js'
import { libText } from './gcode-lib-text.js'
import { PAGE_SIZE, ROW_HEIGHT, SORTS, visibleRange, listArgs, createRowStore, pollDelay, stateChip, isUnsupported, childDir, parentDir } from './gcode-lib-list.js'
import { rowKind, kindShortLine, loadFilter, saveFilter, normalizeFilter } from './gcode-lib-kinds.js'

export default {
	mixins: [libText],
	components: { ErrorNotice, HelpTip, GcodeThumb, GcodeKindBadge, GcodeKindFilter },
	props: {
		value: { type: String, default: '' }, // the selected path
		dir: { type: String, default: '' },
		compact: { type: Boolean, default: false },
		initialKinds: { type: Array, default: null }, // the kinds to start with (the picker dialog follows its own); null = the saved choice of the library page
		persistKinds: { type: Boolean, default: true } // save the chosen kinds in the browser
	},
	data() {
		return { cur: '', shown: '', dirs: [], query: '', sort: 'name', desc: false, total: 0, pending: 0, loaded: false, kinds: [], counts: null, unsupported: false, failure: null, scrollTop: 0, viewH: 400, version: 0 }
	},
	computed: {
		rowHeight() {
			return this.compact ? 56 : ROW_HEIGHT
		},
		sortItems() {
			return SORTS.map((s) => ({ text: this.tx('sort_' + s), value: s }))
		},
		empty() {
			return this.loaded && !this.failure && !this.unsupported && this.total === 0
		},
		range() {
			return visibleRange(this.scrollTop, this.viewH, this.rowHeight, this.total)
		},
		indexes() {
			this.version // eslint-disable-line no-unused-expressions -- redraw when a page arrives
			const out = []
			for (let i = this.range.first; i < this.range.last; i++) out.push(i)
			return out
		}
	},
	watch: {
		query() { this.restart(250) },
		sort() { this.restart(0) },
		desc() { this.restart(0) },
		dir() { this.cur = ''; this.restart(0) },
		initialKinds(v) { if (v) this.kinds = normalizeFilter(v) },
		kinds() { this.restart(0) },
		range() { this.ensure() }
	},
	created() {
		this.kinds = this.initialKinds ? normalizeFilter(this.initialKinds) : loadFilter()
		this.rows = createRowStore(PAGE_SIZE)
		this.generation = 0
		this.quiet = 0
		this.signature = ''
	},
	mounted() {
		this.measure()
		if (typeof ResizeObserver !== 'undefined') {
			this.observer = new ResizeObserver(() => this.measure())
			this.observer.observe(this.$refs.scroll)
		}
		this.restart(0)
	},
	beforeDestroy() {
		this.generation++
		clearTimeout(this.pollTimer)
		clearTimeout(this.typeTimer)
		if (this.observer) this.observer.disconnect()
	},
	methods: {
		rowAt(i) {
			return this.rows.get(i)
		},
		chip(row) {
			return stateChip(row)
		},
		lineOf(row) {
			const s = row.summary
			return s ? kindShortLine(s).join('  ') : this.tx('no_summary')
		},
		kindOfRow(row) {
			return rowKind(row)
		},
		tagsOf(row) {
			return (row.summary && row.summary.tags) || []
		},
		setKinds(list) {
			this.kinds = normalizeFilter(list)
			if (this.persistKinds) saveFilter(undefined, this.kinds)
			this.$emit('kinds', this.kinds)
		},
		pick(row) {
			if (row) this.$emit('select', row)
		},
		measure() {
			const el = this.$refs.scroll
			if (el && el.clientHeight) this.viewH = el.clientHeight
		},
		onScroll(e) {
			if (this.frame) return
			const top = e.target.scrollTop
			this.frame = requestAnimationFrame(() => { this.frame = 0; this.scrollTop = top })
		},
		query_() {
			return { dir: this.cur || this.dir, query: this.query, sort: this.sort, desc: this.desc, kind: this.kinds }
		},
		// a new query: forget the rows, back to the top, fetch the first page
		restart(delay) {
			clearTimeout(this.typeTimer)
			this.typeTimer = setTimeout(() => {
				this.generation++
				this.rows.reset()
				this.total = 0
				this.loaded = false
				this.scrollTop = 0
				if (this.$refs.scroll) this.$refs.scroll.scrollTop = 0
				clearTimeout(this.pollTimer)
				this.quiet = 0
				this.version++
				this.load(0)
			}, delay)
		},
		// the user asks again (the refresh button): visible rows stay, the visible pages are fetched again
		reload() {
			this.failure = null
			this.rows.markStale()
			this.ensure()
		},
		// fetch the pages the visible rows need (the first one when nothing is known yet)
		ensure() {
			const r = this.loaded ? this.range : { first: 0, last: 1 }
			this.rows.claim(r.first, r.last).forEach((o) => this.load(o, true))
		},
		load(offset, claimed) {
			if (!claimed) this.rows.claim(offset, offset + 1)
			const gen = this.generation
			lib.list(listArgs(this.query_(), offset, PAGE_SIZE)).then((out) => {
				if (gen !== this.generation) return
				this.unsupported = false
				this.failure = null
				this.rows.set(offset, out.rows || [])
				if (offset === 0) { this.dirs = Array.isArray(out.dirs) ? out.dirs : []; this.shown = out.dir || '' }
				this.total = out.total || 0
				if (out.counts && typeof out.counts === 'object') this.counts = out.counts
				this.loaded = true
				this.noteStatus(out)
				this.version++
			}, (e) => {
				if (gen !== this.generation) return
				this.rows.release(offset)
				this.loaded = true
				if (isUnsupported(e)) this.unsupported = true
				else if (!e || e.code !== 'cancelled') this.failure = e
				this.$emit('status', { total: 0, pending: 0, unsupported: this.unsupported })
			})
		},
		// pending files: ask the visible pages again later (the service indexes in the background); nothing pending: stop, and refresh what is off screen once
		noteStatus(out) {
			const was = this.pending
			this.pending = out.pending || 0
			this.$emit('status', { total: this.total, pending: this.pending, unsupported: false, cacheBytes: out.cache_bytes || 0 })
			const sig = this.pending + ':' + (out.rows || []).filter((r) => r.state === 'ready').length
			this.quiet = sig === this.signature ? this.quiet + 1 : 0
			this.signature = sig
			clearTimeout(this.pollTimer)
			const delay = pollDelay(this.pending, this.quiet)
			if (delay > 0) this.pollTimer = setTimeout(() => this.poll(), delay)
			else if (was > 0) this.rows.markStale()
		},
		poll() {
			if (typeof document !== 'undefined' && document.hidden) { this.pollTimer = setTimeout(() => this.poll(), 4000); return }
			this.rows.markStale()
			this.ensure()
		},
		enter(name) {
			this.cur = childDir(this.shown || this.dir, name)
			this.restart(0)
		},
		up() {
			this.cur = parentDir(this.shown || this.cur, this.dir)
			this.restart(0)
		},
		retry(row) {
			lib.refresh(row.path).then(() => { this.pending = Math.max(1, this.pending); this.reload() }, (e) => { this.failure = e })
		}
	}
}
</script>

<style scoped>
.gl-list { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.gl-bar { display: flex; align-items: center; gap: 4px; padding: 4px 6px 0; }
.gl-search, .gl-sort { min-width: 0; }
.gl-btn.v-btn { width: 44px; height: 44px; }
.gl-dirs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 6px 0; }
.gl-dir { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 12px; border-radius: 22px; border: 1px solid rgba(128, 128, 128, 0.4); background: transparent; color: inherit; font-size: 13px; cursor: pointer; }
.gl-pending { padding: 4px 10px; font-size: 12px; opacity: 0.85; }
.gl-empty { padding: 24px 12px; text-align: center; opacity: 0.7; }
.gl-scroll { position: relative; flex: 1 1 auto; min-height: 120px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.gl-space { position: relative; width: 100%; }
.gl-row { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 10px; padding: 0 8px; box-sizing: border-box; cursor: pointer; border-bottom: 1px solid rgba(128, 128, 128, 0.2); }
.gl-row:hover, .gl-row:focus { background: rgba(128, 128, 128, 0.12); outline: none; }
.gl-row.is-sel { background: rgba(25, 118, 210, 0.18); }
.gl-row.is-wait { opacity: 0.4; cursor: default; }
.gl-main { min-width: 0; flex: 1 1 auto; }
.gl-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gl-sub { font-size: 12px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
.gl-err { overflow: hidden; text-overflow: ellipsis; }
</style>
