<template>
	<div class="lpp">
		<div class="d-flex align-center flex-wrap" style="gap:6px">
			<span class="text-body-2">{{ tx('apply_lead') }}</span>
			<help-tip v-bind="help('apply')" />
		</div>
		<error-notice v-if="failure" :error="failure" :action="tx('layers_acting')" retry class="mt-2" @retry="load()" />

		<div class="d-flex align-end flex-wrap mt-3" style="gap:12px">
			<wf-field id="lpp-file" :label="px('pellet_layers_f_file')" :message="fileName ? '' : px('pellet_layers_file_missing')">
				<template #help><help-tip v-bind="help('file')" /></template>
				<gcode-picker id="lpp-file" :value="fileName" :job-file="jobName" :default-kinds="['fff']" clearable :show-help="false" :show-line="false" :aria-label="px('pellet_layers_f_file')" @input="onPick" />
			</wf-field>
			<wf-field id="lpp-material" :label="$t('plugins.WorkshopPrinting.common.material')" :message="items.length ? '' : tx('apply_no_materials')">
				<template #help><help-tip v-bind="help('material')" /></template>
				<v-select id="lpp-material" v-model="name" :items="items" dense outlined hide-details style="min-width:240px" :aria-label="$t('plugins.WorkshopPrinting.common.material')">
					<template #item="{ item }"><span>{{ item.text }}</span><v-chip x-small outlined class="ml-2">{{ tx('kind_' + item.kind) }}</v-chip><v-chip v-if="item.layers" x-small outlined color="primary" class="ml-1">{{ tx('layers_on') }}</v-chip></template>
				</v-select>
			</wf-field>
			<v-btn small color="primary" class="lpp-btn" :loading="busy" :disabled="!!readReason" @click="read()"><v-icon small left>mdi-file-eye-outline</v-icon>{{ tx('apply_read') }}</v-btn>
			<v-btn small outlined class="lpp-btn" @click="$emit('goto', { section: 'materials' })"><v-icon small left>mdi-pencil-outline</v-icon>{{ tx('apply_edit') }}</v-btn>
		</div>
		<div v-if="readReason" class="text-caption grey--text mt-1" role="status">{{ readReason }}</div>
		<!-- the numbers and the mini preview of the chosen file (the library already read them) -->
		<gcode-info-card v-if="fileName" :file="fileName" mini-preview class="mt-2" />
		<div v-if="jobName" class="text-caption grey--text mt-1">{{ px('layer_recipes_page_job', { file: jobName }) }}</div>
		<div v-else class="text-caption grey--text mt-1">{{ px('layer_recipes_page_no_job') }}</div>

		<template v-if="picked">
			<!-- what the file asks next to what the material makes of it: with changes per layer its recipe, without them one flat recipe of its zone temperatures -->
			<div v-if="!hasLayers && flatArgs" class="wf-note mt-3" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('apply_flat_note', { name: name }) }}</span></div>
			<template v-if="hasLayers || flatArgs">
				<gcode-layer-view v-if="shown" class="mt-3" :preview="preview" :loading="busy" :error="previewError" :recipe-name="name" @read="read()" />
				<div v-else class="wf-note mt-3" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('apply_not_read') }}</span></div>
			</template>
			<!-- Apply (arms the recipe for the job): only a material with changes per layer has something to arm -->
			<template v-if="hasLayers">
				<recipe-run :name="name" :recipe="recipe" :dirty="false" :file-override="file" />
			</template>

			<!-- a material without changes per layer (below its flat preview): Apply has nothing to arm, it only preheats with the zone temperatures (and the page says so) -->
			<div v-else class="mt-3">
				<div class="wf-note is-warn" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('apply_no_layers', { name: name }) }}</span></div>
				<div class="text-subtitle-2 mt-3">{{ tx('apply_zones_title', { name: name }) }}</div>
				<ul class="text-body-2 mt-1">
					<li v-for="z in zoneLines" :key="z.key">{{ z.text }}</li>
				</ul>
				<div v-if="!zoneLines.length" class="text-caption grey--text">{{ tx('apply_zones_none') }}</div>
				<div class="d-flex flex-wrap mt-3" style="gap:8px">
					<v-btn small color="primary" class="lpp-btn" @click="$emit('goto', { section: 'materials' })"><v-icon small left>mdi-fire</v-icon>{{ tx('apply_go_preheat') }}</v-btn>
					<v-btn small outlined class="lpp-btn" @click="$emit('goto', { section: 'materials' })"><v-icon small left>mdi-layers-plus</v-icon>{{ tx('apply_go_layers') }}</v-btn>
				</div>
			</div>
		</template>
	</div>
</template>

<script>
'use strict'

// "Material and G-code": pick the job file (the one loaded in the machine or typed) and a material. With changes per layer the page reads the file
// (layerrecipes.preview, shown by GcodeLayerView.vue: what the file asks / with the material, by zone and by layer, with the G-code lines) and Apply arms the recipe of the
// material for that job (RecipeRun.vue: two taps, live state, stop). Without changes per layer the same view is read with a FLAT recipe the service builds on the fly from the
// zone temperatures of the material (`flat`, nothing saved); Apply has nothing to arm: the page says that the material only preheats with its zone temperatures and shows them.
// Reading never arms or sends anything.
import { api } from './workshop-api.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeLayerView from './GcodeLayerView.vue'
import RecipeRun from './RecipeRun.vue'
import GcodePicker from './GcodePicker.vue' // the G-code library picker (chooses the job file)
import GcodeInfoCard from './GcodeInfoCard.vue' // its numbers and mini preview
import { fileForJob, toolZones } from './pellet-layers.js'
import { noteParams, bedZoneList } from './layer-recipes.js'
import { CFG_FILE, MATERIALS_DEF, readJson } from './util.js'
import { kindOf, extruderTemps, bedTemps, recipeNameFor, flatPreviewArgs } from './material-profile.js'

