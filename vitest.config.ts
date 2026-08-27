import { defineConfig } from 'vitest/config'

/**
 * Config aparte de `vite.config.ts` a propósito.
 *
 * La de producción arrastra TanStack Start y Paraglide, y exige las
 * variables de build. Nada de eso hace falta para probar funciones puras, y
 * cargarlo volvería las pruebas lentas y frágiles.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    /**
     * La escotilla de desarrollo abre la ventana de registro pase lo que pase.
     * Si alguien la tiene puesta en su shell, las pruebas de `ventanaAbierta`
     * fallarían por el entorno y no por el código.
     */
    env: { VENTANA_SIEMPRE_ABIERTA: '' },
  },
})
