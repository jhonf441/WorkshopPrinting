<template>
	<div>
						<div class="pc-fgrid mt-1">
							<div v-if="named" class="pc-fcell pc-fcell-2"><v-text-field v-model.trim="o.name" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_name')" dense outlined hide-details /></div>
							<div class="pc-fcell">
								<v-select v-if="o.ysen !== 'other'" v-model="o.ysen" :items="kindsSensor" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_type')" dense outlined hide-details />
								<v-text-field v-else :value="o.yRaw" :label="$t('plugins.WorkshopPrinting.extruderConfig.sensor_type')" disabled dense outlined hide-details />
							</div>
							<div class="pc-fcell">
								<v-combobox :value="o.pin" :items="pinItems" :label="isSpi(o.ysen) ? $t('plugins.WorkshopPrinting.extruderConfig.adapter_board_cs') : $t('plugins.WorkshopPrinting.extruderConfig.sensor_connector')"
									:placeholder="isSpi(o.ysen) ? 'spi.cs0' : 'temp1'" dense outlined hide-details :menu-props="{ maxHeight: 360 }" @change="v => $emit('pin', v)">
									<template #item="{ item }">
										<v-list-item-content>
											<v-list-item-title>{{ item.text }}</v-list-item-title>
											<v-list-item-subtitle :class="classNote(item)">{{ item.note }}</v-list-item-subtitle>
										</v-list-item-content>
									</template>
								</v-combobox>
							</div>
							<template v-if="o.ysen === 'thermistor'">
								<div class="pc-fcell"><v-text-field v-model.number="o.beta" :label="$t('plugins.WorkshopPrinting.extruderConfig.beta')" type="number" dense outlined hide-details /></div>
								<div class="pc-fcell"><v-text-field v-model.number="o.r25" :label="$t('plugins.WorkshopPrinting.extruderConfig.r_at_25_c')" type="number" dense outlined hide-details /></div>
								<div class="pc-fcell"><v-text-field v-model.trim="o.shc" :label="$t('plugins.WorkshopPrinting.extruderConfig.coef_c')" :placeholder="$t('plugins.WorkshopPrinting.extruderConfig.optional')" dense outlined hide-details /></div>
							</template>
							<div v-if="o.ysen === 'max31856'" class="pc-fcell"><v-select v-model="o.tc" :items="kindsThermocouple" :label="$t('plugins.WorkshopPrinting.extruderConfig.thermocouple_type')" dense outlined hide-details /></div>
							<template v-if="o.ysen === 'max31865'">
								<div class="pc-fcell"><v-select v-model="o.threads" :items="[2, 3, 4]" :label="$t('plugins.WorkshopPrinting.extruderConfig.wires')" dense outlined hide-details /></div>
								<div class="pc-fcell"><v-text-field v-model.number="o.rref" :label="$t('plugins.WorkshopPrinting.extruderConfig.reference_r')" type="number" dense outlined hide-details /></div>
							</template>
							<div v-if="o.ysen === 'max31856' || o.ysen === 'max31865'" class="pc-fcell"><v-select v-model="o.red" :items="networksElectrical" :label="$t('plugins.WorkshopPrinting.extruderConfig.mains_frequency')" dense outlined hide-details /></div>
							<template v-if="o.ysen === 'linear'">
								<div class="pc-fcell"><v-text-field v-model.number="o.lb" :label="$t('plugins.WorkshopPrinting.extruderConfig.c_with_the_input_at_0')" type="number" dense outlined hide-details /></div>
								<div class="pc-fcell"><v-text-field v-model.number="o.lc" :label="$t('plugins.WorkshopPrinting.extruderConfig.c_with_the_input_at_maximum')" type="number" dense outlined hide-details /></div>
							</template>
						</div>
						<div class="wf-help pc-help"><v-icon small>mdi-information-outline</v-icon><span>{{ explanation }}</span></div>
	</div>
</template>

<script>
import { SENSORES, isSpiKind } from './modefff-edit.js'
import { SENSOR_TEXT } from './extruder-config-text.js'
import { explanationSensor } from './extruder-config-pins.js'

// The fields of a sensor (type, connector and the values of its type) of a zone or of a monitor with its own sensor. Presentation only: o is the zone or monitor being edited
// (its fields are edited in place, like the page always did), the page keeps the lists, the checks and the save.
export default {
	props: {
		o: { type: Object, required: true },
		named: { type: Boolean, default: false },
		pinItems: { type: Array, default: () => [] }
	},
	computed: {
		kindsSensor() {
			return Object.keys(SENSORES).map(k => ({ text: SENSOR_TEXT[k], value: k }));
		},
		kindsThermocouple() {
			return ['K', 'J', 'T', 'E', 'N', 'R', 'S', 'B'];
		},
		networksElectrical() {
			return [{ value: 50, text: '50 Hz' }, { value: 60, text: '60 Hz' }];
		},
		explanation() {
			return explanationSensor(this.o.ysen);
		}
	},
	methods: {
		isSpi(t) {
			return isSpiKind(t);
		},
		classNote(item) {
			return item.state === 3 ? 'pc-muted' : '';
		}
	}
};
</script>
