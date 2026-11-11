; Puts the machine in the mode that global.selectedMode says (see modestate.g). It is run at start-up and by the mode buttons.
; You do not need to edit this file to change mode: use the mode buttons of the pages.
; For this to run at start-up, sys/config.g must call it: either the line
;     M98 P"0:/sys/workshop/modes/automodeselect.g"
; or the workshop's marked block (hook "boot"), which runs it through sys/workshop/hooks/boot.g.
; (the start-up card of Printing tells you if neither is there).
;
; Each mode keeps its own settings in its own file (modefff.g, modelaser.g, modecnc.g). A mode you do not have can stay with
; every line commented: it is skipped. The commands M451 / M452 / M453 select RepRapFirmware's own FFF / Laser / CNC mode.

if !exists(global.selectedMode)
    M98 P"0:/sys/workshop/data/modestate.g"

if global.selectedMode = "Laser"
    if fileexists("0:/sys/workshop/modes/modelaser.g")
        M98 P"0:/sys/workshop/modes/modelaser.g"
elif global.selectedMode = "CNC"
    if fileexists("0:/sys/workshop/modes/modecnc.g")
        M98 P"0:/sys/workshop/modes/modecnc.g"
else
    M451
    if fileexists("0:/sys/workshop/modes/modefff.g")
        M98 P"0:/sys/workshop/modes/modefff.g"
