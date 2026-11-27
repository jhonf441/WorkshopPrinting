<template>
	<!-- adds a fan to the extruder from the panel: a part fan (joins the tool) or a throat fan (thermostatic). WRITES modefff.g -->
	<v-card outlined class="pa-3">
		<div class="pc-actions">
			<v-icon small>mdi-fan-plus</v-icon>
			<span class="pc-card-title">{{ $t('plugins.WorkshopPrinting.pellet.newfan_title') }}</span>
		</div>
		<div class="text-caption pc-muted mt-1">{{ $t('plugins.WorkshopPrinting.pellet.newfan_intro') }}</div>
		<v-btn-toggle v-model="form.kind" mandatory dense color="primary" class="mt-2">
			<v-btn small value="part">{{ $t('plugins.WorkshopPrinting.pellet.newfan_part') }}</v-btn>
			<v-btn small value="throat">{{ $t('plugins.WorkshopPrinting.pellet.newfan_throat') }}</v-btn>
		</v-btn-toggle>
		<div class="text-caption pc-muted mt-1">{{ form.kind === 'throat' ? $t('plugins.WorkshopPrinting.pellet.newfan_throat_note') : $t('plugins.WorkshopPrinting.pellet.newfan_part_note') }}</div>
		<div class="pc-actions mt-2">
			<input v-model.trim="form.name" class="field wide" :placeholder="$t('plugins.WorkshopPrinting.pellet.newfan_name')" maxlength="24" />
			<input v-model.trim="form.pin" class="field wide" placeholder="out6" />
			<input v-model.number="form.freq" type="number" min="1" max="50000" class="field" /> Hz
		</div>
		<template v-if="form.kind === 'throat'">
			<h4 class="mt-3">{{ $t('plugins.WorkshopPrinting.pellet.newfan_follows') }}</h4>
			<v-checkbox v-for="z in zones" :key="z.id" v-model="form.heaters" :value="z.id" dense hide-details class="mt-0" :label="'H' + z.id + ' · ' + z.name" />
			<div class="pc-actions mt-2">
				{{ $t('plugins.WorkshopPrinting.pellet.fan_on_from') }} <input v-model.number="form.low" type="number" min="0" max="300" class="field" :aria-label="$t('plugins.WorkshopPrinting.pellet.fan_on_from') + ' (°C)'" /> °C
				{{ $t('plugins.WorkshopPrinting.pellet.fan_full_from') }} <input v-model.number="form.high" type="number" min="0" max="300" class="field" :aria-label="$t('plugins.WorkshopPrinting.pellet.fan_full_from') + ' (°C)'" /> °C
			</div>
		</template>
		<div class="pc-actions mt-3">
			<v-btn small :color="armed === 'add' ? 'amber darken-3' : 'primary'" :loading="saving" :disabled="!configure" @click="arm('add', save)">
				{{ armed === 'add' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.newfan_save') }}
			</v-btn>
		</div>
		<lock-reason min="technician" class="mt-1" :subject="$t('plugins.WorkshopPrinting.subjects.pellet_fan')" />
		<div class="text-caption pc-muted mt-2">{{ $t('plugins.WorkshopPrinting.pellet.newfan_note') }}</div>
		<template v-if="made.length">
			<v-divider class="my-3" />
			<h4>{{ $t('plugins.WorkshopPrinting.pellet.newfan_made') }}</h4>
			<div v-for="f in made" :key="f.index" class="pc-actions">
				<span class="text-body-2">M106 P{{ f.index }} · {{ f.name }} · {{ f.kind === 'throat' ? $t('plugins.WorkshopPrinting.pellet.newfan_throat') : $t('plugins.WorkshopPrinting.pellet.newfan_part') }}</span>
				<v-spacer />
				<v-btn x-small text color="error" :loading="removing === f.index" @click="arm('rm' + f.index, () => remove(f.index))">
					{{ armed === 'rm' + f.index ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.newfan_remove') }}
				</v-btn>
			</div>
		</template>
	</v-card>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import LockReason from './LockReason.vue' // vue/_shared36
import { confirmRisk } from './risk.js' // the JS plugins' box, else a box of the page (vue/_shared36)
import { MODE_FILE, modeFilePath, readText, writeText, note } from './util.js'
import { pinInUse } from './pellet-feed.js'
import { normalize, applyFan, marked, removeFan, nextFanIndex } from './pellet-fans.js'

import { tapArmMixin } from './tap-arm-mixin.js' // the double tap of the page (4 s)

export default {
	mixins: [tapArmMixin],
	components: { LockReason },
	props: {
		tool: { type: Object, default: null },
		busy: { type: Boolean, default: false },
		configure: { type: Boolean, default: false }, // the role writes the configuration (technician) and the setup view
		omFans: { type: Array, default: () => [] }, // model.fans
		zones: { type: Array, default: () => [] } // heaters of the tool
	},
	data() {
		return {
			form: { kind: 'part', name: '', pin: '', freq: 250, heaters: [], low: 45, high: 50 },
			saving: false, removing: null, made: []
		};
	},
	created() {
		if (this.zones.length) this.form.heaters = [this.zones[0].id];
		this.loadMade();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		say(kind, text) {
			this.$emit('msg', { kind, text });
		},
		async readOptional(path) {
			try {
				return await readText(path);
			} catch (e) {
				return '';
			}
		},
		async loadMade() {
			this.made = marked(await this.readOptional(MODE_FILE));
		},
		async save() {
			if (this.saving || !this.configure) return;
			this.saving = true;
			try {
				if (this.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
				const texts = await Promise.all(['0:/sys/config.g', MODE_FILE, modeFilePath('modelaser.g'), modeFilePath('modecnc.g')].map(p => this.readOptional(p)));
				const taken = marked(texts[1]).map(m => m.index);
				// the first fan number the board does not have and no fan of this page is waiting for a reload with
				const index = nextFanIndex(Array.from({ length: 16 }, (_, i) => this.omFans[i] || taken.includes(i)), 16);
				if (index < 0) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_full'));
				const def = normalize(Object.assign({}, this.form, { index }));
				if (def.error) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_' + def.error));
				if (pinInUse(texts, def.pin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin_use', { pin: def.pin }));
				const r = applyFan(texts[1], this.tool.number, def);
				if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_' + r.error));
				const ok = await confirmRisk({
					title: i18n.t('plugins.WorkshopPrinting.pellet.newfan_confirm_title'),
					text: i18n.t('plugins.WorkshopPrinting.pellet.newfan_confirm_text', { name: def.name, pin: def.pin, index })
				});
				if (!ok) return;
				const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				await writeText(MODE_FILE + '.bak-' + stamp, texts[1]);
				await writeText(MODE_FILE, r.text);
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.newfan_log', { name: def.name, index }));
				this.say('success', i18n.t('plugins.WorkshopPrinting.pellet.newfan_saved', { name: def.name, stamp }));
				this.form.name = '';
				this.form.pin = '';
				await this.loadMade();
				this.$emit('saved');
			} catch (e) {
				this.say('error', e.message || String(e));
			} finally {
				this.saving = false;
			}
		},
		// only a fan this page created can be removed from here (the ones with the mark)
		async remove(index) {
			if (!this.configure) return;
			this.removing = index;
			try {
				if (this.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
				const text = await readText(MODE_FILE);
				const r = removeFan(text, this.tool.number, index);
				if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_missing'));
				const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				await writeText(MODE_FILE + '.bak-' + stamp, text);
				await writeText(MODE_FILE, r.text);
				this.say('success', i18n.t('plugins.WorkshopPrinting.pellet.newfan_removed', { stamp }));
				await this.loadMade();
				this.$emit('saved');
			} catch (e) {
				this.say('error', e.message || String(e));
			} finally {
				this.removing = null;
			}
		}
	}
};
</script>

<style scoped>
.field {
	width: 64px;
	padding: 2px 5px;
	min-height: var(--wf-field-h, 40px);
	box-sizing: border-box;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
.field.wide {
	width: 130px;
}
</style>
