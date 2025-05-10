import * as webllm from "@mlc-ai/web-llm";

// list of models: https://github.com/mlc-ai/web-llm-chat/blob/ac629bc115c69d7563ded5031418a1f96ebf52e5/app/constant.ts#L197
import { type Models as ModelNames, DEFAULT_MODEL_BASES } from "./models.ts"

class LLM {
	constructor(
		public engine: webllm.MLCEngine,
		public systemMessage = "You are a helpful AI assistant.",
		public temperature = 1,
		public history: string[][] = [],
		public onchunk: (chunk: webllm.ChatCompletionChunk) => void = (chunk) => {
			console.log(chunk.choices[0]?.delta.content ?? "");
			if (chunk.usage) {
				console.log(chunk.usage); // only last chunk has usage
			}
		},
	) {}
	static async FromModelName(
		// selectedModel: ModelNames = "Llama-3.1-8B-Instruct-q4f32_1-MLC",
		// selectedModel: ModelNames = "Qwen3-0.6B-q4f32_1-MLC",
		selectedModel: ModelNames = "Qwen3-8B-q4f16_1-MLC",
		initProgressCallback: webllm.InitProgressCallback = (initProgress) => {
			console.log("init progress", initProgress);
		},
	) {
		const engine = await webllm.CreateMLCEngine(
			selectedModel,
			{
				initProgressCallback,
			}, // engineConfig
		);
		return new LLM(engine);
	}
	setSystemMessage(message: string) {
		this.systemMessage = message;
	}
	setOnChunk(callback: (chunk: webllm.ChatCompletionChunk) => void) {
		this.onchunk = callback;
	}
	setTemperature(temperature: number) {
		this.temperature = temperature;
	}
	async sendMessage(content: string, history = this.history): Promise<string> {
		this.history.push([this.systemMessage, content]);
		console.log("Send Message", content)
		const previous: webllm.ChatCompletionMessageParam[] = history.flatMap(
			(item) => ({
				role: "user",
				content: item[1],
			}),
		);
		const chunks = await this.engine.chat.completions.create({
			messages: [
				{ role: "system", content: this.systemMessage },
				...previous,
				{ role: "user", content },
			],
			temperature: this.temperature,
			stream: true, // <-- Enable streaming
			stream_options: { include_usage: true },
		});

		let reply = "";
		for await (const chunk of chunks) {
			console.log("Reply Chunk", chunk)
			reply += chunk.choices[0]?.delta.content || "";
			this.history.at(-1)?.push(reply);
			this.onchunk(chunk);
		}
		return await this.engine.getMessage();
	}
}

async function main() {
	const selected = localStorage.getItem("jadujoel/model-choice") ?? "Qwen3-8B-q4f16_1-MLC"
	console.log("Selected Model", selected)
	const model = DEFAULT_MODEL_BASES
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const input = <HTMLInputElement> document.getElementById("model-choice")!
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const list = <HTMLDataListElement> document.getElementById("models")!
	for (const name of model) {
		const option = document.createElement("option")
		option.value = name.name
		option.innerText = name.family
		if (option.value === selected) {
			option.selected = true
			input.value = selected
		}
		list.appendChild(option)
	}

	input.addEventListener("change", ev => {
		const selected = (ev.target as unknown as { value: string }).value
		localStorage.setItem("jadujoel/model-choice", selected)
		window.location.reload()
	})


	// register service worker
	await navigator.serviceWorker.register("service-worker.js");

	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const loadStatus = document.getElementById("loadstatus")!;
	const chatInput = document.getElementById("chatinput") as HTMLTextAreaElement;
	const submitButton = document.getElementById("send") as HTMLButtonElement;

	const chatOutput = document.getElementById(
		"chatoutput",
	) as HTMLTextAreaElement;

	const llm = await LLM.FromModelName(undefined, (initProgress) => {
		loadStatus.innerText = initProgress.text;
	}).catch((error) => {
		console.log("Load LLM Error:", error)
		loadStatus.innerText = `Error: ${JSON.stringify(error)}`;
		if (error?.name?.includes("WebGPUNotAvailableError")) {
			loadStatus.innerText += "\n\nWebGPU is not available on this device.";
			loadStatus.innerText += "\n\nOn iphone you can enable it in Advanced Settings for Safari.";
		}
	});
	if (llm === undefined) {
		return;
	}
	llm.setSystemMessage("You are a helpful AI assistant.");
	llm.setOnChunk((chunk) => {
		chatOutput.textContent += chunk.choices[0]?.delta.content ?? "";
	});

	submitButton.addEventListener("click", async () => {
		const content = chatInput.value;
		chatOutput.textContent += `You: ${content}\n`;
		chatInput.value = "";
		chatOutput.textContent += "AI:\n";
		await llm.sendMessage(content);
		chatOutput.textContent += "\n";
	});
}

main();
