'use strict'

// The color of each section of the 3D printing page, one place (the look is in printing-design.css, which reads it as --sec).
// The first six are the approved pellet setup palette; the others follow the same logic (heat = orange/red, flow = green, motion = violet).

export const SECTION_COLORS = {
	state: '#1E88E5',
	pellet: '#F4511E',
	materials: '#AB47BC',
	job: '#FFA000',
	tests: '#43A047',
	head: '#26A69A',
	zones: '#F57C00',
	extruder: '#7E57C2',
	pid: '#E53935',
	// inside the pellet setup
	fans: '#00ACC1',
	feed: '#7CB342',
	motor: '#7E57C2',
	nozzle: '#26A69A',
	layout: '#5C6BC0'
}

export function sectionColor(id) {
	return SECTION_COLORS[id] || '#1E88E5'
}
