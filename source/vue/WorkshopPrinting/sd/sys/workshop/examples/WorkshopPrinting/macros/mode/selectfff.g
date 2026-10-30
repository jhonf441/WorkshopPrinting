; EXAMPLE macro: switch the machine to FFF (printer) mode.
; Nothing in this file runs until you remove the ';' in front of a line.
; It is run by the "Head change" tab of Printing (and by a mode button of the control bar if you add one).
; Edit it for your machine.
;
; M451                     ; select FFF mode (RepRapFirmware)
; M98 P"0:/sys/modefff.g"  ; your own FFF settings (heaters, extruders...), if you have that file
