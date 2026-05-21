import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'jkuat-green': '#1a5c2a',
        'jkuat-navy': '#1a3060',
        'jkuat-gold': '#c8a000',
      },
    },
  },
  plugins: [],
} satisfies Config
