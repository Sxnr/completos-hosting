import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Desactivada: genera falsos positivos con el patrón legítimo
      // "cargar datos / suscribirse al montar" (useEffect + setState) que
      // usa deliberadamente todo el proyecto. La regla asume que cualquier
      // setState en un effect es un error, pero load-on-mount es válido en React.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
