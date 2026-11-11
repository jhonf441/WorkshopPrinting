<template>
	<span class="gl-thumb" :class="{ 'is-fill': fill }" :style="fill ? null : { width: size + 'px', height: size + 'px' }" aria-hidden="true">
		<img v-if="url" :src="url" alt="" draggable="false" />
		<v-icon v-else :size="Math.round(size * 0.5)" class="gl-thumb-none">mdi-cube-outline</v-icon>
	</span>
</template>

<script>
'use strict'

// The small picture of a G-code file (the thumbnail the slicer embedded), loaded LAZILY: only when the element is on screen (IntersectionObserver)
// and after a short delay, so scrolling fast through the list never asks for the thumbnails of the rows that went by. The answers live in the LRU of
// the shared store (gcode-lib-shared.js), so a row that comes back is instant. A file without thumbnail shows the cube icon.
import { lib } from './gcode-lib-shared.js'
import { thumbUrl } from './gcode-lib-store.js'

export default {
	props: {
		file: { type: String, default: '' },
		size: { type: Number, default: 48 },
		fill: { type: Boolean, default: false }, // fill the box of the parent (the card preview) instead of a square of `size` px; `size` then only sizes the icon
		width: { type: Number, default: 96 } // pixel width asked from the service (a little over the displayed size for sharp screens)
	},
	data() {
		return { url: '' }
	},
	watch: {
		file() {
			this.url = ''
			this.arm()
		}
	},
	mounted() {
		this.arm()
	},
	beforeDestroy() {
		this.stop()
	},
	methods: {
		stop() {
			if (this.timer) clearTimeout(this.timer)
			this.timer = null
			if (this.observer) this.observer.disconnect()
			this.observer = null
		},
		arm() {
			this.stop()
			if (!this.file) return
			const cached = lib.cachedThumbnail(this.file, this.width)
			if (cached) { this.url = thumbUrl(cached); return }
			if (typeof IntersectionObserver === 'undefined') { this.later(); return }
			this.observer = new IntersectionObserver((entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					this.observer.disconnect()
					this.observer = null
					this.later()
				}
			})
			this.observer.observe(this.$el)
		},
		later() {
			this.timer = setTimeout(() => this.fetch(), 120)
		},
		fetch() {
			const file = this.file
			lib.thumbnail(file, this.width).then((t) => {
				if (file === this.file) this.url = thumbUrl(t)
			}, () => { /* no thumbnail: the icon stays */ })
		}
	}
}
</script>

<style scoped>
.gl-thumb { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 6px; background: rgba(128, 128, 128, 0.15); overflow: hidden; }
.gl-thumb img { width: 100%; height: 100%; object-fit: contain; }
.gl-thumb.is-fill { width: 100%; height: 100%; min-width: 0; min-height: 0; border-radius: 6px; background: #1b1b1f; }
.gl-thumb-none { opacity: 0.5; }
</style>
