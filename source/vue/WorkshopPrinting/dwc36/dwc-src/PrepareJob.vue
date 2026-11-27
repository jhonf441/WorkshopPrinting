<template>
	<div class="pj">
		<!-- a machine with users and nobody signed in: the session cover of the family, alone (no empty steps under it); the chip of the header is the one Sign in button -->
		<session-notice v-if="noSession" variant="cover" kind="session" class="mt-3" />
		<error-notice v-else-if="shownFailure" :error="shownFailure" :action="tx('acting')" retry class="mt-2" @retry="load()" />

		<div v-if="!noSession">
		<!-- what was chosen and what the role can do, always in sight (four data) -->
		<prepare-summary class="mt-3" :items="stripItems" />
		<!-- the role, said from the first step (nobody finds a lock at the end): the ONE reason of Apply in this view, and one line of what this role can do.
		     A technician and a machine without users see nothing here. Preheat keeps its own reason next to its button (another group, another role). -->
		<div v-if="!canApply" :id="uid + '-role'" class="mb-3">
			<lock-reason op="layerrecipes.arm" need="technician" :subject="$t('plugins.WorkshopPrinting.subjects.prepare_apply')" />
			<div class="wf-field-msg is-hint mt-1">{{ tx(canPreheat ? 'role_can_operator' : 'role_can_viewer') }}</div>
		</div>

		<!-- the four steps: folded or open (the body of a folded step stays in the page), the current one opens by itself when it changes -->
		<div role="group" :aria-label="tx('steps_label')">
			<prepare-step :uid="uid" :n="1" :state="flow.steps[0].state" :title="tx('step_file_title')" :result="stepTexts.file" :open="open.file" @toggle="onToggle('file', $event)">
				<prepare-step-file :file-name="fileName" :job-name="jobName" :file-kind="fileKind" :stop="flow.stop" :is-job-file="isJobFile" @pick="onPick" @info="onInfo" @goto="$emit('goto', $event)" />
			</prepare-step>
			<prepare-step :uid="uid" :n="2" :state="flow.steps[1].state" :title="tx('step_profile_title')" :result="stepTexts.profile" :open="open.profile" :lead="tx('step_profile_help')" @toggle="onToggle('profile', $event)">
				<prepare-step-profile :value="name" :items="items" :file-name="fileName" :stop="flow.stop" :hint="flow.steps[1].hint" :picked="picked" :picked-kind="pickedKind" :picked-match="pickedMatch" :summary="summary" :has-layers="hasLayers" :file-nozzle-c="fileNozzleC" :can-edit="canEdit" @input="name = $event" @goto="$emit('goto', $event)" />
			</prepare-step>
			<prepare-step :uid="uid" :n="3" :state="flow.steps[2].state" :title="tx('step_review_title')" :result="stepTexts.review" :open="open.review" :lead="tx('step_changes_help')" @toggle="onToggle('review', $event)">
				<prepare-step-review :hint="flow.steps[2].hint" :ready="flow.ready" :name="name" :has-layers="hasLayers" :shown="shown" :preview="preview" :preview-error="previewError" :busy="busy" :applied="applied" :run-status="runStatus" :removing="removing" @read="read()" @remove-other="removeOther()" />
			</prepare-step>
			<prepare-step :uid="uid" :n="4" :state="flow.steps[3].state" :title="tx('step_start_title')" :result="stepTexts.start" :open="open.start" @toggle="onToggle('start', $event)">
				<prepare-step-ready :uid="uid" :file-name="fileName" :file="file" :stop="flow.stop" :ready="flow.ready" :hint="flow.steps[3].hint" :picked="picked" :name="name" :has-layers="hasLayers" :recipe="recipe" :draft-applied="draftApplied" :before-apply="beforeApply" :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="currentTool" :bed-config="bedConfig" :state="state" :path-parts="pathParts" :job-parts="jobParts" :changes-text="changesText" :copied="copied" :can-edit="canEdit" @status="runStatus = $event" @stale="statusStale = $event" @removed="onRemoved()" @goto="$emit('goto', $event)" @copy-path="copyPath()" @open-jobs="openJobs()" />
			</prepare-step>
		</div>
		<!-- ONE help for the section, at its foot: the four steps in order and the four-part help of each step (no second fold at the top, no "?" in every step) -->
		<help-fold class="mt-3" :items="helpRows">
			<p class="mt-2 mb-1">{{ tx('how_lead') }}</p>
			<ol class="mb-0">
				<li>{{ tx('how_1') }}</li>
				<li>{{ tx('how_2') }}</li>
				<li>{{ tx('how_3') }}</li>
				<li>{{ tx('how_4') }}</li>
			</ol>
		</help-fold>
		</div>
	</div>
