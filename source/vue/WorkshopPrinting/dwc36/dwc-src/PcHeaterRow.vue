<template>
	<div class="pc-heater" :class="{ 'is-fault': fault }">
		<span class="pc-heater-name"><v-icon small aria-hidden="true">{{ h.icon }}</v-icon>{{ h.name }}</span>
		<span class="pc-heater-num" :aria-label="$t('plugins.WorkshopPrinting.printing.heater_now_label', { name: h.name })">{{ h.sensorBad ? '--' : fmt(h.current) }} °C</span>
		<span class="pc-heater-num pc-heater-tgt">{{ h.target > 0 ? $t('plugins.WorkshopPrinting.printing.heater_target_to', { n: fmt(h.target) }) : $t('plugins.WorkshopPrinting.common.off') }}</span>
		<span class="pc-heater-bar-w">
			<span class="pc-heater-bar" role="img" :aria-label="barLabel"><i :style="{ width: pct + '%' }" /><u v-if="tickPct != null" class="pc-heater-tick" :style="{ left: tickPct + '%' }" /></span>
			<span class="pc-heater-lim">{{ $t('plugins.WorkshopPrinting.printing.limit_c', { max: fmt(h.max) }) }}</span>
		</span>
		<span class="wf-state" :class="kind">{{ stateText }}</span>
		<template v-if="fault">
			<!-- ONE short line of the problem; the sentence of the sensor and Clear fault are behind See more -->
			<div class="pc-heater-fault">
				<span class="text-caption">{{ h.sensorBad ? $t('plugins.WorkshopPrinting.printing.heater_short_sensor') : $t('plugins.WorkshopPrinting.printing.heater_short_fault') }}</span>
				<details class="pc-heater-more">
					<summary class="pc-heater-more-sum">{{ $t('plugins.WorkshopPrinting.printing.see_more') }}</summary>
					<div class="pc-heater-more-body">
						<span class="text-caption">{{ h.explanation || $t('plugins.WorkshopPrinting.printing.the_heater_is_in_fault') }}</span>
						<v-btn small outlined color="error" :disabled="h.sensorBad || !canOperate" :aria-describedby="h.sensorBad ? 'st-sensor-' + h.id : undefined" @click="$emit('clear-fault', h)">
							{{ $t('plugins.WorkshopPrinting.printing.clear_fault_m562') }}
						</v-btn>
						<!-- the reason the button is off, in words (not only a title): the sensor must be fixed before the fault can be cleared -->
						<span v-if="h.sensorBad" :id="'st-sensor-' + h.id" class="text-caption">{{ $t('plugins.WorkshopPrinting.printing.fix_the_sensor_first') }}</span>
					</div>
				</details>
			</div>
		</template>
	</div>
</template>

<script>
// One heater of the State section as a compact row (name, now, target, a thin bar with the cap and the state as a dot and a word). Presentational: props down, `clear-fault` up.
// The bar fills in the neutral color: the state is the dot and the word, never the color alone. The numbers are mono 14 (printing-design.css .pc-heater).
export default {
	props: {
		h: { type: Object, required: true }, // a heater as Print.vue builds it
		stateText: { type: String, default: '' },
		kind: { type: String, default: 'info' }, // ok | warn | err | info (the dot)
		canOperate: { type: Boolean, default: false }
	},
	computed: {
		// where the target sits on the bar (the bar runs to the cap at its right end)
		tickPct() {
			const h = this.h;
			if (!h.max || h.sensorBad || !(h.target > 0)) return null;
			return Math.max(0, Math.min(100, (h.target / h.max) * 100));
		},
		fault() {
			return this.h.state === 'fault' || !!this.h.sensorBad;
		},
		pct() {
			const h = this.h;
			if (!h.max || h.sensorBad || !isFinite(h.current)) return 0;
			return Math.max(0, Math.min(100, (h.current / h.max) * 100));
		},
		barLabel() {
			return this.$t('plugins.WorkshopPrinting.printing.heater_bar_label', { name: this.h.name, now: this.fmt(this.h.current), max: this.fmt(this.h.max), target: this.h.target > 0 ? this.fmt(this.h.target) : this.$t('plugins.WorkshopPrinting.common.off') });
		}
	},
	methods: {
		fmt(v) {
			return v == null || isNaN(v) ? '--' : Number(v).toFixed(0);
		}
	}
};
</script>
