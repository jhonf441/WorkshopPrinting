; Puts the machine in the mode that global.selectedMode says (see modestate.g). It is run at start-up and by the mode buttons.
; You do not need to edit this file to change mode: use the mode buttons of the pages.
; For this to run at start-up, the LAST lines of your sys/config.g must be:
;     M98 P"0:/sys/automodeselect.g"
; (the start-up card of Printing tells you if that line is missing).
;
; Each mode keeps its own settings in its own file (modefff.g, modelaser.g, modecnc.g). A mode you do not have can stay with
; every line commented: it is skipped. The commands M451 / M452 / M453 select RepRapFirmware's own FFF / Laser / CNC mode.

if !exists(global.selectedMode)
    M98 P"0:/sys/modestate.g"

if global.selectedMode = "Laser"
    if fileexists("0:/sys/modelaser.g")
        M98 P"0:/sys/modelaser.g"
elif global.selectedMode = "CNC"
    if fileexists("0:/sys/modecnc.g")
        M98 P"0:/sys/modecnc.g"
else
    M451
    if fileexists("0:/sys/modefff.g")
        M98 P"0:/sys/modefff.g"
