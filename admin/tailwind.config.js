/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F3F0FF',
          100: '#E6E0FF',
          200: '#D1C4FF',
          300: '#B49BFF',
          400: '#946BFF',
          500: '#6C5CE7',
          600: '#5B46E0',
          700: '#4A32D1',
          800: '#3D28B3',
          900: '#322096',
          950: '#1D1063',
        },
      },
    },
  },
  plugins: [],
};
