import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        hero: {
          start: 'hsl(var(--hero-start))',
          end: 'hsl(var(--hero-end))',
        },
        ivory: {
          DEFAULT: 'hsl(var(--ivory))',
          warm: 'hsl(var(--ivory-warm))',
        },
        charcoal: 'hsl(var(--charcoal))',
        'gold-text': 'hsl(var(--gold-text))',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-heading)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 14px 34px rgb(0 0 0 / 0.08)',
        elevated:
          '0 4px 16px -4px rgb(122 31 43 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        modal: '0 20px 60px -15px rgb(0 0 0 / 0.2)',
        hero: '0 22px 52px rgb(0 0 0 / 0.30)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(.22,.61,.36,1)',
      },
      transitionDuration: {
        250: '250ms',
      },
    },
  },
  plugins: [],
};

export default config;
