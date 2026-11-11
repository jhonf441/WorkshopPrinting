// Pure helpers of the read-only viewer "what will happen in this file" (GcodeLayerView.vue): the answer of the service op layerrecipes.preview
// turned into the rows to draw. No Vue, no calls, no texts of its own (the ones that need a sentence get the translate function `t`).
//
// The answer (the contract with the service):
//   { file, layers, axis: 'layer' | 'z', truncated, notes: [key],
//     changes: [ { layer, z | null, line, at,
//        extruder: { temps: [n], code: 'M568 P0 S210:220', limited } | null,
//        bed: { temps: [n], codes: ['M140 P0 S60'], limited } | null,
//        context: [ { n, text, mark } ] } ] }
// The service temperature command is sent when the layer starts, that is right at the layer-start line.
//
// Newer answers also carry what the FILE itself sets (every key below may be missing in an old answer: the viewer then works as before):
//   file_temps: { count, truncated, lines: [ { line, text, kind: 'bed' | 'extruder' | 'chamber', tool, bed, temps, code } ] }   (up to 60 lines)
//   changes[i].file: { extruder: { temps } | null, bed: { temps } | null }     what the file holds when this layer starts
//   changes[i].conflicts: [ { line, text, track: 'extruder' | 'bed', same_layer } ]   file commands inside this layer that set what the recipe controls
//   changes[i].delta: { extruder: [n] | null, bed: [n] | null }   the recipe's changes over the file (recipes are relative); file may be null: the base is unknown
//   note_params: { <note key>: { track } }   (kept by the callers; the notes themselves are keys)
//   layers_table: [ { layer, file: { extruder, bed }, recipe: { extruder, bed } } ]   (each a list of temperatures or null; up to 1500 rows)

'use strict'

export const TRACKS = ['all', 'extruder', 'bed']
export const KNOWN_NOTES = ['preview_no_file', 'preview_no_layers', 'preview_zones_missing', 'preview_truncated', 'preview_unreadable', 'preview_file_sets', 'preview_base_unknown']

// the codes that set a temperature: their S and R words are the temperatures
const TEMP_CODES = ['M104', 'M109', 'M140', 'M141', 'M190', 'M191', 'M568']

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
const ints = (v) => (Array.isArray(v) ? v.map(num).filter((x) => x !== null) : [])

function track(raw, many) {
	if (!raw || typeof raw !== 'object') return null
	const out = { temps: ints(raw.temps), limited: raw.limited === true }
	if (many) out.codes = Array.isArray(raw.codes) ? raw.codes.filter((c) => typeof c === 'string' && c) : []
	else out.code = typeof raw.code === 'string' ? raw.code : ''
	return out
}

const str = (v) => (typeof v === 'string' ? v : '')
// a list of temperatures or null (null = nothing set)
const tempsOrNull = (v) => (Array.isArray(v) ? ints(v) : null)

function fileTracks(raw) {
	if (!raw || typeof raw !== 'object') return null
	const one = (x) => (x && typeof x === 'object' ? { temps: tempsOrNull(x.temps) } : null)
	return { extruder: one(raw.extruder), bed: one(raw.bed) }
}

function conflictsOf(raw) {
	const out = []
	for (const c of Array.isArray(raw) ? raw : []) {
		if (!c || num(c.line) === null) continue
		out.push({ line: c.line, text: str(c.text), track: c.track === 'bed' ? 'bed' : 'extruder', sameLayer: c.same_layer !== false })
	}
	return out
}

function fileTempsOf(raw) {
	if (!raw || typeof raw !== 'object') return null
	const lines = []
	for (const l of Array.isArray(raw.lines) ? raw.lines : []) {
		if (!l || num(l.line) === null) continue
		lines.push({
			line: l.line,
			text: str(l.text),
			kind: l.kind === 'bed' || l.kind === 'chamber' ? l.kind : 'extruder',
			tool: num(l.tool),
			bed: num(l.bed),
			temps: tempsOrNull(l.temps),
			code: str(l.code)
		})
	}
	return { count: num(raw.count) === null ? lines.length : raw.count, truncated: raw.truncated === true, lines }
}

