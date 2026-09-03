/** @type {import('tailwindcss').Config} */
export default {
  // El tema oscuro se controla por clase añadida al <html> (`class="dark"`)
  darkMode: 'class',

  // Rutas donde Tailwind escanea clases utilitarias
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      // ─────────────────────────────────────────────────────
      // SISTEMA DE DISEÑO "QUESITO" — Dual Theme (claro/oscuro)
      // Paleta de marca bloqueada: naranja + amarillo únicamente
      // ─────────────────────────────────────────────────────
      colors: {
        quesito: {
          orange: '#ff9f1c',
          orangeBright: '#ffb347',
          yellow: '#ffd23f',
          yellowBright: '#ffe06b',
          dark: '#2a1804',
        },

        // Superficies / fondos — valores claros y oscuros
        surface: {
          // Modo OSCURO: fondos abisales
          dark: {
            base: '#0a0a0a',      // Fondo raíz abisal
            s1: '#121212',        // Cards y paneles
            s2: '#1c1c1c',        // Elementos dentro de cards
            s3: '#262626',        // Hover, inputs
            border: '#2e2e2e',    // Bordes
          },
          // Modo CLARO: fondos limpios y suaves
          light: {
            base: '#f7f3ec',
            s1: '#ffffff',        // Cards
            s2: '#f1ece3',        // Elementos dentro de cards
            s3: '#e9e3d8',        // Hover, inputs
            border: '#e0d9cc',    // Bordes
          },
        },

        // Texto — jerarquía clara que siempre destaca del fondo
        ink: {
          // OSCURO: gris muy claro / blanco sobre fondos abisales
          dark: {
            hi: '#f5f5f5',
            mid: '#cfcfcf',
            faint: '#9a9a9a',
          },
          // CLARO: oscuros nítidos sobre fondos suaves
          light: {
            hi: '#1a160f',
            mid: '#463d2f',
            faint: '#7a6f5d',
          },
        },
      },

      fontFamily: {
        // Títulos geométricos — Clash Display (importado vía fontsource)
        display: ['"Clash Display"', 'Inter', 'Segoe UI', 'sans-serif'],
        // Cuerpo legible
        body: ['Inter', 'Segoe UI', 'sans-serif'],
        // Consolas WebSocket — monoespaciada
        mono: ['"JetBrains Mono"', 'Fira Code', 'Consolas', 'monospace'],
      },

      dropShadow: {
        // Glow difuminado de marca, legible sin opacar el texto
        'quesito': '0 0 22px rgba(255, 159, 28, 0.45)',
        'quesito-yellow': '0 0 22px rgba(255, 210, 63, 0.4)',
      },

      boxShadow: {
        'glow-sm': '0 0 12px rgba(255, 159, 28, 0.35)',
        'glow': '0 0 22px rgba(255, 159, 28, 0.45)',
        'glow-lg': '0 0 40px rgba(255, 159, 28, 0.5)',
        'glass-dark': '0 8px 24px rgba(0,0,0,0.6)',
        'glass-light': '0 8px 24px rgba(60,40,10,0.12)',
      },

      backgroundImage: {
        // Gradiente oficial de marca (naranja → amarillo)
        'brand': 'linear-gradient(135deg, #ff9f1c 0%, #ffd23f 100%)',
        'brand-hover': 'linear-gradient(135deg, #ffb347 0%, #ffe06b 100%)',
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      animation: {
        'aurora': 'aurora-drift 26s ease-in-out infinite alternate',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },

      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(255,159,28,0.3)' },
          '50%': { boxShadow: '0 0 28px rgba(255,159,28,0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },

  plugins: [
    require('@tailwindcss/forms'),
  ],
}
