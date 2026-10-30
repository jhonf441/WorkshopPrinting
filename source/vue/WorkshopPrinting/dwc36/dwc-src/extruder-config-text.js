'use strict'

// Texts and constants of the heater / sensor forms of ExtruderConfig.vue (kept out of the component: it is long). i18n keys are in extruderConfig.

import i18n from '../../i18n'

export const kinds = {
	dc: i18n.t('plugins.WorkshopPrinting.extruderConfig.board_heater_dc'),
	ssr: i18n.t('plugins.WorkshopPrinting.extruderConfig.solid_state_relay_ssr_for_ac'),
	ssrdc: i18n.t('plugins.WorkshopPrinting.extruderConfig.solid_state_relay_ssr_for_dc'),
	relay: i18n.t('plugins.WorkshopPrinting.extruderConfig.mechanical_relay_contactor')
};
export function labelKind(kind, ca) {
	return (kinds[kind] || kinds.dc) + (kind === 'relay' && ca ? ' ' + i18n.t('plugins.WorkshopPrinting.extruderConfig.ac_paren') : '');
}
// sensor types (M308 Y): the G-code names are in modefff-edit.js, the texts here
export const SENSOR_TEXT = {
	thermistor: i18n.t('plugins.WorkshopPrinting.extruderConfig.thermistor'),
	pt1000: i18n.t('plugins.WorkshopPrinting.extruderConfig.pt1000_straight_to_the_board'),
	max31856: i18n.t('plugins.WorkshopPrinting.extruderConfig.thermocouple_with_max31856_spi'),
	max31855: i18n.t('plugins.WorkshopPrinting.extruderConfig.type_k_thermocouple_with_max31855_spi'),
	max31865: i18n.t('plugins.WorkshopPrinting.extruderConfig.pt100_with_max31865_spi'),
	linear: i18n.t('plugins.WorkshopPrinting.extruderConfig.linear_analog_input_0_3_3')
};

export const actions = [
	{ value: 0, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.heater_fault_turns_it_off_and') },
	{ value: 1, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.turn_this_heater_off_it_must') },
	{ value: 2, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.cut_it_only_while_exceeded_resumes') },
	{ value: 3, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.turn_off_all_heaters_and_cut') }
];
export const conditions = [{ value: 0, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.if_above') }, { value: 1, text: i18n.t('plugins.WorkshopPrinting.extruderConfig.if_below') }];
