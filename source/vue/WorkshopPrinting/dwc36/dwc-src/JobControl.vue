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

		<!-- Z baby-stepping: steps of hundredths, one tap each (DWC's own buttons work the same); the sum is capped by job-control.js and
		     the reset can move up to that cap at once, so it takes two taps -->
		<div class="text-subtitle-2 mt-4">{{ t('jobControl.baby_title') }}</div>
		<div class="text-caption grey--text">{{ t('jobControl.baby_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<v-btn v-for="s in steps" :key="s" small outlined :disabled="!isFff || !babyStepCode(s, babyNow) || !canOperate || sending" @click="baby(s)">
				{{ (s > 0 ? '+' : '') + s.toFixed(2) }}
			</v-btn>
			<span class="text-body-2">{{ t('jobControl.baby_now') }} <b class="mono">{{ babyText }}</b></span>
			<v-btn x-small :text="armed !== 'baby0'" :color="armed === 'baby0' ? 'amber darken-3' : undefined" :disabled="!isFff || babyNow === null || Math.abs(babyNow) < 0.005 || !canOperate || sending" @click="arm('baby0', babyReset)">
				{{ armed === 'baby0' ? t('jobControl.baby_reset_again') : t('jobControl.baby_reset') }}
			</v-btn>
		</div>
		<div class="text-caption grey--text mt-1">{{ t('jobControl.baby_limit', { limit: babyLimit }) }}</div>

		<!-- speed and flow factors: percentages over what the file asks; "now" is what the board reports -->
		<div class="text-subtitle-2 mt-4">{{ t('jobControl.factors_title') }}</div>
		<div class="text-caption grey--text">{{ t('jobControl.speed_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-2">{{ t('jobControl.speed') }}</span>
			<input v-model.number="speedNew" type="number" step="5" :min="speedLimits.min" :max="speedLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn x-small outlined :disabled="!isFff || !speedCode(speedNew) || !canOperate || sending" @click="applySpeed(speedNew)">{{ t('jobControl.apply') }}</v-btn>
			<v-btn x-small text :disabled="!isFff || factors.speed === 100 || !canOperate || sending" @click="applySpeed(100)">100 %</v-btn>
			<span class="text-caption grey--text">{{ t('jobControl.now_pct', { n: factors.speed === null ? '--' : factors.speed }) }}</span>
		</div>
		<div class="text-caption grey--text mt-2">{{ t('jobControl.flow_help') }}</div>
		<div v-for="f in factors.flows" :key="f.extruder" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-2">{{ t('jobControl.flow_e', { n: f.extruder }) }}</span>
			<input v-model.number="flowNew[f.extruder]" type="number" step="1" :min="flowLimits.min" :max="flowLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn x-small outlined :disabled="!isFff || !flowCode(flowNew[f.extruder], f.extruder) || !canOperate || sending" @click="applyFlow(f.extruder, flowNew[f.extruder])">{{ t('jobControl.apply') }}</v-btn>
			<v-btn x-small text :disabled="!isFff || f.percent === 100 || !canOperate || sending" @click="applyFlow(f.extruder, 100)">100 %</v-btn>
			<span class="text-caption grey--text">{{ t('jobControl.now_pct', { n: f.percent === null ? '--' : f.percent }) }}</span>
		</div>
		<div v-if="!factors.flows.length" class="text-caption grey--text mt-1">{{ t('jobControl.no_extruder') }}</div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</v-card>
</template>

<script>
'use strict'

import { mapActions } from 'vuex'
import { BABY_LIMIT, BABY_STEPS, FLOW_LIMITS, SPEED_LIMITS, babyResetCode, babyStepCode, babyStepNow, babyStepText, factorsNow, flowCode, jobButtons, jobCode, jobRunning, speedCode } from './job-control.js'
import { TZ_FFF_STATES } from './fff-temps.js' // the translated names of the machine states (fff.st_<state>)
import { isError } from './util.js'
import { jobInLive } from './machine-free.js' // a live job (program through the bridge) has its controls in the Jog bar (vue/_shared)
import { NEED } from './print-sections.js'
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
			armed: null, armedTimer: null, sending: false, msg: null, msgKind: 'info'
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
			if (this.live) return this.t('jobControl.live_job');
			if (!jobRunning(this.status)) return this.t('jobControl.no_job');
			return '';
		},
		babyNow() {
			return babyStepNow(this.model);
		},
		babyText() {
			return babyStepText(this.babyNow);
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
		arm(id, fn) {
			if (this.armed !== id) {
				this.armed = id;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = null; }, 4000);
				return;
			}
			this.armed = null;
			fn();
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
			if (!code) return;
			this.run([code], this.t('jobControl.baby_set', { delta: (step > 0 ? '+' : '') + step.toFixed(2), sum: babyStepText((this.babyNow || 0) + step) }));
		},
		babyReset() {
			this.run([babyResetCode()], this.t('jobControl.baby_zero'));
		},
		applySpeed(percent) {
			const code = speedCode(percent);
			if (!code) return;
			this.speedNew = Math.round(percent);
			this.run([code], this.t('jobControl.speed_set', { n: Math.round(percent) }));
		},
		applyFlow(extruder, percent) {
			const code = flowCode(percent, extruder);
			if (!code) return;
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
