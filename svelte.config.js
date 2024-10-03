import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			//The built-in $lib alias is controlled by config.kit.files.lib as it is used for packaging.
			//"$lib": ["src/lib"],
			//"$lib/*": ["src/lib/*"],
			src: 'src',
			'src/*': 'src/*',
		},
	},
	preprocess: vitePreprocess()
};

export default config;
