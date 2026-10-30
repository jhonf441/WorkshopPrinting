<template>
	<!-- Nozzle change of the pellet extruder (technician): guided steps (hot, because the pellet inside is hard when cold) and what has to be
	     done again afterwards, since the firmware does not know the diameter. -->
	<v-card outlined class="pa-3">
		<div class="text-subtitle-1">{{ $t('plugins.WorkshopPrinting.nozzle.title') }}</div>
		<div class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.nozzle.intro') }}</div>
		<div class="text-body-2 mt-2">
			{{ saved > 0 ? $t('plugins.WorkshopPrinting.nozzle.current_size', { d: saved }) : $t('plugins.WorkshopPrinting.nozzle.no_size_saved') }}
		</div>

		<!-- no nozzle registered yet: what the machine has now was calibrated with the nozzle that is fitted; asking its diameter keeps it as its profile -->
		<v-card v-if="!(saved > 0)" outlined class="pa-3 mt-2">
			<div class="text-body-2 font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.first_title') }}</div>
			<div class="text-caption">{{ $t('plugins.WorkshopPrinting.nozzle.first_intro') }}</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
				<v-text-field v-model.number="firstD" type="number" step="0.05" min="0.2" max="8" dense outlined hide-details style="max-width:190px"
					:label="$t('plugins.WorkshopPrinting.nozzle.fitted_diameter')" suffix="mm" :disabled="!configure || busyHere" />
				<v-btn small color="primary" :disabled="!configure || !validFirst || busyHere" :loading="running === 'first'" @click="registerCurrent">{{ $t('plugins.WorkshopPrinting.nozzle.first_button') }}</v-btn>
			</div>
			<div v-if="!configure" class="text-caption warning--text mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.only_technician') }}</div>
			<v-alert v-if="firstMsg" dense text :type="firstKind" class="mt-2 mb-0">{{ firstMsg }}</v-alert>
		</v-card>

		<!-- what was calibrated with each nozzle (the one fitted now first) -->
		<div class="mt-2">
			<div class="text-caption font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.profiles_title') }}
				<v-btn icon x-small :title="$t('plugins.WorkshopPrinting.nozzle.profiles_refresh')" @click="loadProfiles"><v-icon x-small>mdi-refresh</v-icon></v-btn>
			</div>
			<div v-if="!profileList.length" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.nozzle.profiles_none') }}</div>
			<div v-for="p in profileList" :key="p.d" class="text-caption" :class="{ 'font-weight-medium': p.active }">
				{{ p.d }} mm<span v-if="p.active"> ({{ $t('plugins.WorkshopPrinting.nozzle.profile_fitted') }})</span>, {{ p.date || '?' }}:
				<span v-for="(i, n) in p.items" :key="i.id">{{ n ? ' | ' : '' }}{{ $t('plugins.WorkshopPrinting.nozzle.profile_' + i.id) }} <code>{{ i.text }}</code></span>
			</div>
		</div>

		<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
			<v-text-field v-model.number="diameter" type="number" step="0.05" min="0.2" max="8" dense outlined hide-details style="max-width:190px"
				:label="$t('plugins.WorkshopPrinting.nozzle.new_diameter')" suffix="mm" :disabled="busyHere" />
			<v-text-field v-model.number="temp" type="number" step="5" dense outlined hide-details style="max-width:190px"
				:label="$t('plugins.WorkshopPrinting.nozzle.melt_temperature')" suffix="°C" :disabled="busyHere" />
		</div>
		<div v-if="diameter !== '' && !valid" class="text-caption error--text mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.invalid_diameter') }}</div>
		<div v-else-if="valid && change === 'same'" class="text-caption warning--text mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.same_diameter') }}</div>

		<template v-if="valid">
			<div class="mt-3">
				<div v-for="(p, k) in steps" :key="k" class="step" :class="{ done: done(k), current: k === next }">
					<div class="step-num"><v-icon v-if="done(k)" small color="white">mdi-check</v-icon><span v-else>{{ k + 1 }}</span></div>
					<div class="step-body">
						<div class="text-body-2" :class="{ 'font-weight-medium': k === next }">{{ p.text }}</div>
						<div v-if="p.detail" class="text-caption grey--text">{{ p.detail }}</div>
						<div class="mt-1">
							<v-checkbox v-if="p.kind === 'manual'" :input-value="done(k)" :disabled="k > next" dense hide-details class="mt-0" :label="p.check" @change="mark(k, $event)" />
							<template v-else-if="p.kind === 'action'">
								<v-btn x-small :color="done(k) ? '' : 'primary'" :outlined="done(k)" :disabled="k > next || busyHere || !!p.blocked" :loading="running === k" @click="run(k)">
									{{ done(k) ? $t('plugins.WorkshopPrinting.headChange.again') : p.button }}
								</v-btn>
								<span v-if="k === next && p.blocked" class="text-caption warning--text ml-2">{{ p.blocked }}</span>
							</template>
							<div v-else-if="p.kind === 'auto'" class="text-caption" :class="p.ok() ? 'success--text' : 'warning--text'">{{ p.state() }}</div>
						</div>
					</div>
				</div>
			</div>
			<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

			<!-- what has to be done again with this diameter -->
			<div v-if="next >= steps.length" class="mt-4">
				<v-alert dense text type="success">{{ $t('plugins.WorkshopPrinting.nozzle.saved_now_redo', { d: diameter }) }}</v-alert>
				<!-- a profile saved for this diameter: flow, PID and pressure advance come back with one tap -->
				<div v-if="profileItems.length && !restored.length" class="followup">
					<div class="text-body-2 font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.profile_title', { d: diameter }) }}</div>
					<div class="text-caption">{{ $t('plugins.WorkshopPrinting.nozzle.profile_found', { date: profile.date || '?' }) }}</div>
					<div v-for="i in profileItems" :key="i.id" class="text-caption"><b>{{ $t('plugins.WorkshopPrinting.nozzle.profile_' + i.id) }}</b>: <code>{{ i.text }}</code></div>
					<v-btn x-small color="primary" class="mt-1" :disabled="!configure || busyHere" :loading="applying" @click="applySaved">{{ $t('plugins.WorkshopPrinting.nozzle.profile_apply') }}</v-btn>
					<span v-if="!configure" class="text-caption warning--text ml-2">{{ $t('plugins.WorkshopPrinting.nozzle.only_technician') }}</span>
				</div>
				<div v-else-if="!restored.length && after && after.change !== 'same'" class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.nozzle.profile_none', { d: diameter }) }}</div>
				<v-alert v-if="restored.length" dense text type="success" class="mt-2 mb-0">{{ $t('plugins.WorkshopPrinting.nozzle.profile_applied', { list: restored.map(i => $t('plugins.WorkshopPrinting.nozzle.profile_' + i)).join(', ') }) }}</v-alert>
				<div v-if="after && after.snapshot" class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.nozzle.profile_kept', { d: after.old }) }}</div>
				<div v-for="f in follow" :key="f.id" class="followup">
					<div class="text-body-2 font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id + '_title') }}</div>
					<div class="text-caption">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id, limits) }}</div>
					<v-btn v-if="f.goto" x-small outlined class="mt-1" @click="$emit('goto', { section: f.goto })">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id + '_go') }}</v-btn>
				</div>
			</div>
		</template>
	</v-card>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { isError, updateCfg, note } from './util.js'
