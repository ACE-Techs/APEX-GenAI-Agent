import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const appConfig = { instance: 'DEV' }

/**
 * Store Framework
 */
const setup = {
	i18n:'eng',
	conversation:[
		// {
		// 	userMsg:'',
		// 	intent:{},
		//	smallTalk:''
		//  flagi18n:false,
		// }
	]
};

/**
 * Store App
 * 
 */
function manageApp() {
	let store = setup;
	// if (browser) {
	// 	if (sessionStorage.getItem(`${appConfig.instance}_app`)) {
	// 		const storedUpdates = JSON.parse(sessionStorage.getItem(`${appConfig.instance}_app`));
	// 		store = {
	// 			...setup,
	// 			...storedUpdates,
	// 		}
	// 	} else {
	// 		store = setup;
	// 	}
	// }

	const { subscribe, set, update } = writable(store);

	return {
		/**
		 * Subscribe to updates
		 */
		subscribe,
		/**
		 * updateVal
		 */
		updateVal: (key, val) => {
			//console.info('[app][updateVal]', key, val);
			update((a) => {
				//console.log('update',a,data)
				if (typeof (a[key]) !== 'undefined') {
					//console.log('updating.........', a[key], val);
					a[key] = val;
				}
				return a;
			});
		},

		/**
		 * updateLang
		 */
		updateLang:(lang) => {
			update((a) => {
				a.i18n = lang;
				return a;
			});
		},

		/**
		 * flagLang
		 */
		flagLang: (lang) => {
			update((a) => {
				let lastMsg = a.conversation.length-1;
				a.conversation[lastMsg].flagi18n = lang;

				return a;
			});
		},

		/**
		 * createNewMsg
		 */
		createNewMsg: (msg) => {
			update((a) => {
				a.conversation.push({
					userMsg:msg,
					//genAIRes:{},
					//ODARes:{},
				});

				return a;
			});
		},

		/**
		 * updateLastUserMsg
		 * @param {*} msg 
		 */
		updateLastUserMsg: (msg) => {
			console.log('updating msg',msg);
			update((a) => {
				let lastMsg = a.conversation.length-1;
				a.conversation[lastMsg].userMsg = msg;

				return a;
			});
		},


		/**
		 * smallTalkResponse
		 */
		smallTalkResponse: (msg) => {
			update((a) => {
				let lastMsg = a.conversation.length-1
				a.conversation[lastMsg].smallTalk = msg;

				return a;
			});
		},

		/**
		 * setIntent
		 */
		setIntent: (intentObj) => {
			update((a) => {
				let lastMsg = a.conversation.length-1
				a.conversation[lastMsg].intent = intentObj;

				return a;
			});
		},

		/**
		 * store
		 * store data for quick access designed for page refresh ie f5
		 */
		store: () => {
			update((a) => {
				try {
					sessionStorage.setItem(`${appConfig.instance}_app`, JSON.stringify(a));
				// Implement cleanup...
				} catch (e) {
					if (e.name === 'QuotaExceededError') {
						console.error('Storage limit exceeded');
						
						a = setup;
						sessionStorage.setItem(`${appConfig.instance}_app`, JSON.stringify(a));
					}
				}

				return a;
			});
		},

		/**
		 * reset the state
		 */
		reset: () => set(setup),
	};
}

const app = manageApp();

//store all store data in session storage for easy access to read in console
app.subscribe((val) => {
	if (browser) {
		//if debug mode enabled then store all the data
		//if (sessionStorage.getItem('debug') === 'true') {
			try {
				sessionStorage.setItem(`${appConfig.instance}_app`, JSON.stringify(val));
			} catch (e) {
				if (e.name === 'QuotaExceededError') {
					console.error('Storage limit exceeded');
					// Implement cleanup...
				}
			}
		//}
	}
});

export { app };