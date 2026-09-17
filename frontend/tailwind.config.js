/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand accent — teal/cyan (fintech "money" tone)
        primary: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
        },
        // Secondary accent — soft sky blue (complements teal)
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        // Unified neutral — deep navy scale
        // Light: bg #F6F8FA, cards #FFFFFF, borders #E2E6EC
        // Dark : base #080D18, surface #0E1526, elevated #131C31, borders #1F2A44
        navy: {
          50: '#F6F8FA',
          100: '#EAEEF4',
          200: '#D5DCE6',
          300: '#B4BFD0',
          400: '#8C9AB0',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#10182B',
          950: '#080D18',
        },
        // Keep gray mapped to navy so existing gray-* utilities keep working
        gray: {
          50: '#F6F8FA',
          100: '#EAEEF4',
          200: '#D5DCE6',
          300: '#B4BFD0',
          400: '#8C9AB0',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#10182B',
          950: '#080D18',
        },
        // Success / active — fresh emerald (distinct from teal brand)
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        // Warning — warm amber
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // Danger — reserved for destructive actions
        red: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
        border: '#D5DCE6',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(8, 13, 24, 0.08)',
        'card-hover': '0 10px 36px rgba(8, 13, 24, 0.14)',
        glow: '0 0 0 3px rgba(20, 184, 166, 0.15)',
        'glow-strong': '0 0 0 4px rgba(20, 184, 166, 0.22)',
        'btn-primary': '0 4px 16px rgba(20, 184, 166, 0.3)',
      },
      borderRadius: {
        card: '1rem',
        'input-sm': '0.625rem',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
