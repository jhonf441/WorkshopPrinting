'use strict'

// WorkshopPrinting -- "3D Printing" page (2026-10-10, request: "build
// the 3d printing plugin"). The machine is a hybrid (Laser / CNC / FFF) with a
// PELLET extruder: there is no filament loading; there is purge and flow
// calibration by weight. Everything it does is normal G-code through DWC (no backend).

import './i18n-register.js'
import { registerRoute } from '../../routes'
import './safe-saving.js' // power cut: save with a backup and in one step (vue/_shared)

import printing from './Print.vue'
import './theme.css'
import './printing-design.css' // the one look of every section (pc-* classes)

registerRoute(printing, {
	Plugins: {
		WorkshopPrinting: {
			icon: 'mdi-printer-3d-nozzle',
			caption: 'plugins.WorkshopPrinting.common.3d_printing',
			path: '/Plugins/Printing'
		}
	}
});

// a bookmark or a link to the old Spanish address keeps working