function tableOf(raw) {
	const out = []
	const side = (x) => (x && typeof x === 'object' ? { extruder: tempsOrNull(x.extruder), bed: tempsOrNull(x.bed) } : { extruder: null, bed: null })
	for (const r of Array.isArray(raw) ? raw : []) {
		if (!r || num(r.layer) === null) continue
		out.push({ layer: r.layer, file: side(r.file), recipe: side(r.recipe) })
	}
	return out
}

// The answer of the service as the viewer reads it: every field has a safe value; null when there is no answer.
export function normalize(answer) {
	if (!answer || typeof answer !== 'object') return null
	const changes = []
	for (const c of Array.isArray(answer.changes) ? answer.changes : []) {
		if (!c || num(c.layer) === null) continue
		const context = []
		for (const l of Array.isArray(c.context) ? c.context : []) {
			if (l && num(l.n) !== null) context.push({ n: l.n, text: typeof l.text === 'string' ? l.text : '', mark: l.mark === true })
		}
		changes.push({
			layer: c.layer,
			z: num(c.z),
			line: num(c.line),
			at: num(c.at),
			extruder: track(c.extruder, false),
			bed: track(c.bed, true),
			context,
			delta: c.delta && typeof c.delta === 'object' ? { extruder: tempsOrNull(c.delta.extruder), bed: tempsOrNull(c.delta.bed) } : null,
			file: Object.prototype.hasOwnProperty.call(c, 'file') ? (fileTracks(c.file) || { extruder: null, bed: null }) : null,
			conflicts: conflictsOf(c.conflicts)
		})
	}
	return {
		file: typeof answer.file === 'string' ? answer.file : '',
		layers: num(answer.layers) === null ? 0 : answer.layers,
		axis: answer.axis === 'z' ? 'z' : 'layer',
		truncated: answer.truncated === true,
		notes: Array.isArray(answer.notes) ? answer.notes.filter((k) => typeof k === 'string' && k) : [],
		changes,
		noteParams: answer.note_params && typeof answer.note_params === 'object' ? answer.note_params : {},
		fileTemps: fileTempsOf(answer.file_temps),
		layersTable: tableOf(answer.layers_table)
	}
}

// The key of the text of a note: a known one has its own sentence; anything else shows a generic text plus the key itself.
export function noteKey(key) {
	// the service names its notes layer_recipes_preview_*: the same sentences under the short names of this file
	const k = String(key).replace(/^layer_recipes_/, '').replace('preview_zones_undefined', 'preview_zones_missing')
	return KNOWN_NOTES.indexOf(k) >= 0 ? k : 'preview_unknown'
}

// Millimetres as a person writes them: 1, 1.2, 0.325 (never 1.000000).
export function formatZ(z) {
	const n = num(z)
	return n === null ? '' : String(Math.round(n * 1000) / 1000)
}

// '210', or '210 / 220 / 230' when the heads differ and a single value when they are all equal.
export function formatTemps(temps) {
	const list = ints(temps)
	if (!list.length) return ''
	return list.every((x) => x === list[0]) ? String(list[0]) : list.join(' / ')
}

