/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06060b',
          900: '#0b0b15',
          850: '#101021',
          800: '#15152b',
          700: '#1d1d38',
          600: '#2a2a4d',
        },
        neon: {
          cyan: '#22e5ff',
          magenta: '#ff2ea8',
          lime: '#b2ff59',
          amber: '#ffb020',
          violet: '#a06bff',
        },
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        display: ['Chakra Petch', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 20px 60px -20px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.4s cubic-bezier(0.23,1,0.32,1) infinite',
      },
    },
  },
  plugins: [],
};
