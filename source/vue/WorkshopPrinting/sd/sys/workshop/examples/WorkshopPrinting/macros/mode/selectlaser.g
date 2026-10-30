; EXAMPLE macro: switch the machine to laser mode.
; Nothing in this file runs until you remove the ';' in front of a line.
; Only for machines with a laser: otherwise tap "Do not use" in the start-up card.
; It is run by the "Head change" tab of Printing. Edit it for your machine.
;
; M452 C"out5" F500 R255     ; select laser mode: C = the laser pin, F = PWM frequency, R = the 100% value (see the RepRapFirmware documentation of M452)
; M98 P"0:/sys/modelaser.g"  ; your own laser settings, if you have that file
