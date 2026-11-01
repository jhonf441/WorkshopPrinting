<template>
	<!-- Job control (2026-10-30): what a person touches while a print runs. Pause / resume / cancel send the codes DWC's own buttons
	     send; the live corrections (Z baby-stepping M290, speed M220, flow M221 of the tool's extruder) show what the board applies now
	     from the object model. Operator's (NEED.operate): every button is disabled below that role. Logic in job-control.js. -->
	<v-card outlined class="pa-3 job-control">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small>mdi-play-pause</v-icon>
			<span class="text-subtitle-1">{{ t('jobControl.title') }}</span>
			<v-chip small outlined>{{ stateText }}</v-chip>
		</div>
		<details class="wf-more mt-1">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>{{ t('jobControl.help_what') }} {{ t('jobControl.help_why') }} {{ t('jobControl.help_missing') }} {{ t('jobControl.help_how') }}</p>
		</details>
		<v-alert v-if="!isFff" dense text type="info" class="mt-2 mb-0">{{ t('jobControl.only_fff') }}</v-alert>

		<!-- pause / resume / cancel: cancel ends the job for good, so it takes two taps (DESIGN.md 5: danger = red outline, armed = filled) -->
		<div class="text-subtitle-2 mt-3">{{ t('jobControl.job_title') }}</div>
		<div class="text-caption grey--text">{{ t('jobControl.job_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<v-btn small color="primary" :disabled="!buttons.pause || !canOperate || sending" @click="job('pause')">
				<v-icon small left>mdi-pause</v-icon>{{ t('jobControl.pause') }}
			</v-btn>
			<v-btn small color="primary" :disabled="!buttons.resume || !canOperate || sending" @click="job('resume')">
				<v-icon small left>mdi-play</v-icon>{{ t('jobControl.resume') }}
			</v-btn>
			<v-btn small color="error" :outlined="armed !== 'cancel'" :disabled="!buttons.cancel || !canOperate || sending" @click="arm('cancel', () => job('cancel'))">
				<v-icon small left>mdi-stop</v-icon>{{ armed === 'cancel' ? t('jobControl.cancel_again') : t('jobControl.cancel') }}
			</v-btn>
			<span v-if="jobReason" class="text-caption grey--text">{{ jobReason }}</span>
		</div>

		<!-- The three corrections (Z, speed, flow) belong to a print in progress: their steps and Apply are off with no job (correct), and what
		     a job left behind is a warning (leftoverText); Reset and 100 % are always there to put it back (job-control.js) -->
		<v-alert v-if="leftoverText" dense text type="warning" class="mt-4 mb-0">{{ leftoverText }}</v-alert>
		<div v-if="correctReason" class="text-caption grey--text mt-3">{{ correctReason }}</div>

		<!-- Z baby-stepping: steps of hundredths; every step takes two taps (it moves Z under a running print) and the reset too (it can move
		     up to the cap at once); the sum is capped by job-control.js -->
		<div class="text-subtitle-2 mt-4">{{ t('jobControl.baby_title') }}</div>
		<div class="text-caption grey--text">{{ t('jobControl.baby_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<v-btn v-for="s in steps" :key="s" small :outlined="armed !== 'baby:' + s" :color="armed === 'baby:' + s ? 'amber darken-3' : undefined" :disabled="!isFff || !correct || !babyStepCode(s, babyNow) || !canOperate || sending" @click="arm('baby:' + s, () => baby(s))">
				{{ (s > 0 ? '+' : '') + s.toFixed(2) }}
			</v-btn>
			<span class="text-body-2">{{ t('jobControl.baby_now') }} <b class="mono">{{ babyText }}</b></span>
			<v-btn small :text="armed !== 'baby0'" :color="armed === 'baby0' ? 'amber darken-3' : undefined" :disabled="!isFff || babyNow === null || Math.abs(babyNow) < 0.005 || !canOperate || sending" @click="arm('baby0', babyReset)">
				{{ armed === 'baby0' ? t('jobControl.baby_reset_again') : t('jobControl.baby_reset') }}
			</v-btn>
		</div>
		<div v-if="armedBaby" class="text-caption warning--text mt-1">{{ t('jobControl.baby_tap_again', { delta: armedBaby }) }}</div>
		<div class="text-caption grey--text mt-1">{{ t('jobControl.baby_limit', { limit: babyLimit }) }}</div>

		<!-- speed and flow factors: percentages over what the file asks; "now" is what the board reports -->
		<div class="text-subtitle-2 mt-4">{{ t('jobControl.factors_title') }}</div>
		<div class="text-caption grey--text">{{ t('jobControl.speed_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-2">{{ t('jobControl.speed') }}</span>
			<input v-model.number="speedNew" type="number" step="5" :min="speedLimits.min" :max="speedLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn small outlined :disabled="!isFff || !correct || !speedCode(speedNew) || !canOperate || sending" @click="applySpeed(speedNew)">{{ t('jobControl.apply') }}</v-btn>
			<v-btn small text :disabled="!isFff || factors.speed === 100 || !canOperate || sending" @click="applySpeed(100)">100 %</v-btn>
			<span class="text-caption grey--text">{{ t('jobControl.now_pct', { n: factors.speed === null ? '--' : factors.speed }) }}</span>
		</div>
		<div class="text-caption grey--text mt-2">{{ t('jobControl.flow_help') }}</div>
		<div v-for="f in factors.flows" :key="f.extruder" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-2">{{ t('jobControl.flow_e', { n: f.extruder }) }}</span>
			<input v-model.number="flowNew[f.extruder]" type="number" step="1" :min="flowLimits.min" :max="flowLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn small outlined :disabled="!isFff || !correct || !flowCode(flowNew[f.extruder], f.extruder) || !canOperate || sending" @click="applyFlow(f.extruder, flowNew[f.extruder])">{{ t('jobControl.apply') }}</v-btn>
			<v-btn small text :disabled="!isFff || f.percent === 100 || !canOperate || sending" @click="applyFlow(f.extruder, 100)">100 %</v-btn>
			<span class="text-caption grey--text">{{ t('jobControl.now_pct', { n: f.percent === null ? '--' : f.percent }) }}</span>
		</div>
		<div v-if="!factors.flows.length" class="text-caption grey--text mt-1">{{ t('jobControl.no_extruder') }}</div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</v-card>
</template>

<script>
'use strict'

import { mapActions } from 'vuex'
import { ARM_MS, BABY_LIMIT, BABY_STEPS, FLOW_LIMITS, SPEED_LIMITS, armedPress, babyResetCode, babyStepCode, babyStepNow, babyStepText, correctionsOpen, factorsNow, flowCode, jobRunning, leftoverCorrections, speedCode } from './job-control.js'
import { jobButtons, jobCode } from './job-rules.js' // the buttons by state and their codes: one rule for every page (vue/_shared)
import { TZ_FFF_STATES } from './fff-temps.js' // the translated names of the machine states (fff.st_<state>)
import { isError } from './util.js'
import { jobInLive } from './machine-free.js' // a live job (program through the bridge) has its controls in the Jog bar (vue/_shared)
import { NEED } from './print-sections.js'
import { pluginActive } from './workshop-ids.js' // vue/_shared36
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)

export default {
	mixins: [roleMixin],
	props: {
		isFff: { type: Boolean, default: false }
	},
	data() {
		return {
			steps: BABY_STEPS, babyLimit: BABY_LIMIT, speedLimits: SPEED_LIMITS, flowLimits: FLOW_LIMITS,
			speedNew: 100, speedFilled: false, flowNew: {},
			armed: null, armedAt: 0, armedTimer: null, sending: false, msg: null, msgKind: 'info'
		};
	},
	computed: {
		// pausing, cancelling, a Z step or a factor: an operator's, like heating a zone (NEED, print-sections.js)
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		model() {
			return this.$store.state.machine.model;
		},
		status() {
			return (this.model.state && this.model.state.status) || '';
		},
		live() {
			return !!jobInLive(this.model);
		},
		// the tool the machine has now: the one that prints
		tool() {
			const n = this.model.state && this.model.state.currentTool;
			return (this.model.tools || []).find(t => t && t.number === n) || null;
		},
		buttons() {
			return jobButtons(this.status, this.live);
		},
		stateText() {
			const s = this.status;
			return s ? (TZ_FFF_STATES[s] ? this.t('fff.st_' + s) : s) : '--';
		},
		// why the three buttons are grey (DESIGN.md 5: the reason written)
		jobReason() {
			if (!this.canOperate) return this.t('jobControl.needs_operator');
			if (this.live) return this.t(pluginActive(this.$store, 'jog') ? 'jobControl.live_job' : 'jobControl.live_job_no_jog'); // the Jog is another plugin: nothing about it when it is absent
			if (!jobRunning(this.status)) return this.t('jobControl.no_job');
			return '';
		},
		babyNow() {
			return babyStepNow(this.model);
		},
		// M290, M220 and M221 only with a job going on (file or live); putting them back is always allowed
		correct() {
			return correctionsOpen(this.status, this.live);
		},
		correctReason() {
			return this.isFff && this.canOperate && !this.correct ? this.t('jobControl.corrections_need_job') : '';
		},
		// what a job left applied (Z, speed, flow) with nothing printing: the next job would start with it
		leftoverText() {
			if (!this.isFff || this.correct) return '';
			const list = leftoverCorrections(this.babyNow, this.factors).map(x => {
				if (x.id === 'baby') return this.t('jobControl.leftover_baby', { sum: babyStepText(x.value) });
				if (x.id === 'speed') return this.t('jobControl.leftover_speed', { n: x.value });
				return this.t('jobControl.leftover_flow', { e: x.extruder, n: x.value });
			});
			return list.length ? this.t('jobControl.leftover', { list: list.join(', ') }) : '';
		},
		babyText() {
			return babyStepText(this.babyNow);
		},
		// the Z step armed now (its first tap was given): "+0.02" / "-0.05", '' when none
		armedBaby() {
			const a = this.armed;
			if (!a || !a.startsWith('baby:')) return '';
			const s = Number(a.slice(5));
			return (s > 0 ? '+' : '') + s.toFixed(2);
		},
		factors() {
			return factorsNow(this.model, this.tool);
		}
	},
	watch: {
		// the fields start with what the board applies (once per extruder, when the model says it)
		factors: {
			immediate: true,
			handler(f) {
				if (f.speed !== null && !this.speedFilled) { this.speedFilled = true; this.speedNew = f.speed; }
				f.flows.forEach(x => { if (x.percent !== null && this.flowNew[x.extruder] === undefined) this.$set(this.flowNew, x.extruder, x.percent); });
			}
		}
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		babyStepCode,
		speedCode,
		flowCode,
		// the double tap (armedPress, job-control.js): the first tap arms, the second within ARM_MS fires
		arm(id, fn) {
			const r = armedPress(this.armed ? { id: this.armed, at: this.armedAt } : null, id, Date.now());
			this.armed = r.state ? r.state.id : null;
			this.armedAt = r.state ? r.state.at : 0;
			clearTimeout(this.armedTimer);
			if (r.state) this.armedTimer = setTimeout(() => { this.armed = null; }, ARM_MS);
			if (r.fire) fn();
		},
		async run(codes, okText) {
			if (!this.canOperate || this.sending) return;
			this.sending = true;
			this.msg = null;
			try {
				for (const c of codes) {
					const r = await this.sendCode({ code: c, log: true });
					if (isError(r)) throw new Error(r);
				}
				this.msgKind = 'success';
				this.msg = okText;
			} catch (e) {
				this.msgKind = 'error';
				this.msg = this.t('jobControl.could_not', { error: e.message || String(e) });
			} finally {
				this.sending = false;
			}
		},
		job(action) {
			const code = jobCode(action);
			if (!code || !this.buttons[action]) return;
			this.run([code], this.t('jobControl.sent', { code }));
		},
		baby(step) {
			const code = babyStepCode(step, this.babyNow);
			if (!code || !this.correct) return;
			this.run([code], this.t('jobControl.baby_set', { delta: (step > 0 ? '+' : '') + step.toFixed(2), sum: babyStepText((this.babyNow || 0) + step) }));
		},
		babyReset() {
			this.run([babyResetCode()], this.t('jobControl.baby_zero'));
		},
		applySpeed(percent) {
			const code = speedCode(percent);
			if (!code || (!this.correct && Math.round(percent) !== 100)) return;
			this.speedNew = Math.round(percent);
			this.run([code], this.t('jobControl.speed_set', { n: Math.round(percent) }));
		},
		applyFlow(extruder, percent) {
			const code = flowCode(percent, extruder);
			if (!code || (!this.correct && Math.round(percent) !== 100)) return;
			this.$set(this.flowNew, extruder, Math.round(percent));
			this.run([code], this.t('jobControl.flow_set', { e: extruder, n: Math.round(percent) }));
		}
	}
};
</script>

<style scoped>
.field {
	width: 72px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
	font-variant-numeric: tabular-nums;
}
.mono {
	font-family: var(--tp-font-mono, monospace);
}
</style>
