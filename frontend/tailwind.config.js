/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'rgb(var(--p-50)  / <alpha-value>)',
          100: 'rgb(var(--p-100) / <alpha-value>)',
          200: 'rgb(var(--p-200) / <alpha-value>)',
          300: 'rgb(var(--p-300) / <alpha-value>)',
          400: 'rgb(var(--p-400) / <alpha-value>)',
          500: 'rgb(var(--p-500) / <alpha-value>)',
          600: 'rgb(var(--p-600) / <alpha-value>)',
          700: 'rgb(var(--p-700) / <alpha-value>)',
          800: 'rgb(var(--p-800) / <alpha-value>)',
          900: 'rgb(var(--p-900) / <alpha-value>)',
        },
        brand: {
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['var(--fontFamilyBase)'],
        mono: ['var(--fontFamilyMonospace)'],
        serif: ['var(--fontFamilyBase)'],
      },
      fontSize: {
        '2xs': ['var(--fontSizeBase100)', { lineHeight: 'var(--lineHeightBase100)' }],
        xs: ['var(--fontSizeBase200)', { lineHeight: 'var(--lineHeightBase200)' }],
        sm: ['var(--fontSizeBase300)', { lineHeight: 'var(--lineHeightBase300)' }],
        base: ['var(--fontSizeBase300)', { lineHeight: 'var(--lineHeightBase300)' }],
        lg: ['var(--fontSizeBase400)', { lineHeight: 'var(--lineHeightBase400)' }],
        xl: ['var(--fontSizeBase500)', { lineHeight: 'var(--lineHeightBase500)' }],
        '2xl': ['var(--fontSizeBase600)', { lineHeight: 'var(--lineHeightBase600)' }],
        '3xl': ['var(--fontSizeHero700)', { lineHeight: 'var(--lineHeightHero700)' }],
        '4xl': ['var(--fontSizeHero800)', { lineHeight: 'var(--lineHeightHero800)' }],
        '5xl': ['var(--fontSizeHero900)', { lineHeight: 'var(--lineHeightHero900)' }],
        '6xl': ['var(--fontSizeHero1000)', { lineHeight: 'var(--lineHeightHero1000)' }],
      },
      fontWeight: {
        normal: 'var(--fontWeightRegular)',
        medium: 'var(--fontWeightMedium)',
        semibold: 'var(--fontWeightSemibold)',
        bold: 'var(--fontWeightBold)',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-md': '0 4px 8px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.07)',
        'card-lg': '0 10px 18px -3px rgba(0,0,0,0.10), 0 4px 8px -4px rgba(0,0,0,0.07)',
        'glow': '0 0 20px rgb(var(--p-500) / 0.3)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'none',
        'gradient-cyan': 'none',
        'gradient-emerald': 'none',
        'gradient-amber': 'none',
        'gradient-red': 'none',
        'gradient-dark': 'none',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-out-left': 'slideOutLeft 0.3s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
