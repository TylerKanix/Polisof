/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Plane / surface stack — the terminal's chrome.
        void: '#07080b',
        plane: '#0b0d12',
        surface: '#11141c',
        raised: '#161a24',
        hairline: 'rgba(255,255,255,0.08)',
        // Ink
        ink: '#f2f4f8',
        'ink-2': '#a8b0c2',
        'ink-3': '#6b7488',
        // Party poles (diverging)
        dem: '#3987e5',
        gop: '#e34948',
        ind: '#c98500',
        grn: '#199e70',
        lib: '#9085e9',
      },
      boxShadow: {
        lift: '0 24px 60px -20px rgba(0,0,0,0.85), 0 2px 8px -2px rgba(0,0,0,0.6)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
