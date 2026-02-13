/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        secondary: {
          DEFAULT: '#2c3e50',
          light: '#3498db',
        },
        success: '#27ae60',
        warning: '#f39c12',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'loading-bar': 'loading-bar 1.5s ease-in-out infinite',
      },
      keyframes: {
        'loading-bar': {
          '0%': { width: '0%', marginLeft: '0%' },
          '50%': { width: '60%', marginLeft: '20%' },
          '100%': { width: '0%', marginLeft: '100%' },
        },
      },
    },
  },
  plugins: [],
};
