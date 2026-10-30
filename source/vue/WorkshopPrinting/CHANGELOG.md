# WorkshopPrinting -- historial de versiones

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
