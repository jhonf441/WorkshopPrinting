import i18n from '../../i18n'
'use strict'

// The active risk of the cold extrusion (API risk.start / risk.end of WorkshopService): opened while M302 P1 lasts, closed when it is locked again.
// Print.vue keeps it in step with the REAL state of the board; StateSection.vue opens and closes it when the person allows or locks the cold extrusion.

import { api } from './workshop-api.js'

export const RISK_COLD = 'extrusion_cold'

export const startColdRisk = () => api('risk.start', { id: RISK_COLD, text: i18n.t('plugins.WorkshopPrinting.printing.risk_cold_extrusion', 'es'), text_en: i18n.t('plugins.WorkshopPrinting.printing.risk_cold_extrusion', 'en'), seconds: 3600 })

export const endColdRisk = () => api('risk.end', { id: RISK_COLD })
