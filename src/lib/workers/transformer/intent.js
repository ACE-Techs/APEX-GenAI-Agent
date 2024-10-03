import { pipeline, env } from '@xenova/transformers';

// Skip local model check
env.allowLocalModels = false;

// Use the Singleton pattern to enable lazy construction of the pipeline.
class PipelineSingleton {
	static task = 'zero-shot-classification';
	static model = 'Xenova/bart-large-mnli';
	static instance = null;

	static async getInstance(progress_callback = null) {
		if (this.instance === null) {
			this.instance = await pipeline(this.task, this.model, { progress_callback });
		}

		return this.instance;
	}
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
	console.log('[intent][caught message]', event);

	// Get an instance of the pipeline
	const classifier = await PipelineSingleton.getInstance((x) => {
		// Progress callback for tracking model loading status
		console.log(x);
		// Track model loading progress and send updates to the main thread
		self.postMessage(x);
	});

	console.log('[intent][LLM Ready] - processing classification...', event.data);

	// If text data is received, begin processing
	if (event?.data?.text?.length > 0) {
		console.log('[intent][has text]')
		// Perform the classification
		let output = await classifier(event.data.text, event.data.classes);

		console.log('[intent][output]',output)

		let intent = {
			"intent":output.labels[0],
		}
		// Send the output back to the main thread
		self.postMessage({
			status: 'complete',
			output: JSON.stringify(intent),
		});
	}
});
