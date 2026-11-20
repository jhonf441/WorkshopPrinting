'use strict'

// A file that cannot be read is an ERROR of the store (`printingConfig.error`), not an empty file: the screens say why and nothing is written on top of it.
// The ONE reader and writer of printing.json (0:/sys/workshop/config/printing.json) of this page: the store of config-store.js over util.js. Profiles and Prepare job use it
// (the other sections move to it one at a time); a profile saved in one is seen by the other without reloading.

import { readCfgStrict, updateCfg } from './util.js'
import { createConfigStore } from './config-store.js'

export const printingConfig = createConfigStore(() => readCfgStrict(false), updateCfg)
