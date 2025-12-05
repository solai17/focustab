/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Playfair Display', 'Georgia', 'serif'],
        'body': ['DM Sans', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'void': '#0a0a0b',
        'obsidian': '#111113',
        'slate': '#1a1a1f',
        'ash': '#2a2a32',
        'smoke': '#8a8a99',
        'pearl': '#e8e8ed',
        'life': '#4ade80',
        'life-dim': '#166534',
        'amber': '#f59e0b',
        'rose': '#f43f5e',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(74, 222, 128, 0.1)' },
          '100%': { boxShadow: '0 0 30px rgba(74, 222, 128, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
