import * as ac from "can-start-audio-context"
import * as macros from "../macros.ts" with { type: "macro" }
import type { EncodedItem } from '../build.ts'

/**
 * - https://bugs.webkit.org/show_bug.cgi?id=237322
 * - Allow audio being played with the ring/silent switch set to silent.
 * - According to CanIUse: supported in Safari 16.4 and above.
 * After testing on BrowserStack:
 * - ios18.1 - chrome - supported
 * - ios18.1 - safari - supported
 * - ios17.6.1 - firefox 133.3 - supported
 * - ios16 - safari 16 - supported
 * - ios16 - chrome 92.0.4515.90 - supported
 * - ios15 - chrome 92.0.4515.90 - not supported
 * - ios15 - safari 15 - not supported
 */
export function backgroundAudioFix(): void {
	interface AudioSession {
			/** @default "auto" */
			type: "ambient" | "playback" | "auto";
	}
	type NavigatorWithAudioSession = Navigator & { audioSession: AudioSession; };
	function isNavigatorWithAudioSession(navigator: Navigator): navigator is NavigatorWithAudioSession {
			return (navigator as NavigatorWithAudioSession).audioSession !== undefined;
	}
	if (typeof window !== "undefined" && isNavigatorWithAudioSession(window.navigator)) {
			window.navigator.audioSession.type = "playback";
	}
}

class SoundManager {
	constructor(
		public readonly context: AudioContext,
		public readonly cache: Map<string, AudioBuffer>,
		public readonly items: EncodedItem[]
	) {}
	async fetch(source: string): Promise<AudioBuffer | undefined> {
		const existing = this.cache.get(source)
		if (existing !== undefined) {
			return existing
		}

		const item = this.items.find(x => x.source === source)
		if (item === undefined) {
			return undefined
		}

		const response = await fetch(item.outname).catch(() => undefined)
		if (response === undefined || !response.ok) {
			return undefined
		}

		const arrayBuffer = await response.arrayBuffer()
		const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
		this.cache.set(source, audioBuffer)
		return audioBuffer
	}
	static fromContext(context: AudioContext) {
		return new SoundManager(context, new Map(), macros.encoded())
	}
}

async function main() {
	backgroundAudioFix()

	const app = <HTMLDivElement> document.getElementById("app")
	const statel = document.createElement("div")
	app.appendChild(statel)

	statel.innerText = "Context Starting..."
	const context = await ac.start(undefined, { sampleRate: 48_000, latencyHint: "playback" })
	statel.innerText = `Context State: ${context.state}`
	context.addEventListener("statechange", ev => {
		statel.innerText = `Context State: ${context.state}`
	})

	const sm = SoundManager.fromContext(context)

	const buffer = await sm.fetch("rosa10")
	if (buffer === undefined) {
		throw new Error("Failed To Fetch Soundfile")
	}

	const source = context.createBufferSource()
	source.buffer = buffer
	source.loop = true
	source.connect(context.destination)

	source.start()

}
main()
