# WorkshopPrinting -- historial de versiones

## 2.37.1 -- 2026-11-27

- number fields are 40 px high like the other fields; the status icon of each heater in the commissioning page has a name for screen readers

## 2.37.0 -- 2026-11-24

- family scale: buttons 32 (main 36), touch area 40, rows 48; card head of the family; the heaters of Status as rows of 48
- one help per section at its foot (Tool, Profiles, Prepare job); blocks inside a card are flat groups (title and divider), no gray sub-cards

## 2.36.2 -- 2026-11-23

- optional files are never requested when absent

## 2.36.1 -- 2026-11-22

- select arrows, one focus ring per field, shared family stylesheet split

## 2.36.0 -- 2026-11-22

- One common page bar and 44 px fields

## 2.35.3 -- 2026-11-22

- Rebuild with shared update: start-up card split into modules, neutral Spanish texts, service texts resynced, unused .wf-index rule dropped

## 2.35.2 -- 2026-11-22

- Tuteo in texts (no voseo in es.json).

## 2.35.1 -- 2026-11-22

- Visual review round: single hover and focus for inputs and controls (family styles), 44 px switch and checkbox rows, range picker field 44 px.

## 2.35.0 -- 2026-11-22

- Style unification: compact header with a 44 px health chip, shared unsaved-changes guard in 7 editors (section change and route leave ask first), revealed results, one 'Requires the X role' wording, 44 px chips and fields, bed legend 12 px, nothing under 12 px.

## 2.34.8 -- 2026-11-20

- Bed power card is full width with a shadowed scroll as backup, a note for the short headers and one card per zone on narrow widths

## 2.34.7 -- 2026-11-20

- Bed power table scrolls inside its card instead of being cut, power and insulation cards stack by content width

## 2.34.6 -- 2026-11-20

- Inputs no longer overflow (border-box under the page), labelled fields on one baseline, fluid zone grids, plural of the warnings, folds that look foldable

## 2.34.5 -- 2026-11-20

- Pruebas as a short list, help folded once per section, file select and profile fit narrow widths, What will happen in this file readable at a glance

## 2.34.4 -- 2026-11-20

- Files toolbar in one row with a state list, Prepare job profile field without overlap and 44 px buttons in every step

## 2.34.3 -- 2026-11-20

- Redesign closer to the mockup: compact Tool card, bed zone cards, Files in one row, Prepare job with one folded help, one short line per heater fault, Tests rows in one line

## 2.34.2 -- 2026-11-19

- Redesign polish: Tests sensor wraps, bed badge plurals, sticky Profiles bar with scroll margin for the focused field, help text no longer names another plugin

## 2.34.1 -- 2026-11-19

- Redesign closed against the mockup: Status badge and bars with target mark, bed zone cards, current job side by side, profiles without inner scroll, Tests as a list with four-part help, Extruder zones in folding sub-cards, one empty state in Files, PID without connection state

## 2.34.0 -- 2026-11-18

- General redesign: one Tool entry, new menu names, compact heater rows with series marks, Prepare job in folding steps, Files and Profiles states by role, current job empty state, one double tap and one result line everywhere, every Configure section in the same pattern

## 2.33.0 -- 2026-11-18

- Prepare job redesign in four steps (File, Profile, Review, Start), honest Apply, role from the first step, Use in the job, current job empty state, one shared printing.json, unreadable printing.json and no-answer states

## Unreleased

