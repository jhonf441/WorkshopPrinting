; EXAMPLE macro: switch the machine to CNC mode.
; Nothing in this file runs until you remove the ';' in front of a line.
; Only for machines with a spindle: otherwise tap "Do not use" in the start-up card.
; It is run by the "Head change" tab of Printing. Edit it for your machine.
;
; M453                       ; select CNC mode (see the RepRapFirmware documentation of M453 for the spindle pins)
; M98 P"0:/sys/modecnc.g"    ; your own CNC settings, if you have that file
