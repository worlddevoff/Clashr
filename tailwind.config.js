/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08060e',
          900: '#0f0c1a',
          850: '#171230',
          800: '#1c1838',
          700: '#252048',
          600: '#3a3458',
        },
        muted: '#948cae',
        line: 'rgba(255,255,255,0.09)',
        neon: {
          cyan: '#2fe0f0',
          magenta: '#ff2b2b',
          lime: '#c9f74a',
          amber: '#ffb020',
          violet: '#a78bfa',
          soft: '#ff6e6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Sora', 'system-ui', 'sans-serif'],
        display: ['Chakra Petch', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 30px 80px -40px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(255,43,43,0.35), 0 18px 60px -20px rgba(255,43,43,0.45)',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.23, 1, 0.32, 1)',
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
