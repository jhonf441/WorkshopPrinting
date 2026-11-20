'use strict'

// The texts of Prepare job and of its parts (PrepareStep*.vue, PrepareSummary.vue): ONE way to ask for them, so the parts do not repeat it.
//   tx(key)  a key of plugins.WorkshopPrinting.prepare        px(key)  a key of the pellet layers area (the file label)
//   help(k)  the four parts of the `?` of a row (what / why / if it is missing / how), keys help_<k>_*

export const prepareTextMixin = {
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.prepare.' + key, params || {})
		},
		px(key, params) {
			return this.$t('plugins.WorkshopPrinting.pellet.' + key, params || {})
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		}
	}
}
