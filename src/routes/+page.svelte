<script>
	//svelte
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade } from 'svelte/transition';

	//lib
	import { marked } from 'marked';
	import {franc } from 'franc';

	//store
	import { app as sApp } from 'src/stores/app.js';

	//bindings
	let promptVal = '';
	let chatScroll;

	//DOM
	let promptLoading = false;
	let promptResVal = '';
	let promptFocus = false;
	let flagLanguageChange = false;
	let detectLang = 'eng';

	//Widget
	let displayChatWidget = false;
	let genAIReady = false;

	//scroll
	let showScroll = false;

	//genai bot sessions
	let genAIBot = {
		smallTalk:null,
		intent:null,
		entity:null,
		i18n:null,
	};

	//genAI
	let enableBrowserAI_ifSupported = true;
	let pipelineWorker;

	//Primary Intent Structure
	let primaryIntents = {
		"Help": {
			"name":"Help",
			"description": "Triggered when the user says hello or initiates a conversation.",
			"exampleSentances": [
				"help",
				"hi"
			]
		},
	};

	//language support for
	//lang list here - https://www.npmjs.com/package/franc
	let i18nSupport = [
		'eng',//english
		'spa',//spanish
		'deu',//german
	];

	let languageMap = {
		'eng':'English',
		'spa':'Spanish',
		'deu':'German'
	}
	
	//Create a basic queue to handle 1-1 processing of msgs if multiple requests required
	let messageQueue;
	class MessageQueue {
		constructor() {
			this.queue = [];
			this.isProcessing = false;
		}

		// Add a new item to the queue
		enqueue(item,onFinish) {
			this.queue.push(item);
			this.processQueue(onFinish); // Start processing the queue after adding
		}

		// Process the queue: ensure items are processed one at a time
		async processQueue(onFinish) {
			if (this.isProcessing) return; // If already processing, do nothing

			this.isProcessing = true; // Mark as processing

			while (this.queue.length > 0) {
				const currentItem = this.queue.shift(); // Get the first item in the queue

				try {
					await this.processItem(currentItem); // Process the item (wait for the promise to resolve)
				} catch (error) {
					console.error("Error processing item:", error);
				}
			}

			this.isProcessing = false; // Mark as not processing when done
			// If onFinish callback is provided, call it when the queue finishes
			if (typeof onFinish === 'function') {
				onFinish();
			}
		}

		// Simulate an async task with a promise
		processItem(item) {
			return new Promise(async (resolve) => {
				console.log(`Processing`,item);

				//const prompti18n = await genAIBot.i18n.prompt(item.translate);
				console.log(`[i18n][Translating] - "${item.messagePayload.text}"`);

				item.messagePayload.text = `${item?.messagePayload?.text?.trim()}.`;
				const prompti18n = await genAIBot.i18n.prompt(`Translate the following text: ${item.messagePayload.text}`);

				console.log('[i18n][Translated] - ',prompti18n);

				item.messagePayload.i18n = prompti18n;

				//after dom update
				await tick();

				//scroll to the bottom
				scrollToBottom();

				resolve();
			});
		}
	}

	// Callback to notify when the queue is finished processing
	const onQueueFinish = () => {
		console.log('All items in the queue have been processed.');
		promptLoading = false;
	};


	onMount(async () => {
		//initialise local bots
		initialiseBots();
	});

	// Clean up the worker when the component is destroyed
	onDestroy(() => {
		if (pipelineWorker) {
			console.log('Terminated pipelineWorker')
			pipelineWorker.terminate();
		}
	});

	/**
	 * initialiseBots
	 * startup sessions for intent, entity, smalltalk & translation service
	 */
	function initialiseBots() {
		initSmallTalk();
		//initIntentDetection();
		//initEntityDetection('skills/order/dialogs/LLMEnhancementBot-OrderStatus-Flow.yaml');
		//initTranslator(i18n);
	}

	/**
	 * initSmallTalk
	 */
	async function initSmallTalk() {
		console.log('[initSmallTalk]');
		const preprompt = `You are a friendly bot responding to a user query`;

		if (genAIBot.smallTalk) {
			console.log('[destroy session]')
			genAIBot.smallTalk.destroy();
		}

		//init local AI Model
		genAIBot.smallTalk = await initialiseSession(preprompt,{},'smallTalk');

	}

	/**
	 * initIntentDetection
	 */
	async function initIntentDetection() {
		console.log('[initIntentDetection]');
		if (genAIBot.intent) {
			console.log('[destroy session]')
			genAIBot.entity.destroy();
		}

		genAIBot.intent = await initialiseSession(preprompt,localWorker,'intentDetection');
	}

	/**
	 * initEntityDetection
	 */
	async function initEntityDetection(url) {
		console.log('[initEntityDetection]');

		if (genAIBot.entity) {
			console.log('[destroy session]')
			genAIBot.entity.destroy();
		}

		//init local AI Model
		genAIBot.entity = await initialiseSession(preprompt,{},'entityDetection');
	}

	/**
	 * initTranslator
	 * sets the language to translate to
	 */
	async function initTranslator(langauge) {
		console.log('[initTranslator]',langauge)
		return new Promise(async (resolve, reject) => {
			const preprompt = `Your role is to translate the message received from the prompt from English into ${langauge}`;

			if (genAIBot.i18n) {
				console.log('[destroy session]')
				genAIBot.i18n.destroy();
			}

			//init local AI Model
			genAIBot.i18n = await initialiseSession(preprompt,{},'translator');

			resolve();
		});
	}

	/**
	 * fetchEntityConfig
	 * Function to fetch the entity configuration based on entityName
	 * @param entityName
	 */
	async function fetchEntityConfig(entityName) {
		try {
			// Construct the path to the entity JSON file
			const entityUrl = `/entities/${entityName}.json`;
			
			// Fetch the entity configuration
			const response = await fetch(entityUrl);
			
			if (!response.ok) {
				throw new Error(`Error fetching entity: ${entityName}`);
			}

			const entityConfig = await response.json();

			return entityConfig;

		} catch (error) {
			console.error(`Error fetching entity config for ${entityName}:`, error);
			return null;  // Return null if the entity config could not be fetched
		}
	}

	/**
	 * initialiseSession
	 * initialise local genai gemini nano Session
	 */
	async function initialiseSession(preprompt,worker,type) {
		console.log(`[initialiseSession][${type}]`);

		//browser ai gemini
		if ((window.ai) && (enableBrowserAI_ifSupported)) {
			console.info(`[initialiseSession][${type}][detected gemini nano]`);
			const capabilities = await window.ai.assistant.capabilities();
			console.log('[initialiseSession][capabilities]', capabilities);

			// Handle different capability scenarios
			switch (capabilities.available) {
				case 'no': {
					console.log('This browser/device cannot provide a language model.');
					return Promise.reject('Language model not supported on this device.');
				}
				case 'after-download': {
					console.log('Going to download a language model; sit tight!', window.ai);
					// Optionally you could add more logic here to monitor the download progress
					break;
				}
				case 'readily': {
					console.log('[initialiseSession][GeminiReady]...');
					break;
				}
			}

			// Return a promise that will resolve or reject based on session creation
			return new Promise(async (resolve, reject) => {
				try {
					const sessionConfig = {
						monitor(m) {
							m.addEventListener('downloadprogress', e => {
								console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
							});
						},
						systemPrompt: preprompt,
						temperature: 0.1,
						topK: 5
					};

					console.log('[initialiseSession][sessionConfig]', sessionConfig);

					// Try to create the session
					const session = await window.ai.assistant.create(sessionConfig);
					console.log(`[initialiseSession][initialised][${type}]`);

					// Set the global ready flag or any state you need
					genAIReady = true;

					// Resolve the promise indicating success
					resolve(session);

				} catch (e) {
					console.error('Creating the Gemini session failed. More details: ', e);

					// Reject the promise indicating failure
					reject(e);
				}
			});

		//custom local worker
		} else if (worker) {
			console.info('[initialiseSession][setting up internal genAI modules]');

			return new Promise(async (resolve, reject) => {
				try {
					console.log('initialising pipeline');
					// Import the worker as a module
					/* @vite-ignore */
					const Worker = await import(worker);

					// Create an instance of the worker
					const session = new Worker.default();

					const onMessageReceived = (e) => {
					switch (e.data.status) {
						case 'initiate':
							console.log('---initiate');
							ready = false;
							break;
						case 'progress':
							// Add loading bar functionality here
							console.log('---progress', e.data);
							progress = e.data.progress;
							break;
						case 'ready':
							console.log('---ready');
							console.log('[ready] - Creating the session succeeded!');

							// Set the global ready flag or any state you need
							genAIReady = true;

							// Resolve the promise indicating success
							resolve({
								worker: session,
								prompt: function (text) {
									return new Promise((resolve, reject) => {
										// Define a one-time listener for the worker's response
										const handleMessage = (event) => {
											resolve(event.data.output); // Resolve with the response from the worker
											session.removeEventListener('message', handleMessage); // Remove listener after response
											session.removeEventListener('error', handleError); // Remove error listener
										};

										// Handle potential errors from the worker
										const handleError = (error) => {
											reject(error); // Reject the promise if there's an error
											session.removeEventListener('message', handleMessage); // Remove message listener
											session.removeEventListener('error', handleError); // Remove error listener
										};

										// Add the message event listener
										session.addEventListener('message', handleMessage);

										// Add the error event listener
										session.addEventListener('error', handleError);

										// Send the message to the worker
										session.postMessage({ 
											text:text,
											classes:['Order Status', 'Help',]
										});
									});
								}
							});

							// Remove the `onMessageReceived` listener as it's no longer needed
							session.removeEventListener('message', onMessageReceived);
							break;
						case 'complete':
							console.log('---complete', e);
							break;
						default:
							console.log('Found new status', e.data.status);
							break;
					}
					};

					// Attach the callback function as an event listener.
					session.addEventListener('message', onMessageReceived);

					// Send an initialization message to the worker
					session.postMessage({ action: 'init' });

				} catch (e) {
					console.error('Creating the local GenAI session failed. More details: ', e);

					// Reject the promise indicating failure
					reject(e);
				}
			});

		//server connection
		} else {
			console.info('[initialiseSession][local GenAI Disabled]');
			return false;

		}
	}

	/**
	 * createWorkerWithCacheBusting
	 * Emable cache buster support for web worker when developing
	 * @param url
	 */
	function createWorkerWithCacheBusting(url) {
		console.log('Creating webworker');
		const timestamp = new Date().getTime();
		const workerUrl = `${url}?t=${timestamp}`;

		return new Worker(workerUrl, { type: 'module' });
	}


	/**
	 * prompt
	 * prompt the bot to get intent
	 */
	async function prompt() {

		//check if empty prompt val exit
		if (promptVal.trim().length === 0) {
			return;
		}
		
		//show loading state
		promptLoading = true;
		
		//cleanup initial prompt value
		promptResVal = promptVal;
		promptVal = '';

		//add message display to store
		sApp.createNewMsg(promptResVal);

		//check language
		detectLang = franc(promptResVal, {
			only: i18nSupport,
		});

		//if not english - enable option to receive response in other language
		if ((detectLang !== $sApp.i18n) && (detectLang !== 'und')) {
			console.log('[prompt][detected Lang]',detectLang);
			sApp.flagLang(detectLang);

			//display modal
			flagLanguageChange = true;
		} else {
			submitPrompt();
		}

	}

	/**
	 * submitPrompt
	*/
	async function submitPrompt() {
		//wait dom update
		await tick();
		//scroll down display
		scrollToBottom();
		
		console.log('[prompt][prompting...]', promptResVal);
		console.log('[availableBots]',genAIBot);

		let promptRes = await genAIBot.smallTalk.prompt(promptResVal);
		console.log('[utteranceResponse][smalltalk][res]',promptRes);

		if (promptRes?.length === 0) {
			promptRes = 'Sorry, Im not sure what you are asking for?';
		}
		//display response
		sApp.smallTalkResponse(promptRes);

		//clear loading display
		promptLoading = false;

		// let promptIntent = await genAIBot.intent.prompt(promptResVal);

		// //add cleanup to catch bad responses
		// promptIntent = promptIntent.replace(/```json/g,'');
		// promptIntent = promptIntent.replace(/`/g,'');

		// console.log('[prompt][intent][res]',promptIntent);

		// let promptIntentObj = validateResponse(promptIntent);

		// utteranceResponse(promptIntentObj);

	}

	/**
	 * validateResponse
	 * validates json has been returned and returns obj
	 * @param promptResponse
	 */
	function validateResponse(promptResponse) {
		//try to parse json to obj
		try {
			console.log('[validateResponse]',promptResponse)
			let promptObj = JSON.parse(promptResponse);
			
			return promptObj;
		//
		} catch (e) {
			console.error('[validateResponse] - bad response expected json');

			return false;
		}
	}

	/**
	 * utteranceResponse
	 */
	async function utteranceResponse(promptResponse) {
		console.log('[utteranceResponse]',promptResponse);

		//check if intent sent from genai matches ODA and send utterance message
		if ((promptResponse?.intent) && (primaryIntents[promptResponse?.intent])) {
			//tmp set intent for history and checking.
			sApp.setIntent(primaryIntents[promptResponse?.intent]);

		//Cant find the intent utterance lets default response to small talk..
		//lets try to get genai to steer the conversation back to the ODA Conversation..
		} else {
			let updatedPrompt = promptResVal;

			if ($sApp.i18n !== 'eng') {
				updatedPrompt = `Make sure to reply to this prompt in ${languageMap[$sApp.i18n]}: ${promptResVal}`;
				console.log('[utteranceResponse][smalltalk][requesting translation]',updatedPrompt)
			}

			const promptRes = await genAIBot.smallTalk.prompt(updatedPrompt);

			console.log('...failed to match intent...')
			console.log('[utteranceResponse][smalltalk][res]',promptRes);

			//display response
			sApp.smallTalkResponse(promptRes);

			//clear loading display
			promptLoading = false;
		}
	}

	/**
	 * entityValidation
	 * @param promptResponse
	 */
	function entityValidation(promptResponse) {
		console.log('[entityValidation]',promptResponse)
		
		try {
			promptResponse = promptResponse.replace(/```json/g,'');
			promptResponse = promptResponse.replace(/`/g,'');
			promptResponse = JSON.parse(promptResponse);
			
			let invalidEntities = [];
			let validEntities = [];

			if ((promptResponse?.entities) && (minifiedYAML)) {
				Object.entries(promptResponse?.entities).forEach(([key, value]) => {
					let pattern = new RegExp(minifiedYAML.variables[key].config.patternExpression);
					if (!pattern.test(value)) {
						invalidEntities.push({key:value});
					} else {
						validEntities.push({key:value});
					}
				});

				if (invalidEntities.length > 0) {
					console.warn('[entityValidation][invalid]',invalidEntities);

					sApp.updateLastUserMsg(highlightWithTitles(promptResVal,invalidEntities));
				} else {
					console.warn('[entityValidation][valid]',validEntities);

					sApp.updateLastUserMsg(highlightWithTitles(promptResVal,validEntities));
				}
				
			}

		} catch(e) {
			console.warn('entity data not returned',e)
		}
		
	}

	/**
	 * highlightText
	 * highlights entities found in the conversation
	 * @param sentence
	 * @param searchTerm
	 */
	 function highlightWithTitles(sentence, searchTerms) {
		if (!searchTerms || searchTerms.length === 0) return sentence; // Return original if no terms

		searchTerms.forEach(termObj => {
			const key = Object.keys(termObj)[0]; // Extract the key (title)
			const value = termObj[key]; // Extract the value (text to highlight)

			// Escape special characters in the value
			const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

			// Create a regex for the current value
			const regex = new RegExp(`(${escapedValue})`, 'gi');

			// Replace matched value with highlighted version and add title attribute
			sentence = sentence.replace(regex, `<span class="highlight" title="${key}">$1</span>`);
		});

		return sentence; // Return the modified sentence with highlighted terms
	}
	
	/**
	 * promptSubmit
	 * event key press on prompt input to submit
	 */
	function promptSubmit(e) {
		if (e.key === 'Enter') {
			prompt();
		}
	}

	/**
	 * toggleDisplay
	 * show / hide chat widget display
	 */
	function toggleDisplay() {
		displayChatWidget = !displayChatWidget;
	}

	/**
	 * user for the bot text response animation
	 * @param node
	 * @param obj animation speed
	 */
	function typewriter(node, { speed = 4 }) {
		const htmlContent = node.innerHTML;
		let contentLength = htmlContent.length;
		const duration = contentLength / (speed * 0.01);

		return {
			duration,
			tick: (t) => {
				const charCount = Math.trunc(contentLength * t);
				let slicedContent = htmlContent.slice(0, charCount);
				
				// Set the sliced content to the node's innerHTML
				node.innerHTML = slicedContent;

				// Optional: Scroll to the bottom
				scrollToBottom();
			}
		};
	}

	/**
	 * scrollToBottom
	 * Function to scroll the chat container to the bottom
	 */
	function scrollToBottom() {
		if (chatScroll) {
			chatScroll.scrollTop = chatScroll.scrollHeight;
		}
	}