// A real line of the file in pieces to draw: plain text, the code of a temperature command, its temperature words (S210:220) and the comment.
// kind: 'plain' | 'code' | 'temp' | 'comment'. The pieces joined give back the line exactly.
// `opts.conflict`: the line is a file command that sets a temperature the recipe controls: its temperature words get the kind 'conflict'.
export function tokenizeLine(text, opts) {
	const tempKind = opts && opts.conflict ? 'conflict' : 'temp'
	const line = typeof text === 'string' ? text : ''
	if (!line) return []
	const cut = line.indexOf(';')
	const body = cut >= 0 ? line.slice(0, cut) : line
	const comment = cut >= 0 ? line.slice(cut) : ''
	const tokens = []
	const push = (t, kind) => {
		if (!t) return
		const last = tokens[tokens.length - 1]
		if (last && last.kind === kind) last.text += t
		else tokens.push({ text: t, kind })
	}
	const word = /[A-Za-z]-?\d+(?:\.\d+)?(?::-?\d+(?:\.\d+)?)*/g
	const first = /^\s*([A-Za-z]\d+)/.exec(body)
	const isTemp = !!first && TEMP_CODES.indexOf(first[1].toUpperCase()) >= 0
	let at = 0
	let m
	let seen = false
	while ((m = word.exec(body)) !== null) {
		push(body.slice(at, m.index), 'plain')
		const letter = m[0][0].toUpperCase()
		if (!seen && first && m[0].toLowerCase() === first[1].toLowerCase()) { push(m[0], isTemp ? 'code' : 'plain'); seen = true } else if (isTemp && (letter === 'S' || letter === 'R')) push(m[0], tempKind)
		else push(m[0], 'plain')
		at = m.index + m[0].length
	}
	push(body.slice(at), 'plain')
	push(comment, 'comment')
	return tokens
}

// Context lines of a change with what each one is: the layer-start line (the one with the mark, or the line of the change) and, right on it,
// the place where the temperature command of the service is inserted. kind: 'start' | 'normal'.
export function lineMarks(change) {
	const c = change || {}
	const lines = Array.isArray(c.context) ? c.context : []
	const hasMark = lines.some((l) => l && l.mark === true)
	const sends = !!(c.extruder || c.bed)
	const conflicts = {}
	for (const x of Array.isArray(c.conflicts) ? c.conflicts : []) if (x) conflicts[x.line] = x.track
	return lines.map((l) => {
		const start = hasMark ? l.mark === true : (c.line !== null && c.line !== undefined && l.n === c.line)
		const conflict = Object.prototype.hasOwnProperty.call(conflicts, l.n)
		return { n: l.n, text: l.text, start, insert: start && sends, conflict, conflictTrack: conflict ? conflicts[l.n] : null, kind: start ? 'start' : (conflict ? 'conflict' : 'normal') }
	})
}

// The rows to draw of a change: its lines (with marks and tokens) and the exact commands the service would send.
// `only`: 'all' | 'extruder' | 'bed' limits the commands to that track.
export function buildRows(change, only) {
	const c = change || {}
	const want = (name) => !only || only === 'all' || only === name
	const lines = lineMarks(c).map((l) => Object.assign({}, l, { tokens: tokenizeLine(l.text, { conflict: l.conflict }) }))
	const commands = []
	if (c.extruder && want('extruder') && c.extruder.code) commands.push({ track: 'extruder', text: c.extruder.code, tokens: tokenizeLine(c.extruder.code), temps: c.extruder.temps, limited: c.extruder.limited })
	if (c.bed && want('bed')) {
		for (const code of c.bed.codes || []) commands.push({ track: 'bed', text: code, tokens: tokenizeLine(code), temps: c.bed.temps, limited: c.bed.limited })
	}
	return { lines, commands }
}

// Short pieces for the legend of a change: [{ track, text, limited }]. `t(key, params)` translates (area gcodeView); keys: describe_extruder, describe_bed.
export function describeChange(change, t) {
	const c = change || {}
	const out = []
	if (c.extruder) out.push({ track: 'extruder', text: t('describe_extruder', { temps: formatTemps(c.extruder.temps) }), limited: !!c.extruder.limited })
	if (c.bed) out.push({ track: 'bed', text: t('describe_bed', { temps: formatTemps(c.bed.temps) }), limited: !!c.bed.limited })
	return out
}