import { nozzleState } from './nozzle-state.js'
import { validDiameter, sizeChange, slicerLimits, heatCode, offCode, followUps } from './nozzle-change.js'
import { getProfile, profileItems } from './nozzle-profiles.js'
import { readProfiles, snapshotNozzle, applyProfile } from './nozzle-store.js'

export default {
	props: {
		tool: { type: Object, default: null },
		zones: { type: Array, default: () => [] }, // heaters of the tool, nozzle first
		saved: { type: Number, default: 0 }, // diameter kept in printing.json (0: none)
		busy: { type: Boolean, default: false }, // a job runs
		configure: { type: Boolean, default: false }, // technician: the step that writes printing.json
		ext: { type: Object, default: null }, // the extruder of the tool in the model (steps per mm, pressure advance)
		extruder: { type: Number, default: 0 } // its number
	},
	data() {
		return { diameter: '', temp: 200, doneMap: {}, running: null, msg: null, msgKind: 'info', nozzles: {}, after: null, restored: [], applying: false, firstD: '', firstMsg: null, firstKind: 'success' };
	},
	computed: {
		valid() {
			return validDiameter(this.diameter);
		},
		change() {
			return sizeChange(this.saved, this.diameter);
		},
		// the change as it was when the diameter was registered (after that the registered one is the new one)
		changeNow() {
			return this.after ? this.after.change : this.change;
		},
		validFirst() {
			return validDiameter(this.firstD);
		},
		profileList() {
			return Object.keys(this.nozzles || {}).map(d => ({ d, active: Number(d) === Number(this.saved), date: this.nozzles[d].date, items: profileItems(this.nozzles[d]) }))
				.filter(p => p.items.length).sort((a, b) => (b.active - a.active) || (Number(a.d) - Number(b.d)));
		},
		profile() {
			return getProfile(this.nozzles, this.diameter);
		},
		profileItems() {
			return this.after && this.after.change !== 'same' ? profileItems(this.profile) : [];
		},
		heaterIds() {
			return this.zones.map(z => z.id);
		},
		busyHere() {
			return this.busy || this.running !== null;
		},
		limits() {
			return Object.assign({ d: this.diameter, old: this.after ? this.after.old : this.saved }, slicerLimits(this.valid ? this.diameter : 0));
		},
		follow() {
			const back = this.restored.map(i => (i === 'advance' ? 'pressure' : i));
			return followUps(this.changeNow).filter(f => !back.includes(f.id));
		},
		nozzle() {
			return this.zones[0] || null;
		},
		steps() {
			const t = this.tool ? this.tool.number : 0;
			const T = (k, o) => i18n.t('plugins.WorkshopPrinting.nozzle.' + k, o);
			const p = [{
				kind: 'action', text: T('step_heat', { c: this.temp }), detail: T('step_heat_detail'), button: T('heat'), codes: [heatCode(t, this.temp)],
				blocked: this.nozzle && this.temp > this.nozzle.max ? T('over_limit', { c: this.nozzle.max }) : ''
			}];
			// a sensor that is not connected reads -273 C: it can never show "hot", so the person checks it by hand
			if (nozzleState(this.nozzle, this.temp - 10) === 'unreadable') {
				p.push({ kind: 'manual', text: T('step_wait_hot', { c: this.temp - 10 }), check: T('hot_no_reading_check') });
			} else {
				p.push({
					kind: 'auto', text: T('step_wait_hot', { c: this.temp - 10 }), ok: () => nozzleState(this.nozzle, this.temp - 10) === 'hot',
					state: () => T('nozzle_at', { c: this.nozzle ? Math.round(this.nozzle.current) : '?' })
				});
			}
			p.push({ kind: 'manual', text: T('step_remove'), detail: T('step_remove_detail'), check: T('removed') });
			p.push({ kind: 'manual', text: T('step_fit', { d: this.diameter }), detail: T('step_fit_detail'), check: T('fitted') });
			p.push({ kind: 'action', text: T('step_off'), button: T('turn_off'), codes: [offCode(t)] });
			p.push({ kind: 'action', text: T('step_save', { d: this.diameter }), button: T('save'), save: true, blocked: this.configure ? '' : T('only_technician') });
			return p;
		},
		next() {
			for (let k = 0; k < this.steps.length; k++) if (!this.done(k)) return k;
			return this.steps.length;
		}
	},
	watch: {
		// another diameter or temperature starts again: the steps depend on them
		diameter() { this.reset(); },
		temp() { this.reset(); },
		saved() { this.loadProfiles(); }
	},
	created() {
		this.loadProfiles();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		reset() {
			this.doneMap = {};
			this.msg = null;
			this.after = null;
			this.restored = [];
		},
		// the nozzle fitted now was never registered: its diameter is asked once and what the machine has becomes its profile
		async registerCurrent() {
			if (!this.configure || this.busyHere || !this.validFirst) return;
			this.running = 'first';
			this.firstMsg = null;
			try {
				const d = Number(this.firstD);
				await snapshotNozzle(d, { steps: this.ext && this.ext.stepsPerMm, advance: this.ext && this.ext.pressureAdvance }, this.heaterIds);
				await updateCfg({ nozzleSize: d });
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_first', { d }));
				await this.loadProfiles();
				this.$emit('saved', d);
				this.firstKind = 'success';
				this.firstMsg = i18n.t('plugins.WorkshopPrinting.nozzle.first_done', { d });
			} catch (e) {
				this.firstKind = 'error';
				this.firstMsg = e.message || String(e);
			} finally {
				this.running = null;
			}
		},
		async loadProfiles() {
			try {
				this.nozzles = (await readProfiles()).nozzles;
			} catch (e) {
				this.nozzles = {};
			}
		},
		// the technician puts the saved flow / PID / advance of this diameter back (runs them and writes modefff.g)
		async applySaved() {
			if (!this.configure || this.busyHere || !this.profile) return;
			this.applying = true;
			this.msg = null;
			try {
				const plan = await applyProfile(this.sendCode, this.profile, this.extruder, this.heaterIds);
				this.restored = plan.ids;
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_profile_applied', { d: this.diameter, list: plan.codes.join(' | ') }));
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.nozzle.profile_apply') + ': ' + (e.message || e);
			} finally {
				this.applying = false;
			}
		},
		done(k) {
			const p = this.steps[k];
			if (!p) return false;
			if (p.kind === 'auto') return p.ok();
			return !!this.doneMap[k];
		},
		mark(k, v) {
			this.$set(this.doneMap, k, !!v);
			if (!v) Object.keys(this.doneMap).forEach(i => { if (+i > k) this.$delete(this.doneMap, i); });
		},
		async run(k) {
			const p = this.steps[k];
			if (!p || this.busyHere || p.blocked) return;
			this.running = k;
			this.msg = null;
			try {
				if (p.save) {
					if (!this.configure) return;
					// the nozzle that leaves keeps what it has now (steps, advance, PID), so it comes back with its own numbers
					const old = this.saved;
					const change = this.change;
					let snapshot = false;
					if (old > 0 && change !== 'same') {
						try {
							snapshot = await snapshotNozzle(old, { steps: this.ext && this.ext.stepsPerMm, advance: this.ext && this.ext.pressureAdvance }, this.heaterIds);
						} catch (e) {
							snapshot = false;
						}
					}
					await updateCfg({ nozzleSize: Number(this.diameter) });
					await this.loadProfiles();
					this.after = { change, old, snapshot };
					note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_changed', { old: this.saved || '?', d: this.diameter }));
					this.$emit('saved', Number(this.diameter));
				} else {
					for (const c of p.codes) {
						const r = await this.sendCode({ code: c, log: true });
						if (isError(r)) throw new Error(r);
					}
				}
				this.$set(this.doneMap, k, true);
			} catch (e) {
				this.msgKind = 'error';
				this.msg = p.text + ': ' + (e.message || e);
			} finally {
				this.running = null;
			}
		}
	}
};
</script>

<style scoped>
.step { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.15); opacity: 0.6; }
.step.current, .step.done { opacity: 1; }
.step-num { flex: none; width: 24px; height: 24px; border-radius: 50%; background: #607d8b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.step.current .step-num { background: #1976d2; }
.step.done .step-num { background: #2e7d32; }
.step-body { flex: 1; min-width: 0; }
.followup { padding: 8px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.15); }
</style>