</script>

<!-- Chat Widget -->
<section class="{displayChatWidget?'opacity-100':'opacity-0 pointer-events-none'} flex flex-col overflow-hidden transition-all duration-400 absolute z-[1000000] bottom-5 right-5 w-96 h-[620px] bg-rww-light  shadow-md rounded-lg">
	<div class="flex flex-col flex-1 relative overflow-auto">
		{#if (flagLanguageChange)}
			<div class="absolute flex items-center justify-center top-0 left-0 right-0 bottom-0 bg-black/50 z-[100]">
				<dl in:fade class="bg-white rounded-md m-5 w-full box-shadow">
					<dt class="px-4 py-2 border-b font-semibold">Language Change Detected..</dt>
					<dd class="">
						<div class="p-4">
							{#if ($sApp.i18n !== 'eng')}
								Change response language back to English?
							{:else}
								Change response language to {languageMap[detectLang]}?
							{/if}
						</div>

						<div class="flex items-center justify-center gap-x-2 border-t px-4 py-2">
							<button 
								on:click="{() => {
									flagLanguageChange = false;
									submitPrompt();
								}}"
								class="bg-gray-100 rounded-md px-4 py-2">Cancel</button>
							<button 
								on:click="{async () => {
									sApp.updateLang(detectLang);
									flagLanguageChange = false;
									await initTranslator(languageMap[detectLang]);
									//const prompti18n = await genAIBot.i18n.prompt('your order numnber is 21345');
									//console.log(prompti18n);
									submitPrompt();
								}}"
								class="border rounded-md px-4 py-2">Accept</button>
						</div>
					</dd>
				</dl>
			</div>
		{/if}

		<!-- Menu min max close -->
		<ul class="absolute flex top-0 left-4 overflow-hidden rounded-b-sm z-[120]">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<li 
				on:click="{toggleDisplay}"
				class="cursor-pointer bg-taskbar-red w-6 h-1.5"></li>
			<li class="cursor-pointer bg-taskbar-orange w-6"></li>
			<li class="cursor-pointer bg-taskbar-green w-6"></li>
		</ul>
		<!-- xMenu min max close -->

		<!-- Header bg placeholder -->
		<header class="pointer-events-none absolute bg-neutral-dark h-32 left-0 right-0 border-b-0 border border-rwb-light"></header>
		<!-- xHeader bg placeholder -->
		<div class="flex flex-col flex-1 relative overflow-auto">

			<!-- Main Panel -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<main class="relative flex flex-1 flex-col relative z-10 pt-4 px-4 overflow-auto">
				<!-- Header -->
				<div class="flex gap-x-2 pb-4">
					<!-- Ico -->
					<div>
						<div class="bg-rwb-light w-10 h-10 rounded-md flex items-center justify-center">
							<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
								<g id="Group_16" data-name="Group 16" transform="translate(-1 -1)">
								<path id="Path_16" data-name="Path 16" d="M21.2,22a1.242,1.242,0,0,0,.527-.055.5.5,0,0,0,.219-.219A1.242,1.242,0,0,0,22,21.2V10.8a1.242,1.242,0,0,0-.055-.527.5.5,0,0,0-.219-.219A1.242,1.242,0,0,0,21.2,10H18.8a1.242,1.242,0,0,0-.527.054.5.5,0,0,0-.219.219A1.242,1.242,0,0,0,18,10.8v2.4a1.242,1.242,0,0,1-.055.527.5.5,0,0,1-.219.219A1.242,1.242,0,0,1,17.2,14H14.8a1.242,1.242,0,0,0-.527.054.5.5,0,0,0-.219.219A1.242,1.242,0,0,0,14,14.8v2.4a1.242,1.242,0,0,1-.054.527.5.5,0,0,1-.219.219A1.242,1.242,0,0,1,13.2,18H10.8a1.242,1.242,0,0,0-.527.055.5.5,0,0,0-.219.219A1.242,1.242,0,0,0,10,18.8v2.4a1.242,1.242,0,0,0,.054.527.5.5,0,0,0,.219.219A1.242,1.242,0,0,0,10.8,22Z" fill="none" stroke="#cfcfcf" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
								<path id="Path_17" data-name="Path 17" d="M10,6.8a1.242,1.242,0,0,1,.054-.527.5.5,0,0,1,.219-.218A1.242,1.242,0,0,1,10.8,6h2.4a1.242,1.242,0,0,1,.527.055.5.5,0,0,1,.219.218A1.242,1.242,0,0,1,14,6.8V9.2a1.242,1.242,0,0,1-.054.527.5.5,0,0,1-.219.219A1.242,1.242,0,0,1,13.2,10H10.8a1.242,1.242,0,0,1-.527-.054.5.5,0,0,1-.219-.219A1.242,1.242,0,0,1,10,9.2Z" fill="none" stroke="#cfcfcf" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
								<path id="Path_18" data-name="Path 18" d="M3,12.8a1.242,1.242,0,0,1,.055-.527.5.5,0,0,1,.218-.219A1.242,1.242,0,0,1,3.8,12H6.2a1.242,1.242,0,0,1,.527.054.5.5,0,0,1,.218.219A1.242,1.242,0,0,1,7,12.8v2.4a1.242,1.242,0,0,1-.055.527.5.5,0,0,1-.218.219A1.242,1.242,0,0,1,6.2,16H3.8a1.242,1.242,0,0,1-.527-.054.5.5,0,0,1-.218-.219A1.242,1.242,0,0,1,3,15.2Z" fill="none" stroke="#cfcfcf" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
								<path id="Path_19" data-name="Path 19" d="M2,2.8a1.242,1.242,0,0,1,.055-.527.5.5,0,0,1,.218-.218A1.242,1.242,0,0,1,2.8,2H5.2a1.242,1.242,0,0,1,.527.055.5.5,0,0,1,.218.218A1.242,1.242,0,0,1,6,2.8V5.2a1.242,1.242,0,0,1-.055.527.5.5,0,0,1-.218.218A1.242,1.242,0,0,1,5.2,6H2.8a1.242,1.242,0,0,1-.527-.055.5.5,0,0,1-.218-.218A1.242,1.242,0,0,1,2,5.2Z" fill="none" stroke="#cfcfcf" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
								</g>
							</svg>						  
						</div>
					</div>
					<!-- xIco -->

					<!-- Title description -->
					<div class="flex flex-col justify-center">
						<h2 class="text-white font-semibold leading-4">APEX AI</h2>
						<span class="text-white opacity-50 text-sm leading-3">Personal Data Assistant</span>
					</div>
					<!-- xTitle description -->
				</div>
				<!-- xHeader -->

				<!-- Chat History -->
				<!-- svelte-ignore missing-declaration -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<!-- svelte-ignore a11y-mouse-events-have-key-events -->
				<div 
					on:mouseover={() => { showScroll = true; }} 
					on:mouseout={() => { showScroll = false; }} 
					class="relative flex flex-col flex-1 overflow-hidden rounded-t-md bg-white">
					
					<!-- Anim Scroll display -->
					<div class="{showScroll?'opacity-0':'opacity-100'} pointer-events-none transition-all transition-delay-200 absolute right-0 top-2 bottom-0 w-4 bg-white"></div>
					<!-- xAnim Scroll display -->

					<!-- Redwood header img seperator -->
					<div style="background-image:url('/color-strip-netsuite-2x.webp')" class="h-2 bg-no-repeat bg-contain"></div>
					<!-- xRedwood header img seperator -->

					<!-- Scroll Chat Window -->
					<div bind:this="{chatScroll}" id="FBGDA-blockContent" class="flex-1 overflow-auto pt-2">
						
						{#each $sApp?.conversation as msg }
							<!-- User Msg -->
							<div in:fade class="flex flex-col gap-y-2 mb-3">
								<div class="flex gap-x-2 ms-3 me-5">
									<div class="flex-1 bg-white border rounded-md py-2 px-3">
										{@html msg.userMsg}
									</div>
									<div class="flex items-center justify-center">
										<div class="flex-1 bg-white borderx rounded-md w-8 h-8">
											<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M5.3163 19.4384C5.92462 18.0052 7.34492 17 9 17H15C16.6551 17 18.0754 18.0052 18.6837 19.4384M16 9.5C16 11.7091 14.2091 13.5 12 13.5C9.79086 13.5 8 11.7091 8 9.5C8 7.29086 9.79086 5.5 12 5.5C14.2091 5.5 16 7.29086 16 9.5ZM22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</div>
									</div>
								</div>
								
								<!-- {#if (msg.flagi18n)}
									{#if ($sApp.i18n !== 'eng')}
										<button 
											on:click="{() => {sApp.updateLang('eng'); }}"
											class="mx-3 flex-1 bg-white border rounded-md py-2 px-3">
											Change response language back to English?
										</button>
									{:else}
										<button 
											on:click="{() => {sApp.updateLang(msg.flagi18n); }}"
											class="mx-3 flex-1 bg-white border rounded-md py-2 px-3">
											Change response language to {languageMap[msg.flagi18n]}?
										</button>
									{/if}
								{/if} -->
							</div>
							<!-- xUser Msg -->

							<!-- Small Talk Res -->
							{#if (msg?.smallTalk)}
								<div class="flex flex-col gap-y-2 mb-3">
									<div transition:typewriter="{{ speed: 4 }}" class="bg-gray-100 rounded-md py-2 px-3 ms-8 me-5">
										{@html marked.parse(msg?.smallTalk?.replace(/`/g,''))}
									</div>
								</div>
							{/if}
							<!-- xSmall Talk Res -->
							
							<!-- AI Res -->
							{#if (msg?.ODARes)}
								<div class="flex flex-col gap-y-2 mb-3">
									{#each msg?.ODARes as botRes, i}
										{#if ((msg?.intent?.entity) && (i===0))}
											<!-- skip first msg-->
										{:else}
											<div transition:typewriter="{{ speed: 4 }}" class="bg-gray-100 rounded-md py-2 px-3 ms-8 me-5">
												{@html marked.parse(botRes?.messagePayload?.i18n || botRes?.messagePayload?.text || botRes?.messagePayload?.headerText)}
											</div>
										{/if}
									{/each}
								</div>
							{/if}
							<!-- xAI Res -->
						{:else}
							<div class="flex flex-col gap-y-2 mb-3">
								<div class="relative bg-gray-100 rounded-md py-2 mt-5 ps-12 pe-3 ms-8 me-5">
									<div class="absolute -left-6 -top-5 w-16 h-16">
										<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 90 90">
											<defs>
											<clipPath id="clip-path">
												<circle id="Ellipse_3" data-name="Ellipse 3" cx="39" cy="39" r="39" transform="translate(1492 433)" fill="#fff"/>
											</clipPath>
											</defs>
											<g id="Group_273" data-name="Group 273" transform="translate(-1492.5 -306)">
											<circle id="Ellipse_6" data-name="Ellipse 6" cx="45" cy="45" r="45" transform="translate(1492.5 306)" fill="#4f7d7b"/>
											<circle id="Ellipse_1" data-name="Ellipse 1" cx="41" cy="41" r="41" transform="translate(1496.5 310)" fill="#fff"/>
											<g id="Group_227" data-name="Group 227" transform="translate(-169.156 -258.655)">
												<g id="Group_225" data-name="Group 225" transform="translate(1658.13 551.129)">
												<path id="Path_171" data-name="Path 171" d="M32.9,0c18.172,0,32.9,14.479,32.9,32.34S0,50.2,0,32.34,14.731,0,32.9,0Z" transform="translate(15.623 24.837)" fill="none" stroke="#312e2b" stroke-width="3"/>
												<path id="Path_165" data-name="Path 165" d="M36.35,14.428c0-2.941-.04-11.968-16.175-10.292C6.022,5.606,4,11.487,4,14.428c0,4.411.008,11.762,12.131,11.762C32.307,26.19,36.35,18.839,36.35,14.428Z" transform="translate(12.175 31.434)" fill="#fbf9f8" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
												<path id="Path_168" data-name="Path 168" d="M12,14.428l.012-.873.04-.791.109-.876.053-.309.133-.632c.057-.215.117-.429.186-.647l.243-.656c1.359-3.288,5.1-6.578,15.4-5.508C39.652,5.327,43.149,9.42,44.067,12.493l.146.6c.02.1.04.194.053.288l.065.544.02.5-.012,1.441-.061,1.159-.081.8c-.493,4.017-2.649,8.366-11.978,8.366-13.167,0-18.294-4.87-19.746-9.06l-.214-.712q-.087-.344-.146-.691l-.085-.668Q12,14.744,12,14.428Z" transform="translate(36.525 31.434)" fill="#fbf9f8" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
												<path id="Path_169" data-name="Path 169" d="M10,15v3.174" transform="translate(30.438 32.496)" fill="none" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
												<path id="Path_170" data-name="Path 170" d="M14,15v3.174" transform="translate(42.613 32.496)" fill="none" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
												</g>
												<line id="Line_3" data-name="Line 3" y1="1.973" x2="11.187" transform="translate(1705.827 615.451)" fill="none" stroke="#312e2b" stroke-width="5"/>
												<path id="Path_172" data-name="Path 172" d="M1710.87,610.951c24.615-.7,27.138-13.21,27.138-13.21" transform="translate(0.55 5.486)" fill="none" stroke="#312e2b" stroke-width="3"/>
											</g>
											<path id="Rectangle_40" data-name="Rectangle 40" d="M14.167,0H41.833A14.167,14.167,0,0,1,56,14.167v0A2.833,2.833,0,0,1,53.167,17H2.833A2.833,2.833,0,0,1,0,14.167v0A14.167,14.167,0,0,1,14.167,0Z" transform="translate(1509.5 367)" fill="#283c3b"/>
											<g id="Mask_Group_2" data-name="Mask Group 2" transform="translate(6.5 -121)" clip-path="url(#clip-path)">
												<path id="Rectangle_41" data-name="Rectangle 41" d="M20,0H36A20,20,0,0,1,56,20v0a4,4,0,0,1-4,4H4a4,4,0,0,1-4-4v0A20,20,0,0,1,20,0Z" transform="translate(1503 488)" fill="#283c3b"/>
											</g>
											<text id="GDA" transform="translate(1523.5 380)" fill="#fbf9f8" font-size="12" font-family="SFProDisplay-Semibold, SF Pro Display" font-weight="600" letter-spacing="0.179em"><tspan x="0" y="0">GDA</tspan></text>
											</g>
										</svg>
										
										
										
										
									</div>
									I'm your new and improved <b>
									AI Agent</b> designed to 
									improve your data Interactions...
								</div>
								<div class="bg-gray-100 rounded-md py-2 px-3 ms-8 me-5">
									Let's get started...
								</div>
							</div>
						{/each}
					</div>
					<!-- xScroll Chat Window -->
				</div>
				<!-- xChat History -->
			</main>
			<!-- xMain Panel -->

			<!-- Footer -->
			<footer class="group flex p-2 border-t bg-white h-[66px]">
				<div class="{promptFocus?'shadow-innerx -mt-0.5':''} h-[49px] flex flex-1 group-hover:shadow-md transition-all transition-duration-400 group-hover:-mt-0.5 rounded-full overflow-hidden p-1 border">
					<div class="flex flex-1 ps-4">
						<input 
							on:keypress="{promptSubmit}"
							on:focus="{() => { promptFocus=true; }}"
							on:blur="{() => { promptFocus=false; }}"
							bind:value="{promptVal}"
							type="text" 
							placeholder="Type a message"
							class="{promptLoading?'pointer-events-none':''} flex-1 outline-0" />
					</div>
					<div>
						<button 
							on:click="{() => { prompt(); }}"
							class="{promptLoading?'pointer-events-none bg-bluex-500':'bg-rwg-dark'} {promptVal?.length > 0 || promptLoading?'opacity-100':'opacity-40 pointer-events-none'}  transition-all flex items-center justify-center w-10 h-10 rounded-full ">
							{#if (promptLoading)}
								<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="14.165" height="12.663" viewBox="0 0 14.165 12.663">
									<path id="Path_22" data-name="Path 22" d="M4.576,15.187c-.392.172-.587.258-.707.221a.335.335,0,0,1-.219-.218c-.038-.12.048-.316.22-.708L8.745,3.364c.155-.354.233-.53.341-.585a.335.335,0,0,1,.3,0c.108.054.186.231.341.585L14.6,14.481c.172.392.258.588.22.708a.335.335,0,0,1-.219.218c-.12.038-.316-.048-.707-.221L9.451,13.231a.719.719,0,0,0-.161-.059.333.333,0,0,0-.11,0,.72.72,0,0,0-.161.059Z" transform="translate(16.153 -2.904) rotate(90)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
								</svg>
							{/if}
						</button>
					</div>
				</div>
			</footer>
			<!-- xFooter -->
		</div>
	</div>
</section>
<!-- xChat Widget -->

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
	on:click="{toggleDisplay}"
	class="{genAIReady?'w-16 h-16':'w-0 h-0'} transition-all duration-500 delay-100 cursor-pointer absolute bottom-5 right-5 bg-rwg-dark z-[100000] rounded-lg p-2">
	<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 90 91">
		<defs>
		  <filter id="Ellipse_5" x="0" y="0" width="90" height="91" filterUnits="userSpaceOnUse">
			<feOffset dy="1" input="SourceAlpha"/>
			<feGaussianBlur result="blur"/>
			<feFlood flood-opacity="0.161"/>
			<feComposite operator="in" in2="blur"/>
			<feComposite in="SourceGraphic"/>
		  </filter>
		  <clipPath id="clip-path">
			<circle id="Ellipse_3" data-name="Ellipse 3" cx="39" cy="39" r="39" transform="translate(1492 433)" fill="#fff"/>
		  </clipPath>
		</defs>
		<g id="Group_272" data-name="Group 272" transform="translate(-1815 -969)">
		  <g transform="matrix(1, 0, 0, 1, 1815, 969)" filter="url(#Ellipse_5)">
			<g id="Ellipse_5-2" data-name="Ellipse 5" fill="#4f7d7b" stroke="#4f7d7b" stroke-width="4">
			  <circle cx="45" cy="45" r="45" stroke="none"/>
			  <circle cx="45" cy="45" r="43" fill="none"/>
			</g>
		  </g>
		  <circle id="Ellipse_1" data-name="Ellipse 1" cx="40" cy="40" r="40" transform="translate(1820 974)" fill="#fff"/>
		  <g id="Group_227" data-name="Group 227" transform="translate(153.344 404.345)">
			<g id="Group_225" data-name="Group 225" transform="translate(1658.13 551.129)">
			  <path id="Path_171" data-name="Path 171" d="M32.9,0c18.172,0,32.9,14.479,32.9,32.34S0,50.2,0,32.34,14.731,0,32.9,0Z" transform="translate(15.623 24.837)" fill="none" stroke="#312e2b" stroke-width="3"/>
			  <path id="Path_165" data-name="Path 165" d="M36.35,14.428c0-2.941-.04-11.968-16.175-10.292C6.022,5.606,4,11.487,4,14.428c0,4.411.008,11.762,12.131,11.762C32.307,26.19,36.35,18.839,36.35,14.428Z" transform="translate(12.175 31.434)" fill="#fbf9f8" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
			  <path id="Path_168" data-name="Path 168" d="M12,14.428l.012-.873.04-.791.109-.876.053-.309.133-.632c.057-.215.117-.429.186-.647l.243-.656c1.359-3.288,5.1-6.578,15.4-5.508C39.652,5.327,43.149,9.42,44.067,12.493l.146.6c.02.1.04.194.053.288l.065.544.02.5-.012,1.441-.061,1.159-.081.8c-.493,4.017-2.649,8.366-11.978,8.366-13.167,0-18.294-4.87-19.746-9.06l-.214-.712q-.087-.344-.146-.691l-.085-.668Q12,14.744,12,14.428Z" transform="translate(36.525 31.434)" fill="#fbf9f8" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
			  <path id="Path_169" data-name="Path 169" d="M10,15v3.174" transform="translate(30.438 32.496)" fill="none" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
			  <path id="Path_170" data-name="Path 170" d="M14,15v3.174" transform="translate(42.613 32.496)" fill="none" stroke="#312e2b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/>
			</g>
			<line id="Line_3" data-name="Line 3" y1="1.973" x2="11.187" transform="translate(1705.827 615.451)" fill="none" stroke="#312e2b" stroke-width="5"/>
			<path id="Path_172" data-name="Path 172" d="M1710.87,610.951c24.615-.7,27.138-13.21,27.138-13.21" transform="translate(0.55 5.486)" fill="none" stroke="#312e2b" stroke-width="3"/>
		  </g>
		  <path id="Rectangle_40" data-name="Rectangle 40" d="M14.167,0H41.833A14.167,14.167,0,0,1,56,14.167v0A2.833,2.833,0,0,1,53.167,17H2.833A2.833,2.833,0,0,1,0,14.167v0A14.167,14.167,0,0,1,14.167,0Z" transform="translate(1832 1030)" fill="#283c3b"/>
		  <g id="Mask_Group_2" data-name="Mask Group 2" transform="translate(329 542)" clip-path="url(#clip-path)">
			<path id="Rectangle_41" data-name="Rectangle 41" d="M20,0H36A20,20,0,0,1,56,20v0a4,4,0,0,1-4,4H4a4,4,0,0,1-4-4v0A20,20,0,0,1,20,0Z" transform="translate(1503 488)" fill="#283c3b"/>
		  </g>
		  <text id="GDA" transform="translate(1846 1043)" fill="#fbf9f8" font-size="12" font-family="SFProDisplay-Semibold, SF Pro Display" font-weight="600" letter-spacing="0.179em"><tspan x="0" y="0">GDA</tspan></text>
		</g>
	</svg>
</div>

<style>

	:global(.highlight) {
		background-color: yellow;
		font-weight: bold;
		cursor: pointer; /* Show pointer to indicate title on hover */
	}
	:global(#FBGDA-blockContent p) {
		margin-bottom:10px;
	}
</style>