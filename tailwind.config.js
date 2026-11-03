/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // surfaces and text come from CSS variables so the dark map theme is one class switch
        surface: v('surface'),
        raised: v('raised'),
        sunken: v('sunken'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          400: '#5b8cf6',
          500: '#3a6ff0',
          600: '#2557d6',
          700: '#1e45ad',
          800: '#1d3c8a',
        },
        sev: {
          low: '#e0a800',
          medium: '#f26b1d',
          high: '#dc2f2f',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        float: '0 1px 2px rgb(15 23 42 / 0.10), 0 4px 14px rgb(15 23 42 / 0.12)',
        sheet: '0 -2px 10px rgb(15 23 42 / 0.10), 0 -10px 30px rgb(15 23 42 / 0.10)',
        panel: '2px 0 12px rgb(15 23 42 / 0.10)',
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'panel-in': { from: { transform: 'translateX(-16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { transform: 'scale(.96)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: {
        'sheet-up': 'sheet-up .22s cubic-bezier(.2,.8,.2,1)',
        'panel-in': 'panel-in .2s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .18s ease-out',
        'pop-in': 'pop-in .16s ease-out',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
