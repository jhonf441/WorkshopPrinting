<template>
	<div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
		<div class="wf-help pc-help">
			<v-icon small>mdi-information-outline</v-icon>
			<div><b>{{ $t('plugins.WorkshopPrinting.extruderConfig.extruder_configuration_what_the_board_reads') }}</b><div class="mt-1">
			{{ $t('plugins.WorkshopPrinting.extruderConfig.each_zone_is_a_heater_with') }} <b>{{ $t('plugins.WorkshopPrinting.common.save') }}</b> {{ $t('plugins.WorkshopPrinting.extruderConfig.writes') }} <code>sys/modefff.g</code> {{ $t('plugins.WorkshopPrinting.extruderConfig.directly_with_a_backup_copy_then') }}
			</div></div>
		</div>
		</details>
		<div v-if="loading" class="text-body-2 grey--text mt-2">{{ $t('plugins.WorkshopPrinting.extruderConfig.reading_modefff_g') }}</div>
		<div v-else-if="errReading" class="text-body-2 error--text mt-2">{{ errReading }}</div>
		<template v-else>
			<div v-for="(z, k) in zones" :key="z.key" class="pc-zcard" :class="{ removed: z.remove }">
				<div class="pc-zhead">
					<span class="pc-idx">{{ k + 1 }}</span>
					<h4>{{ k === 0 ? $t('plugins.WorkshopPrinting.common.zone_1_nozzle') : $t('plugins.WorkshopPrinting.extruderConfig.zone_n', { n: k + 1 }) }}</h4>
					<v-chip v-if="z.newEntry" x-small outlined color="info">{{ $t('plugins.WorkshopPrinting.extruderConfig.new') }}</v-chip>
					<v-chip v-else-if="z.remove" x-small outlined color="error">{{ $t('plugins.WorkshopPrinting.extruderConfig.removed_on_save') }}</v-chip>
					<v-chip v-else-if="changesOf(z).length" x-small outlined color="warning">{{ $t('plugins.WorkshopPrinting.extruderConfig.changed') }}</v-chip>
					<span class="pc-tgt text-caption">{{ $t('plugins.WorkshopPrinting.extruderConfig.heater_h_sensor_s', { h: z.h, s: z.s }) }}</span>
					<v-spacer />
					<v-btn v-if="!z.remove" x-small outlined :aria-expanded="isOpen(z) ? 'true' : 'false'" @click="toggleZone(z)">
						<v-icon x-small left>{{ isOpen(z) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ isOpen(z) ? $t('plugins.WorkshopPrinting.extruderConfig.close_zone') : $t('plugins.WorkshopPrinting.extruderConfig.edit_zone') }}
					</v-btn>
					<v-btn v-if="k > 0 && !z.remove" x-small text color="error" @click="removeZone(z)">{{ $t('plugins.WorkshopPrinting.extruderConfig.remove_zone') }}</v-btn>
					<v-btn v-if="z.remove" x-small text @click="z.remove = false">{{ $t('plugins.WorkshopPrinting.extruderConfig.keep') }}</v-btn>
				</div>
				<!-- 2026-10-11: output type (DC board, AC SSR, mechanical relay) and connectors chosen from a list -->
				<template v-if="!z.remove && isOpen(z)">
					<div class="pc-fsec" style="--fs:#F4511E">
						<div class="pc-fhead"><span class="pc-fb"><v-icon x-small>mdi-fire</v-icon></span>{{ $t('plugins.WorkshopPrinting.extruderConfig.heater_section') }}</div>
					<v-row dense class="mt-1">
						<v-col cols="12" sm="4"><v-text-field v-model.trim="z.name" :label="$t('plugins.WorkshopPrinting.extruderConfig.name')" dense outlined hide-details /></v-col>
						<v-col cols="12" sm="5" class="pc-w-230"><v-select v-model="z.kind" :items="kindsOutput" :label="$t('plugins.WorkshopPrinting.extruderConfig.output_type')" dense outlined hide-details /></v-col>
						<v-col v-if="z.kind === 'relay'" cols="12" sm="3" class="pc-w-230"><v-checkbox v-model="z.ca" :label="$t('plugins.WorkshopPrinting.extruderConfig.switches_ac_mains_110_220_v')" dense hide-details class="mt-1" /></v-col>
					</v-row>
					<v-row dense>
						<v-col cols="6" sm="3" class="pc-w-150">
							<v-combobox :value="z.output" :items="optionsPin(z, 'output')" :label="z.kind === 'dc' ? $t('plugins.WorkshopPrinting.extruderConfig.heater_output') : $t('plugins.WorkshopPrinting.extruderConfig.output_that_drives_the_relay')"
								placeholder="out1" dense outlined hide-details :menu-props="{ maxHeight: 360 }" @change="v => choosePin(z, 'output', v)">
								<template #item="{ item }">
									<v-list-item-content>
										<v-list-item-title>{{ item.text }}</v-list-item-title>
										<v-list-item-subtitle :class="classNote(item)">{{ item.note }}</v-list-item-subtitle>
									</v-list-item-content>
								</template>
							</v-combobox>
						</v-col>
						<v-col cols="6" sm="2" class="pc-w-110"><v-text-field v-model.number="z.max" :label="$t('plugins.WorkshopPrinting.extruderConfig.limit_c')" type="number" dense outlined hide-details /></v-col>
					</v-row>
					<div class="wf-help pc-help" style="--fs:#F4511E">
						<v-icon small>mdi-information-outline</v-icon>
						<div>
						<span>{{ explanationKind(z.kind) }}</span>
						<span v-if="(z.kind === 'ssr' || z.kind === 'ssrdc') && z.q && z.orig && z.orig.kind === z.kind" class="grey--text"> {{ $t('plugins.WorkshopPrinting.extruderConfig.in_the_file_q', { q: z.q }) }}</span>
						</div>
					</div>
					<v-alert v-if="z.kind === 'ssr' || (z.kind === 'relay' && z.ca)" dense outlined type="warning" icon="mdi-flash-alert" class="text-caption mt-2 mb-0">
						{{ $t('plugins.WorkshopPrinting.extruderConfig.danger_110_220_v_ac_mains') }}
					</v-alert>
					</div>
					<!-- 2026-10-11: tipo de sensor (M308 Y) y sensores de vigilancia extra (M143 P1/P2 con otro sensor) -->
					<div v-for="f in rowsSensor(z)" :key="f.key" class="pc-fsec" :style="{ '--fs': f.m ? '#8E24AA' : '#1E88E5' }">
						<div class="pc-fhead">
							<span class="pc-fb"><v-icon x-small>{{ f.m ? 'mdi-shield-half-full' : 'mdi-thermometer' }}</v-icon></span><span>{{ f.title }}</span>
							<v-chip v-if="f.m && f.m.newItem" x-small outlined color="info">{{ $t('plugins.WorkshopPrinting.extruderConfig.new') }}</v-chip>
							<v-chip v-else-if="f.m && f.m.remove" x-small outlined color="error">{{ $t('plugins.WorkshopPrinting.extruderConfig.removed_on_save') }}</v-chip>
							<v-spacer />
							<v-btn v-if="f.m && !f.m.remove" x-small text color="error" @click="removeMonitor(z, f.m)">{{ $t('plugins.WorkshopPrinting.extruderConfig.remove_monitor') }}</v-btn>
							<v-btn v-if="f.m && f.m.remove" x-small text @click="f.m.remove = false">{{ $t('plugins.WorkshopPrinting.extruderConfig.keep') }}</v-btn>
						</div>
						<v-row v-if="f.m && !f.m.remove" dense class="mt-1">
							<v-col cols="12" sm="4" class="pc-w-190"><v-select v-model="f.m.source" :items="sourcesMonitor(z, f.m)" :label="$t('plugins.WorkshopPrinting.extruderConfig.monitoring_sensor')" dense outlined hide-details @change="v => chooseSource(f.m, v)" /></v-col>
							<v-col cols="6" sm="2" class="pc-w-150"><v-select v-model="f.m.cond" :items="conditionsMonitor" :label="$t('plugins.WorkshopPrinting.extruderConfig.triggers')" dense outlined hide-details /></v-col>
							<v-col cols="6" sm="2" class="pc-w-110"><v-text-field v-model.number="f.m.limit" :label="$t('plugins.WorkshopPrinting.extruderConfig.limit_c_2')" type="number" dense outlined hide-details /></v-col>
							<v-col cols="12" sm="4" class="pc-w-230"><v-select v-model="f.m.action" :items="actionsMonitor" :label="$t('plugins.WorkshopPrinting.extruderConfig.what_the_board_does')" dense outlined hide-details /></v-col>
						</v-row>
						<template v-if="!f.m || (!f.m.remove && f.m.source === 'newItem')">
							<v-row dense class="mt-1">
								<v-col v-if="f.m" cols="12" sm="3"><v-text-field v-model.trim="f.o.name" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_name')" dense outlined hide-details /></v-col>
								<v-col cols="12" sm="3" class="pc-w-190">
									<v-select v-if="f.o.ysen !== 'other'" v-model="f.o.ysen" :items="kindsSensor" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_type')" dense outlined hide-details />
									<v-text-field v-else :value="f.o.yRaw" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_type')" disabled dense outlined hide-details />
								</v-col>
								<v-col cols="6" sm="2" class="pc-w-150">
									<v-combobox :value="f.o.pin" :items="optionsPin(f.o, 'pin')" :label="isSpi(f.o.ysen) ? $t('plugins.WorkshopPrinting.extruderConfig.adapter_board_cs') : $t('plugins.WorkshopPrinting.extruderConfig.sensor_connector')"
										:placeholder="isSpi(f.o.ysen) ? 'spi.cs0' : 'temp1'" dense outlined hide-details :menu-props="{ maxHeight: 360 }" @change="v => choosePin(f.o, 'pin', v)">
										<template #item="{ item }">
											<v-list-item-content>
												<v-list-item-title>{{ item.text }}</v-list-item-title>
												<v-list-item-subtitle :class="classNote(item)">{{ item.note }}</v-list-item-subtitle>
											</v-list-item-content>
										</template>
									</v-combobox>
								</v-col>
								<template v-if="f.o.ysen === 'thermistor'">
									<v-col cols="4" sm="1" class="pc-w-110"><v-text-field v-model.number="f.o.beta" :label="$t('plugins.WorkshopPrinting.extruderConfig.beta')" type="number" dense outlined hide-details /></v-col>
									<v-col cols="4" sm="2" class="pc-w-150"><v-text-field v-model.number="f.o.r25" :label="$t('plugins.WorkshopPrinting.extruderConfig.r_at_25_c')" type="number" dense outlined hide-details /></v-col>
									<v-col cols="4" sm="1" class="pc-w-190"><v-text-field v-model.trim="f.o.shc" :label="$t('plugins.WorkshopPrinting.extruderConfig.coef_c')" :placeholder="$t('plugins.WorkshopPrinting.extruderConfig.optional')" dense outlined hide-details /></v-col>
								</template>
								<v-col v-if="f.o.ysen === 'max31856'" cols="6" sm="2" class="pc-w-150"><v-select v-model="f.o.tc" :items="kindsThermocouple" :label="$t('plugins.WorkshopPrinting.extruderConfig.thermocouple_type')" dense outlined hide-details /></v-col>
								<template v-if="f.o.ysen === 'max31865'">
									<v-col cols="6" sm="1" class="pc-w-110"><v-select v-model="f.o.threads" :items="[2, 3, 4]" :label="$t('plugins.WorkshopPrinting.extruderConfig.wires')" dense outlined hide-details /></v-col>
									<v-col cols="6" sm="2" class="pc-w-150"><v-text-field v-model.number="f.o.rref" :label="$t('plugins.WorkshopPrinting.extruderConfig.reference_r')" type="number" dense outlined hide-details /></v-col>
								</template>
								<v-col v-if="f.o.ysen === 'max31856' || f.o.ysen === 'max31865'" cols="6" sm="2" class="pc-w-190"><v-select v-model="f.o.red" :items="networksElectrical" :label="$t('plugins.WorkshopPrinting.extruderConfig.mains_frequency')" dense outlined hide-details /></v-col>
								<template v-if="f.o.ysen === 'linear'">
									<v-col cols="6" sm="2" class="pc-w-190"><v-text-field v-model.number="f.o.lb" :label="$t('plugins.WorkshopPrinting.extruderConfig.c_with_the_input_at_0')" type="number" dense outlined hide-details /></v-col>
									<v-col cols="6" sm="2" class="pc-w-190"><v-text-field v-model.number="f.o.lc" :label="$t('plugins.WorkshopPrinting.extruderConfig.c_with_the_input_at_maximum')" type="number" dense outlined hide-details /></v-col>
								</template>
							</v-row>
							<div class="wf-help pc-help"><v-icon small>mdi-information-outline</v-icon><span>{{ explanationSensor(f.o.ysen) }}</span></div>
						</template>
					</div>
					<div class="wf-actions">
						<v-btn x-small outlined :disabled="!canAddMonitor(z)" @click="addMonitor(z)"><v-icon x-small left>mdi-shield-plus</v-icon>{{ $t('plugins.WorkshopPrinting.extruderConfig.add_monitor') }}</v-btn>
						<span class="text-caption grey--text">{{ canAddMonitor(z) ? '' : $t('plugins.WorkshopPrinting.extruderConfig.maximum_2_extra_monitors_per_heater') }}</span>
					</div>
					<div class="wf-help pc-help" style="--fs:#8E24AA">
						<v-icon small>mdi-information-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.extruderConfig.the_heater_is_controlled_with_a') }}</span>
					</div>
				</template>
				<div v-for="e in errorsOf(z)" :key="e" class="wf-help pc-help" style="--fs:#E53935"><v-icon small>mdi-alert-circle-outline</v-icon><span class="error--text">{{ e }}</span></div>
				<div v-for="a in noticesOf(z)" :key="'a' + a" class="wf-help pc-help" style="--fs:#FFA000"><v-icon small>mdi-alert-outline</v-icon><span>{{ a }}</span></div>
			</div>
			<div class="wf-help pc-help mt-3" style="--fs:#1E88E5">
				<v-icon small>mdi-information-outline</v-icon>
				<span>
				{{ $t('plugins.WorkshopPrinting.extruderConfig.output_and_sensor_the_board_connector') }}
				</span>
			</div>
			<!-- Board connectors (2026-10-10: "a list with available outputs and inputs and which board they are on") -->
			<div class="mt-3">
				<v-btn x-small text color="primary" @click="viewPins = !viewPins">
					<v-icon x-small left>{{ viewPins ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ viewPins ? $t('plugins.WorkshopPrinting.extruderConfig.hide_connectors') : $t('plugins.WorkshopPrinting.extruderConfig.show_free_connectors_of_each_board') }}
				</v-btn>
				<template v-if="viewPins">
					<div class="text-caption grey--text mt-1">
						{{ $t('plugins.WorkshopPrinting.extruderConfig.green_free_orange_used_only_by') }}
					</div>
					<div v-for="b in boards" :key="b.key" class="mt-2">
						<div class="text-body-2"><b>{{ b.name }}</b> <span class="grey--text">{{ b.where }}</span></div>
						<div v-if="!b.groups.length" class="text-caption grey--text">{{ b.note }}</div>
						<div v-for="g in b.groups" :key="g.kind" class="d-flex flex-wrap align-center mt-1" style="gap:4px">
							<span class="text-caption grey--text pin-kind">{{ g.kind }}</span>
							<v-chip v-for="c in g.pins" :key="c.pin" x-small :outlined="!c.used" :color="c.used ? 'grey' : c.otherMode ? 'warning' : 'success'"
								:title="c.used ? $t('plugins.WorkshopPrinting.extruderConfig.used_by', { who: c.used }) : c.otherMode ? $t('plugins.WorkshopPrinting.extruderConfig.only_in_other_mode_title', { who: c.otherMode }) : (g.field ? $t('plugins.WorkshopPrinting.extruderConfig.free_tap_to_use') : $t('plugins.WorkshopPrinting.extruderConfig.free_cap'))"
								@click="!c.used && g.field && usePin(g.field, c.pin, c.otherMode)">{{ c.pin }}</v-chip>
						</div>
					</div>
					<div v-if="msgPin" class="text-caption mt-1">{{ msgPin }}</div>
				</template>
			</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn small outlined :disabled="hFree == null || sFree == null" @click="addZone()"><v-icon small left>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.extruderConfig.add_zone') }}</v-btn>
				<v-btn small color="primary" :disabled="!changes.length || !!errors.length || saving" :loading="saving" @click="save()">
					<v-icon small left>mdi-content-save</v-icon>{{ $t('plugins.WorkshopPrinting.common.save_to_modefff_g') }}
				</v-btn>
				<v-btn small outlined :disabled="changes.length > 0" @click="reload()">{{ $t('plugins.WorkshopPrinting.extruderConfig.reload_fff_mode') }}</v-btn>
				<v-btn small text :disabled="!changes.length" @click="read()">{{ $t('plugins.WorkshopPrinting.extruderConfig.discard_changes') }}</v-btn>
				<span v-if="reloadPending" class="text-caption warning--text">{{ $t('plugins.WorkshopPrinting.extruderConfig.saved_reload_fff_mode_so_the') }}</span>
			</div>
			<div v-if="changes.length" class="text-caption mt-2">
				<b>{{ $t('plugins.WorkshopPrinting.extruderConfig.will_change') }}</b>
				<ul class="mt-1">
					<li v-for="c in changes" :key="c">{{ c }}</li>
				</ul>
			</div>
			<div v-if="errors.length && changes.length" class="text-caption error--text mt-1">{{ $t('plugins.WorkshopPrinting.extruderConfig.fix_what_is_marked_in_red') }}</div>
		</template>
	</div>
