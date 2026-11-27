<template>
	<pc-section icon="mdi-flask-outline" :title="$t('plugins.WorkshopPrinting.printing.profiles')">
		<!-- the guide of the section is read in its ONE help, at the foot (PcSection slot guide) -->
		<template v-slot:guide>
			<p>{{ tx('page_lead') }}</p>
			<ol class="mb-0">
				<li>{{ tx('guide_1') }}</li>
				<li>{{ tx('guide_2') }}</li>
				<li>{{ tx('guide_3') }}</li>
			</ol>
			<!-- the list, Save and Use in the job: no "?" at the rows, their parts are read here, in the ONE fold -->
			<!-- the fields of the editor, the zones, the preheat and the changes: their parts are read here too (no "?" at the rows) -->
			<div v-for="k in ['f_name', 'kind', 'f_nozzle', 'f_bed', 'f_camera', 'f_fan', 'f_density', 'zones_extruder', 'zones_bed', 'preheat']" :key="k" class="mt-2">
				<strong>{{ tx('help_' + k + '_title') }}</strong>
				<div>{{ tx('help_' + k + '_what') }} {{ tx('help_' + k + '_why') }}</div>
				<div>{{ tx('help_' + k + '_miss') }} {{ tx('help_' + k + '_how') }}</div>
			</div>
			<div class="mt-2">
				<strong>{{ tx('changes_title') }}</strong>
				<div>{{ tx('changes_help_what') }} {{ tx('changes_help_why') }}</div>
				<div>{{ tx('changes_help_miss') }} {{ tx('changes_help_how') }}</div>
			</div>
			<div class="mt-2">
				<strong>{{ $t('plugins.WorkshopPrinting.pellet.layer_recipes_help_axis_title') }}</strong>
				<div>{{ $t('plugins.WorkshopPrinting.pellet.layer_recipes_help_axis_what') }} {{ $t('plugins.WorkshopPrinting.pellet.layer_recipes_help_axis_why') }}</div>
				<div>{{ $t('plugins.WorkshopPrinting.pellet.layer_recipes_help_axis_miss') }} {{ $t('plugins.WorkshopPrinting.pellet.layer_recipes_help_axis_how') }}</div>
			</div>

				<strong>{{ tx('help_' + k + '_title') }}</strong>
				<div>{{ tx('help_' + k + '_what') }} {{ tx('help_' + k + '_why') }}</div>
				<div>{{ tx('help_' + k + '_miss') }} {{ tx('help_' + k + '_how') }}</div>
			</div>
		</template>
		<div v-if="!loaded" class="text-caption pc-muted mt-3">{{ $t('plugins.WorkshopPrinting.common.reading') }}</div>
		<template v-else>
			<div class="pf-grid mt-3">
				<profile-list :rows="rows" :selected="sel" :can-edit="canEdit" @select="sel = $event" @new="addProfile()" />
				<div class="pf-main">
					<template v-if="current">
						<div class="pc-actions pf-head">
							<h4 class="pc-card-title" style="font-size: 16px">{{ current.name || tx('unnamed') }}</h4>
							<!-- the role in the row of the profile: who may edit, and what everybody else can still do with it -->
							<v-chip x-small outlined class="pf-role">{{ tx(canEdit ? 'role_edit' : 'role_read') }}</v-chip>
							<profile-preheat :profile="current" :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="currentTool" :bed-config="bedConfig" :state="state" />
						</div>
						<profile-editor
							:key="'pe' + sel" class="mt-2" :profile="current" :can-edit="canEdit" :nozzle-zones="nozzleZones" :nozzle="nozzle" :bed="bed" :camera="camera" :bed-heaters="bedHeaters" :step="step"
							:tool="selectedTool" :bed-config="bedConfig" :has-changes="!!recipeFor(current._from)" @changed="touch()" @changes-changed="recipesChanged"
						/>
					</template>
					<div v-else class="pf-empty" role="status">
						<v-icon aria-hidden="true">mdi-flask-empty-outline</v-icon>
						<div>{{ tx('empty_title') }}</div>
						<div class="text-caption pc-muted">{{ tx('empty_help') }}</div>
					</div>
				</div>
			</div>
			<!-- the bar stays at the bottom of the visible page (sticky, like Prepare job): Save, Duplicate, Delete and Use are in reach without scrolling the long editor -->
			<div class="pc-sticky-act">
				<!-- the bar under the profile, as in the mockup: Save, Duplicate, Delete, Use in the job. New / Duplicate / Delete change the list, nothing is stored until Save -->
				<div class="pc-actions pf-bar mt-3">
					<v-btn v-if="canEdit" small depressed color="primary" class="pf-btn" :disabled="!changed || !!nameIssues.length" :loading="saving" @click="save()"><v-icon small left>mdi-content-save-outline</v-icon>{{ $t('plugins.WorkshopPrinting.common.save') }}</v-btn>
					<v-btn small outlined class="pf-btn" :disabled="!canEdit || sel < 0" @click="duplicate()"><v-icon small left>mdi-content-copy</v-icon>{{ tx('duplicate') }}</v-btn>
					<v-btn small outlined class="pf-btn" :disabled="!canEdit || sel < 0" @click="askDelete()"><v-icon small left>mdi-delete-outline</v-icon>{{ tx('delete') }}</v-btn>
					<v-btn v-if="canEdit" small outlined class="pf-btn" :disabled="!changed" @click="discard()">{{ tx('discard_all') }}</v-btn>
					<v-btn v-if="canEdit" small text class="pf-btn" @click="restore()">{{ tx('factory_values') }}</v-btn>
					<wf-unsaved-mark :show="changed" />
					<span v-if="current" class="d-flex align-center">
					<v-btn small outlined class="pf-btn" :disabled="!canUse" :aria-describedby="canUse ? undefined : uid + '-use'" @click="useInJob()"><v-icon small left>mdi-clipboard-arrow-right-outline</v-icon>{{ tx('use_in_job') }}</v-btn>
					</span>
				</div>
				<div v-if="current && !canUse" :id="uid + '-use'" class="wf-field-msg is-hint mt-1">{{ tx('use_save_first') }}</div>
				<lock-reason :min="needEdit" class="mt-1" :subject="$t('plugins.WorkshopPrinting.subjects.profiles')" />
			</div>
		</template>
		<error-notice v-if="failure" :error="failure" :retry="cfgFailed" class="mt-3" @retry="readConfig()" />
		<ul v-if="nameIssues.length" class="mt-2"><li v-for="(e, i) in nameIssues" :key="i" class="text-caption wf-state err">{{ tx(e.key, e.params) }}</li></ul>
		<pc-result :text="msg || ''" :kind="msgKind" class="mt-3" />

		<!-- deleting asks first, and says when the changes during the print go with the profile -->
		<v-dialog v-model="confirm" max-width="460" content-class="workshop-theme impresion-dialog">
			<v-card v-if="plan">
				<v-card-title class="pc-card-title">{{ tx('delete_title', { name: plan.name }) }}</v-card-title>
				<v-card-text>
					<div>{{ tx('delete_text') }}</div>
					<div v-if="plan.withChanges" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('delete_with_changes') }}</span></div>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn text class="pf-btn" @click="confirm = false">{{ tx('cancel') }}</v-btn>
					<v-btn color="error" class="pf-btn" @click="doDelete()">{{ tx('delete') }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</pc-section>
</template>

<script>
'use strict'

// "Profiles": the master-detail page of the material profiles. Left: the list (ProfileList.vue); right: ONE profile in flat sections (ProfileEditor.vue: Basics, Temperatures
// by zone, Changes during the print) with its Preheat button (ProfilePreheat.vue). A profile is an entry of `materials` in printing.json; its optional changes during the print
// are the relative layer changes stored in the service (layerrecipes.*) under the SAME NAME (the link): renaming a profile moves them, duplicating copies them, deleting removes them.
// The list is a draft: New / Duplicate / Delete / edits change it and nothing is stored until Save. The logic of the list is pure (profile-list.js, material-profile.js).
// "Use in the job" writes the saved profile into the job draft of the page (job-draft.js) and asks the shell to open Prepare job.
import i18n from '../../i18n'
import WfUnsavedMark from './WfUnsavedMark.vue' // vue/_shared36
import { unsavedMixin } from './unsaved-mixin.js' // vue/_shared36: the guard of the unsaved changes (the dialog is mounted by the page)
import PcResult from './PcResult.vue' // the result of an action, one line
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import LockReason from './LockReason.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared36)
import { MATERIALS_DEF } from './util.js'
import { printingConfig } from './printing-config.js' // the one copy of printing.json of the page (shared with Prepare job)
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'
import { api } from './workshop-api.js'
import ProfileList from './ProfileList.vue'
import ProfileEditor from './ProfileEditor.vue'
import ProfilePreheat from './ProfilePreheat.vue'
import { cleanList, nameProblems, linkPlan, recipeNameFor } from './material-profile.js'
import { newProfile, duplicateProfile, removeProfile, deletePlan, listRows } from './profile-list.js'
import { jobDraft } from './job-draft.js'

let seq = 0

const fresh = list => JSON.parse(JSON.stringify(list)).map(m => Object.assign(m, { _from: m.name }))

export default {
	mixins: [unsavedMixin, roleMixin],
	sessionData: ['msg', 'msgKind', 'failure'],
	sessionErrors: ['msg', 'msgKind', 'failure'],
	components: { WfUnsavedMark, PcResult, PcSection, LockReason, ErrorNotice, ProfileList, ProfileEditor, ProfilePreheat },
	props: {
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null },
		state: { type: String, default: '' }
	},
	data() {
		return { uid: 'pf' + (++seq), list: [], sel: -1, saved: [], recipes: [], originals: [], bedConfig: null, cfg: {}, cfgFailed: false, loaded: false, changed: false, saving: false, confirm: false, plan: null, msg: null, msgKind: 'info', failure: null }
	},
	computed: {
		// a printing.json that could not be read is not an empty one: nothing is edited or saved until it reads again (the factory list would replace the real one)
		canEdit() {
			return this.atLeast(NEED.configure) && !this.cfgFailed
		},
		needEdit() {
			return NEED.configure
		},
		selectedTool() {
			return this.currentTool
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
		step() {
			return (this.cfg && this.cfg.step) || {}
		},
		current() {
			return this.list[this.sel] || null
		},
		rows() {
			return listRows(this.list, this.nozzleZones.length, this.recipes)
		},
		nameIssues() {
			return nameProblems(this.list)
		},
		// only a SAVED profile can go to the job: with unsaved changes (or a profile not saved yet) the button says to save first
		canUse() {
			return !this.changed && !!this.current && !!this.current._from
		}
	},
	mounted() {
		this.readConfig()
	},
	methods: {
		// the unsaved changes guard (unsaved-mixin.js): what is being edited against what is saved
		unsavedPair() {
			// a draft flag: true = something changed since the last Save
			return [this.changed, false]
		},
		async saveBeforeLeaving() {
			if (!this.changed) return true
			await this.save()
			return !this.changed
		},
		discardUnsaved() {
			this.discard()
		},
		unsavedLabel() {
			return 'profiles'
		},
		// printing.json (the one copy of the page): when it cannot be read the list stays empty, the error is shown with Retry and nothing can be saved over the file
		async readConfig() {
			this.cfg = await printingConfig.load(true)
			this.cfgFailed = !!printingConfig.error
			this.failure = printingConfig.error
			this.setList(this.cfgFailed ? [] : (Array.isArray(this.cfg.materials) && this.cfg.materials.length ? this.cfg.materials : MATERIALS_DEF))
			const last = this.cfg.last && this.list.findIndex(m => m.name === this.cfg.last)
			this.sel = last >= 0 ? last : (this.list.length ? 0 : -1)
			this.changed = false
			this.loaded = true
			this.loadLinks()
		},
		tx(key, params) {
			return i18n.t('plugins.WorkshopPrinting.profiles.' + key, params || {})
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		},
		// the loaded list: each entry remembers the name it was loaded with (the link with its changes during the print)
		setList(src) {
			this.list = fresh(src)
			this.saved = fresh(src)
			this.originals = this.list.map(m => m.name)
		},
		touch() {
			this.changed = true
			this.list = this.list.slice()
		},
		// the stored changes during the print (by name) and the bed zones: both optional, a service without them only hides that section
		async loadLinks() {
			try {
				this.recipes = ((await api('layerrecipes.list', {}, { quiet: true })).recipes || []).map(r => r.name)
			} catch (e) { /* the section says it cannot read them */ }
			try {
				this.bedConfig = (await api('bedzones.get', {}, { quiet: true })).config
			} catch (e) { /* no bed zones */ }
		},
		recipeFor(name) {
			return recipeNameFor(name, this.recipes)
		},
		recipesChanged(e) {
			const rest = this.recipes.filter(n => n.toLowerCase() !== String(e.name).toLowerCase())
			this.recipes = e.has ? rest.concat([e.name]) : rest
		},
		// leave the profile chosen in the job draft and open Prepare job: nothing is heated or sent
		useInJob() {
			if (!this.canUse) return
			jobDraft.setProfile(this.current._from)
			this.$emit('goto', { section: 'prepare', focus: true })
		},
		addProfile() {
			const r = newProfile(this.list, this.tx('new'), this.nozzleZones.length)
			this.list = r.list
			this.sel = r.index
			this.changed = true
		},
		duplicate() {
			const r = duplicateProfile(this.list, this.sel, this.tx('copy_word'))
			this.list = r.list
			this.sel = r.index
			this.changed = true
		},
		askDelete() {
			this.plan = deletePlan(this.list, this.sel, this.recipes)
			this.confirm = !!this.plan
		},
		doDelete() {
			const r = removeProfile(this.list, this.sel)
			this.list = r.list
			this.sel = r.index
			this.changed = true
			this.confirm = false
		},
		discard() {
			const name = this.current ? this.current.name : ''
			this.list = fresh(this.saved)
			this.sel = Math.max(0, this.list.findIndex(m => m._from === name))
			if (!this.list.length) this.sel = -1
			this.changed = false
			this.msg = null
		},
		restore() {
			this.list = JSON.parse(JSON.stringify(MATERIALS_DEF))
			this.sel = this.list.length ? 0 : -1
			this.changed = true
		},
		async save() {
			if (!this.canEdit) return
			this.failure = null
			this.saving = true
			try {
				const plan = linkPlan(this.list, this.recipes, this.originals)
				if (plan.clash.length) {
					this.msgKind = 'error'
					this.msg = this.tx('err_changes_clash', { name: plan.clash[0] })
					return
				}
				const clean = cleanList(this.list)
				const cfg = await printingConfig.update({ materials: clean })
				this.cfg = cfg
				this.changed = false
				const said = await this.syncChanges(plan)
				const keep = this.current ? this.current.name : ''
				this.setList(clean)
				this.sel = Math.max(0, this.list.findIndex(m => m.name === keep))
				if (!this.list.length) this.sel = -1
				this.msgKind = said.failed ? 'warning' : 'success'
				this.msg = this.tx('saved') + said.text
			} catch (e) {
				if (isFriendly(e)) this.failure = e
				else {
					this.msgKind = 'error'
					this.msg = i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e)
				}
			} finally {
				this.saving = false
			}
		},
		// the changes during the print follow their profiles by name: a duplicate gets a copy, a renamed profile moves them, one taken out takes them (the person is told)
		async syncChanges(plan) {
			const out = { text: '', failed: false }
			const stored = async name => (await api('layerrecipes.get', { name }, { quiet: true })).recipe
			for (const r of plan.copy) {
				try {
					await api('layerrecipes.set', { name: r.to, recipe: Object.assign({}, await stored(r.from), { material: String(r.to).slice(0, 40) }) })
					out.text += ' ' + this.tx('changes_copied', { from: r.from, to: r.to })
				} catch (e) {
					out.failed = true
					out.text += ' ' + this.tx('changes_copy_failed', { from: r.from, to: r.to, error: (e && e.message) || String(e) })
				}
			}
			for (const r of plan.rename) {
				try {
					await api('layerrecipes.set', { name: r.to, recipe: Object.assign({}, await stored(r.from), { material: String(r.to).slice(0, 40) }) })
					await api('layerrecipes.remove', { name: r.from })
					out.text += ' ' + this.tx('changes_renamed', { from: r.from, to: r.to })
				} catch (e) {
					out.failed = true
					out.text += ' ' + this.tx('changes_move_failed', { from: r.from, to: r.to, error: (e && e.message) || String(e) })
				}
			}
			for (const name of plan.remove) {
				try {
					await api('layerrecipes.remove', { name })
					out.text += ' ' + this.tx('changes_removed', { name })
				} catch (e) {
					out.failed = true
					out.text += ' ' + this.tx('changes_remove_failed', { name, error: (e && e.message) || String(e) })
				}
			}
			await this.loadLinks()
			return out
		}
	}
}
</script>

<style scoped>
.pf-main { min-width: 0; }
.pf-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 12px; text-align: center; border: 1px dashed var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 6px; }
</style>