// Keeps the changes of a track and of a range of layers (both ends included; empty, null or not a number = no limit on that side).
export function filterChanges(changes, opts) {
	const o = opts || {}
	const bound = (v) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v))
	const from = bound(o.layerFrom)
	const to = bound(o.layerTo)
	const kind = TRACKS.indexOf(o.track) >= 0 ? o.track : 'all'
	return (Array.isArray(changes) ? changes : []).filter((c) => {
		if (from !== null && c.layer < from) return false
		if (to !== null && c.layer > to) return false
		if (kind === 'extruder') return !!c.extruder
		if (kind === 'bed') return !!c.bed
		return true
	})
}

function range(values) {
	return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null
}

// Counts and limits of a list of changes: how many, first and last layer, the lowest and the highest temperature of each track.
export function summary(changes) {
	const list = Array.isArray(changes) ? changes : []
	const ext = []
	const bed = []
	let extruderCount = 0
	let bedCount = 0
	let limitedCount = 0
	for (const c of list) {
		if (c.extruder) { extruderCount++; ext.push(...ints(c.extruder.temps)) }
		if (c.bed) { bedCount++; bed.push(...ints(c.bed.temps)) }
		if ((c.extruder && c.extruder.limited) || (c.bed && c.bed.limited)) limitedCount++
	}
	const layers = list.map((c) => c.layer)
	return {
		count: list.length,
		extruderCount,
		bedCount,
		limitedCount,
		firstLayer: layers.length ? Math.min(...layers) : null,
		lastLayer: layers.length ? Math.max(...layers) : null,
		extruder: range(ext),
		bed: range(bed)
	}
}

// ---- what the FILE sets and where it meets the recipe ----

// The block "the file itself sets temperature": `known` is false when the answer has no file_temps (old service: show nothing).
// `inPrinting`: some of those commands sit at or after the first layer where the recipe changes something, or a change reports a conflict,
// that is, they can override the recipe (the ones before it are the usual start-up heating). `shown`: the first `limit` lines.
export function fileSummary(preview, limit) {
	const d = preview || {}
	const ft = d.fileTemps || null
	if (!ft) return { known: false, count: 0, none: false, inPrinting: false, truncated: false, lines: [], shown: [], rest: 0 }
	const changes = Array.isArray(d.changes) ? d.changes : []
	const starts = changes.map((c) => c.line).filter((n) => num(n) !== null)
	const first = starts.length ? Math.min(...starts) : null
	const inPrinting = changes.some((c) => Array.isArray(c.conflicts) && c.conflicts.length > 0) || (first !== null && ft.lines.some((l) => l.line >= first))
	const cap = num(limit) === null ? 5 : Math.max(0, limit)
	const shown = ft.lines.slice(0, cap)
	return { known: true, count: ft.count, none: ft.count === 0, inPrinting, truncated: ft.truncated || ft.count > ft.lines.length, lines: ft.lines, shown, rest: Math.max(0, ft.lines.length - shown.length) }
}

// Rounded difference with its sign for a person: -5, +5, 0.
function signed(n) {
	const r = Math.round(n * 10) / 10
	return r > 0 ? '+' + r : String(r)
}

// File temperatures against the recipe ones, zone by zone: [{ zone, file, recipe, delta, same }]. A side that is null or shorter gives null in that zone
// (delta null, same false); two nulls give no rows.
export function compareTemps(fileTemps, recipeTemps) {
	const f = Array.isArray(fileTemps) ? fileTemps : null
	const r = Array.isArray(recipeTemps) ? recipeTemps : null
	const n = Math.max(f ? f.length : 0, r ? r.length : 0)
	const out = []
	for (let i = 0; i < n; i++) {
		const a = f && num(f[i]) !== null ? f[i] : null
		const b = r && num(r[i]) !== null ? r[i] : null
		out.push({ zone: i, file: a, recipe: b, delta: a !== null && b !== null ? b - a : null, same: a !== null && b !== null && a === b })
	}
	return out
}