- Round 2.34.8, power estimate of the bed: the power and insulation cards take the whole width and sit side by side only from 1200 px of content (the five columns of the table fit without scrolling), the table keeps its scrolling region as a back-up with a shadow at the edge that has more, a note under it explains the short headers (Energy, Hold, Heat) for touch and keyboard, and under 640 px of content each zone is a card with label and value instead of a scrolling table
- Round 2.34.7, power estimate of the bed: the results table scrolls sideways inside its own focusable region (nothing is cut), with short headers (Plate, Energy, Hold, Heat) whose full names are the title, numbers and "Zone 1 3082 cm2" on one line; the power and insulation cards sit side by side only from 880 px of content and stack below it
- Rows of labelled fields share one baseline: the power estimate of the bed (the fourth field had a two-line label and its box sat lower), the layout editor, the zone settings and the nozzle change use one row class (grid of equal cells, each box at the bottom of its cell); a test fails when a row of two or more fields is a bare flex or grid
- Round 2.34.6, the rest: the border-box rule is under the page and its own dialogs only (it hung from the family class, which the other plugins share); the fields of a zone of the extruder (heater, sensor, monitors) are a fluid grid of 180 px cells instead of columns of fixed width, so none overlaps or is cut at any width; the target of each zone in the PID table of all zones is a real outlined field of 120 px with the unit, a suggested value and the cap as a small line below
- Round 2.34.6, file preview: "See 1 more warning" is drawn with the real plural (it showed the raw "1 aviso | n avisos" string), the layer range fields say All and the unit and start at the left, and every folded block looks foldable (a soft box with a chevron that turns, normal weight)
- Round 2.34.6: the input boxes of the page (selects, autocompletes, text fields, outlines, toggles) are border-box, so they no longer come out 24 px wider than their container and over the next control ("Edit the profiles" over the profile select, the folder button over the file select, the range fields of the file preview); the chips under the profile select have one gap and no margin of their own
- Prepare job, step Review ("What will happen in this file"): clear title and sentence, four small figure cards (temperature lines, changes by layer, layers, material) and a color legend (bed orange, extruder blue, "sent here" accent) used in the listing; the filters are one wrapping row with a label above each field (140 px, no overlap) and a toggle with icons; the summary is chips with singular and plural ("1 cambio"); the lines of the file are folded (open only with a conflict); each change shows "what the file asks" and "with the material" as two cards with an arrow, and the box of what would be sent is dotted with a clear title; ONE yellow warning with the rest behind "more"
- Prepare job, step File: the file select shrinks and the folder button stays inside the card (the field had a 240 px minimum and took the whole line, pushing the button out), the preview of the file card goes under the info in a narrow content, and the loose question marks of the step are gone (one folded help)
- Round 2.34.5: the question marks of the rows of Extruder and flow, PID, the bed setup and the calibration are drawn once, folded, at the end of each section ("Help of this section", the four parts kept); the step text of a Tests row is at most two lines with See more and the warning is one short sentence; Profiles stacks by the width of the content, not of the screen
- Prepare job: the buttons of the four steps are 44 px (the rule lived in a scoped style of the parent and never reached them; it is global now), and the profile select no longer pushes "Edit the profiles" over its edge (the field takes up to 280 px and shrinks); a test fails when a child uses a class that only its parent defines in a scoped style
- Files, round 2.34.4: the three states of the mockup (With files, No files, Service not answering) as a plain list, the one that applies lit by what the service says, the type chips are the Type select of ONE toolbar row that spans the page (search, sort, type, folder; it stacks below 640 px of content), the list sits beside the preview in one grid, and with no file chosen the preview is a short box
- Round 2.34.3, closer to the mockup by showing less: the pellet Tool is a compact card (zones as dots with their temperature, motor test and feeding) with the drawing and the panels of the parts folded under "See scheme and settings"; the live bed shows zone cards with a bar and the zone panel first, with the map and the table folded under "See map and table"; Files has search, sort and kind in one row, folders as a select, no loose help marks and one empty state; Prepare job has one folded help for the steps instead of a question mark in each, and the done check is green; a heater in fault shows one short line, the sensor sentence and Clear fault go behind See more; long messages of the Tests rows are one line with See more
- Round 2.34.2, Pi comparison: the long reading of a sensor in Tests wraps inside its row at medium widths; the bed badge says "1 zona" / "n zonas" (and "1 con alerta") and the folded zone table is not drawn without rows; the Profiles bar Save / Duplicate / Delete / Use is sticky at the bottom so it is in reach with a long editor; a job running or paused keeps its tracking card (test added)
- Tests: every row has its four-part help (what it is, what for, without it, how), and the heating sentence says "falta 1" / "faltan 2"
- Round 2.34.1, audit of the mockup: the six parts of Zones of the extruder are folding sub-cards instead of internal tabs; the PID current model says there is no connection instead of Reading forever; the bed zone panel shows the limit and says turning off is never blocked; the Tool head has its lead sentence; speed and flow of the current job have a slider beside the number (Apply still sends); the heater row See more is a small button and the bar label says the target
- Round 2.34.1, closing the differences with the approved mockup: Status head carries the "Heating: n of m" badge and a lead sentence, the heater bar has a target tick and a cap mark, a sensor message is one line with See more, and the extruder type shortcut moved to Tool; the live bed shows the "n zones, all fine" badge in its head and one card per zone under the map; Controlar and Ajustes en vivo of the current job sit side by side from 880 px with short four-part helps and a role chip instead of the state chip; Files has one empty state and a Ready badge per file; Profiles has no inner scroll, New on top of the list and Save / Duplicate / Delete / Use in one bar under the profile; Tests is a flat list with a dot, a result line and Done / Check / Next / Guide chips and an "n of m tests ready" bar (no Previous / Skip / Next / Close row); Configure section heads carry the Technician chip, Pellet and zones gets the common head, the tool title no longer repeats "extruder", and Extruder and flow does not repeat the temperature notice of Status
- Internal: the State section moved out of the page shell into its own component, and a shared job draft (file + profile) was added for the Prepare flow; nothing changes on screen
- Prepare job, step 1: one line of state under the file card instead of fixed gray sentences; without a file, one box with a "See the files" button; the pending step circle is darker (contrast)
- Prepare job, honest Apply: a profile without changes during the print has no Apply button and no duplicated zone list, one note says the file temperatures rule during the job; step 3 is done when the comparison was read; inside Prepare job the words are Apply / Remove and the state is Applied / Not applied
- Prepare job has a fourth step, Start: folder and file as DWC Jobs shows them, Copy path, what happens with the changes during the print, and an Open DWC Jobs button (navigation only, the page never starts a job); the step is done only when the machine is printing that file
- Prepare job says the role from the first step: one reason for Apply under the stepper (technician) and one line of what the current role can do; an operator can go on to Start without applying; with nobody signed in the section shows the session cover instead of an empty flow
- G-code library: a selection line above the panes with a Prepare this file button (one tap takes the file to Prepare job, at every width; off with its reason for laser / CNC files, unreadable files and outside FFF); the empty list says where files come from; the choice travels in a shared job draft that is cleared when the session changes or that job ends
- Profiles has a Use in the job button (it leaves the saved profile chosen in Prepare job, nothing is heated or sent; off with its reason while there are unsaved changes); Prepare job lists the profiles of the current tool kind first, marks the one whose nozzle temperature is within 15 C of what the file asks (Matches the file, a suggestion: never chosen by itself, nothing is said when the file has no temperature), asks for the profiles again each time it is shown, and says who to ask when there are no profiles
- Prepare job says what is applied against what was chosen: changes applied for another file or profile are named with the file (Apply is off, Remove is on), changes turned off by themselves say why for this file, and changes this page applied that are gone (the service restarted) say so with Apply again; a file that changed on the card since it was read reopens the review with Read again (checked when the section is shown, before Apply and when Start is reached, never on a timer; a stale reading is never applied); Start says when the file is being simulated and when another job without a file is running; the same file on another drive is not the same file; pending steps keep full-contrast text
- Current job (Trabajo 3D): with nothing running one box says what to do (Prepare a job, Open DWC Jobs) and, for a 3D print file the library knows, how the last job ended (finished, cancelled, interrupted with a pointer to Status, simulation): neutral, never red, no cause; the old gray "No print running" line is gone
- Current job (Trabajo 3D): the file field is the same select as Files and Prepare job (one list of files for the whole page; the plugin's own directory listing and Refresh button are gone); the view opens files whose name has # or ? and no longer opens a file of another drive by mistake
- Internal: Profiles, Prepare job and Preheat read and write printing.json through one shared copy (printing-config.js): a profile saved in Profiles is in Prepare job without reloading the page; the format of the file does not change (the other sections move over one at a time)
- Status: Turn off all heaters moved up, right under the bed and chamber lines and before the heater cards (one tap, 44 px), so it is on screen without scrolling even with four heaters; when a heater has a bad sensor the reason Clear fault is off (fix the sensor first) is written under the card, not only in a tooltip
- General redesign, step 0: the tool selector (shown with more than one tool) moved from the State section to one thin strip of the page shell under the header, so it is in reach from every section; the tool it picks still applies to every section. Internal: shared building blocks for the next steps (grids that answer to the width of the content, sub-cards, rows, steps, facts, progress bar, empty state, a slot for the state or role at the right of a section head); nothing else changes on screen
- General redesign, step 9a (internal): one double tap (4 s, arms on the first tap, a second thing disarms the first) and one result line next to the action, as modules with tests; no section uses them yet, each one moves over in its own step
- Prepare job (general redesign, step 2): a strip of four data at the top (file, profile, changes by layer, your role); the four steps are folded blocks with a numbered circle, a result on the right and the current one open (nothing is closed for you and a folded step keeps working); the last step is now Get ready (Dejar listo) with two blocks, Preheat (operator) and Apply the changes by layer (technician, only when the profile has them), the facts of what is prepared and the button that opens DWC Jobs (this page still never starts the job); the colors of the steps come from the theme. Internal: PrepareJob split into PrepareSummary, PrepareStep and one part per step (props down, events up)
- Files and Profiles (general redesign, step 3): a file being read says it with the blue state dot (no blue bar); a file that could not be read shows what happened with Retry only for who may ask the service again, and the others read the role in words (the Prepare button no longer says to press Retry to a role that has no Retry); a fixed note says uploading, deleting and renaming files is done in DWC Jobs, with a button that opens it (navigation only); a profile says its rules in one line (how many, or that the G-code rules) and its row says the role (technician edits and uses, everybody else sees and uses)
- Current job (general redesign, step 4): a tracking card (the file, the state with its dot, a progress bar and the facts: layer, Z, elapsed and remaining as DWC reports them) replaces the table of temperatures, which are one link away (See temperatures, Status); Control (pause, resume, cancel) and Live adjustments (Z, speed, flow) are two cards with ONE reason for both and the one double tap of the page (cancel still only while paused, nothing is offered while pausing, resuming or cancelling); the layer view has its own card; with nothing running the empty state has an icon, a sentence and the way on; the result of an action sits next to its buttons
- Status (general redesign, step 5): the heaters are compact rows (name, now, target, a thin bar with the cap, the state as a dot and a word; numbers in mono 14, no big readings) under ONE line of state (Heating: 1 of 4 still to reach the target, At temperature, With a fault, All off), counted with the same classification and tolerance as the job page; Turn off all heaters sits right under the list; the chart says it starts when the page opens; Fans and Cold extrusion are two cards (cold extrusion keeps its level 4 notice and Understood); How it is configured is folded and holds the bed and chamber lines; the result of an action is one line next to its button
- Menu (general redesign, step 6): Panel del pellet, Panel del filamento and Cargar material are ONE entry, Herramienta (Tool): it shows the pellet panel, or the filament panel with the load under it, by the kind of the tool seen, and a viewer sees it read only; changing the tool no longer takes you out of the section; names: Cama (en vivo), Cabezal y modo, Zonas del extrusor, Zonas de la cama, Extrusor y caudal, Pruebas (Trabajo en curso was already so); the id of a section saved in the browser by the old version opens Status once (no table of old ids); the Load button inside the filament panel is gone (the load is on the same page)
- Tool (general redesign, step 7a): the entry is ONE card with ONE head (Herramienta, the tool and its kind at the right); the pellet panel and the filament panel with the load are parts inside it, each with its title and its ? (no head of their own); the big readings (zone, flow, fan, motor) are mono 18 at most; the double tap and the result of an action are the ones of the page; every control and every function stays (the pellet figure, the layer and hotend fans, the flow, the feeding)
- Bed (live) (general redesign, step 7b): the map and the panel of the chosen zone (now, target, its setpoint with the double tap) are side by side, the table of every zone is folded under the panel (all the data stays in the page); with no zones the empty state names the way on: a technician has the button to Bed zones, the others are told to ask a technician; the double tap and the result of an action are the ones of the page; Configure (bed zones) is untouched
- Internal (general redesign, step 9b, first part): the copies of the double tap in Extruder, the pellet feed, motor and fan forms and the printer tests were replaced by the one of the page (same 4 s, same texts; nothing changes on screen); the copies in the head change, the layer rules, Preheat and Apply remain
- Tests (general redesign, step 8, first section): ONE notice on top says these tests really heat and turn parts on; "n of m done" has a bar that says its value; the numbered circles are outlined (green done, red a problem, no white icon on a fill); the colors come from the theme; the result of an action is one line; the tests themselves, their order and what they save do not change
- Status chart (general redesign): each series has a shape (circle, square, triangle, diamond) at the end of its line and in the legend, so the heaters are told apart without color; the line types keep their meaning (solid temperature, dashes target, dots cap)
- Prepare job: with a profile WITHOUT changes the page also asks the service what is applied; if changes of another profile are applied for the same file it says so with a Remove button (any role) instead of saying the file temperatures rule, and the summary of the last step agrees; for a laser / CNC file the sentence that says it is not a 3D print appears once (step 1) instead of repeating with a raw {kind}
- Profiles and Prepare job: when printing.json cannot be read (network, permission, a file that is not valid JSON) the factory profiles are no longer shown in its place; the cause is shown with a Retry button, Profiles opens read-only and nothing is saved over the unreadable file (a file that does not exist yet is still a fresh machine)
- Prepare job: the Applied chip no longer stays when the service stops answering; after two polls (about 6 s) without an answer it says No answer, the last layer and file it read are not shown as current, Apply waits and the summary of the last step says it is not known; a good answer brings it back
- Wording: the start help no longer says DWC starts the job with its own checks (the page prepares, the job is started in DWC Jobs); the Files section speaks to you as tu everywhere (help of the page, search, sort, legend, zoom, layer slider, info, picker, folders, intro); the English text of the turned-off layer profile names {recipe} like the Spanish one
- Names (step 12, authorised by the owner): the section Trabajo 3D / 3D job is now Trabajo en curso / Current job and Biblioteca de G-code / G-code library is now Archivos de trabajo / Job files (menu, card titles, picker and help titles); only texts, the section ids do not change; the Profiles intro no longer names printing.json (the path moved to the help of Save); README (es and en) updated
- Configure (general redesign, step 8): Head change, Extruder and flow, PID, Pellet zones, nozzle change and the bed zones setup follow the same pattern as Printer tests: one note on top where the steps heat or move, "n of m" with a bar that says its value, numbered outlined circles, the result as one line next to the action, notes and states from the family (no colored boxes or colored text), titles of 14 and the help "?" of four parts on the new sub-cards (Extruder type, Purge, Flow, PID model). Nothing that is written to the machine changes
- Internal: Extruder configuration and PID split into parts (connector list, sensor fields, all-zones panel; the writes of modefff.g stay in their page) with characterization tests of the text they write; Head change, PID, Layer rules, Recipe run and Preheat use the one double tap of the page; the rest of the sections lost their inline gaps, colored boxes and subtitle sizes

## 2.32.15 -- 2026-11-17

- Back to the previous look: the family design pieces of the last rounds are removed (steppers, docks, big readings, token fills)

## 2.32.14 -- 2026-11-13

- Whole plugin on the family design: steppers for the guided flows, docks for action rows, big readings, machine codes, tokens, shortcut to Prepare job

## 2.32.13 -- 2026-11-13

- Outside FFF the big card with its own mode switch is replaced by the one thin mode note; the switch lives in the control bar

## 2.32.12 -- 2026-11-13

- Prepare job pilot ends on 2026-12-15 and hides the section number circles while the stepper shows

## 2.32.11 -- 2026-11-13

- Prepare job pilot: Preparar, Revisar and Enviar stepper with a dock of 48 px buttons; step circles on the family fill tokens

## 2.32.10 -- 2026-11-13

- Access notices name what they lock (JS and Vue), locked covers say which section they cover

## 2.32.9 -- 2026-11-13

- Safe state and accent colors moved to family tokens; off-scale sizes and monospace fonts aligned

## 2.32.8 -- 2026-11-12

- Session reconcile, access notices name what they lock, kiosk native number keyboard

## 2.32.7 -- 2026-11-12

- Kiosk PIN: read-only field and number pad only, no full keyboard

## 2.32.6 -- 2026-11-11

- User report 2026-11-11: shutdown without session, kiosk PIN pad, hive confirm color, wheel release and Z keys, version in every page bar

## 2.32.5 -- 2026-11-11

- Note says someone changed the temperatures

## 2.32.5 -- 2026-11-11

- The note "the G-code changed the temperatures" (shown when the board holds other temperatures than the profile sent, from the G-code or by hand) now says someone changed them and that the profile does not insist until its next change.

## 2.32.4 -- 2026-11-11

- Spanish wording fixes in the Prepare job preview

## 2.32.4 -- 2026-11-11

- Prepare job, step 3 (Spanish): "dondel perfil" is now "donde el perfil" in four texts; the change counts read "Cama, cambios: 1" instead of "1 cambios"; the note about the base temperature says the file does not set every zone of the track; the armed-profile messages agree in gender (activado, desactívalo). New test for glued words and agreement in the Spanish catalog.

## 2.32.3 -- 2026-11-11

- Prepare job: the profile list showed the path of a missing text (`prepare.kind_filament`) next to every profile; the type chips (Pellet / Filament) have their text. New test for the keys the Profiles and Prepare job screens build at run time.

## 2.32.2 -- 2026-11-11

- The reasons the service gives for a live change that stopped (turned off by a person, job ended, board refused it, heater fault, ...) and the notes of the live state now have their text in both languages; the redesign had left the page showing the name of the key (`plugins.WorkshopPrinting.pellet.layer_recipes_off_by_user`). A test now compares the keys the service can send with the catalogs.
- Spanish wording of those messages in the language of profiles (el perfil, no la receta).

## 2.32.1 -- 2026-11-11

- Prepare job: the hints of the file step say to choose a file from the list (they still said to type the name).

## 2.32.0 -- 2026-11-11 (profiles and prepare job redesign)

- Wording: the word "recipe" (receta) is gone from the interface in Spanish and English. The material is the profile ("Perfil"); the optional per-layer part is "Changes during the print" ("Cambios durante la impresión"); the job screen is "Prepare job" ("Preparar trabajo"). The service API and its operation names (layerrecipes.*) and the storage are untouched; a test fails if any catalog value says receta / recipe.
- Side bar, Prepare group, in the order of the flow (files, then the profile, then the job): Library of G-code, Profiles (was Materials), Prepare job (was Material and G-code). Section ids are now `profiles` and `prepare` (a section id saved by the old version falls back to the first section).
- Profiles page (new, replaces the dense Materials table): master-detail. Left: the list of profiles (name, type chip pellet / filament, one line summary nozzle / bed, "Changes" chip) with New, Duplicate and Delete (Delete asks to confirm and says when the changes during the print go with the profile); on a narrow screen the list becomes a select above the editor. Right: the editor in three flat sections, nothing nested in a row dropdown: Basics (name, type, nozzle, bed, chamber, fan, density), Temperatures by zone (extruder and bed zones; an empty zone keeps the nozzle plus stagger rule) and Changes during the print (an on / off switch, off by default, that reveals the per-layer editor with its shapes, deltas per zone and absolute caps). Every field has its help; the Preheat button and the save bar keep their roles and rules.
- Duplicating a profile that has changes during the print copies them under the new name when saving (rename still moves them, delete still removes them; a name that already has changes is a clash and nothing is saved).
- Prepare job page (replaces the Material and G-code page): one page with a header stepper and three steps, each with a done / now / pending state, one sentence of help and an empty state that says what to do: 1 Choose file (the library select), 2 Choose profile (select with type and summary), 3 What changes (the file next to the profile, by zone and by layer, with the highlighted G-code lines; read automatically once file and profile are chosen) with the buttons Preheat and Apply. Apply arms the changes during the print for this job with the existing double tap; a profile without them only confirms that the job will use its zone temperatures. A laser or CNC file stops the page with a sentence. A collapsed "How it works" at the top explains the three steps.
- New pure modules with tests: prepare-steps.js (which step is current, done or blocked), profile-list.js (names, new, duplicate, delete, rows of the list) and the link plan of material-profile.js now also copies. The retired recipes card (LayerRecipes.vue), Materials.vue and their catalog keys were removed; the Preheat logic moved to ProfilePreheat.vue and is shared by both pages.
- Tests: sections, roles, material-profile and the render tests were updated; new tests for the steps, the list, the wording (no recipe / receta, es/en parity, no dead keys, help on every field).

## 2.31.2 -- 2026-11-11

- Library 3D view: while the camera moves it draws up to 60 layers (was 10) and 30000 segments per frame (was 12000), so the piece keeps its shape when rotating; at rest it is still full detail.

## 2.31.1 -- 2026-11-11

- Library 3D view: on screens with a display scale (125 % and similar) every frame now clears the whole canvas and draws in CSS pixels; before, only part of the bitmap was cleared and the picture was drawn smaller and off centre, which left traces while rotating or moving.

## 2.31.0 -- 2026-11-11

- Job file select ("Material y G-code"): the file can only be chosen from the library list; no typed paths. Without a library in the service the select stays empty and says so.

## 2.30.0 -- 2026-11-11

- Bed zones calibration assistant: the service does the work. Preheat the zones in order with a stagger, hold, then turn them off; tune the PID (M303) of one zone or all in order, with the neighbours held; stop turns every zone off. Confirmation that names zones and temperatures, technician role, bounded temperatures, audit.
- Saving: the M307 model and the M143 cap of each bed heater go through the plan of the configuration (exact diff, snapshot, restart note); offsets through the bed zones settings. No more G-code blocks to copy and run by hand.

- G-code select (GcodePicker, 3.6 line): the job's file can only be chosen from the library list; no free text and no typed paths. Typing only filters the list. With a service that has no library the select stays, empty, and says so (it used to turn into a plain text field). New text `picker2.unsupported` in both languages.

## 2.29.2 -- 2026-11-10

- Library: slider track fix and orange for files without types

## 2.29.1 -- 2026-11-10

- Library: the layer slider track no longer collapses to zero height

## 2.29.0 -- 2026-11-10

- G-code library: whole model with progressive layers, no overflow in the card, service thumbnails

## 2.28.0 -- 2026-11-10

- G-code library: 3D view with configurable camera, file kinds (print, laser, CNC, test) with filters, job file select; side bar in Operate, Prepare and Configure; bed zones split in live and setup

## 2.27.0 -- 2026-11-10

- G-code library page, picker and info card; whole-bed insulation test

## 2.26.1 -- 2026-11-10

- Material and G-code: a material without layers reads the file with a flat recipe of its zone temperatures

## 2.26.0 -- 2026-11-10

- Material is the single profile: type, zone temperatures and optional per-layer block in Materials; Material and G-code page

## 2.25.0 -- 2026-11-10

- Recipes relative to the G-code (Printing), session role switch and UI fixes (26), SD layout manifest

## 2.24.0 -- 2026-11-09

- SD layout: mode files move to sys/workshop/modes, hook macros, templates for air assist, status LEDs and CNC buttons, bar buttons with a missing macro locked, unmigrated modes notice

## 2.23.0 -- 2026-11-07

- Layers and G-code section: the viewer of what a recipe will do in a job file, with its own place in the side bar

## 2.22.0 -- 2026-11-07

- UI fixes from the 18 screenshots: session and role locks, floating camera and Jog, Model colours, bed editor, calibration assistant

## 2.21.0 -- 2026-11-07

- Recipes of temperature by layer (extruder and bed tracks, shapes, run panel, G-code viewer), power estimate and insulation test in bed zones, editor ruler and guides

## 2.20.0 -- 2026-11-07

- Bed zones: smart tidy-up that keeps the sizes and the order the user set (preview, apply, undo)

## 2.19.0 -- 2026-11-06

- Bed zones: edit on the map page, align, distribute and make equal, no automatic layout

## 2.18.0 -- 2026-11-06

- Bed zones with real geometry (auto and manual layout) and pellet temperature by layer

## 2.17.8 -- 2026-11-06

- Refusals: the sign-in chip and only the note nearest to the touch blink; a reason fits its text so the blink rings the words

## 2.17.7 -- 2026-11-06

- Side bar and session: the bar follows the session, the real icon with a small lock, the needed role under the name; a page follows a sign-in made in another tab

## 2.17.6 -- 2026-11-06

- Roles y permisos: una razon por grupo, rechazos nunca en rojo, controles bloqueados visibles, secciones con candado, permisos con allow/deny

## 2.17.5 -- 2026-11-06

- Macros of sys/workshop/macros are now in folders (axis, zcal, focus, work, guard, laser, probe, system); install together with the service and the SD migration

## 2.17.4 -- 2026-11-06

- Beds: define the first zone first, bed limit from the board

## 2.17.3 -- 2026-11-06

- Filament extruder panel in Operate: heater, flow, layer fan and hotend fan

## 2.17.2 -- 2026-11-05

- QA batch: 3D view resets per file, draws the bed for a file with no layers

## 2.17.1 -- 2026-11-05

- Bed zones: offers the beds the board defines, live preview of the form, one bed is one big centered square

## 2.17.0 -- 2026-11-05

- Bed zones: the beds the board lacks are defined in Machine, the map grows with the zones (limit of eight, with a counter) and the color scale is explained

## 2.16.1 -- 2026-11-05

- Bed zones: a sensor that is not connected shows as no reading, not as a freezing bed

## 2.16.0 -- 2026-11-05

- Bed zones section: map, setpoints per zone, settings, bed assistant and backup macro (needs service 2.23.0)

## 2.15.29 -- 2026-11-05

- Session state, refusals and notices unified; errors kept as objects; 403 names the action

## 2.15.28 -- 2026-11-05

- Session notices and help standard: one voice for sign-in and role refusals, shared help tips, identity change resets what the session showed

## 2.15.27 -- 2026-11-05

- Darker primary button hover, Workbench save label, generic RS485 notes

## 2.15.26 -- 2026-11-05

- Sign out no longer reopens the PIN dialog

## 2.15.25 -- 2026-11-04

- Rebuilt with the readable text colours, the shared start-up card and the session notice

## 2.15.24 -- 2026-11-04

- SideTabs: rebuilt with the side bar fix (the v-for template was missing)

## 2.15.23 -- 2026-11-04

- ErrorNotice: no second sign-in notice (the page bar chip says it)

## 2.15.22 -- 2026-11-04

- Start-up card locked without a session; shared help tip; session chip class

## 2.15.21 -- 2026-11-03

- Session: standard login notice (shared ErrorNotice)

## 2.15.20 -- 2026-11-03

- Charts: the unit label no longer overlaps the top value of the Y axis

## 2.15.19 -- 2026-11-02

- 3D view: view buttons and mouse work with no job

## 2.15.18 -- 2026-11-01

- Printing: the 3D view shows the bed and a clear empty state instead of a grey box, and says so when the canvas is not available

## 2.15.17 -- 2026-10-31

- Lot 2: one relay client, camera client folder, single gallery, one presence helper, shared resources released at the last plugin, flash for the operator

## 2.15.16 -- 2026-10-31

- Hides what names a plugin that is absent; a plugin is active only by the machine list

## 2.15.15 -- 2026-10-30

- Job control cancel only while paused, heat block without tool select, preheat with material, screw motor opens Machine for acceleration, jerk and speed

## 2.15.14 -- 2026-10-30

- Job control (pause, resume, cancel, baby steps, speed and flow factors) and load material for filament tools

## 2.15.13 -- 2026-10-30

- The side bar scrolls inside when it is taller than the window

## 2.15.12 -- 2026-10-30

- Zone cards closed until opened; bed and chamber heating line; tool selector

## 2.15.11 -- 2026-10-30

- The extruder type is a choice of each tool (pellet or filament), with a tool selector when there is more than one; the charts no longer register the zoom plugin for every chart of DWC

## 2.15.10 -- 2026-10-30

- Screw motor assistant (acceleration, jerk, top speed, retraction); the feed select is readable in the dark theme

## 2.15.9 -- 2026-10-30

- Pellet feed select readable in the dark theme; Power: scanned meters already set up open their card, the test sends no name, history empty state with icon

## 2.15.8 -- 2026-10-30

- Manifest: sbcRequired true (needs WorkshopService); side bar keeps the group names

## 2.15.7 -- 2026-10-30

- Manifest: sbcRequired true (needs WorkshopService); side bar keeps the group names

## 2.15.6 -- 2026-10-30

- Side bar: group names stay visible when folded and in the narrow layout

## 2.15.5 -- 2026-10-30

- Status: extruder type line with a Change button

## 2.15.4 -- 2026-10-30

- PID: a switched-off machine is reported as off, not busy

## 2.15.3 -- 2026-10-30

- Pellet panel: long zone state texts shortened in the vertical layout

## 2.15.2 -- 2026-10-30

- Materials limit follows zone 1; pellet panel zone cards without overlapping text

## 2.15.1 -- 2026-10-30

- PID: the heater model reaches the detail view (was always 'no model')

## 2.15.0 -- 2026-10-30

- Extruder type setting: pellets or filament (filament hides the pellet pages and adapts the flow calibration)

## 2.14.4 -- 2026-10-29

- Phone layout fixes (44 px touch targets, no overflow), Workbench full-screen section picker, clamps hint, interrupted jobs off the table, Machine scale label

## 2.14.3 -- 2026-10-29

- Audit and UX fixes: Jog owns workzeroaxis.g, restart notice with time, shared pulse table with update and download, side bar tooltips, spacing, wider field

## 2.14.2 -- 2026-10-29

- State chips with an icon: the icon carries the color and there is no dot (family.css); chosen chip tinted

## 2.14.1 -- 2026-10-29

- PID chart read from the service (any screen), Activity shows its active filters, health state without the duplicate icon

## 2.14.0 -- 2026-10-29

- PID: real chart of the tuning (temperature, target and power measured while M303 runs) with the explanation of how the model is calculated

## 2.13.1 -- 2026-10-29

- Fix: the page froze (the start-up panel and the page called each other on every render)

## 2.13.0 -- 2026-10-29

- Side bars: no gray line, a chosen item goes to the start of its section; Printing: start-up chip without the mode rows, tests notice only when the chip is not green, no-sensor fault reading; Vision: settings cards packed in columns, laser crosses only with Laser mode; Zones: visible mode dot

## 2.12.15 -- 2026-10-28

- Design family: final shared styles

## 2.12.14 -- 2026-10-28

- Design family: page bar with lead, one card per section (no card in card), pellet setup top bar is now a plain section head, family tabs; printing-design.css keeps only the content

## 2.12.13 -- 2026-10-28

- Polish: long notes collapsible, outline buttons and chips, no shadows, neutral alerts

## 2.12.12 -- 2026-10-28

- Minimalist design: neutral cards with a 2 px section line, text tabs with a colored underline, flat sub-blocks, plain gray help lines, outline buttons, dot and word states

## 2.12.11 -- 2026-10-28

- Zone forms: Beta, R at 25 C and Coef. C keep a minimum width, rows wrap instead of cutting the value

## 2.12.10 -- 2026-10-28

- Printing: one look for every section (shared design sheet, section headers, colored zone forms, cards of feeding, fan and nozzle change)

## 2.12.9 -- 2026-10-28

- Pellet setup: colorful and friendly design

## 2.12.8 -- 2026-10-28

- Pellet setup: colorful and friendly design as in the approved mockup

## 2.12.7 -- 2026-10-28

- Pellet setup: PID of all the zones inside Heat zones; cards, tiles and picks as in the mockup

## 2.12.6 -- 2026-10-28

- Pellet setup redesigned: zones as cards, section strip, one PID action for the coupled zones

## 2.12.5 -- 2026-10-28

- Risk dialogs get their colored side bar back; one type scale (Roboto in the panels, no half sizes)

## 2.12.4 -- 2026-10-28

- PID: say why Calibrate is locked (heater in fault, temperature, busy machine)

## 2.12.3 -- 2026-10-27

- Plan warnings in words, risk dialogs in DWC style, mesh point selection, link to Machine modes

## 2.12.2 -- 2026-10-27

- Side bar no longer makes the page jump when a shorter section is chosen; start-up chip as in every page (header, same wording)

## 2.12.1 -- 2026-10-26

- Run-time guard: the 3.6 build refuses to start on a host with window.DWC and the 3.7 build outside DWC 3.7.x (visible warning); shipped as a strict per-line zip (dwcVersion 3.6 / 3.7)

## 2.12.0 -- 2026-10-26

- Modes the machine uses: the start-up card asks once which modes you use (FFF / Laser / CNC) and only shows the steps of those; guide step by step; no head change on a machine with one mode

## 2.11.28 -- 2026-10-26

- A sensor with no data is no longer shown as a fault

## 2.11.27 -- 2026-10-24

- Printing: FFF switch ignores an all-commented macro, one-row Preview and Back, same navigation buttons as the other assistants; Camera: orientation asks Vision through the service

## 2.11.26 -- 2026-10-24

- Start-up assistant: active lines highlighted, single-step way back, dark select options; Lights time picker and defaults; Printing FFF switch; Mesh handles above the points

## 2.11.25 -- 2026-10-24

- Machine mode files as examples with an assistant per mode file and a config.g check

## 2.11.24 -- 2026-10-24

- Start-up card reports its pending count to the service (machine setup list)

## 2.11.23 -- 2026-10-24

- Mode assistant: RRF's own mode plus global.selectedMode by default; the own sys/mode file only if it exists

## 2.11.22 -- 2026-10-23

- Follow a sign-in or logout made in another tab

## 2.11.21 -- 2026-10-23

- One sign-in for every tab (token in localStorage)

## 2.11.20 -- 2026-10-23

- Header: no health chip while signed out

## 2.11.19 -- 2026-10-23

- Compact live job strip in the bar; page header treats an expired session as sign in; numeric PIN field

## 2.11.18 -- 2026-10-23

- Page header asks who is signed in; PIN field is numeric

## 2.11.17 -- 2026-10-23

- Common page header: health chip, session chip, quiet start-up icon when ready

## 2.11.16 -- 2026-10-23

- Side bar sections no longer overflow the page on narrow screens (under 900 px)

## 2.11.15 -- 2026-10-22

- Side-bar pin only while the bar is open; Lights panel counts only the faults the service marks

## 2.11.14 -- 2026-10-22

- Pin on every side bar, thin scrollbars, one sign-in dialog

## 2.11.13 -- 2026-10-22

- Sign-in never opens by itself; keyboard only on touch

## 2.11.12 -- 2026-10-22

- Fix names, values and catalog markers the English rename left behind

## 2.11.11 -- 2026-10-22

- Sessions made clear: not-signed-in chip, sign-in on visitor 403, refusal toast

## 2.11.10 -- 2026-10-22

- Sign-in dialog focus and kiosk keyboard helper; Jog blocked touches explained

## 2.11.9 -- 2026-10-22

- Kiosk keyboard helper call, sign-in dialog font

## 2.11.8 -- 2026-10-22

- Jog and bars tell why an action is blocked and ask for the session; Jog loses the Machine pointer sections

## 2.11.7 -- 2026-10-22

- Sign-in dialog redesign and on-screen keyboard; single floating panel for power actions; risk bar on one line; Jog gear and scrollbar; side tabs transition

## 2.11.6 -- 2026-10-21

- PIN sign enters by itself when the PIN has the length that worked last time

## 2.11.5 -- 2026-10-21

- Side bar: pin next to the fold arrow keeps the bar open

## 2.11.4 -- 2026-10-21

- Register the fitted nozzle and keep its calibrations

## 2.11.3 -- 2026-10-21

- Advance note, CAN timeout is a failure

## 2.11.2 -- 2026-10-21

- Pressure advance restored at start (M572 in modefff.g)

## 2.11.1 -- 2026-10-21

- Nozzle section lists the saved profiles

## 2.11.0 -- 2026-10-21

- Per-nozzle profiles: flow, PID and pressure advance

## 2.10.1 -- 2026-10-21

- Nozzle change fields wider

## 2.10.0 -- 2026-10-21

- Nozzle change assistant in the pellet setup

## 2.9.0 -- 2026-10-21

- Pellet setup is its own view (zones with order, fans, feeding, motor, panel layout); the panel only operates; head change does not take an unreadable nozzle sensor as cold

## 2.8.4 -- 2026-10-21

- Pellet panel: throat label clear of the throat fan

## 2.8.3 -- 2026-10-21

- Pellet panel: throat fans to the right of the throat, clear of the hopper (vertical layout)

## 2.8.2 -- 2026-10-21

- Page routes in English with redirects from the old ones, localStorage keys migrated to English; monitor sensors are recognised again after reloading modefff.g

## 2.8.1 -- 2026-10-21

- Changing the mode is allowed with the supply off; pellet panel shortcut picks the right heater in PID

## 2.8.0 -- 2026-10-21

- Operate and configure sections by role, pellet panel: add zone, fan and watch sensor from the panel, shortcuts to PID and flow calibration, role-aware errors

## 2.7.0 -- 2026-10-21

- Page split by role: Operate (status, pellet panel, materials preheat, 3D job) and Configure (printer tests, head change, pellet zones and feeding, extruder, PID); a viewer or an operator sees only Operate, a technician or an administrator both
- Switching to FFF mode is a technician's: other roles read "Ask a technician to switch to FFF"; allowing cold extrusion needs a technician too
- A refused write of modefff.g / printing.json / the PID says which role is needed, and a 401 opens the PIN dialog
- Tests for the rewriting of modefff.g (M563 / M950 / M308 / M143 / M307) with real files; ExtruderConfig lost 280 lines to dwc-src/modefff-edit.js

## 2.6.1 -- 2026-10-21

- Pellet panel: short band title in the horizontal layout, wider selector

## 2.6.0 -- 2026-10-21

- Pellet panel: vertical or horizontal layout, drag zones to reorder (with warning), fans animate only with real rpm, hopper feeding with level sensor and mechanism (manual or automatic)

## 2.5.1 -- 2026-10-21

- Pellet panel: throat label clear of the fans, result message under the panel

## 2.5.0 -- 2026-10-21

- Pellet extruder as an industrial panel: tap heaters, fans and motor to see and edit them; 3D job view opens on load and says when a file has no extrusion

## 2.4.3 -- 2026-10-21

- Pellet tab no longer blank (computed called itself), Materials picks the tool zones again

## 2.4.2 -- 2026-10-21

- Pellet, Materials and PID detail receive their props again (renamed bindings repaired)

## 2.4.1 -- 2026-10-21

- Page reloads when the DWC language changes; Vision pins dsf-python below 3.7; meter wizard copy over http

## 2.4.0 -- 2026-10-21

- English migration: texts through the catalog, no in-browser translator, interfaces per part

## 2.3.1 -- 2026-10-20

- English names: remaining values, ids, theme panels and the Vision backend keys (fixes a mismatch with the page)

## 2.3.0 -- 2026-10-20

- All the code, data keys and enum values are in English; stored data is converted by the one-off migration script

## 2.2.4 -- 2026-10-18

- Start-up entry is a chip in the page header

## 2.2.3 -- 2026-10-17

- Machine free rule follows the movement owner settings (like Duet / release seconds)

## 2.2.2 -- 2026-10-17

- Start-up strip under the page header, same place as the other plugins

## 2.2.1 -- 2026-10-16

- One shared way to start a job file (cuts, mesh, big pieces, CNC) that also reports an error answer; Jog step tab only shows the axes the machine has; Printing mode macros have assistant questions

## 2.2.0 -- 2026-10-16

- Start-up card is now a dialog opened from a strip on the page (one card per function, progress, step-by-step assistant), with a plain explanation for every row

## 2.1.13 -- 2026-10-16

- Start-up assistant (shared piece), Lights: the strip pin is chosen in Advanced (plain LED removed)

## 2.1.12 -- 2026-10-15

- Start-up card (shared piece): Printing assistant renamed so it no longer collides with the card

## 2.1.11 -- 2026-10-15

- Start-up card in Head change: the mode macros (FFF, laser, CNC) with their state; examples created once by the service; a machine without laser or spindle hides the row

## 2.1.10 -- 2026-10-15

- Spanish texts with accents and enie

## 2.1.9 -- 2026-10-14

- Hide every mention of another plugin when it is absent

## 2.1.8 -- 2026-10-14

- Cleanup: no more lookups of the old service Id (PiCustomCodes) or mentions of the removed custom G-codes

## 2.1.7 -- 2026-10-14

- Header is its own card above the side bar, like the other pages

## 2.1.6 -- 2026-10-14

- Side bar icons are 18 px like the bar of Vision

## 2.1.5 -- 2026-10-13

- The side bar is like the ones of Vision and the Work table: 190 px, 52 px folded with the double arrow in the middle, it folds by itself after choosing and opens only with the arrow (nothing floats over the page when the pointer passes by)

## 2.1.4 -- 2026-10-13

- The side bar has the double arrow (fold / open) like the bar of Vision, besides folding by itself after choosing

## 2.1.3 -- 2026-10-13

- The side bar has no pin: it is open at first, folds to the icons by itself when something is chosen and opens again over the page with the pointer or the focus

## 2.1.2 -- 2026-10-13

- The side bar uses the same measures and colors as the bar of Vision (190 px, sticky under the DWC bar)

## 2.1.1 -- 2026-10-13

- The side bar can be pinned or collapse by itself (pin button)

## 2.1.0 -- 2026-10-13

- Tabs as a side bar (like Work table and Vision)

## 2.0.2 -- 2026-10-13

- Files and macros written by the plugin are in English; bilingual risk texts

## 2.0.1 -- 2026-10-13

- Official localization completed: no Spanish text left in the sources, texts with parameters are single keys

## 2.0.0 -- 2026-10-13

- Needs WorkshopService 2.0: calls its central API (POST /machine/WorkshopService/api) instead of the custom codes M9003 / M9010, which are gone
- PID of every zone, cold extrusion risk and Activity notes through the API

## 1.10.0 -- 2026-10-13

- Official DWC localization: es.json / en.json via registerPluginLocalization

## 1.9.5 -- 2026-10-13

- Sidebar closed rail and settings; shared updates; English texts pending

## 1.9.4 -- 2026-10-12

- Cambio de modo y de cabezal revisan el trabajo en vivo (confirmacion en trabajo quieto); estado desde DWC; dwcVersion 3.6

## 1.9.3 -- 2026-10-11

- out3 de la 6HC es calentador, no ventilador

## 1.9.2 -- 2026-10-11

- PID: la temperatura de referencia al abrir es la del tipo de calentador

## 1.9.1 -- 2026-10-11

- PID: como esta y como funciona con los valores actuales; zonas: SSR de corriente continua; el voltaje de calibracion ya no se pierde al guardar M307

## 1.9.0 -- 2026-10-11

- Puesta en marcha paso a paso; Estado con grafica, configuracion y extrusion en frio; PID automatico de todas las zonas; zonas con conectores, tipo de salida y de sensor, y vigilancias

## 1.8.1 -- 2026-10-11

- Declara la dependencia de WorkshopService

## 1.8.0 -- 2026-10-11

- Carpetas en ingles bajo 0:/sys/workshop (datos, disenos, malla, cortar por partes); arreglos de la Mesa de trabajo

## 1.7.1 -- 2026-10-11

- Las paginas vuelven a cargar (punto y coma en safe-saving.js)

## 1.7.0 -- 2026-10-11

- Id nuevo en ingles (Workshop...) y guardado seguro ante cortes de luz

# TallerImpresion -- historial de versiones

## 1.6.1 -- 2026-10-10

- Compatibilidad con los Id nuevos en ingles (busca el servicio por el Id nuevo o el viejo); sin cambiar ningun Id todavia

## 1.6.0 -- 2026-10-10

- Fuera del modo FFF muestra el cartel Impresion 3D necesita el modo FFF, con explicacion y Cambiar a modo FFF (doble toque, solo en reposo), y apaga las pestanas de imprimir

## 1.5.0 -- 2026-10-10

- Pellet: conectores de cada placa (MB6HC y EXP1XD) libres, usados en otro modo o usados, con el motivo; tocar uno libre lo usa para la zona nueva

## 1.4.0 -- 2026-10-10

- Formulario del extrusor de pellet que escribe modefff.g. Estilo comun segun DESIGN.md (alto de botones, colores de la paleta, encabezados)

## 1.3.1 -- 2026-10-10

- Los comandos de la pagina van por HTTP desde el primero (antes salian por G-code mientras cargaban los plugins) y reintentan ~15 s si el servicio se esta reiniciando

## 1.3.0 -- 2026-10-10

- Encabezado y pestanas con el estilo comun (como RS485 y Motores) y colores de estado de la paleta; Pellet y zonas con un visor del extrusor: motor, tolva, garganta, tornillo, bandas de calor en su lugar con temperatura actual y objetivo y color por estado, boquilla y ventiladores; tocar una zona abre su detalle (calentar con doble toque, apagar, escalonado)

## 1.2.0 -- 2026-10-10

- Pestaña Pellet y zonas: zonas de calor del extrusor, escalonado de temperaturas por zona que usa Precalentar, y asistente para agregar una zona a modefff.g. Se quita la pestaña Herramientas (mezcla, offsets y macros de cambio): eso ya lo resuelven DWC/RRF. Las calibraciones y ajustes guardados quedan anotados en Actividad

## 1.1.1 -- 2026-10-10

- Estandar de advertencias y nombre visible del servicio (Servicio de la Pi)

## 1.1.0 -- 2026-10-10

- Varias herramientas: zonas de calor de pellet, extrusores y mezcla M567, offsets G10 con asistente de medicion, plantillas tfree/tpre/tpost. Camara calefactada en estado, materiales y PID. Fallas de sensor explicadas, con Borrar falla. Pestaña Puesta en marcha para la primera vez: sensores, prueba real de cada calentador, ventiladores, extrusor, caudal, PID, offsets y altura Z, con estado guardado.

## 1.0.0 -- 2026-10-10

- Pagina Impresion 3D: estado (boquilla, cama, ventiladores, herramienta), asistente de cambio de cabezal (Laser/CNC <-> FFF), materiales de pellet con precalentar, purga, calibracion de caudal por peso (M92 E) y PID de boquilla y cama.
