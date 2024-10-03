/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		colors: {
			rwg: {
				dark:'#283C3B'
			},
			rwb: {
				light:'#565451'
			},
			rww: {
				light:'#F1EFED'
			},
			primary: {
				DEFAULT: '#1D2731', // Dark blue/navy (Primary)
				light: '#394451',  // Lighter shades of primary
				dark: '#0F1720',   // Darker shades of primary
			},
			secondary: {
				DEFAULT: '#F80000', // Oracle Red (Accent)
				light: '#FF4D4D',   // Lighter shades of red
				dark: '#B30000',    // Darker shades of red
			},
			neutral: {
				DEFAULT: '#F4F4F4', // Neutral background
				dark: '#312E2B',    // Dark neutral for borders
				light: '#FFFFFF',   // Light background
			},
			blue: {
				DEFAULT: '#005B9F', // Accent blue for links/buttons
				light: '#337BBF',
				dark: '#00386F',
			},
			green: {
				DEFAULT: '#008577', // Accent green for success
				light: '#33A598',
				dark: '#00574F',
			},
			orange: {
				DEFAULT: '#F68B1F', // Accent orange for warnings
				light: '#F9A94B',
				dark: '#C6620B',
			},
			purple: {
				DEFAULT: '#9B5DE5', // Accent purple
				light: '#B074F2',
				dark: '#7B34C0',
			},
			taskbar: {
				green:'#61C554',
				orange:'#F5BF4F',
				red:'#EC6A5F'
			},

			transparent: 'transparent',
			current: 'currentColor',

			slate: colors.slate,
			black: colors.black,
			bluex: colors.blue,
			red: colors.red,
			sky: colors.sky,
			white: colors.white,
			gray: colors.gray,
			emerald: colors.emerald,
			indigo: colors.indigo,
			yellow: colors.yellow,
		},

		extend: {
			height: {
				screen: ['100vh /* fallback for Opera, IE and etc. */', '100svh'],
			},
			fontFamily: {
				Inter: ['Inter', 'sans-serif'],
				'sans': ['"Source Sans 3"', ...defaultTheme.fontFamily.sans],
			},
			boxShadow: {
				'top-bottom-2px': '0 0px 0px 1px rgba(38, 128, 235, 1), 0 -2px 0px -1px rgba(38, 128, 235, 1)',
				'innerx': '0px 0px 0px 0px rgba(0,0,0,1), inset0px 0px 0px 0px rgba(0,0,0,1)'
			  }
		},
	},
	plugins: [],
}

