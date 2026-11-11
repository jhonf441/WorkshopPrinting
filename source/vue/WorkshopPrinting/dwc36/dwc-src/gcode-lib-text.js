'use strict'

// The texts of the G-code library components (plugins.WorkshopPrinting.gcodeLib.*, es.json / en.json): one mixin so every component asks the same way.
// help(k) = the four lines of a "?" (what it is, what it is for, what you lose without it, how to use it) from the keys help_<k>_title / _what / _why / _miss / _how.

export const libText = {
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.gcodeLib.' + key, params || {})
		},
		// the "?" of the file kinds (gcodeLib.kinds.help_<k>_*)
		helpKind(k) {
			const p = 'kinds.help_' + k + '_'
			return { title: this.tx(p + 'title'), what: this.tx(p + 'what'), why: this.tx(p + 'why'), ifMissing: this.tx(p + 'miss'), how: this.tx(p + 'how') }
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		}
	}
}
