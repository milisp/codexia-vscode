const { heroui } = require("@heroui/react")

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				"azeret-mono": ['"Azeret Mono"', "monospace"],
			},
		},
	},
	darkMode: "class",
	plugins: [
		heroui({
			defaultTheme: "vscode",
			themes: {
				vscode: {
					colors: {
						background: "",
					},
				},
			},
		}),
		function({ addComponents }) {
			addComponents({
				'.vscode-border-top': {
					'border-top-color': 'var(--vscode-input-border)',
				},
				'.vscode-input-container': {
					'background-color': 'var(--vscode-input-background)',
					'border': '1px solid var(--vscode-input-border)',
				},
				'.vscode-textarea': {
					'color': 'var(--vscode-input-foreground)',
					'font-size': 'var(--vscode-font-size)',
					'font-family': 'var(--vscode-font-family)',
				},
				'.vscode-send-button': {
					'&:not(:disabled)': {
						'background-color': 'var(--vscode-button-background)',
						'color': 'var(--vscode-button-foreground)',
					},
					'&:disabled': {
						'background-color': 'var(--vscode-button-secondaryBackground)',
						'color': 'var(--vscode-button-secondaryForeground)',
					},
				},
			})
		},
	],
}