// The two columns of a change card: per track, "what the file asks" and "with the recipe", each zone as one sentence.
// `t(key, params)` translates (area gcodeView); keys: zone_diff, zone_same, zone_file_none, zone_name_extruder, zone_name_bed, track_extruder, track_bed.
// Returns null when the answer has no `file` key for this change (old answer: no columns).
// Otherwise [{ track, notSet, same, zones: [{ name, text, same, file, recipe }] }].
export function compareChange(change, t) {
	const c = change || {}
	if (!c.file && !c.delta) return null
	const fileOf = c.file || { extruder: null, bed: null }
	const out = []
	for (const name of ['extruder', 'bed']) {
		const mine = c[name]
		if (!mine) continue
		const file = fileOf[name] && fileOf[name].temps ? fileOf[name].temps : null
		const delta = c.delta && c.delta[name] ? c.delta[name] : null
		const rows = compareTemps(file, mine.temps)
		const many = rows.length > 1
		const zones = rows.map((z) => {
			const params = { file: z.file === null ? '-' : z.file, recipe: z.recipe === null ? '-' : z.recipe, delta: z.delta === null ? '' : signed(z.delta) }
			const d = delta && num(delta[z.zone]) !== null ? delta[z.zone] : null
			if (d !== null) params.delta = signed(d)
			const key = d !== null ? (z.file === null ? 'zone_delta_nofile' : 'zone_delta') : (z.file === null ? 'zone_file_none' : (z.same ? 'zone_same' : 'zone_diff'))
			return { name: many ? t('zone_name_' + name, { n: z.zone + 1 }) : t('track_' + name), text: t(key, params), same: z.same, file: z.file, recipe: z.recipe }
		})
		out.push({ track: name, notSet: !file, same: zones.length > 0 && zones.every((z) => z.same), zones })
	}
	return out
}

// The lines of the file inside this layer that set a temperature the recipe controls: [{ line, text, track, sameLayer, tokens }].
export function conflictLines(change) {
	const list = change && Array.isArray(change.conflicts) ? change.conflicts : []
	return list.map((x) => ({ line: x.line, text: x.text, track: x.track, sameLayer: x.sameLayer !== false, tokens: tokenizeLine(x.text, { conflict: true }) }))
}

// The "at a glance" table: one row per layer with what the file holds and what the recipe sets, per track.
// filters: { all (every layer), track ('all' | 'extruder' | 'bed'), layerFrom, layerTo }. Without `all` only the layers where the file and the recipe
// differ and the layers where the recipe changes something are kept. A row: { layer, change, differs, cells: { extruder, bed } } with
// cell = { file: '60', recipe: '55', differs } ('' = nothing set). `differs` needs both sides set and some zone different.
export function tableRows(preview, filters) {
	const d = preview || {}
	const f = filters || {}
	const bound = (v) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v))
	const from = bound(f.layerFrom)
	const to = bound(f.layerTo)
	const only = TRACKS.indexOf(f.track) >= 0 ? f.track : 'all'
	const changeLayers = {}
	for (const c of Array.isArray(d.changes) ? d.changes : []) changeLayers[c.layer] = true
	const out = []
	for (const r of Array.isArray(d.layersTable) ? d.layersTable : []) {
		if (from !== null && r.layer < from) continue
		if (to !== null && r.layer > to) continue
		const cells = {}
		let differs = false
		for (const name of ['extruder', 'bed']) {
			const file = r.file[name]
			const recipe = r.recipe[name]
			const diff = !!file && !!recipe && compareTemps(file, recipe).some((z) => !z.same)
			cells[name] = { file: file ? formatTemps(file) : '', recipe: recipe ? formatTemps(recipe) : '', differs: diff }
			if (diff && (only === 'all' || only === name)) differs = true
		}
		const change = changeLayers[r.layer] === true
		if (f.all || differs || change) out.push({ layer: r.layer, change, differs, cells })
	}
	return out
}
