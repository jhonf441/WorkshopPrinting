; EXAMPLE: settings of the 3D printer (FFF) mode. Nothing in this file runs until you remove the ';' in front of a line.
; It is run by automodeselect.g each time the machine goes into FFF mode. Use the "Create with help" button of the start-up
; card of Printing to fill it with questions, or edit it by hand. If your machine has no 3D printer head, leave it as it is.
;
; 1. Speeds and accelerations of this mode (millimetres per minute, mm/s^2 and mm/s). Lower values are slower and safer.
; M203 X12000 Y12000 Z600 E1200      ; maximum speed of each axis
; M201 X1000 Y1000 Z100 E1000        ; acceleration
; M566 X600 Y600 Z30 E600            ; jerk (largest speed jump allowed at a corner)
;
; 2. Limits of the bed for this mode (minimum:maximum, in mm). Measure your own machine.
; M208 X0:300 Y0:300 Z0:300
;
; 3. Probe offset of this mode, if you use a bed probe (X and Y distance from the nozzle, Z trigger height).
; G31 X0 Y0 Z2.5
;
; Heaters, extruders and fans are defined in your sys/config.g (M950, M563, M143...). Do not repeat them here.
