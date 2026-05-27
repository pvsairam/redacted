/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Graphite palette: the core surface system
        graphite: {
          950: '#080808',
          900: '#0a0a0a',
          800: '#111111',
          700: '#161616',
          600: '#1c1c1c',
          500: '#242424',
          400: '#2a2a2a',
          300: '#3a3a3a',
          200: '#4a4a4a',
          100: '#6b7280',
          50:  '#9ca3af',
        },
        // Off-white for primary text
        chalk: {
          DEFAULT: '#f5f5f5',
          100: '#e5e7eb',
          200: '#d1d5db',
        },
        // Semantic colors
        success: {
          DEFAULT: '#22c55e',
          muted: '#16a34a',
          bg: '#0d1f12',
          border: '#1a3a1f',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#dc2626',
          bg: '#1c0e0e',
          border: '#3a1515',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#d97706',
          bg: '#1c160a',
          border: '#3a2f10',
        },
        info: {
          DEFAULT: '#3b82f6',
          bg: '#0d1626',
          border: '#1a2a4a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        crisp: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'crisp-lg': '0 4px 16px rgba(0,0,0,0.4)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