</template>

<script>
'use strict'

// "Prepare job": ONE page with a strip of four data and four steps that fold (PrepareStep.vue: file, profile, review, get ready; prepare-steps.js): 1 the file (the G-code library select), 2 the profile (the material), 3 review what changes:
// the file next to the profile, by zone and by layer, with the G-code lines (GcodeLayerView.vue), and the actions Preheat and Apply. Step 3 is done when the comparison was read: Apply is
// an action with its own state in words, never a condition of a step. With changes during the print the page reads the file (layerrecipes.preview) and Apply gets them ready for that
// file (RecipeRun.vue: two taps, live state, Remove). Without them the same view is read with a FLAT comparison the service builds from the zone temperatures of the profile (`flat`,
// nothing saved) and there is NO Apply button: during the job the temperatures of the file rule, and the page says so. A file that is not a 3D print (laser / CNC) stops the page with a
// sentence. Reading never applies or sends anything. Step 4 (start) closes the flow: the page does NOT start the job, it shows the folder and the name of the file, what was
// prepared, and a button that opens DWC Jobs (router navigation); the step is done only when the object model says that very file is printing.
// The file and the profile are the job draft of the page (job-draft.js): the files section ("Prepare this file") and the profiles section ("Use in the job") write it too,
// so what was chosen there arrives here already chosen. The draft is what the person WANTS; what the machine HAS is always read from the object model and the service.
import { api } from './workshop-api.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import HelpFold from './HelpFold.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import SessionNotice from './SessionNotice.vue' // vue/_shared36
import { signedOut } from './workshop-auth.js' // vue/_shared36
import PrepareSummary from './PrepareSummary.vue' // the strip of four data
import PrepareStep from './PrepareStep.vue' // one folded / open step
import PrepareStepFile from './PrepareStepFile.vue'
import PrepareStepProfile from './PrepareStepProfile.vue'
import PrepareStepReview from './PrepareStepReview.vue'
import PrepareStepReady from './PrepareStepReady.vue'
import { prepareTextMixin } from './prepare-text-mixin.js'
import { summaryItems, stepResult, roleOf, openOnChange } from './prepare-summary.js'
import { fileForJob, toolZones } from './pellet-layers.js'
import { noteParams, bedZoneList } from './layer-recipes.js'
import { MATERIALS_DEF } from './util.js'
import { printingConfig } from './printing-config.js' // the one copy of printing.json of the page: a profile saved in Profiles arrives here without a reload
import { kindOf, recipeNameFor, flatPreviewArgs } from './material-profile.js'
import { kindOf as fileKindOf } from './gcode-lib-kinds.js'
import { summaryOf } from './profile-list.js'
import { prepareSteps, jobPathParts, appliedState } from './prepare-steps.js'
import { CORRECTION_STATES, jobRunning } from './job-control.js'
import { copyText } from './copy-text.js'
import { orderForJob, fileNozzle } from './profile-match.js'
import { samePath, jobDraft } from './job-draft.js'
import { lib } from './gcode-lib-shared.js'
import { stampListArgs, stampNow, staleState } from './file-stamp.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { NEED } from './print-sections.js'

let seq = 0

