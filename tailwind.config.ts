/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './content/**/*.{md,mdx}'],
  darkMode: ['class'],
  theme: {
    screens: {
      sm: '640px',
    },
    colors: {
      'cloudflare-darktheme-bg': '#1d1d1d',
      'cloudflare-darktheme-font': '#d9d9d9',
    },
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
}
