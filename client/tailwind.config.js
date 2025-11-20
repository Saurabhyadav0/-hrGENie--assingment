/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0077ff',
        secondary: '#0f172a',
      },
    },
  },
  plugins: [],
};