export default {
	mixins: [roleMixin, prepareTextMixin],
	// what the person who left had read stays nowhere: the comparison and the changes of the profile are read again with the new session (onSessionChange)
	sessionData: ['preview', 'shown', 'previewError', 'recipe'],
	sessionErrors: ['failure', 'previewError'],
	components: { ErrorNotice, HelpFold, LockReason, SessionNotice, PrepareSummary, PrepareStep, PrepareStepFile, PrepareStepProfile, PrepareStepReview, PrepareStepReady },
	props: {
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null },
		state: { type: String, default: '' },
		// the kind of the tool the page works on (pellet / filament, from the shell): the profiles of that kind are listed first ('' = not said)
		toolKind: { type: String, default: '' }
	},
	data() {
		return { uid: 'pj' + (++seq), materials: [], step: {}, recipes: [], bedConfig: null, name: '', file: '', fileTouched: false, fileKind: null, fileSummary: null, cfgError: null, readStale: false, draftApplied: false, removing: false, statusStale: false, statusMisses: 0, statusTimer: null, recipe: null, preview: null, shown: false, previewError: null, busy: false, failure: null, runStatus: null, copied: '', copiedTimer: null, last: '', open: { file: false, profile: false, review: false, start: false } }
	},
	computed: {
		// the help of the four steps, drawn folded under them (what it is, what for, if it is missing, how)
		helpRows() {
			return [['file', 'step_file_title', this.help('file')], ['profile', 'step_profile_title', this.help('profile')], ['changes', 'step_review_title', this.help('changes')], ['start', 'step_start_title', this.help('start')]].map(x => Object.assign({ id: x[0], title: this.tx(x[1]) }, x[2]));
		},
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
		// the profiles of the select: the kind of the tool first, the ones that fit the file first and marked (profile-match.js); none is hidden and none is chosen by itself
		items() {
			return orderForJob(this.materials, this.fileSummary, this.toolKind, this.extruderZones.length).map(r => ({ text: r.profile.name, value: r.profile.name, kind: r.kind, layers: !!recipeNameFor(r.profile.name, this.recipes), match: r.match }))
		},
		pickedMatch() {
			const it = this.items.find(i => i.value === this.name)
			return !!it && it.match
		},
		// the nozzle temperature the file asks for (null: the library does not know it, so nothing is said)
		fileNozzleC() {
			return fileNozzle(this.fileSummary)
		},
		picked() {
			return this.materials.find(m => m.name === this.name) || null
		},
		pickedKind() {
			return this.picked ? kindOf(this.picked, this.extruderZones.length) : 'pellet'
		},
		summary() {
			if (!this.picked) return ''
			const s = summaryOf(this.picked, this.extruderZones.length, this.recipes)
			return [s.nozzle !== null ? this.$t('plugins.WorkshopPrinting.profiles.sum_nozzle', { c: s.nozzle }) : '', s.bed !== null ? this.$t('plugins.WorkshopPrinting.profiles.sum_bed', { c: s.bed }) : ''].filter(Boolean).join(' / ')
		},
		linked() {
			return this.picked ? recipeNameFor(this.picked.name, this.recipes) : ''
		},
		hasLayers() {
			return !!this.linked
		},
		// the active bed zones as the flat comparison needs them: id = the bed number of the zones config, max = the heater cap
		bedZonesNow() {
			const hs = (this.model && this.model.heat && this.model.heat.heaters) || []
			return bedZoneList(this.bedConfig).filter(z => z.active).map(z => ({ id: z.heater, max: (hs[z.heater] && hs[z.heater].max) || null }))
		},
		// what the service needs to compare the file with a profile without changes during the print (null: nothing to compare)
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
		// the chosen file is the one the machine has loaded
		isJobFile() {
			return samePath(this.fileName, this.jobName)
		},
		readable() {
			return this.hasLayers || !!this.flatArgs
		},
		// the state of the three steps (prepare-steps.js)
		flow() {
			return prepareSteps({
				file: this.fileName, fileKind: this.fileKind, profile: this.picked ? this.picked.name : '', hasProfiles: this.materials.length > 0, readable: this.readable,
				preview: { shown: this.shown, loading: this.busy, error: this.previewError, ok: !!this.preview && !this.previewError, stale: this.readStale },
				job: { file: this.jobName, printing: !!CORRECTION_STATES[this.status], busy: jobRunning(this.status), simulating: this.status === 'simulating' }
			})
		},
		// the status of the machine, from the object model (what IS, never what the person chose)
		status() {
			return (this.model && this.model.state && this.model.state.status) || ''
		},
		// the folder and the name of the chosen file, as DWC Jobs shows them; and of the file of the job the machine has
		pathParts() {
			return jobPathParts(this.fileName)
		},
		jobParts() {
			return jobPathParts(this.jobName)
		},
		// the changes during the print of THIS profile are applied for THIS file (what the service says, layerrecipes.status through RecipeRun.vue)
		applied() {
			return this.statusStale ? 'unknown' : appliedState(this.runStatus, this.fileName, this.linked)
		},
		// the last row of the summary of step 4: applied, not applied (the job will use only the file temperatures) or the profile has none
		changesText() {
			if (this.applied === 'unknown') return this.tx('sum_changes_unknown')
			if (!this.hasLayers) return this.applied === 'other' ? this.tx('applied_other', { recipe: this.runStatus.recipe, file: this.runStatus.file }) : this.tx('sum_changes_none')
			return this.tx(this.applied === 'here' ? 'sum_changes_on' : 'sum_changes_off')
		},
		// the strip of four data and the result on the right of each step (prepare-summary.js: only keys, the texts are in the catalogs)
		stripItems() {
			return summaryItems({ fileName: this.fileName, profileName: this.picked ? this.picked.name : '', hasLayers: this.hasLayers, applied: this.applied, role: roleOf(this.canApply, this.canPreheat) })
		},
		stepTexts() {
			const i = { flow: this.flow, fileName: this.fileName, profileName: this.picked ? this.picked.name : '', hasLayers: this.hasLayers }
			const out = {}
			;['file', 'profile', 'review', 'start'].forEach(id => { const r = stepResult(id, i); out[id] = this.tx(r.key, r.params) })
			return out
		},
		// the machine has users and nobody is signed in: the service refuses every read, so the page shows the session cover instead of an empty flow
		noSession() {
			void this.identityTick
			return signedOut()
		},
		// Apply is the service's layerrecipes.arm (technician); Preheat is an operator's action. Both are said before the person starts (the role line under the stepper)
		canApply() {
			return this.canDo('layerrecipes.arm')
		},
		canPreheat() {
			return this.atLeast(NEED.operate)
		},
		// switching on changes during the print is editing a profile: a technician's action (the button that goes there shows only for that role)
		canEdit() {
			return this.atLeast(NEED.configure)
		},
		// the failure to show: printing.json that could not be read comes first (the profiles are not the factory ones, they are unknown)
		shownFailure() {
			return this.cfgError || this.failure
		},
		readDoneNow() {
			return !!this.flow.steps[2] && this.flow.steps[2].state === 'done'
		},
		// the file and the profile together: when it changes the reading is stale
		readKey() {
			return this.flow.ready ? this.fileName + '|' + (this.picked ? this.picked.name : '') + '|' + this.hasLayers : ''
		}
	},
	watch: {
		// the current step opens when it changes; the person may have opened another one, so nothing is closed or reset on a poll
		'flow.current': { immediate: true, handler(c) { this.open = openOnChange(this.open, c) } },
		jobName(v) {
			if (!this.fileTouched) this.file = v
		},
		name(v) {
			this.preview = null
			this.shown = false
			this.previewError = null
			this.recipe = null
			jobDraft.setProfile(v)
			this.loadRecipe()
		},
		fileName(v) {
			this.fileKind = null
			this.fileSummary = null
			this.reset()
			jobDraft.setFile(v)
		},
		// what the service has applied for this very job, kept in the draft for the other sections
		applied(v) {
			if (v === 'here') jobDraft.setApplied(true)
		},
		// step 4 is reached (the reading is done): the file is looked at once more, it may have changed while the person was in other sections
		readDoneNow(v) {
			if (v) this.checkStale()
		},
		hasLayers() {
			this.loadRecipe()
		},
		// both choices made: read the file against the profile (read only, nothing is armed or sent)
		readKey(k) {
			this.reset()
			if (k) this.read()
		}
	},
	mounted() {
		// what another section left chosen comes first; without it, the file the machine has loaded
		const d = jobDraft.get()
		this.file = d.file || this.jobName
		this.fileTouched = !!d.file
		if (d.profile) this.name = d.profile
		this.offDraft = jobDraft.subscribe(draft => this.onDraft(draft))
		this.offConfig = printingConfig.subscribe(cfg => { if (this.loadedOnce) this.takeConfig(cfg) })
		this.load().then(() => { this.loadedOnce = true })
		// a profile without changes has no Apply panel to read what the service has applied: the page asks itself (the same 3 s as the panel, only while it is needed)
		this.pollStatus()
		this.statusTimer = setInterval(() => this.pollStatus(), 3000)
	},
	beforeDestroy() {
		clearTimeout(this.copiedTimer)
		clearTimeout(this.focusTimer)
		clearInterval(this.statusTimer)
		if (this.offDraft) this.offDraft()
		if (this.offConfig) this.offConfig()
	},
	methods: {
		// the person opened or folded a step
		onToggle(id, value) {
			this.$set(this.open, id, !!value)
		},
		// the person signed in / out or the role changed: what the service answers may differ, so everything is read again
		onSessionChange() {
			this.load()
			this.loadRecipe()
			if (this.readKey) this.read()
		},
		// the draft changed somewhere else (the files section, the profiles section, or it was cleared when the session changed or the job ended):
		// the page follows it. An empty draft goes back to the defaults: the file the machine has loaded and the last profile used.
		onDraft(d) {
			this.draftApplied = !!d.applied
			if (d.file !== this.fileName) {
				this.file = d.file || this.jobName
				this.fileTouched = !!d.file
			}
			if (d.profile !== this.name) this.name = d.profile || (this.materials.some(m => m.name === this.last) ? this.last : '')
		},
		// what printing.json holds now: the profiles, the stagger of the zones and the last profile used
		takeConfig(cfg) {
			// a file that could not be read is NOT an empty one: no factory profiles in its place, and the notice says why (Retry reads again)
			if (printingConfig.error) { this.materials = []; this.cfgError = printingConfig.error; return }
			this.cfgError = null
			this.materials = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF
			this.step = cfg.step || {}
			this.last = cfg.last || ''
			if (!this.name && cfg.last && this.materials.some(m => m.name === cfg.last)) this.name = cfg.last
		},
		// the section was shown again (also by the menu): the profiles list is read again (read only)
		onActivate() {
			if (!this.loadedOnce) return
			this.load()
			this.checkStale()
		},
		async pollStatus() {
			if (this.hasLayers || !this.fileName || this.noSession) return
			try {
				this.runStatus = await api('layerrecipes.status', {}, { quiet: true })
				this.statusMisses = 0
				this.statusStale = false
			} catch (e) {
				if (++this.statusMisses >= 2) this.statusStale = true // two polls in a row without an answer: what was read last is not claimed
			}
		},
		// Remove (a stop: any role) for changes of another profile applied for this file
		async removeOther() {
			this.removing = true
			try {
				this.runStatus = await api('layerrecipes.disarm', {})
				this.onRemoved()
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.failure = e
			} finally {
				this.removing = false
			}
		},
		// the changes of this page were removed by the person: not applied any more is then expected, nothing to explain
		onRemoved() {
			jobDraft.setApplied(false)
		},
		// the file on the card against the stamp taken when it was read: ONE gcodelib.list call (read only), at fixed moments, never on a timer.
		// Returns true when the reading is still good (or nothing can be said).
		async checkStale() {
			if (!this.fileName || !this.preview) return true
			try {
				const out = await lib.list(stampListArgs(this.fileName))
				const known = jobDraft.get().fileStamp
				if (!known) { jobDraft.noteFile(stampNow(out && out.rows, this.fileName)); return true }
				if (staleState(known, out && out.rows, this.fileName) === 'stale') { this.readStale = true; return false }
			} catch (e) { /* the library does not answer: nothing is claimed */ }
			return true
		},
		// the stamp of the file as it is when it is read; the reading that follows is of that file
		async takeStamp() {
			try {
				const out = await lib.list(stampListArgs(this.fileName))
				const now = stampNow(out && out.rows, this.fileName)
				if (now) jobDraft.noteFile(now)
			} catch (e) { /* no stamp: a change is never claimed without one */ }
		},
		// before Apply: a stale reading must not be applied; the step opens again with Read again
		beforeApply() {
			return this.checkStale()
		},
		readAgain() {
			this.read()
		},
		// arriving from another section: the focus goes to the title of the first step that is not done (the tab change takes a moment to show the section)
		focusCurrent() {
			this.open = openOnChange(this.open, this.flow.current)
			clearTimeout(this.focusTimer)
			this.focusTimer = setTimeout(() => {
				const open = this.flow.steps.findIndex(s => s.state !== 'done')
				const n = (open < 0 ? this.flow.steps.length - 1 : open) + 1
				const el = this.$el && this.$el.querySelector ? this.$el.querySelector('#' + this.uid + '-s' + n) : null
				if (el && typeof el.focus === 'function') el.focus()
			}, 350)
		},
		// the path as DWC Jobs shows it (gcodes/folder/name), to find the file there: copied, or left on screen when the browser refuses
		copyPath() {
			copyText(this.pathParts.path).then((ok) => {
				this.copied = ok ? 'ok' : 'failed'
				clearTimeout(this.copiedTimer)
				this.copiedTimer = setTimeout(() => { this.copied = '' }, 4000)
			})
		},
		// the job is started in DWC Jobs: this only navigates there (no code is sent, nothing starts)
		openJobs() {
			if (this.$router) this.$router.push('/Files/Jobs').catch(() => {})
		},
		reset() {
			this.readStale = false
			this.preview = null
			this.shown = false
			this.previewError = null
		},
		// the file field is the select of the G-code library: it gives the path of the chosen file ('' when cleared)
		onPick(path) {
			this.file = path || ''
			this.fileTouched = true
		},
		// the library's summary of the file tells its kind: a laser / CNC file stops the page (a file the library does not know yet is not judged)
		onInfo(summary) {
			this.fileKind = fileKindOf(summary)
			this.fileSummary = summary || null
		},
		async load() {
			try {
				this.takeConfig(await printingConfig.load(true))
				this.cfgError = printingConfig.error
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
			if (!this.flow.ready) return
			this.busy = true
			this.readStale = false
			await this.takeStamp()
			this.previewError = null
			this.shown = true
			jobDraft.setRead('reading')
			try {
				const out = await api('layerrecipes.preview', this.hasLayers ? { name: this.linked, file: this.fileName } : { flat: this.flatArgs, file: this.fileName })
				// the service sends its notes as {key, params, message}: the viewer takes the keys and has its own sentences
				this.preview = Object.assign({}, out, { notes: (out.notes || []).map(n => (n && typeof n === 'object' ? n.key : n)), note_params: noteParams(out.notes) })
			} catch (e) {
				if (e && e.code !== 'cancelled') this.previewError = e
			} finally {
				this.busy = false
				jobDraft.setRead(this.previewError ? 'failed' : (this.preview ? 'ok' : 'idle'))
			}
		}
	}
}
</script>

<style scoped>
.pj-path { overflow-wrap: anywhere; }
</style>
