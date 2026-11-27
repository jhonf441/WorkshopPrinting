# DWC 3.7 line: paused

The DWC 3.7 line of this plugin (`dwc-src/`, Vue 3, and `vue/_shared`) is paused: only 3.6 is built and released.

- Only DWC 3.6 (`dwc36/dwc-src/`, `vue/_shared36`, `src/` JS plugins) is developed, built, installed and published. The release has only the `-dwc3.6.zip`.
- The 3.7 line was never run on a real DWC 3.7 (it was only tested without a browser). It stays in the repository as it is and may lag behind the 3.6 line.
- Pure JS modules and i18n catalogs that the parity tests compare (`tests/lines-*`, `python build.py --lines`) are still copied over when it is cheap.
- `build.py` refuses `--dwc 3.7` and leaves the 3.7 zip out of `--dwc both` / `--release` / `--check-release`, unless `--paused-37` is given explicitly.
- Public documents say "DWC 3.6.x only".
- To resume: port the 3.6 components to Vue 3, build with `--paused-37`, test on a real DWC 3.7, restore the 3.7 lines in the public README. See `docs/DWC-LINES.md`.

- UX redesign of Prepare job (2026-11, 3.6 only): these `prepare.*` / `fff.*` keys were retired from the 3.6 catalog and the 3.7 catalog never had them or still keeps them untouched: `apply_zones_title`, `apply_zones_none`, `apply_zone_extruder`, `apply_zone_bed`, `hint_apply_next`, `hint_applied`, `step_changes_title`, `apply_flat_note`, `apply_no_layers`, `fff.p_none`, `fff.refresh`, `fff.loading`, `fff.no_files`. The keys added by the redesign (`prepare.*`, `gcodeLib.selected` and friends, `profiles.use_*`, `fff.none_*`, `fff.last_*`, `util.config_unreadable`) exist only in the 3.6 catalog. Porting this to 3.7 means porting the components and then copying the catalog keys.
- General redesign round 2 (2026-11, 3.6 only), steps 0 to 3: NOT copied to the 3.7 catalog. Added to the 3.6 catalog: `prepare.strip_*`, `prepare.res_*`, `prepare.ready_*`, `prepare.role_operator`, `prepare.role_technician`, `gcodeLib.dwc_files_note`, `gcodeLib.prepare_unreadable_role`, `subjects.library_retry`, `profiles.changes_rules`, `profiles.changes_none`, `profiles.role_edit`, `profiles.role_read`; retired from the 3.6 catalog: `prepare.machine_title`; the value of `prepare.step_start_title` changed (Dejar listo / Get ready). The 3.7 catalog keeps the old state untouched.
- Round 2, step 4: added to the 3.6 catalog `fff.times_dwc`, `fff.see_temps`, `fff.layers_title`, `jobControl.card_control`, `jobControl.card_live`; retired from it `fff.temps_title`, `fff.no_heaters`. Not copied to 3.7.
- Round 2, step 5: added to the 3.6 catalog `printing.heaters_title`, `printing.heat_sum_*`, `printing.heater_now_label`, `printing.heater_target_to`, `printing.heater_bar_label`, `stateChart.starts_on_open`. Not copied to 3.7.
- Round 2, step 6: added to the 3.6 catalog `printing.tool`; retired `fpanel.go_load`; new VALUES of `printing.bed_zones_live`, `head_change`, `pellet_and_zones`, `bed_zones_setup`, `extruder`, `printer_tests`. Section ids `pellet`, `hotend`, `filament` are gone from the 3.6 page (one `tool`). Not copied to 3.7.
- Round 2, step 7b: added to the 3.6 catalog `bedZones.live_empty_title`, `live_empty_ask`, `panel_hint`, `panel_table`; new VALUES of `bedZones.live_define_note`, `live_define_go`. Not copied to 3.7.
- Round 2, step 8 (Tests): added to the 3.6 catalog `commissioning.heats_for_real_note`. Not copied to 3.7.
- Round 2, step 8 (Configure, 3.6 only): added to the 3.6 catalog `headChange.moves_for_real_note`, `pid.heats_for_real_note`, `pid.help_model_*` and `extruder.help_kind_*`, `extruder.help_purge_*`, `extruder.help_flow_*` (what / why / missing / how); nothing was retired; NOT copied to the 3.7 catalog.