export default {
	components: { ErrorNotice, WfField, HelpTip, GcodeLayerView, RecipeRun, GcodePicker, GcodeInfoCard },
	data() {
		return { materials: [], step: {}, recipes: [], bedConfig: null, name: '', file: '', fileTouched: false, recipe: null, preview: null, shown: false, previewError: null, busy: false, failure: null }
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		tool() {
			const cur = this.model && this.model.state && this.model.state.currentTool
			const tools = (this.model && this.model.tools) || []
			return tools.find(t => t && t.number === cur) || tools[0] || null
		},
		extruderZones() {
			return this.tool ? toolZones(this.model, this.tool.number) : []
		},
		items() {
			return this.materials.map(m => ({ text: m.name, value: m.name, kind: kindOf(m, this.extruderZones.length), layers: !!recipeNameFor(m.name, this.recipes) }))
		},
		picked() {
			return this.materials.find(m => m.name === this.name) || null
		},
		linked() {
			return this.picked ? recipeNameFor(this.picked.name, this.recipes) : ''
		},
		hasLayers() {
			return !!this.linked
		},
		// the active bed zones as the flat preview needs them: id = the bed number of the zones config, max = the heater cap
		bedZonesNow() {
			const hs = (this.model && this.model.heat && this.model.heat.heaters) || []
			return bedZoneList(this.bedConfig).filter(z => z.active).map(z => ({ id: z.heater, max: (hs[z.heater] && hs[z.heater].max) || null }))
		},
		// what the service needs to compare the file with a material without layers (null: nothing to compare)
		flatArgs() {
			if (!this.picked || this.hasLayers) return null
			return flatPreviewArgs(this.picked, this.tool ? this.tool.number : null, this.extruderZones, this.bedZonesNow, this.step)
		},
		jobName() {
			const j = this.model && this.model.job
			return (j && j.file && j.file.fileName) || ''
		},
		fileName() {
			return fileForJob(this.file)
		},
		// why Read is off, in words (never a mute button)
		readReason() {
			if (!this.fileName) return this.px('pellet_layers_file_missing')
			if (!this.picked) return this.tx('apply_pick_material')
			if (!this.hasLayers && !this.flatArgs) return this.tx('apply_read_needs_zones', { name: this.picked.name })
			return ''
		},
		// the zone temperatures the material heats with (no layer changes): the extruder zones of the tool and the zones of the bed
		zoneLines() {
			if (!this.picked) return []
			const m = this.picked
			const out = []
			extruderTemps(m, this.extruderZones.map(z => ({ id: z.heater, max: z.max })), this.step).forEach((t, i) => out.push({ key: 'e' + i, text: this.tx('apply_zone_extruder', { n: i + 1, t }) }))
			bedTemps(m, this.bedZonesNow).forEach((z, i) => out.push({ key: 'b' + i, text: this.tx('apply_zone_bed', { n: i + 1, t: z.t }) }))
			return out
		}
	},
	watch: {
		jobName(v) {
			if (!this.fileTouched) this.file = v
		},
		name() {
			this.preview = null
			this.shown = false
			this.previewError = null
			this.recipe = null
			this.loadRecipe()
		},
		hasLayers() {
			this.loadRecipe()
		}
	},
	mounted() {
		this.file = this.jobName
		this.load()
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.materials.' + key, params || {})
		},
		px(key, params) {
			return this.$t('plugins.WorkshopPrinting.pellet.' + key, params || {})
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		},
		// the file field is the select of the G-code library: it gives the path of the chosen file ('' when cleared)
		onPick(path) {
			this.file = path || ''
			this.fileTouched = true
		},
		async load() {
			try {
				const cfg = (await readJson(CFG_FILE, {})) || {}
				this.materials = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF
				this.step = cfg.step || {}
				if (!this.name && this.materials.length) this.name = cfg.last && this.materials.some(m => m.name === cfg.last) ? cfg.last : this.materials[0].name
			} catch (e) {
				this.failure = e
			}
			try {
				this.recipes = ((await api('layerrecipes.list', {}, { quiet: true })).recipes || []).map(r => r.name)
				this.failure = null
			} catch (e) {
				this.failure = e
			}
			try {
				this.bedConfig = (await api('bedzones.get', {}, { quiet: true })).config
			} catch (e) { /* no bed zones */ }
		},
		async loadRecipe() {
			if (!this.hasLayers) { this.recipe = null; return }
			try {
				this.recipe = (await api('layerrecipes.get', { name: this.linked }, { quiet: true })).recipe
			} catch (e) {
				this.failure = e
			}
		},
		async read() {
			if (this.readReason) return
			this.busy = true
			this.previewError = null
			this.shown = true
			try {
				const out = await api('layerrecipes.preview', this.hasLayers ? { name: this.linked, file: this.fileName } : { flat: this.flatArgs, file: this.fileName })
				// the service sends its notes as {key, params, message}: the viewer takes the keys and has its own sentences
				this.preview = Object.assign({}, out, { notes: (out.notes || []).map(n => (n && typeof n === 'object' ? n.key : n)), note_params: noteParams(out.notes) })
			} catch (e) {
				if (e && e.code !== 'cancelled') this.previewError = e
			} finally {
				this.busy = false
			}
		}
	}
}
</script>

<style scoped>
.lpp-btn.v-btn { height: 44px; min-height: 44px; }
</style>
