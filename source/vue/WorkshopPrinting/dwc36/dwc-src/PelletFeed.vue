<template>
			<!-- feeding of the hopper: level sensor + feeding mechanism, by hand or automatic. READ the board, WRITE modefff.g -->
			<v-card v-if="feedForm" outlined class="pa-3">
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-icon small>mdi-grain</v-icon>
					<span class="text-subtitle-1">{{ $t('plugins.WorkshopPrinting.pellet.feed_title') }}</span>
					<span class="pc-state"><span class="pc-dot" :style="{ background: feedHmi.color }" />{{ feedHmi.levelText }}</span>
				</div>
				<div class="text-caption grey--text mt-1">{{ $t('plugins.WorkshopPrinting.pellet.feed_intro') }}</div>
				<div v-if="!configure" class="text-body-2 mt-2">{{ feedForm.mode === 'auto' ? $t('plugins.WorkshopPrinting.pellet.feed_auto') : $t('plugins.WorkshopPrinting.pellet.feed_manual') }}</div>
				<v-btn-toggle v-if="configure" v-model="feedForm.mode" mandatory dense color="primary" class="mt-2">
					<v-btn small value="manual"><v-icon small left>mdi-hand-back-right-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.feed_manual') }}</v-btn>
					<v-btn small value="auto" :disabled="!!feedAutoReason"><v-icon small left>mdi-autorenew</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.feed_auto') }}</v-btn>
				</v-btn-toggle>
				<div v-if="configure" class="text-caption mt-1" :class="feedAutoReason ? 'warning--text' : 'grey--text'">
					{{ feedAutoReason || (feedForm.mode === 'auto' ? $t('plugins.WorkshopPrinting.pellet.feed_auto_note') : $t('plugins.WorkshopPrinting.pellet.feed_manual_note')) }}
				</div>
				<v-divider class="my-3" />
				<div class="text-subtitle-2">{{ $t('plugins.WorkshopPrinting.pellet.feed_sensor') }}</div>
				<div v-if="feedCfg.sensor && gpIn[feedCfg.sensor.index]" class="text-caption">
					J{{ feedCfg.sensor.index }} · {{ feedCfg.sensor.pin || '?' }} · {{ $t('plugins.WorkshopPrinting.pellet.feed_value', { v: gpIn[feedCfg.sensor.index].value }) }}
				</div>
				<div v-else-if="feedCfg.sensor" class="text-caption warning--text">{{ $t('plugins.WorkshopPrinting.pellet.feed_pending_reload') }}</div>
				<div v-else class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.feed_no_sensor') }}</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
					<input v-model.trim="feedForm.sensorPin" class="field wide" placeholder="io3.in" />
					<select v-model.number="feedForm.present" class="field wide">
						<option :value="1">{{ $t('plugins.WorkshopPrinting.pellet.feed_present_1') }}</option>
						<option :value="0">{{ $t('plugins.WorkshopPrinting.pellet.feed_present_0') }}</option>
					</select>
				</div>
				<div class="text-subtitle-2 mt-3">{{ $t('plugins.WorkshopPrinting.pellet.feed_mechanism') }}</div>
				<div v-if="feedCfg.mechanism && gpOut[feedCfg.mechanism.index]" class="text-caption">
					P{{ feedCfg.mechanism.index }} · {{ feedCfg.mechanism.pin || '?' }} · {{ Math.round((gpOut[feedCfg.mechanism.index].pwm || 0) * 100) }} %
				</div>
				<div v-else-if="feedCfg.mechanism" class="text-caption warning--text">{{ $t('plugins.WorkshopPrinting.pellet.feed_pending_reload') }}</div>
				<div v-else class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.feed_no_mechanism') }}</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
					<input v-model.trim="feedForm.mechPin" class="field wide" placeholder="out4" />
					<input v-model.number="feedForm.freq" type="number" min="1" max="5000" class="field" /> Hz
				</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
					{{ $t('plugins.WorkshopPrinting.pellet.feed_run') }} <input v-model.number="feedForm.run_s" type="number" min="1" max="60" class="field" /> s
					{{ $t('plugins.WorkshopPrinting.pellet.feed_wait') }} <input v-model.number="feedForm.wait_s" type="number" min="0" max="600" class="field" /> s
					{{ $t('plugins.WorkshopPrinting.pellet.feed_max') }} <input v-model.number="feedForm.max_s" type="number" min="5" max="3600" class="field" /> s
				</div>
				<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
					<v-btn v-if="configure" small :color="armed === 'feedsave' ? 'amber darken-3' : 'primary'" :loading="feedSaving" @click="arm('feedsave', saveFeed)">
						{{ armed === 'feedsave' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_save') }}
					</v-btn>
					<v-btn small outlined :disabled="!feedReady || !canOperate" :color="armed === 'feednow' ? 'amber darken-3' : undefined" @click="arm('feednow', feedNow)">
						<v-icon small left>mdi-play</v-icon>{{ armed === 'feednow' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_now', { s: feedForm.run_s }) }}
					</v-btn>
					<v-btn v-if="configure && (feedCfg.sensor || feedCfg.mechanism)" small text color="error" @click="arm('feedrm', removeFeed)">
						{{ armed === 'feedrm' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_remove') }}
					</v-btn>
				</div>
				<div v-if="configure" class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.pellet.feed_save_note') }}</div>
			</v-card>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { confirmRisk } from './risk.js' // the JS plugins' box, else a box of the page (vue/_shared36)
import { MODE_FILE, readText, writeText, updateCfg, isError, note } from './util.js'
import { isFriendly } from './print-errors.js'
import { normalize as normFeed, hopperState, pinOk, pinInUse, nextFree, pulseCodes, definitionLines, triggerLine, triggerMacro, applyFeedToMode, nextTrigger, markedTrigger } from './pellet-feed.js'

export default {
	props: {
		config: { type: Object, default: null }, // what printing.json keeps ("feed")
		tool: { type: Object, default: null },
		busy: { type: Boolean, default: false },
		gpIn: { type: Array, default: () => [] },
		gpOut: { type: Array, default: () => [] },
		// F3-P: the form that writes modefff.g / printing.json is for a technician; an operator only sees the state and feeds now
		configure: { type: Boolean, default: true },
		canOperate: { type: Boolean, default: true }
	},
	data() {
		return { feedForm: null, feedSaving: false, armed: null, armedTimer: null };
	},
	computed: {
		feedCfg() {
			return normFeed(this.config);
		},
		feedHmi() {
			const st = hopperState(this.feedCfg, this.gpIn);
			return { color: { full: '#2e7d32', empty: '#c62828', unknown: '#9e9e9e' }[st], levelText: i18n.t('plugins.WorkshopPrinting.pellet.feed_level_' + st) };
		},
		// what the form would leave defined, to say why automatic is not possible yet
		feedAutoReason() {
			const f = this.feedForm;
			if (!f) return '';
			if (!pinOk(f.sensorPin)) return i18n.t('plugins.WorkshopPrinting.pellet.feed_need_sensor');
			if (!pinOk(f.mechPin)) return i18n.t('plugins.WorkshopPrinting.pellet.feed_need_mechanism');
			return '';
		},
		// the feeder is defined AND the board already has it (the mode was reloaded after saving)
		feedReady() {
			const c = this.feedCfg;
			return !!c.mechanism && !!this.gpOut[c.mechanism.index];
		},
	},
	watch: {
		config() { this.seedFeed(); }
	},
	created() {
		this.seedFeed();
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
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
		say(kind, text) {
			this.$emit('msg', { kind, text });
		},
		seedFeed() {
			const c = this.feedCfg;
			this.feedForm = {
				mode: c.mode, sensorPin: (c.sensor && c.sensor.pin) || '', present: c.sensor ? c.sensor.present : 1,
				mechPin: (c.mechanism && c.mechanism.pin) || '', freq: c.mechanism ? c.mechanism.freq : 500, run_s: c.run_s, wait_s: c.wait_s, max_s: c.max_s
			};
		},
		// reads a text of the SD that may not exist
		async readOptional(path) {
			try {
				return await readText(path);
			} catch (e) {
				return '';
			}
		},
		// saves the feeding: printing.json, the lines of modefff.g and the trigger macro (automatic). Needs a mode reload
		async saveFeed() {
			const f = this.feedForm;
			if (!f || this.feedSaving || !this.configure) return;
			const tool = this.tool && this.tool.number;
			this.feedSaving = true;
			try {
				if (this.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
				const old = this.feedCfg;
				const sensorPin = f.sensorPin && f.sensorPin.trim(), mechPin = f.mechPin && f.mechPin.trim();
				if (sensorPin && !pinOk(sensorPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin', { pin: sensorPin }));
				if (mechPin && !pinOk(mechPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin', { pin: mechPin }));
				if (f.mode === 'auto' && !(sensorPin && mechPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_auto'));
				const texts = await Promise.all(['0:/sys/config.g', MODE_FILE, '0:/sys/modelaser.g', '0:/sys/modecnc.g'].map(p => this.readOptional(p)));
				[sensorPin, mechPin].filter(Boolean).forEach(p => { if (pinInUse(texts, p)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin_use', { pin: p })); });
				const inIdx = old.sensor ? old.sensor.index : nextFree(this.gpIn, 8);
				const outIdx = old.mechanism ? old.mechanism.index : nextFree(this.gpOut, 20);
				const next = normFeed({
					mode: f.mode, run_s: f.run_s, wait_s: f.wait_s, max_s: f.max_s,
					sensor: sensorPin ? { index: inIdx, present: f.present, pin: sensorPin } : null,
					mechanism: mechPin ? { index: outIdx, pin: mechPin, freq: f.freq } : null
				});
				const files = await this.listSys();
				const trig = markedTrigger(texts[1]) != null ? markedTrigger(texts[1]) : nextTrigger(files);
				if (next.mode === 'auto' && trig < 0) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_trigger'));
				const lines = definitionLines(next).concat(next.mode === 'auto' ? [triggerLine(next, trig)] : []);
				const r = applyFeedToMode(texts[1], tool, lines);
				if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_err_' + r.error));
				const ok = await confirmRisk({
					title: i18n.t('plugins.WorkshopPrinting.pellet.feed_confirm_title'),
					text: i18n.t('plugins.WorkshopPrinting.pellet.feed_confirm_text', { lines: lines.map(l => l.split(';')[0].trim()).join(' | ') || '-', mode: next.mode === 'auto' ? i18n.t('plugins.WorkshopPrinting.pellet.feed_auto') : i18n.t('plugins.WorkshopPrinting.pellet.feed_manual') })
				});
				if (!ok) return;
				const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				if (r.text !== texts[1]) {
					await writeText(MODE_FILE + '.bak-' + stamp, texts[1]);
					await writeText(MODE_FILE, r.text);
				}
				if (next.mode === 'auto') await writeText('0:/sys/trigger' + trig + '.g', triggerMacro(next));
				else if (markedTrigger(texts[1]) != null) await writeText('0:/sys/trigger' + markedTrigger(texts[1]) + '.g', triggerMacro({}));
				await updateCfg({ feed: next });
				this.seedFeed();
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.feed_log', { mode: next.mode }));
				this.say('success', i18n.t('plugins.WorkshopPrinting.pellet.feed_saved', { stamp }));
				this.$emit('saved', next);
			} catch (e) {
				if (isFriendly(e)) this.$emit('error', e);
				else this.say('error', e.message || String(e));
			} finally {
				this.feedSaving = false;
			}
		},
		async listSys() {
			try {
				const r = await fetch('/machine/directory/' + encodeURI('0:/sys'), { cache: 'no-store' });
				const l = r.ok ? await r.json() : [];
				return (Array.isArray(l) ? l : []).map(x => x && x.name);
			} catch (e) {
				return [];
			}
		},
		// forgets the feeding: the marked lines go away and the macro is left empty
		async removeFeed() {
			this.feedForm.sensorPin = '';
			this.feedForm.mechPin = '';
			this.feedForm.mode = 'manual';
			await this.saveFeed();
		},
		// one run of the mechanism by hand; the output is always switched off, also if something fails in the middle
		async feedNow() {
			const c = this.feedCfg;
			if (!this.feedReady) return;
			const p = pulseCodes(c.mechanism.index, this.feedForm.run_s);
			try {
				for (const code of [p.on, p.wait]) {
					const r = await this.sendCode({ code, log: true });
					if (isError(r)) throw new Error(r);
				}
				this.say('success', i18n.t('plugins.WorkshopPrinting.pellet.feed_pulsed', { s: this.feedForm.run_s }));
			} catch (e) {
				this.say('error', i18n.t('plugins.WorkshopPrinting.pellet.feed_pulse_error', { error: e.message || String(e) }));
			} finally {
				try { await this.sendCode({ code: p.off, log: true }); } catch (e) { /* the next run tries again */ }
			}
		},
	}
};
</script>

<style scoped>
.field {
	width: 64px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
select.field.wide {
	width: 230px;
}
.field.wide {
	width: 120px;
}
</style>
