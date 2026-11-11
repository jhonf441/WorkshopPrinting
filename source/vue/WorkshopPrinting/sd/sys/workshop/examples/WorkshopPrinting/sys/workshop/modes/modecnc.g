; EXAMPLE: settings of the CNC (spindle) mode. Nothing in this file runs until you remove the ';' in front of a line.
; It is run by automodeselect.g each time the machine goes into CNC mode. Use the "Create with help" button of the start-up
; card of Printing to fill it with questions, or edit it by hand. If your machine has no spindle, leave it as it is.
;
; 1. Speeds and accelerations of this mode (millimetres per minute, mm/s^2 and mm/s). Lower values are slower and safer.
; M203 X6000 Y6000 Z600              ; maximum speed
; M201 X300 Y300 Z100                ; acceleration
; M566 X400 Y400 Z50                 ; jerk
;
; 2. Limits of the work area for this mode (minimum:maximum, in mm). Measure your own machine.
; M208 X0:400 Y0:400 Z0:100
;
; 3. THE LINE THAT TURNS ON CNC MODE. Without it the machine does not enter CNC mode.
;    Your spindle (its pin, speed range and direction) is defined in your sys/config.g with M950 and M563; this line only selects the mode.
; M453
