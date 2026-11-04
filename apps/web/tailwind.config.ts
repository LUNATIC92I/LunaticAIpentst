import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark, blue-black base with graphite/metal greys.
        bg: '#070b11',
        'bg-elevated': '#0b111a',
        surface: '#101826',
        'surface-2': '#15202f',
        border: '#1e2b3c',
        graphite: '#273344',
        metal: '#3a4a60',
        text: '#e6edf3',
        'text-muted': '#8b98a9',
        'text-dim': '#5c6b7e',
        // Accents: turquoise + electric blue.
        accent: '#2dd4bf',
        'accent-strong': '#14b8a6',
        electric: '#38bdf8',
        'electric-strong': '#0ea5e9',
        success: '#34d399',
        warn: '#fbbf24',
        danger: '#f87171',
        critical: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(45,212,191,0.15), 0 8px 30px -12px rgba(56,189,248,0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-in': 'fade-in 0.3s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
