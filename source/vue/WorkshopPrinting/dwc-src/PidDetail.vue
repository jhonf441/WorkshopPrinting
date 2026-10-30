<template>
	<!-- How the PID is and how it works (2026-10-11, request: "in printing add
complete detail information on how the PID is and how it works with the
current values"). It only reads: the object model (heat.heaters[n].model) and the
response to M307 H<n> that Pid.vue already asks for. The calculations follow RRF 3.5's
code (src/Heating/FOPDT.cpp, LocalHeater.cpp, Heater.cpp). -->
	<div class="pid-detail">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-title-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.pidDetail.how_it_is_and_how_it') }}</span>
			<v-chip size="small" variant="outlined" :color="colorLevel(a.level)">{{ textLevel(a.level) }}</v-chip>
			<v-spacer />
			<span class="text-body-small text-medium-emphasis">{{ chosen.name }} (H{{ chosen.id }})</span>
		</div>

		<v-alert v-if="a.withoutModel" density="compact" variant="tonal" type="info" class="mt-2 mb-0">{{ $t('plugins.WorkshopPrinting.pidDetail.this_heater_has_no_model_loaded') }}</v-alert>
		<template v-else>
			<!-- avisos primero: lo que conviene revisar -->
			<v-alert v-for="(w, k) in a.notices" :key="'w' + k" density="compact" variant="tonal" :type="w.kind" class="mt-2 mb-0">
				{{ w.text }} <b v-if="w.value">{{ w.value }}</b>
			</v-alert>

			<!-- 1. valores de la placa -->
			<div class="text-title-small mt-3 mb-1">{{ $t('plugins.WorkshopPrinting.pidDetail.board_values_now') }}</div>
			<v-table density="compact" class="pd-table">
				<tbody>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.temperature') }}</td>
						<td class="pd-val">{{ fmt(a.current, 1) }} °C</td>
						<td>
							<span>{{ $t('plugins.WorkshopPrinting.pidDetail.state') }}</span> <b>{{ textState(a.state) }}</b>.
							<span>{{ $t('plugins.WorkshopPrinting.common.target') }}</span> <b>{{ chosen.target > 0 ? fmt(chosen.target, 0) + ' °C' : $t('plugins.WorkshopPrinting.common.off') }}</b>.
							<template v-if="a.avgPwm != null"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.average_power_now') }}</span> <b>{{ pct(a.avgPwm) }}</b>.</template>
						</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.heating_r') }}</td>
						<td class="pd-val">{{ fmt(a.R, 3) }} °C/s</td>
						<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.at_full_power_and_still_cold') }}</span> <b>{{ fmt(a.R, 1) }} °C</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.per_second') }}</span></td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.cooling_k') }}</td>
						<td class="pd-val">{{ fmt(a.K, 3) }} °C/s</td>
						<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.off_and_at_100_c_above') }}</span> <b>{{ fmt(a.K, 2) }} °C</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.per_second_the_hotter_it_is') }}</span></td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.exponent_e') }}</td>
						<td class="pd-val">{{ fmt(a.E, 2) }}</td>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.how_heat_loss_grows_with_temperature') }}</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.fan_k_2nd_value') }}</td>
						<td class="pd-val">{{ fmt(a.F, 3) }} °C/s</td>
						<td>
							<template v-if="a.F > 0"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.with_the_fan_at_100_and') }}</span> <b>{{ fmt(a.F, 2) }} °C</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.more_per_second_the_board_raises') }}</span></template>
							<template v-else>{{ $t('plugins.WorkshopPrinting.pidDetail.the_model_does_not_account_for') }}</template>
						</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.dead_time_d') }}</td>
						<td class="pd-val">{{ fmt(a.D, 2) }} s</td>
						<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.it_takes') }}</span> <b>{{ fmt(a.D, 1) }} s</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.to_notice_a_power_change_at') }}</span></td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.maximum_power_s') }}</td>
						<td class="pd-val">{{ pct(a.S) }}</td>
						<td>{{ a.S < 1 ? $t('plugins.WorkshopPrinting.pidDetail.it_never_delivers_more_than_this') : $t('plugins.WorkshopPrinting.pidDetail.it_can_use_all_the_power') }}</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.tuning_voltage_v') }}</td>
						<td class="pd-val">{{ a.V >= 10 ? fmt(a.V, 1) + ' V' : '-' }}</td>
						<td>{{ a.V >= 10 ? $t('plugins.WorkshopPrinting.pidDetail.if_the_power_supply_gives_another') : $t('plugins.WorkshopPrinting.pidDetail.no_voltage_saved_it_does_not') }}</td>
					</tr>
					<tr v-if="a.inverted">
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.inverted_output') }}</td>
						<td class="pd-val">{{ $t('plugins.WorkshopPrinting.pidDetail.yes') }}</td>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.the_output_works_the_other_way') }}</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.common.control') }}</td>
						<td class="pd-val">{{ a.usesPid ? (a.overridden ? $t('plugins.WorkshopPrinting.pidDetail.manual_pid') : $t('plugins.WorkshopPrinting.common.pid')) : 'B1' }}</td>
						<td>{{ !a.usesPid ? $t('plugins.WorkshopPrinting.pidDetail.on_off_bang_bang_no_pid') : a.overridden ? $t('plugins.WorkshopPrinting.pidDetail.pid_set_by_hand_with_m301') : $t('plugins.WorkshopPrinting.pidDetail.pid_calculated_by_the_board_from') }}</td>
					</tr>
					<template v-if="a.usesPid && a.p != null">
						<tr>
							<td>P</td>
							<td class="pd-val">{{ fmt(a.p, 4) }}</td>
							<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.for_every_1_c_missing_it') }}</span> <b>{{ pct(a.p, 1) }}</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.of_power') }}</span></td>
						</tr>
						<tr>
							<td>I</td>
							<td class="pd-val">{{ fmt(a.i, 5) }}</td>
							<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.for_every_second_it_stays_1') }}</span> <b>{{ pct(a.i, 2) }}</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.more_and_subtracts_if_it_is') }}</span></td>
						</tr>
						<tr>
							<td>D</td>
							<td class="pd-val">{{ fmt(a.d, 3) }}</td>
							<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.if_it_rises_1_c_per') }}</span> <b>{{ pct(a.d, 1) }}</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.so_as_not_to_overshoot') }}</span></td>
						</tr>
					</template>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.common.limit_m143') }}</td>
						<td class="pd-val">{{ fmt(a.max, 0) }} °C</td>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.if_it_goes_over_the_board') }}</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.sensor') }}</td>
						<td class="pd-val">S{{ chosen.sensor }}</td>
						<td>{{ chosen.sensorName || $t('plugins.WorkshopPrinting.pidDetail.sensor_that_reads_this_temperature') }}</td>
					</tr>
				</tbody>
			</v-table>
			<div v-if="m307.pidHeat || m307.rise != null" class="text-body-small text-medium-emphasis mt-1">
				<template v-if="m307.rise != null"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.the_board_m307_calculates_that_at') }}</span> {{ m307.rise }} °C <span>{{ $t('plugins.WorkshopPrinting.pidDetail.above_ambient') }}</span></template>
				<template v-if="m307.pidHeat"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.pid_on_the_m301_scale_when') }}</span> {{ m307.pidHeat }}<span>{{ $t('plugins.WorkshopPrinting.pidDetail.when_holding') }}</span> {{ m307.pidHold || '-' }}.</template>
			</div>

			<!-- 2. cuentas -->
			<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.pidDetail.calculations_with_these_values') }} <span class="text-medium-emphasis text-body-small"><span>{{ chosen.target > 0 ? $t('plugins.WorkshopPrinting.pidDetail.with_the_target') : $t('plugins.WorkshopPrinting.pidDetail.with_the_temperature_above') }}</span> <b>{{ fmt(reference, 0) }} °C</b></span></div>
			<v-table density="compact" class="pd-table">
				<tbody>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.maximum_at_full_power') }}</td>
						<td class="pd-val">~{{ fmt(a.maxFull, 0) }} °C</td>
						<td>
							<span>{{ $t('plugins.WorkshopPrinting.pidDetail.if_it_stayed_on_at_100') }}</span> <b>{{ fmt(a.maxFull, 0) }} °C</b><span>.</span>
							<template v-if="a.S < 1"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.with_its_power_limit') }}</span> <b>~{{ fmt(a.maxS, 0) }} °C</b><span>.</span></template>
						</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.power_to_hold') }}</td>
						<td class="pd-val">{{ pct(a.req) }}</td>
						<td>
							<span>{{ $t('plugins.WorkshopPrinting.pidDetail.to_stay_at') }}</span> <b>{{ fmt(reference, 0) }} °C</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.without_the_fan_it_needs_roughly') }}</span>
							<template v-if="a.F > 0"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.with_the_fan_at_100') }}</span> <b>{{ pct(a.reqFan) }}</b><span>.</span></template>
						</td>
					</tr>
					<tr v-if="a.measurement">
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.measured_power') }}</td>
						<td class="pd-val">{{ pct(a.avgPwm) }}</td>
						<td><span>{{ $t('plugins.WorkshopPrinting.pidDetail.right_now_it_holds_it_with') }}</span> <b>{{ pct(a.reqNow) }}</b><span>{{ $t('plugins.WorkshopPrinting.pidDetail.if_they_are_similar_the_model') }}</span></td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.time_to_get_there') }}</td>
						<td class="pd-val">{{ a.tCold != null ? '~' + fmtT(a.tCold) : $t('plugins.WorkshopPrinting.pidDetail.does_not_reach_it') }}</td>
						<td>
							<template v-if="a.tCold != null"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.from_25_c_to') }}</span> <b>{{ fmt(reference, 0) }} °C</b> <span>{{ $t('plugins.WorkshopPrinting.pidDetail.at_full_power_near_the_end') }}</span></template>
							<template v-else>{{ $t('plugins.WorkshopPrinting.pidDetail.at_full_power_it_does_not') }}</template>
							<template v-if="a.tNow != null"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.from_the_current_temperature') }}</span> <b>~{{ fmtT(a.tNow) }}</b><span>.</span></template>
						</td>
					</tr>
					<tr>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.margin_to_the_limit') }}</td>
						<td class="pd-val">{{ a.max ? fmt(a.max - reference, 0) + ' °C' : '-' }}</td>
						<td>{{ $t('plugins.WorkshopPrinting.pidDetail.distance_between_the_working_temperature_and') }}</td>
					</tr>
				</tbody>
			</v-table>

			<!-- 3. curva estimada (SVG liviano) -->
			<div v-if="curve" class="mt-4">
				<div class="text-title-small mb-1">{{ $t('plugins.WorkshopPrinting.pidDetail.estimated_heating_curve') }}</div>
				<svg :viewBox="'0 0 ' + G.w + ' ' + G.h" class="pd-svg" preserveAspectRatio="xMidYMid meet">
					<g v-for="v in curve.ticksY" :key="'y' + v">
						<line :x1="G.l" :x2="G.w - G.r" :y1="cy(v)" :y2="cy(v)" class="pd-grid" />
						<text :x="G.l - 5" :y="cy(v) + 4" text-anchor="end" class="pd-axis">{{ v }}</text>
					</g>
					<g v-for="t in curve.ticksX" :key="'x' + t">
						<line :x1="cx(t)" :x2="cx(t)" :y1="G.t" :y2="G.h - G.b" class="pd-grid" />
						<text :x="cx(t)" :y="G.h - 8" text-anchor="middle" class="pd-axis">{{ fmtAxis(t) }}</text>
					</g>
					<!-- tiempo muerto: todavia no se nota nada -->
					<rect :x="cx(0)" :y="G.t" :width="Math.max(0, cx(a.D) - cx(0))" :height="G.h - G.t - G.b" class="pd-muerto" />
					<line v-if="a.max" :x1="G.l" :x2="G.w - G.r" :y1="cy(a.max)" :y2="cy(a.max)" class="text-error" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 4" />
					<line :x1="G.l" :x2="G.w - G.r" :y1="cy(reference)" :y2="cy(reference)" class="text-success" stroke="currentColor" stroke-width="1.5" stroke-dasharray="7 5" />
					<path :d="curve.withoutControl" fill="none" class="pd-without" stroke-width="1.5" stroke-dasharray="4 4" />
					<path :d="curve.withControl" fill="none" class="text-primary" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
				</svg>
				<div class="text-body-small text-medium-emphasis">
					{{ $t('plugins.WorkshopPrinting.pidDetail.blue_estimated_temperature_at_full_power') }}
				</div>
			</div>

			<!-- 4. how it works: foldable so as not to overload -->
			<v-expansion-panels variant="accordion" multiple class="mt-4">
				<v-expansion-panel>
					<v-expansion-panel-title>{{ $t('plugins.WorkshopPrinting.pidDetail.what_the_model_is') }}</v-expansion-panel-title>
					<v-expansion-panel-text class="text-body-medium">
						<p>
							{{ $t('plugins.WorkshopPrinting.pidDetail.tuning_m303_heats_and_cools_the') }}<b>{{ fmt(a.R, 2) }} °C/s</b>{{ $t('plugins.WorkshopPrinting.pidDetail.how_much_heat_it_loses') }}<b>{{ fmt(a.K, 3) }} °C/s</b> {{ $t('plugins.WorkshopPrinting.pidDetail.at_100_c_above_ambient_and') }}<b>{{ fmt(a.D, 1) }} s</b>).
						</p>
						<p>
							{{ $t('plugins.WorkshopPrinting.pidDetail.with_the_model_the_board_knows') }} <b>{{ fmt(reference, 0) }} °C</b> {{ $t('plugins.WorkshopPrinting.pidDetail.it_calculates_about') }} <b>{{ pct(a.req) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.and_starts_from_there_instead_of') }} <b>{{ fmt(2 * a.D, 0) }} s</b>{{ $t('plugins.WorkshopPrinting.pidDetail.it_flags_a_heating_fault') }}
						</p>
						<p class="mb-0">
							{{ $t('plugins.WorkshopPrinting.pidDetail.maximum_calculation_heat_loss_grows_with') }}<sup>1/E</sup> = <b>{{ fmt(a.maxFull, 0) }} °C</b>{{ $t('plugins.WorkshopPrinting.pidDetail.if_that_number_is_much_higher') }} <b>{{ fmt(a.noWarn, 0) }} °C</b>).
						</p>
					</v-expansion-panel-text>
				</v-expansion-panel>
				<v-expansion-panel v-if="a.usesPid">
					<v-expansion-panel-title>{{ $t('plugins.WorkshopPrinting.pidDetail.how_p_i_and_d_are') }}</v-expansion-panel-title>
					<v-expansion-panel-text class="text-body-medium">
						<p v-if="a.overridden">
							{{ $t('plugins.WorkshopPrinting.pidDetail.right_now_they_are') }} <b>{{ $t('plugins.WorkshopPrinting.pidDetail.set_by_hand_with_m301') }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.the_board_does_not_calculate_them') }}
							<template v-if="a.pCalc != null"><span>{{ $t('plugins.WorkshopPrinting.pidDetail.from_the_model_p_would_be') }}</span> <b>{{ fmt(a.pCalc, 4) }}</b><span>{{ $t('plugins.WorkshopPrinting.pidDetail.now_it_is') }}</span> <b>{{ fmt(a.p, 4) }}</b><span>.</span></template>
						</p>
						<p v-else>
							{{ $t('plugins.WorkshopPrinting.pidDetail.the_board_calculates_them_from_the') }}<b>{{ fmt(a.R, 3) }}</b> × <b>{{ fmt(a.D, 2) }}</b>) = <b>{{ fmt(a.pCalc, 4) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.d_p_0_7_dead_time') }}
						</p>
						<p class="mb-0">
							{{ $t('plugins.WorkshopPrinting.pidDetail.it_has_two_sets_one_for') }}
						</p>
					</v-expansion-panel-text>
				</v-expansion-panel>
				<v-expansion-panel v-if="a.usesPid && a.p != null">
					<v-expansion-panel-title>{{ $t('plugins.WorkshopPrinting.pidDetail.what_each_term_does_with_these') }}</v-expansion-panel-title>
					<v-expansion-panel-text class="text-body-medium">
						<p>
							<b>{{ $t('plugins.WorkshopPrinting.pidDetail.p_proportional') }}</b> {{ $t('plugins.WorkshopPrinting.pidDetail.pushes_according_to_how_much_is') }} <b>{{ pct(Math.min(1, a.p * 10)) }}</b> {{ $t('plugins.WorkshopPrinting.pidDetail.of_power_if_1_c_is') }} <b>{{ pct(a.p, 1) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.on_its_own_it_would_always') }}
						</p>
						<p>
							<b>{{ $t('plugins.WorkshopPrinting.pidDetail.i_integral') }}</b> {{ $t('plugins.WorkshopPrinting.pidDetail.corrects_the_remaining_error_it_builds') }} <b>{{ fmt(reference, 0) }} °C</b>{{ $t('plugins.WorkshopPrinting.pidDetail.about') }} <b>{{ pct(a.req) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.with_1_c_below_for_10') }} <b>{{ pct(a.i * 10, 1) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.when_heating_the_board_starts_it') }}
						</p>
						<p>
							<b>{{ $t('plugins.WorkshopPrinting.pidDetail.d_derivative') }}</b> {{ $t('plugins.WorkshopPrinting.pidDetail.brakes_if_it_rises_fast_it') }} <b>{{ fmt(a.d / a.p, 1) }} s</b>{{ $t('plugins.WorkshopPrinting.pidDetail.if_it_rises_2_c_per') }} <b>{{ pct(Math.min(1, a.d * 2)) }}</b>{{ $t('plugins.WorkshopPrinting.pidDetail.that_way_it_cuts_back_before') }}
						</p>
						<p class="mb-0">
							{{ $t('plugins.WorkshopPrinting.pidDetail.the_output_power_is_the_sum') }}<b>{{ pct(a.S) }}</b>).
						</p>
					</v-expansion-panel-text>
				</v-expansion-panel>
				<v-expansion-panel>
					<v-expansion-panel-title>{{ $t('plugins.WorkshopPrinting.pidDetail.on_off_bang_bang_b1') }}</v-expansion-panel-title>
					<v-expansion-panel-text class="text-body-medium">
						<p class="mb-0">
							<span>{{ a.usesPid ? $t('plugins.WorkshopPrinting.pidDetail.not_in_use_this_heater_uses') : $t('plugins.WorkshopPrinting.pidDetail.it_is_in_use_on_this') }}</span>
							{{ $t('plugins.WorkshopPrinting.pidDetail.with_b1_the_board_does_not') }} <b>{{ fmt(a.R * a.D, 0) }} °C</b> {{ $t('plugins.WorkshopPrinting.pidDetail.after_cutting_off_heating_dead_time') }}
						</p>
					</v-expansion-panel-text>
				</v-expansion-panel>
				<v-expansion-panel v-if="neighbors.length">
					<v-expansion-panel-title>{{ $t('plugins.WorkshopPrinting.pidDetail.coupled_zones_of_the_barrel') }}</v-expansion-panel-title>
					<v-expansion-panel-text class="text-body-medium">
						<p>
							{{ $t('plugins.WorkshopPrinting.pidDetail.this_zone_shares_the_barrel_with') }}
						</p>
						<v-table density="compact" class="pd-table">
							<thead>
								<tr><th>{{ $t('plugins.WorkshopPrinting.common.zone') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.heating') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.cooling') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.dead_time') }}</th><th>{{ $t('plugins.WorkshopPrinting.common.now') }}</th></tr>
							</thead>
							<tbody>
								<tr v-for="z in neighbors" :key="z.id" :class="z.id === chosen.id ? 'pd-sel' : ''">
									<td>{{ z.name }}</td>
									<td>{{ fmt(z.R, 2) }} °C/s</td>
									<td>{{ fmt(z.K, 3) }} °C/s</td>
									<td>{{ fmt(z.D, 1) }} s</td>
									<td>{{ fmt(z.current, 0) }} °C</td>
								</tr>
							</tbody>
						</v-table>
					</v-expansion-panel-text>
				</v-expansion-panel>
			</v-expansion-panels>
		</template>

		<!-- 5. all the heaters at a glance: tapping one chooses it above -->
		<div v-if="summary.length > 1" class="mt-4">
			<div class="text-title-small mb-1">{{ $t('plugins.WorkshopPrinting.pidDetail.all_heaters_at_a_glance') }}</div>
			<v-table density="compact" class="pd-table">
				<thead>
					<tr><th>{{ $t('plugins.WorkshopPrinting.pidDetail.heater') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.heating') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.dead_time') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.max_at_full_power') }}</th><th>{{ $t('plugins.WorkshopPrinting.pidDetail.to_hold') }}</th><th>{{ $t('plugins.WorkshopPrinting.common.status') }}</th></tr>
				</thead>
				<tbody>
					<tr v-for="r in summary" :key="r.id" class="pd-row" :class="r.id === chosen.id ? 'pd-sel' : ''" @click="$emit('choose', r.id)">
						<td>{{ r.name }}</td>
						<template v-if="r.withoutModel"><td colspan="4" class="text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.common.no_model') }}</td></template>
						<template v-else>
							<td>{{ fmt(r.R, 2) }} °C/s</td>
							<td>{{ fmt(r.D, 1) }} s</td>
							<td>~{{ fmt(r.maxFull, 0) }} °C</td>
							<td>{{ pct(r.req) }} a {{ fmt(r.ref, 0) }} °C</td>
						</template>
						<td><v-chip variant="outlined" size="x-small" :color="colorLevel(r.level)">{{ textLevel(r.level) }}</v-chip></td>
					</tr>
				</tbody>
			</v-table>
			<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.pidDetail.tap_a_heater_to_see_its') }}</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { i18n } from './dwc-host.js'

// Ambient temperature RRF uses in the model's calculations (NormalAmbientTemperature).
const AMB = 25;
// Model of a new uncalibrated zone in this workshop (user's request: R2.0 K0.3 D5.0).
const WITHOUT_CALIBRATE = { R: 2.0, K: 0.3, D: 5.0 };
// Heat loss in °C/s with the temperature "suba" above ambient and the fan
// at "fan" (0..1). Same as FopDt::GetCoolingRate (RRF 3.5, FOPDT.cpp).
function enfria(m, suba, fan) {
	const x = suba * 0.01;
	const aj = x < 0 ? -Math.pow(-x, m.E) : Math.pow(x, m.E);
	return m.K * aj + x * m.F * (fan || 0);
}
// Maximum rise with power "pwm": where what rises equals what is lost.
// With pwm 1 and no fan it is 100 * (R/K)^(1/E) (FopDt::EstimateMaxTemperatureRise).
function subaMax(m, pwm) {
	return 100 * Math.pow((m.R * pwm) / m.K, 1 / m.E);
}
// Simple simulation of the model: nothing during the dead time, afterwards
// dT/dt = R*pwm - loss. Returns points [t, T] and when it reaches "obj".
function simulate(m, T0, obj, pwm, tMax) {
	const pts = [[0, T0], [m.D, T0]];
	let T = T0;
	let t = m.D;
	let llega = T0 >= obj ? 0 : null;
	const dt = 0.25;
	let end = tMax;
	let n = 0;
	while (t < end) {
		const dT = m.R * pwm - enfria(m, T - AMB, 0);
		if (dT <= 0.0005) break;
		T += dT * dt;
		t += dt;
		if (llega == null && T >= obj) {
			llega = t;
			end = Math.min(tMax, Math.max(t * 1.6, t + 30));
		}
		if (++n % 4 === 0) pts.push([t, T]);
	}
	pts.push([t, T]);
	return { pts, arrives: llega };
}
function paperRef(c) {
	return c.paper === 'bed' ? 60 : c.paper === 'camera' ? 45 : 200;
}

const props = defineProps({
	omHeaters: { type: Array, default: () => [] },
	chosen: { type: Object, required: true },
	reference: { type: Number, default: 200 },
	modelTxt: { type: String, default: '' }
})

const emit = defineEmits(['choose'])

const G = ref({ w: 600, h: 220, l: 42, r: 12, t: 10, b: 26 })

const a = computed(() => {
	return analyze(props.chosen, props.reference);
})

const summary = computed(() => {
	return props.omHeaters.map(c => {
		const ref = c.id === props.chosen.id ? props.reference : c.target > 0 ? c.target : paperRef(c);
		return Object.assign({ id: c.id, name: c.name, ref }, analyze(c, ref));
	});
})

// otras zonas de la misma herramienta (barril de pellet)
const neighbors = computed(() => {
	const c = props.chosen;
	if (c.paper !== 'nozzle' || c.tool == null) return [];
	const zs = props.omHeaters.filter(x => x.paper === 'nozzle' && x.tool === c.tool).sort((p, q) => p.zone - q.zone);
	if (zs.length < 2) return [];
	return zs.map(z => {
		const m = model(z.id) || {};
		return { id: z.id, name: z.name, R: m.R, K: m.K, D: m.D, current: z.current };
	});
})

// what M307's response adds (RRF 3.5: FopDt::AppendModelParameters)
const m307 = computed(() => {
	const t = props.modelTxt || '';
	const sub = t.match(/Predicted max temperature rise (-?\d+)/i);
	const cal = t.match(/heating P([\d.]+) I([\d.]+) D([\d.]+)/i);
	const sos = t.match(/steady P([\d.]+) I([\d.]+) D([\d.]+)/i);
	const txt = m => 'P ' + m[1] + ' · I ' + m[2] + ' · D ' + m[3];
	return {
		rise: sub ? Number(sub[1]) : null,
		pidHeat: cal ? txt(cal) : '',
		pidHold: sos ? txt(sos) : ''
	};
})

const curve = computed(() => {
	const an = a.value;
	if (an.withoutModel || !an.valid) return null;
	const ref = props.reference;
	const s = simulate(an.m, AMB, ref, an.S, 3600);
	const tEnd = s.pts[s.pts.length - 1][0];
	if (!(tEnd > 0)) return null;
	const yMax = Math.max(100, Math.ceil((Math.max(ref, an.max || 0) + 15) / 50) * 50);
	const step = yMax > 400 ? 100 : 50;
	const ticksY = [];
	for (let v = 0; v <= yMax; v += step) ticksY.push(v);
	const stepX = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800].find(p => tEnd / p <= 7) || 1800;
	const ticksX = [];
	for (let v = 0; v <= tEnd; v += stepX) ticksX.push(v);
	// muestreo a lo sumo ~150 puntos
	const each = Math.max(1, Math.ceil(s.pts.length / 150));
	const pts = s.pts.filter((p, k) => k % each === 0 || k === s.pts.length - 1);
	const sx = t => G.value.l + (t / tEnd) * (G.value.w - G.value.l - G.value.r);
	const sy = v => G.value.t + (1 - Math.min(v, yMax) / yMax) * (G.value.h - G.value.t - G.value.b);
	const path = arr => arr.map((p, k) => (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ');
	const con = pts.map(p => [p[0], Math.min(p[1], ref)]);
	const without = s.arrives != null ? pts.filter(p => p[0] >= s.arrives) : [];
	return { tEnd: tEnd, yMax, ticksY, ticksX, withControl: path(con), withoutControl: without.length > 1 ? path(without) : '' };
})

function model(id) {
	const h = props.omHeaters[id];
	const md = h && h.model;
	if (!md || md.enabled === false) return null;
	return {
		R: Number(md.heatingRate), K: Number(md.coolingRate), E: Number(md.coolingExp) || 1, F: Number(md.fanCoolingRate) || 0,
		D: Number(md.deadTime), S: md.maxPwm != null ? Number(md.maxPwm) : 1, V: Number(md.standardVoltage) || 0,
		inverted: !!md.inverted, pid: md.pid || {}
	};
}

// Everything shown about a heater at the temperature "ref".
function analyze(c, ref) {
	const h = props.omHeaters[c.id] || {};
	const m = model(c.id);
	if (!m) return { withoutModel: true, level: 'sin', notices: [] };
	const valid = m.R > 0 && m.K > 0 && m.D > 0 && m.E > 0;
	const pid = m.pid;
	const usesPid = pid.used !== false;
	const overridden = !!pid.overridden;
	const maxFull = valid ? AMB + subaMax(m, 1) : null;
	const maxS = valid ? AMB + subaMax(m, m.S) : null;
	const req = valid ? enfria(m, ref - AMB, 0) / m.R : null;
	const reqFan = valid ? enfria(m, ref - AMB, 1) / m.R : null;
	const max = h.max != null ? Number(h.max) : null;
	const noWarn = max != null ? (max - AMB) * 1.5 + 50 : null;
	const current = c.current;
	const tCold = valid && maxS > ref ? simulate(m, AMB, ref, m.S, 7200).arrives : null;
	const tNow = valid && maxS > ref && current > AMB + 5 && current < ref - 2 ? simulate(m, current, ref, m.S, 7200).arrives : null;
	// stable at the target: compare the measured power with the model's
	const avgPwm = h.avgPwm != null ? Number(h.avgPwm) : null;
	const measure = valid && h.state === 'active' && avgPwm != null && c.target > 0 && Math.abs(current - c.target) < 3;
	const reqNow = measure ? enfria(m, current - AMB, 0) / m.R : null;
	const notices = [];
	const withoutCal = Math.abs(m.R - WITHOUT_CALIBRATE.R) < 0.01 && Math.abs(m.K - WITHOUT_CALIBRATE.K) < 0.005 && Math.abs(m.D - WITHOUT_CALIBRATE.D) < 0.05;
	if (h.state === 'fault') notices.push({ kind: 'error', text: i18n.t('plugins.WorkshopPrinting.pidDetail.the_heater_is_in_fault_check') });
	if (!valid) notices.push({ kind: 'error', text: i18n.t('plugins.WorkshopPrinting.pidDetail.the_model_has_impossible_values_zero') });
	if (withoutCal) notices.push({ kind: 'warning', text: i18n.t('plugins.WorkshopPrinting.pidDetail.it_looks_untuned_it_has_the') });
	if (valid && noWarn != null && maxFull > noWarn) notices.push({ kind: 'warning', text: i18n.t('plugins.WorkshopPrinting.pidDetail.at_full_power_it_would_get'), value: Math.round(maxFull) + ' °C' });
	if (valid && maxS < ref + 5) notices.push({ kind: 'error', text: i18n.t('plugins.WorkshopPrinting.pidDetail.at_full_power_it_does_not_2'), value: Math.round(maxS) + ' °C' });
	else if (valid && req > 0.85 * m.S) notices.push({ kind: 'warning', text: i18n.t('plugins.WorkshopPrinting.pidDetail.little_power_margin_to_hold_this') });
	if (valid && m.D * m.K > 40) notices.push({ kind: 'warning', text: i18n.t('plugins.WorkshopPrinting.pidDetail.dead_time_very_long_for_how') });
	else if (valid && c.paper === 'nozzle' && m.D > 20) notices.push({ kind: 'info', text: i18n.t('plugins.WorkshopPrinting.pidDetail.long_dead_time_it_is_slow') });
	if (max != null && ref < max && max - ref < 15) notices.push({ kind: 'warning', text: i18n.t('plugins.WorkshopPrinting.pidDetail.very_little_margin_between_the_working') });
	const pCalc = valid ? 0.7 / (m.R * m.D) : null;
	if (usesPid && overridden && pid.p > 0 && pCalc && (pid.p / pCalc > 2 || pid.p / pCalc < 0.5)) notices.push({ kind: 'info', text: i18n.t('plugins.WorkshopPrinting.pidDetail.the_pid_set_by_hand_m301') });
	if (measure && Math.abs(avgPwm - reqNow) > 0.15) notices.push({ kind: 'info', text: i18n.t('plugins.WorkshopPrinting.pidDetail.the_power_it_uses_now_does') });
	let level = 'ok';
	if (notices.some(w => w.kind === 'warning')) level = 'warning';
	if (notices.some(w => w.kind === 'error')) level = 'error';
	if (withoutCal && level === 'warning') level = 'sincal';
	return {
		m, valid: valid, R: m.R, K: m.K, E: m.E, F: m.F, D: m.D, S: m.S, V: m.V, inverted: m.inverted,
		usesPid: usesPid, overridden, p: pid.p, i: pid.i, d: pid.d, pCalc,
		max, noWarn, maxFull, maxS, req, reqFan, tCold: tCold, tNow: tNow, current: current, state: h.state,
		avgPwm, measurement: measure, reqNow: reqNow, notices: notices, level: level
	};
}

function cx(t) {
	const e = curve.value || { tEnd: 1 };
	return G.value.l + (t / e.tEnd) * (G.value.w - G.value.l - G.value.r);
}

function cy(v) {
	const e = curve.value || { yMax: 1 };
	return G.value.t + (1 - Math.min(v, e.yMax) / e.yMax) * (G.value.h - G.value.t - G.value.b);
}

function fmt(v, d) {
	if (v == null || !Number.isFinite(Number(v))) return '--';
	return Number(v).toFixed(d).replace('.', ',');
}

function pct(v, d) {
	if (v == null || !Number.isFinite(Number(v))) return '--';
	return (Number(v) * 100).toFixed(d || 0).replace('.', ',') + ' %';
}

function fmtT(s) {
	if (s == null) return '--';
	if (s < 90) return Math.round(s) + ' s';
	return (s / 60).toFixed(1).replace('.', ',') + ' min';
}

function fmtAxis(s) {
	return s < 120 ? s + ' s' : Math.round(s / 60) + ' min';
}

function textState(s) {
	return { off: i18n.t('plugins.WorkshopPrinting.pidDetail.st_off'), standby: i18n.t('plugins.WorkshopPrinting.common.standby'), active: i18n.t('plugins.WorkshopPrinting.pidDetail.st_on'), fault: i18n.t('plugins.WorkshopPrinting.pidDetail.in_fault'), tuning: i18n.t('plugins.WorkshopPrinting.pidDetail.st_tuning'), offline: i18n.t('plugins.WorkshopPrinting.pidDetail.offline') }[s] || s || '--';
}

function colorLevel(n) {
	return { ok: 'success', warning: 'warning', sincal: 'warning', error: 'error', sin: 'grey' }[n] || 'grey';
}

function textLevel(n) {
	return { ok: i18n.t('plugins.WorkshopPrinting.pidDetail.lvl_ok'), warning: i18n.t('plugins.WorkshopPrinting.pidDetail.lvl_check'), sincal: i18n.t('plugins.WorkshopPrinting.pidDetail.not_calibrated'), error: i18n.t('plugins.WorkshopPrinting.pidDetail.lvl_problem'), sin: i18n.t('plugins.WorkshopPrinting.pidDetail.no_model') }[n] || '--';
}
</script>

<style scoped>
.pd-table td {
	vertical-align: top;
	padding-top: 4px !important;
	padding-bottom: 4px !important;
}
.pd-val {
	white-space: nowrap;
	font-family: monospace;
}
.pd-svg {
	display: block;
	width: 100%;
	max-width: 720px;
	height: auto;
}
.pd-grid {
	stroke: rgba(128, 128, 128, 0.2);
	stroke-width: 1;
}
.pd-axis {
	fill: var(--tp-faint, #9e9e9e);
	font-size: 11px;
}
.pd-muerto {
	fill: rgba(128, 128, 128, 0.15);
}
.pd-without {
	stroke: var(--tp-faint, #9e9e9e);
}
.pd-row {
	cursor: pointer;
}
.pd-sel {
	background: rgba(25, 118, 210, 0.1);
}
</style>