</template>

<script>
import i18n from '../../i18n'
import { kinds, labelKind, SENSOR_TEXT, actions, conditions } from './extruder-config-text.js' // texts of the forms

'use strict'

import { mapActions } from 'vuex'
import { readText, writeText, MODE_FILE, isError, note } from './util.js'
import { isFriendly } from './print-errors.js'
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { NEED } from './print-sections.js'
import {
	partir, command, param, RX_OUTPUT, RX_OUTPUT_RELAY, RX_THERMISTOR, RX_CS, isCA, isSpiKind, readSensor, copySensor,
	kindChange, relayWithoutB1, sensorMonitor, zonesFromLines, rewriteModeText, SENSORES
} from './modefff-edit.js'
import { machineFree } from './machine-free.js' // trabajo de archivo, pausado o en vivo (vue/_shared)
import { confirmRisk } from './risk.js' // the JS plugins' box, else a box of the page (vue/_shared36)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'

const MAX_MONITORS = 3; // P0 (the cap of the zone) + P1 + P2 (RRF: "assuming 3 per heater")

export default {
	mixins: [roleMixin],
	props: {
		tool: { type: Object, default: null }
	},
	data() {
		return { text: null, textConfig: '', othersModes: {}, viewPins: false, msgPin: '', zones: [], loading: true, errReading: null, openZones: {}, saving: false, reloadPending: false };
	},
	computed: {
		model() {
			return this.$store.state.machine.model;
		},
		lines() {
			return this.text ? this.text.split(/\r?\n/) : [];
		},
		// free heater and sensor (on the board AND in the file; sensor 10 belongs to the SZP)
		hFree() {
			const hs = (this.model.heat && this.model.heat.heaters) || [];
			const used = this.zones.map(z => z.h);
			for (let i = 0; i < 32; i++) if (!hs[i] && !used.includes(i) && !this.lines.some(l => command(l) === 'M950' && param(l, 'H') === String(i))) return i;
			return null;
		},
		sFree() {
			const ss = (this.model.sensors && this.model.sensors.analog) || [];
			const used = this.sensorsTaken();
			for (let i = 2; i < 32; i++) if (i !== 10 && !ss[i] && !used.includes(i) && !this.lines.some(l => command(l) === 'M308' && param(l, 'S') === String(i))) return i;
			return null;
		},
		changes() {
			const out = [];
			this.zones.forEach((z, k) => {
				const n = k === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.extruderConfig.zone_n', { n: k + 1 });
				if (z.remove) out.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.zone_removed_change', { zone: n, h: z.h, s: z.s }));
				else if (z.newEntry) {
					const vig = z.monitors.filter(m => !m.remove).length;
					out.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.zone_new_change', { zone: n, type: labelKind(z.kind, z.ca), output: z.output || '?', sensor: this.nameSensor(z.ysen, z.yRaw), pin: z.pin || '?', max: z.max }) +
						(vig ? ', ' + i18n.t('plugins.WorkshopPrinting.extruderConfig.n_monitors_list', { n: vig, list: z.monitors.filter(m => !m.remove).map(m => this.textMonitor(z, m)).join('; ') }) : '') + '.');
				}
				else this.changesOf(z).forEach(c => out.push(`${n}: ${c}`));
			});
			return out;
		},
		kindsOutput() {
			return Object.keys(kinds).map(k => ({ text: kinds[k], value: k }));
		},
		kindsSensor() {
			return Object.keys(SENSORES).map(k => ({ text: SENSOR_TEXT[k], value: k }));
		},
		kindsThermocouple() {
			return ['K', 'J', 'T', 'E', 'N', 'R', 'S', 'B'];
		},
		networksElectrical() {
			return [{ value: 50, text: '50 Hz' }, { value: 60, text: '60 Hz' }];
		},
		actionsMonitor() {
			return actions;
		},
		conditionsMonitor() {
			return conditions;
		},
		// sensors defined in config.g and modefff.g (and those the board already has), to watch with an existing one
		sensorsKnown() {
			const list = {};
			(this.textConfig || '').split(/\r?\n/).concat(this.lines).forEach(l => {
				if (command(l) !== 'M308') return;
				const n = Number(param(l, 'S'));
				if (!isNaN(n) && param(l, 'S') !== null) list[n] = param(l, 'A') || param(l, 'Y') || '';
			});
			const ss = (this.model.sensors && this.model.sensors.analog) || [];
			ss.forEach((x, n) => { if (x && list[n] == null) list[n] = x.name || x.type || ''; });
			return Object.keys(list).map(Number).sort((a, b) => a - b).map(n => ({ n, name: list[n] }));
		},
		// which connector uses what (config.g and the three modes): {"out4": "M950 F0 (modefff.g)", ...}
		usesPins() {
			return this.computeUses(false);
		},
		// the same but without joining ioN.in with ioN.out (a relay's io outputs, 2026-10-11)
		usesExact() {
			return this.computeUses(true);
		},
		boards() {
			// connectors of each Duet 3 board (those that matter for an extruder)
			const CAT = {
				MB6HC: { cal: [0, 1, 2, 3], fan: [4, 5, 6, 7, 8, 9], temp: [0, 1, 2, 3], io: [0, 1, 2, 3, 4, 5, 6, 7, 8], cs: [0, 1, 2, 3] },
				EXP3HC: { cal: [0, 1, 2], fan: [3, 4, 5, 6, 7, 8], temp: [0, 1, 2], io: [0, 1, 2, 3, 4, 5] },
				TOOL1LC: { cal: [0], fan: [1, 2], temp: [0, 1], io: [0, 1, 2] },
				MB6XD: { cal: [0, 1, 2], fan: [3, 4, 5, 6, 7, 8], temp: [0, 1, 2, 3], io: [0, 1, 2, 3, 4, 5, 6, 7, 8], cs: [0, 1, 2, 3] }
			};
			const uses = this.usesPins;
			return ((this.model && this.model.boards) || []).map((b, i) => {
				const can = b.canAddress || 0;
				const pre = can ? can + '.' : '';
				const cat = CAT[b.shortName];
				// only in Laser or CNC mode: in FFF it can be used (each mode configures its own), with a notice
				const other = u => !!u && !/(config|modefff)\.g/.test(u);
				const pins = (pref, nums) => nums.map(n => { const u = uses[pre + pref + n] || null; return { pin: pre + pref + n, used: other(u) ? null : u, otherMode: other(u) ? u : null }; });
				return {
					key: 'b' + i,
					name: b.name || b.shortName || i18n.t('plugins.WorkshopPrinting.extruderConfig.board'),
					where: can ? i18n.t('plugins.WorkshopPrinting.extruderConfig.expansion_board_can', { can }) : i18n.t('plugins.WorkshopPrinting.extruderConfig.main_board'),
					note: cat ? '' : (b.shortName === 'EXP1XD' ? i18n.t('plugins.WorkshopPrinting.extruderConfig.single_motor_board_it_has_no') : i18n.t('plugins.WorkshopPrinting.extruderConfig.i_don_t_know_this_board')),
					groups: cat ? [
						{ id: 'cal', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.heater_outputs'), field: 'output', pins: pins('out', cat.cal) },
						{ id: 'temp', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.thermistors'), field: 'pin', pins: pins('temp', cat.temp) },
						{ id: 'fan', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.small_outputs_fans'), field: null, pins: pins('out', cat.fan) },
						{ id: 'io', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.io_inputs_outputs'), field: null, pins: pins('io', cat.io) }
					].concat(cat.cs ? [{ id: 'cs', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.spi_cs_adapter_board'), field: null, pins: pins('spi.cs', cat.cs) }] : []) : []
				};
			});
		},
		errors() {
			return this.zones.reduce((a, z) => a.concat(this.errorsOf(z)), []);
		}
	},
	watch: {
		tool: { handler() { this.read(); }, immediate: false }
	},
	mounted() {
		this.read();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		// exacto = false: "io3.in" y "io3.out" cuentan como "io3" (lo de siempre)
		computeUses(exact) {
			const uses = {};
			const noteUse = (pin, who) => { uses[pin] = uses[pin] ? uses[pin] + ', ' + who : who; };
			const files = [['config.g', this.textConfig], ['modefff.g', this.text], ['modelaser.g', this.othersModes['modelaser.g']], ['modecnc.g', this.othersModes['modecnc.g']]];
			files.forEach(([nombre, txt]) => {
				(txt || '').split(/\r?\n/).forEach(l => {
					const c = command(l);
					if (!c || !['M950', 'M308', 'M574', 'M558', 'M591', 'M280', 'M42'].includes(c)) return;
					const cod = partir(l)[0];
					const rx = /\b[CP]"([^"]+)"/g;
					let m;
					while ((m = rx.exec(cod))) {
						m[1].split('+').forEach(x => {
							const raw = x.trim().toLowerCase().replace(/^[!^]+/, '');
							const pin = raw.replace(/\.(in|out)$/, '');
							if (!/^(\d+\.)?(out|temp|io|spi\.cs)\d+$/.test(pin)) return;
							const who = cod.trim().split(/\s+/).filter(t => t.indexOf('"') < 0).slice(0, 2).join(' ') + ' (' + nombre + ')';
							if (!exact || raw !== pin) noteUse(exact ? raw : pin, who);
							else if (/io\d+$/.test(pin)) { noteUse(pin + '.in', who); noteUse(pin + '.out', who); }
							else noteUse(pin, who);
						});
					}
				});
			});
			return uses;
		},
		// ---- list of connectors to choose from in each zone (2026-10-11) ----
		// free ones first, then those used only by another mode (with a notice) and finally the used ones (disabled, with the reason)
		// z: a zone (output or sensor) or a watch with its own sensor (only the 'pin' field)
		optionsPin(z, field) {
			const ids = field === 'pin' ? (isSpiKind(z.ysen) ? ['cs'] : ['temp']) : (z.kind === 'dc' ? ['cal'] : ['cal', 'fan', 'io']);
			const names = { cal: i18n.t('plugins.WorkshopPrinting.extruderConfig.heater_outputs_2'), temp: i18n.t('plugins.WorkshopPrinting.extruderConfig.temperature_inputs'), fan: i18n.t('plugins.WorkshopPrinting.extruderConfig.small_outputs_fans_2'), io: i18n.t('plugins.WorkshopPrinting.extruderConfig.io_outputs_3_3_v'), cs: i18n.t('plugins.WorkshopPrinting.extruderConfig.spi_cs_adapter_board') };
			const other = u => !!u && !/(config|modefff)\.g/.test(u);
			const own = String((z.orig && z.orig[field]) || '').toLowerCase();
			const otras = (field === 'pin' ? this.sensorsEdited() : this.zones.filter(o => !o.remove)).filter(o => o !== z);
			const items = [];
			this.boards.forEach(b => {
				if (!b.groups.length) {
					items.push({ header: b.name + ': ' + b.note });
					return;
				}
				ids.forEach(id => {
					const g = b.groups.find(x => x.id === id);
					if (!g) return;
					const list = g.pins.map(c => {
						let pin = c.pin, used = c.used, otherMode = c.otherMode;
						if (id === 'io') {
							pin = c.pin + '.out';
							const u = this.usesExact[pin] || null;
							used = other(u) ? null : u;
							otherMode = other(u) ? u : null;
						}
						const k = pin.toLowerCase();
						const zone = otras.find(o => String(o[field] || '').toLowerCase() === k);
						let state, nota;
						if (zone) { state = 3; nota = i18n.t('plugins.WorkshopPrinting.extruderConfig.chosen_in', { where: this.whereThis(zone) }); }
						else if (k === own) { state = 0; nota = i18n.t('plugins.WorkshopPrinting.extruderConfig.used_by_this_zone'); }
						else if (used) { state = 3; nota = i18n.t('plugins.WorkshopPrinting.extruderConfig.used_lower', { who: used }); }
						else if (otherMode) { state = 1; nota = i18n.t('plugins.WorkshopPrinting.extruderConfig.only_other_mode_note', { who: otherMode }); }
						else { state = 0; nota = i18n.t('plugins.WorkshopPrinting.extruderConfig.free_lower'); }
						return { text: pin, value: pin, disabled: state === 3, note: nota, state: state };
					}).sort((a, b2) => a.state - b2.state);
					items.push({ header: b.name + ' ' + b.where + ': ' + names[id] });
					list.forEach(x => items.push(x));
				});
			});
			return items;
		},
		// all the sensors edited here: each zone's and the watches' own
		sensorsEdited() {
			const r = [];
			this.zones.filter(z => !z.remove).forEach(z => {
				r.push(z);
				(z.monitors || []).forEach(m => { if (!m.remove && m.source === 'newItem') r.push(m); });
			});
			return r;
		},
		whereThis(o) {
			const k = this.zones.indexOf(o);
			if (k >= 0) return i18n.t('plugins.WorkshopPrinting.extruderConfig.the_zone_n', { n: k + 1 });
			const z = this.zones.find(x => (x.monitors || []).includes(o));
			return z ? i18n.t('plugins.WorkshopPrinting.extruderConfig.a_monitor_of_zone_n', { n: this.zones.indexOf(z) + 1 }) : i18n.t('plugins.WorkshopPrinting.extruderConfig.another_zone');
		},
		// sensor numbers already taken by zones and watches (so as not to repeat them)
		sensorsTaken() {
			const r = [];
			this.zones.forEach(z => {
				r.push(z.s);
				(z.monitors || []).forEach(m => { if (m.sOwn != null) r.push(m.sOwn); });
			});
			return r;
		},
		isSpi(t) {
			return isSpiKind(t);
		},
		nameSensor(t, raw) {
			return t === 'other' ? (raw || '?') : SENSOR_TEXT[t] || SENSOR_TEXT.thermistor;
		},
		explanationSensor(t) {
			if (t === 'thermistor') return i18n.t('plugins.WorkshopPrinting.extruderConfig.common_thermistor_ntc_on_a_tempn');
			if (t === 'pt1000') return i18n.t('plugins.WorkshopPrinting.extruderConfig.two_wire_pt1000_straight_to_a');
			if (t === 'max31856') return i18n.t('plugins.WorkshopPrinting.extruderConfig.thermocouple_k_j_t_with_the');
			if (t === 'max31855') return i18n.t('plugins.WorkshopPrinting.extruderConfig.type_k_thermocouple_with_a_max31855');
			if (t === 'max31865') return i18n.t('plugins.WorkshopPrinting.extruderConfig.pt100_with_the_max31865_adapter_board');
			if (t === 'linear') return i18n.t('plugins.WorkshopPrinting.extruderConfig.a_temperature_transmitter_that_gives_a');
			return i18n.t('plugins.WorkshopPrinting.extruderConfig.this_sensor_type_is_not_edited');
		},
		rowsSensor(z) {
			const r = [{ key: 'main', o: z, m: null, title: i18n.t('plugins.WorkshopPrinting.extruderConfig.sensor_controlling_zone_s', { s: z.s }) }];
			(z.monitors || []).forEach((m, j) => r.push({
				key: m.key, o: m, m,
				title: i18n.t('plugins.WorkshopPrinting.extruderConfig.extra_monitor_n', { n: j + 1 }) + (m.source === 'newItem' && m.sOwn != null ? ' (sensor S' + m.sOwn + ')' : '')
			}));
			return r;
		},
		// where a watch's sensor comes from: its own (new M308) or one that already exists
		sourcesMonitor(z, m) {
			const free = m.sOwn != null ? m.sOwn : this.sFree;
			const r = [{ text: free != null ? i18n.t('plugins.WorkshopPrinting.extruderConfig.own_sensor_configured_here_s', { s: free }) : i18n.t('plugins.WorkshopPrinting.extruderConfig.own_sensor_no_free_number'), value: 'newItem', disabled: free == null }];
			const ofWatches = [];
			this.zones.forEach(o => (o.monitors || []).forEach(x => { if (x.sOwn != null) ofWatches.push(x.sOwn); }));
			this.sensorsKnown.forEach(x => {
				if (x.n === m.sOwn || ofWatches.includes(x.n)) return;
				r.push({ text: 'S' + x.n + (x.name ? ' ' + x.name : '') + (x.n === z.s ? i18n.t('plugins.WorkshopPrinting.extruderConfig.the_one_controlling_this_zone') : ''), value: 'S' + x.n });
			});
			if (m.source !== 'newItem' && !r.some(x => x.value === m.source)) r.push({ text: m.source, value: m.source });
			return r;
		},
		chooseSource(m, v) {
			if (v === 'newItem' && m.sOwn == null) m.sOwn = this.sFree;
		},
		textMonitor(z, m) {
			const a = actions.find(x => x.value === Number(m.action));
			const c = conditions.find(x => x.value === Number(m.cond));
			return `sensor S${sensorMonitor(m)}` + (m.source === 'newItem' ? ' ' + i18n.t('plugins.WorkshopPrinting.extruderConfig.sensor_type_on_pin_paren', { type: this.nameSensor(m.ysen, m.yRaw), pin: m.pin || '?' }) : '') +
				`, ${c ? c.text.toLowerCase() : ''} ${m.limit} °C: ${a ? a.text.toLowerCase() : ''}`;
		},
		canAddMonitor(z) {
			return !z.remove && (z.monitors || []).length < MAX_MONITORS - 1;
		},
		// free P (1 or 2; P0 is the zone's cap)
		addMonitor(z) {
			const usedP = z.monitors.map(m => m.p);
			let p = null;
			for (let i = 1; i < MAX_MONITORS; i++) if (!usedP.includes(i)) { p = i; break; }
			if (p == null) return;
			const sl = this.sFree;
			z.monitors.push(Object.assign(readSensor('M308 Y"thermocouple-max31856"'), {
				key: 'm' + Date.now(), p, newItem: true, remove: false, source: sl != null ? 'newItem' : 'S' + z.s, sOwn: sl,
				name: i18n.t('plugins.WorkshopPrinting.extruderConfig.watches_name', { name: z.name || i18n.t('plugins.WorkshopPrinting.extruderConfig.zone_lower') }), limit: Math.min(450, Number(z.max) || 250), action: 0, cond: 0, pin: ''
			}));
		},
		removeMonitor(z, m) {
			if (m.newItem) z.monitors = z.monitors.filter(x => x !== m);
			else m.remove = true;
		},
		// errores de un sensor editable (zona o vigilancia propia)
		errorsSensor(o, who) {
			const e = [];
			const pre = who ? who + ': ' : '';
			if (o.ysen === 'other') return e;
			if (isSpiKind(o.ysen)) {
				if (!RX_CS.test(o.pin || '')) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.the_connector_of_an_spi_sensor'));
			} else if (!RX_THERMISTOR.test(o.pin || '')) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.the_sensor_connector_must_look_like'));
			if (o.ysen === 'thermistor') {
				if (!(o.beta > 1000 && o.beta < 10000)) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.beta_out_of_the_normal_range'));
				if (!(o.r25 >= 1000 && o.r25 <= 10000000)) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.r_at_25_c_out_of'));
				if (String(o.shc || '').trim() !== '' && isNaN(Number(o.shc))) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.the_c_coefficient_must_be_a'));
			}
			if (o.ysen === 'max31865' && !(o.rref >= 50 && o.rref <= 10000)) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.reference_r_between_50_and_10000'));
			if (o.ysen === 'linear' && !(Number(o.lc) > Number(o.lb))) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.the_temperature_at_maximum_must_be'));
			const k = String(o.pin || '').toLowerCase();
			const other = k ? this.sensorsEdited().find(x => x !== o && String(x.pin || '').toLowerCase() === k) : null;
			if (other) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.pin_already_belongs_to', { pin: o.pin, where: this.whereThis(other) }));
			const s = o.sOwn !== undefined ? o.sOwn : o.s;
			if (k && this.usedOutside(o.pin, { h: -1, s })) e.push(pre + i18n.t('plugins.WorkshopPrinting.extruderConfig.pin_used_by_other_sensor', { pin: o.pin }));
			return e;
		},
		errorsMonitor(z, m, j) {
			if (m.remove) return [];
			const q = i18n.t('plugins.WorkshopPrinting.extruderConfig.monitor_n', { n: j + 1 });
			const e = [];
			if (m.source === 'newItem') {
				if (m.sOwn == null) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_no_free_sensor_number', { who: q }));
				if (!m.name) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_sensor_name_missing', { who: q }));
				e.push(...this.errorsSensor(m, q));
			} else if (isNaN(sensorMonitor(m))) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_choose_sensor', { who: q }));
			if (m.limit === '' || !(Number(m.limit) >= -50 && Number(m.limit) <= 1000)) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_limit_range', { who: q }));
			return e;
		},
		// changes of a watch already written in the file
		changesMonitor(z, m, j) {
			const q = i18n.t('plugins.WorkshopPrinting.extruderConfig.monitor_n_lower', { n: j + 1 });
			if (m.remove) return [i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_removed', { who: q })];
			if (m.newItem) return [i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_new', { who: q, what: this.textMonitor(z, m) })];
			const o = m.orig, c = [];
			if (m.source !== o.source) {
				const f = x => (x === 'newItem' ? i18n.t('plugins.WorkshopPrinting.extruderConfig.own_sensor_s', { s: m.sOwn }) : x);
				c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_sensor', { who: q, from: f(o.source), to: f(m.source) }));
			}
			if (Number(m.limit) !== Number(o.limit)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_limit', { who: q, from: o.limit, to: m.limit }));
			if (Number(m.action) !== Number(o.action) || Number(m.cond) !== Number(o.cond)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_now', { who: q, what: this.textMonitor(z, m) }));
			if (m.source === 'newItem') {
				if (m.name !== o.name) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_sensor_name', { who: q, from: o.name, to: m.name }));
				this.changesSensor(m, o.sensor).forEach(x => c.push(`${q}: ${x}`));
			}
			return c;
		},
		// changes of the sensor (without the name)
		changesSensor(o, ant) {
			const c = [];
			if (!ant) return c;
			if (o.ysen !== ant.ysen) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_sensor_type', { from: this.nameSensor(ant.ysen, o.yRaw), to: this.nameSensor(o.ysen, o.yRaw) }));
			if (o.pin !== ant.pin) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_sensor_pin', { from: ant.pin, to: o.pin }));
			if (o.ysen === 'thermistor') {
				if (Number(o.beta) !== Number(ant.beta)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_beta', { from: ant.beta, to: o.beta }));
				if (Number(o.r25) !== Number(ant.r25)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_r25', { from: ant.r25, to: o.r25 }));
				if (String(o.shc || '').trim() !== String(ant.shc || '').trim()) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_coef_c', { from: ant.shc || i18n.t('plugins.WorkshopPrinting.extruderConfig.none_lower'), to: o.shc || i18n.t('plugins.WorkshopPrinting.extruderConfig.none_lower') }));
			}
			if (o.ysen === 'max31856' && o.tc !== ant.tc) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_tc', { from: ant.tc, to: o.tc }));
			if (o.ysen === 'max31865') {
				if (Number(o.threads) !== Number(ant.threads)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_wires', { from: ant.threads, to: o.threads }));
				if (Number(o.rref) !== Number(ant.rref)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_rref', { from: ant.rref, to: o.rref }));
			}
			if ((o.ysen === 'max31856' || o.ysen === 'max31865') && Number(o.red) !== Number(ant.red)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_mains', { from: ant.red, to: o.red }));
			if (o.ysen === 'linear' && (Number(o.lb) !== Number(ant.lb) || Number(o.lc) !== Number(ant.lc))) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_range', { a: ant.lb, b: ant.lc, c: o.lb, d: o.lc }));
			return c;
		},
		classNote(item) {
			return item.state === 3 ? 'grey--text' : item.state === 1 ? 'warning--text' : 'success--text';
		},
		// from the combobox comes the list's object or what was typed by hand
		choosePin(z, field, v) {
			z[field] = String((v && typeof v === 'object' ? v.value : v) || '').trim();
		},
		explanationKind(kind) {
			if (kind === 'ssrdc') {
				return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_ssrdc');
			}
			if (kind === 'ssr') {
				return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_ssr');
			}
			if (kind === 'relay') {
				return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_relay');
			}
			return i18n.t('plugins.WorkshopPrinting.extruderConfig.the_heater_cartridge_goes_straight_to');
		},
		async read() {
			this.loading = true;
			this.errReading = null;
			try {
				this.text = await readText(MODE_FILE);
				this.textConfig = await readText('0:/sys/config.g').catch(() => '');
				const om = {};
				for (const f of ['modelaser.g', 'modecnc.g']) om[f] = await readText('0:/sys/' + f).catch(() => '');
				this.othersModes = om;
				this.zones = this.zonesOfFile();
				if (!this.zones.length) this.errReading = i18n.t('plugins.WorkshopPrinting.extruderConfig.couldn_t_find_the_tool_zones');
			} catch (e) {
				this.errReading = i18n.t('plugins.WorkshopPrinting.extruderConfig.could_not_read_modefff', { error: e.message || String(e) });
			} finally {
				this.loading = false;
			}
		},
		zonesOfFile() {
			return zonesFromLines(this.lines, this.tool ? this.tool.number : -1);
		},
		changesOf(z) {
			if (!z.orig || z.newEntry || z.remove) return [];
			const o = z.orig, c = [];
			if (z.name !== o.name) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_name', { from: o.name, to: z.name }));
			if (z.output !== o.output) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_heater', { from: o.output, to: z.output }));
			this.changesSensor(z, o.sensor).forEach(x => c.push(x));
			if (Number(z.max) !== Number(o.max)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_max', { from: o.max, to: z.max }));
			if (kindChange(z)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_output_type', { from: labelKind(o.kind, o.ca), to: labelKind(z.kind, z.ca) }));
			else if (relayWithoutB1(z)) c.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.chg_to_on_off'));
			(z.monitors || []).forEach((m, j) => this.changesMonitor(z, m, j).forEach(x => c.push(x)));
			return c;
		},
		// avisos que no impiden guardar (2026-10-11)
		noticesOf(z) {
			if (z.remove) return [];
			const a = [];
			const sal = String(z.output || '').toLowerCase();
			const small = this.boards.some(b => b.groups.some(g => g.id === 'fan' && g.pins.some(c => c.pin.toLowerCase() === sal)));
			if (z.kind === 'dc' && small) a.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.warn_small_output', { pin: z.output }));
			if (/io\d+\.out$/.test(sal) && z.kind === 'relay') a.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.warn_io_relay', { pin: z.output }));
			if (/io\d+\.out$/.test(sal) && (z.kind === 'ssr' || z.kind === 'ssrdc')) a.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.warn_io_ssr', { pin: z.output }));
			const withSpi = [z].concat((z.monitors || []).filter(m => !m.remove && m.source === 'newItem')).filter(o => isSpiKind(o.ysen));
			if (withSpi.length) a.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.warn_spi_adapter', { pins: withSpi.map(o => o.pin || '?').join(', ') }));
			if (z.kind === 'relay' && !z.newEntry && !kindChange(z) && relayWithoutB1(z)) a.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.warn_m307_not_on_off'));
			return a;
		},
		// conectores usados por OTRAS lineas de modefff.g o config.g (ventiladores, cama, LEDs...)
		usedOutside(pin, z) {
			const p = String(pin || '').toLowerCase();
			return this.lines.concat((this.textConfig || '').split(/\r?\n/)).some(l => {
				const c = command(l);
				if (!c) return false;
				const own = (c === 'M950' && param(l, 'H') === String(z.h)) || (c === 'M308' && param(l, 'S') === String(z.s));
				if (own) return false;
				const v = String(param(l, c === 'M308' ? 'P' : 'C') || '').toLowerCase().replace(/^[!^]+/, '');
				return (c === 'M950' || c === 'M308') && v.split('+')[0] === p;
			});
		},
		errorsOf(z) {
			if (z.remove) return [];
			const e = [];
			if (z.incomplete) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_lines_missing'));
			if (!z.name) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_name_missing'));
			if (z.kind === 'dc' && !RX_OUTPUT.test(z.output || '')) {
				e.push(RX_OUTPUT_RELAY.test(z.output || '') ? i18n.t('plugins.WorkshopPrinting.extruderConfig.an_io_output_can_only_drive') : i18n.t('plugins.WorkshopPrinting.extruderConfig.the_output_must_look_like_out2'));
			}
			if (z.kind !== 'dc' && !RX_OUTPUT_RELAY.test(z.output || '')) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_output_or_io_format'));
			if (!(z.max >= 50 && z.max <= 450)) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_max_range'));
			const other = this.zones.filter(o => o !== z && !o.remove);
			if (z.output && other.some(o => String(o.output).toLowerCase() === z.output.toLowerCase())) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_output_other_zone', { pin: z.output }));
			if (z.output && this.usedOutside(z.output, z)) e.push(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_output_used_elsewhere', { pin: z.output }));
			// sensor que controla y vigilancias (2026-10-11)
			this.errorsSensor(z, '').forEach(x => e.push(x.charAt(0).toUpperCase() + x.slice(1)));
			(z.monitors || []).forEach((m, j) => this.errorsMonitor(z, m, j).forEach(x => e.push(x)));
			return e;
		},
		// tapping a free connector: it goes to the new zone (if there is none, it creates it)
		usePin(field, pin, otherMode) {
			let z = this.zones.filter(x => x.newEntry && !x.remove).slice(-1)[0];
			if (!z) {
				this.addZone();
				z = this.zones[this.zones.length - 1];
			}
			if (!z) {
				this.msgPin = i18n.t('plugins.WorkshopPrinting.extruderConfig.there_s_no_free_heater_or');
				return;
			}
			z[field] = pin;
			this.msgPin = (field === 'output' ? i18n.t('plugins.WorkshopPrinting.extruderConfig.pin_set_in_zone_heater', { pin, n: this.zones.indexOf(z) + 1 }) : i18n.t('plugins.WorkshopPrinting.extruderConfig.pin_set_in_zone_sensor', { pin, n: this.zones.indexOf(z) + 1 })) + (otherMode ? ' ' + i18n.t('plugins.WorkshopPrinting.extruderConfig.careful_used_by', { who: otherMode }) : '');
		},
		addZone() {
			const h = this.hFree, s = this.sFree;
			if (h == null || s == null) return;
			this.zones.push({ key: 'n' + Date.now(), h, s, newEntry: true, remove: false, name: i18n.t('plugins.WorkshopPrinting.extruderConfig.default_zone_name'), output: '', max: 250, kind: 'dc', ca: false, monitors: [], incomplete: false, ...readSensor('M308 Y"thermistor"') });
		},
		// a zone card is closed until the person opens it (a zone just added opens by itself); closed ones keep what was typed in them
		isOpen(z) {
			return !!z.newEntry || !!this.openZones[z.key];
		},
		toggleZone(z) {
			this.openZones = Object.assign({}, this.openZones, { [z.key]: !this.isOpen(z) });
		},
		removeZone(z) {
			if (z.newEntry) this.zones = this.zones.filter(x => x !== z);
			else z.remove = true;
		},
		// the new file, with the changes
		textNew() {
			try {
				return rewriteModeText(this.text, this.zones, this.tool.number);
			} catch (e) {
				if (e.code === 'm563_not_found') throw new Error(i18n.t('plugins.WorkshopPrinting.extruderConfig.err_m563_not_found', { n: e.tool }));
				throw e;
			}
		},
		// nivel 3 (DESIGN.md 5): un calentador mal conectado calienta otra cosa
		async save() {
			if (!this.atLeast(NEED.configure)) return; // writes modefff.g: a technician's
			this.$emit('error', null);
			// 2026-10-11: the output type of each new or changed zone, and whether it is alternating current
			const tocadas = this.zones.filter(z => !z.remove && (z.newEntry || this.changesOf(z).length));
			const nom = z => { const k = this.zones.indexOf(z); return k === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.extruderConfig.zone_n', { n: k + 1 }); };
			let extra = '';
			if (tocadas.length) extra += ' ' + i18n.t('plugins.WorkshopPrinting.extruderConfig.output_type_list', { list: tocadas.map(z => nom(z) + ': ' + labelKind(z.kind, z.ca) + ', ' + (isCA(z) ? i18n.t('plugins.WorkshopPrinting.extruderConfig.ac_mains_110_220') : i18n.t('plugins.WorkshopPrinting.extruderConfig.no_ac_mains'))).join('; ') });
			if (tocadas.some(isCA)) extra += i18n.t('plugins.WorkshopPrinting.extruderConfig.110_220_v_wiring_is_dangerous');
			if (tocadas.some(z => z.kind === 'ssrdc')) extra += i18n.t('plugins.WorkshopPrinting.extruderConfig.the_dc_ssr_must_be_dc');
			if (tocadas.some(z => z.kind === 'relay')) extra += i18n.t('plugins.WorkshopPrinting.extruderConfig.the_mechanical_relay_stays_on_on');
			const ok = await confirmRisk({
				title: i18n.t('plugins.WorkshopPrinting.extruderConfig.change_the_extruder_configuration'),
				text: i18n.t('plugins.WorkshopPrinting.extruderConfig.modefff_g_is_written') + this.changes.join(' ') + extra + i18n.t('plugins.WorkshopPrinting.extruderConfig.if_the_wires_are_not_on')
			});
			if (!ok) return;
			this.saving = true;
			try {
				const nuevo = this.textNew();
				const current = await readText(MODE_FILE);
				if (current !== this.text) throw new Error(i18n.t('plugins.WorkshopPrinting.extruderConfig.modefff_g_changed_while_you_were'));
				const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				await writeText(MODE_FILE + '.bak-' + sello, current);
				await writeText(MODE_FILE, nuevo);
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.extruderConfig.log_extruder_changes', { changes: this.changes.join(' ') }));
				this.$emit('msg', 'success', i18n.t('plugins.WorkshopPrinting.extruderConfig.saved_reload_hint', { stamp: sello }));
				this.reloadPending = true;
				await this.read();
			} catch (e) {
				// a missing role / PIN is shown by the page with ErrorNotice (F3-P); the other failures keep their text
				if (isFriendly(e)) this.$emit('error', e);
				else this.$emit('msg', 'error', i18n.t('plugins.WorkshopPrinting.extruderConfig.not_saved') + (e.message || e));
			} finally {
				this.saving = false;
			}
		},
		async reload() {
			// reloading the mode changes speeds, limits and heaters: never with a job
			// (file, paused or live) nor with the machine busy (motion
			// audit, finding 7)
			const ml = machineFree(this.$store.state.machine.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings' });
			if (!ml.free) {
				this.$emit('msg', 'error', i18n.t('plugins.WorkshopPrinting.extruderConfig.could_not_reload') + ml.reason + '.');
				return;
			}
			try {
				const r = await this.sendCode({ code: 'M98 P"0:/macros/mode/selectfff.g"', log: true });
				if (isError(r)) throw new Error(r);
				this.reloadPending = false;
				this.$emit('msg', 'success', i18n.t('plugins.WorkshopPrinting.extruderConfig.fff_mode_reloaded_the_board_now'));
			} catch (e) {
				if (isFriendly(e)) this.$emit('error', e);
				else this.$emit('msg', 'error', i18n.t('plugins.WorkshopPrinting.extruderConfig.could_not_reload') + (e.message || e));
			}
		}
	}
};
</script>

<style scoped>
.removed {
	opacity: 0.6;
	border-color: rgba(198, 40, 40, 0.6) !important;
}
ul {
	padding-left: 18px;
}
.monitor {
	border-left: 2px solid rgba(128, 128, 128, 0.4);
}
.pin-kind {
	min-width: 150px;
}
</style>
