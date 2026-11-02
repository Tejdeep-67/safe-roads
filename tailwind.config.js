/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: {
          950: '#0a0b0d',
          900: '#0f1114',
          850: '#14171b',
          800: '#191c21',
          700: '#22262d',
          600: '#2d323a',
          500: '#3b414b',
        },
        amber: {
          DEFAULT: '#f5b301',
          soft: '#ffd166',
          deep: '#d99a00',
        },
        signal: '#2dd4bf',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(245,179,1,0.35), 0 10px 40px -10px rgba(245,179,1,0.35)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -25px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'lane-dash': { from: { backgroundPositionY: '0' }, to: { backgroundPositionY: '120px' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        scan: { '0%': { transform: 'translateY(-10%)' }, '100%': { transform: 'translateY(110%)' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: {
        'lane-dash': 'lane-dash 1.6s linear infinite',
        'fade-up': 'fade-up .6s cubic-bezier(.2,.7,.2,1) both',
        scan: 'scan 3.2s cubic-bezier(.45,0,.55,1) infinite alternate',
        pulse2: 'pulse2 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
