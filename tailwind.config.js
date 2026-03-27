/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
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
        warm: {
          50: '#fdf8f0',
          100: '#f5ede0',
          200: '#ecdcc4',
          300: '#dfc59e',
          400: '#d4ab73',
          500: '#c99354',
          600: '#b87a3d',
          700: '#9a6233',
          800: '#7d4f2d',
          900: '#664127',
          950: '#3a2213',
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
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      animation: {
        'loading-bar': 'loading-bar 1.5s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'scale-in': 'scale-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'loading-bar': {
          '0%': { width: '0%', marginLeft: '0%' },
          '50%': { width: '60%', marginLeft: '20%' },
          '100%': { width: '0%', marginLeft: '100%' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
