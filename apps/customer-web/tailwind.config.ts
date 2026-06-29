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
        olive: {
          DEFAULT: 'hsl(80 28% 32%)',
          light: 'hsl(80 22% 94%)',
          dark: 'hsl(80 28% 22%)',
        },
        terracotta: {
          DEFAULT: 'hsl(15 48% 48%)',
          light: 'hsl(15 40% 95%)',
        },
        charcoal: {
          DEFAULT: 'hsl(0 0% 18%)',
        },
        ivory: {
          DEFAULT: 'hsl(39 50% 97%)',
          warm: 'hsl(37 40% 94%)',
        },
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
        'card-hover': '0 12px 36px -6px rgb(0 0 0 / 0.12), 0 4px 12px -4px rgb(0 0 0 / 0.07)',
        elevated: '0 4px 16px -4px rgb(122 31 43 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        'elevated-hover': '0 20px 52px -8px rgb(0 0 0 / 0.14), 0 8px 20px -6px rgb(0 0 0 / 0.08)',
        modal: '0 20px 60px -15px rgb(0 0 0 / 0.2)',
        hero: '0 24px 72px rgb(0 0 0 / 0.42)',
      },
      transitionTimingFunction: {
        'ease-premium': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
};

export default config;
