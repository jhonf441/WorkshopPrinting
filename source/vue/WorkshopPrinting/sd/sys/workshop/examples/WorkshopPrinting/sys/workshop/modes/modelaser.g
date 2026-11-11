; EXAMPLE: settings of the laser mode. Nothing in this file runs until you remove the ';' in front of a line.
; It is run by automodeselect.g each time the machine goes into Laser mode. Use the "Create with help" button of the start-up
; card of Printing to fill it with questions, or edit it by hand. If your machine has no laser, leave it as it is.
;
; 1. Speeds and accelerations of this mode (millimetres per minute, mm/s^2 and mm/s). Lower values are slower and safer.
; M203 X9000 Y9000 Z600              ; maximum speed
; M201 X300 Y300 Z100                ; acceleration
; M566 X400 Y400 Z50                 ; jerk
;
; 2. Limits of the work area for this mode (minimum:maximum, in mm). Measure your own machine.
; M208 X0:400 Y0:400 Z0:100
;
; 3. THE LINE THAT TURNS ON LASER MODE. Without it the machine does not enter Laser mode.
;    C = the output pin the laser power wire is connected to (look at your wiring; for example "out9").
;    R = maximum value of the power signal (255 is usual), F = signal frequency in Hz (500 is usual; check your laser's manual).
; M452 C"out9" R255 F500
