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
      // Corner roundness follows the Appearance "Corners" setting (--radius-scale: 0 sharp, 1 default).
      borderRadius: {
        sm: 'calc(0.125rem * var(--radius-scale, 1))',
        DEFAULT: 'calc(0.25rem * var(--radius-scale, 1))',
        md: 'calc(0.375rem * var(--radius-scale, 1))',
        lg: 'calc(0.5rem * var(--radius-scale, 1))',
        xl: 'calc(0.75rem * var(--radius-scale, 1))',
        '2xl': 'calc(1rem * var(--radius-scale, 1))',
        '3xl': 'calc(1.5rem * var(--radius-scale, 1))',
      },
      fontWeight: {
        normal: 'var(--fontWeightRegular)',
        medium: 'var(--fontWeightMedium)',
        semibold: 'var(--fontWeightSemibold)',
        bold: 'var(--fontWeightBold)',
      },
      // Soft elevation: two low-alpha layers (a tight contact shadow plus a wide,
      // offset ambient one) tinted toward the theme's darkest primary instead of
      // pure black. Tailwind's own sm/md/lg/xl/2xl names are redefined here so the
      // ~95 existing `shadow-*` call sites soften without being touched.
      boxShadow: {
        'sm':    '0 1px 2px rgb(var(--p-900, 15 23 42) / 0.06), 0 1px 3px rgb(var(--p-900, 15 23 42) / 0.06)',
        DEFAULT: '0 1px 3px rgb(var(--p-900, 15 23 42) / 0.06), 0 4px 10px -2px rgb(var(--p-900, 15 23 42) / 0.08)',
        'md':    '0 2px 6px rgb(var(--p-900, 15 23 42) / 0.06), 0 10px 24px -4px rgb(var(--p-900, 15 23 42) / 0.10)',
        'lg':    '0 4px 10px rgb(var(--p-900, 15 23 42) / 0.06), 0 20px 40px -8px rgb(var(--p-900, 15 23 42) / 0.13)',
        'xl':    '0 8px 20px rgb(var(--p-900, 15 23 42) / 0.07), 0 32px 64px -12px rgb(var(--p-900, 15 23 42) / 0.16)',
        '2xl':   '0 14px 30px rgb(var(--p-900, 15 23 42) / 0.08), 0 48px 90px -16px rgb(var(--p-900, 15 23 42) / 0.22)',
        // Card tiers carry a borderless surface on their own, so they sit a step
        // heavier than the matching generic tier.
        'card':    '0 1px 3px rgb(var(--p-900, 15 23 42) / 0.06), 0 6px 16px -4px rgb(var(--p-900, 15 23 42) / 0.09)',
        'card-md': '0 2px 6px rgb(var(--p-900, 15 23 42) / 0.06), 0 14px 30px -6px rgb(var(--p-900, 15 23 42) / 0.12)',
        'card-lg': '0 4px 10px rgb(var(--p-900, 15 23 42) / 0.07), 0 24px 48px -10px rgb(var(--p-900, 15 23 42) / 0.16)',
        'glow': '0 0 20px rgb(var(--p-500) / 0.3)',
      },
      // Motion tokens. `soft` is the decelerating curve the fx-* keyframes already
      // use — entrances, hover, lift. `soft-in` is symmetric, for state swaps.
      transitionTimingFunction: {
        // DEFAULT is the curve every `transition-*` utility emits, so overriding
        // it moves all ~397 existing transition call sites onto the soft curve
        // without touching one of them. Duration is left at Tailwind's 150ms:
        // soft is about the shape of the motion, not about moving slower.
        DEFAULT: 'var(--ease-soft)',
        soft: 'var(--ease-soft)',
        'soft-in': 'var(--ease-soft-in)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      backgroundImage: {
        'gradient-primary': 'none',
        'gradient-cyan': 'none',
        'gradient-emerald': 'none',
        'gradient-amber': 'none',
        'gradient-red': 'none',
        // P3-02, SCDMS Pre-Production Readiness Audit — Findings Register:
        // the fixed "brand navy" identity used on the public-facing
        // login/lock/PIN/track pages — deliberately not tied to the
        // swappable `primary` theme color, since branding on those pages
        // should stay constant regardless of the logged-in dashboard's
        // theme. Was copy-pasted as an inline style 7 times across 4 files.
        'gradient-dark': 'linear-gradient(135deg, #0c2451 0%, #1a4080 100%)',
      },
      // Entrances decelerate on the shared soft curve; exits stay quicker and
      // use the symmetric one, so leaving never feels slower than arriving.
      animation: {
        'shimmer': 'shimmer 1.4s infinite',
        'slide-in-right': 'slideInRight var(--dur-slow) var(--ease-soft)',
        'slide-out-right': 'slideOutRight var(--dur-base) var(--ease-soft-in)',
        'slide-in-left': 'slideInLeft var(--dur-slow) var(--ease-soft)',
        'slide-out-left': 'slideOutLeft var(--dur-base) var(--ease-soft-in)',
        'fade-in': 'fadeIn var(--dur-base) var(--ease-soft)',
        'scale-in': 'scaleIn var(--dur-base) var(--ease-soft)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
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
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
