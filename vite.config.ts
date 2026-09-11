import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Respeta el puerto que asigne el entorno (p. ej. el panel de vista previa)
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    rollupOptions: {
      output: {
        // Separar los vendors estables del código propio: al desplegar una
        // versión nueva, el navegador solo re-descarga el código de la app,
        // no React ni supabase-js.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        /**
         * EL GIMNASIO SE QUEDA GUARDADO EN EL TELÉFONO.
         *
         * El salón son 1,1 MB entre la sala 3D y sus texturas, y hasta ahora no los
         * guardaba nadie: el service worker precarga los 74 archivos de la app —código,
         * estilos, iconos— pero no toca `piezas/` ni `texturas/`. O sea que un gimnasio
         * con mala cobertura dejaba la sala sin aparecer, que es exactamente donde se usa
         * esto.
         *
         * Se guarda **al abrir el salón, no al abrir la app**. Precargarlo obligaría a
         * bajar 1,1 MB a quien entra a mirar la comida o el chat y no va a entrenar. Con
         * esto lo paga quien lo usa, una vez.
         *
         * Y se sirve `StaleWhileRevalidate` y no `CacheFirst` por una razón concreta: el
         * nombre del archivo NO cambia cuando reexportamos la sala —siempre es
         * `sala-gimnasio.pieza.br`—, así que «primero la copia guardada» dejaría el
         * gimnasio viejo congelado para siempre en el móvil de quien ya entró. Así se
         * pinta al instante desde la copia y se comprueba por detrás: como mucho se ve un
         * despliegue por detrás, y se arregla solo la próxima vez que se abre.
         */
        runtimeCaching: [
          {
            urlPattern: /\/(piezas|texturas)\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gimnasio-3d',
              // Doce archivos son de sobra para la sala y sus cinco texturas, con sitio
              // para las piezas que entren. Dos meses sin abrir /entrenar y se suelta.
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 },
              // Sin el 0 no se guardaría nada que venga de otro sitio; y sin acotar los
              // estados se guardaría un 404 y el salón se quedaría sin sala hasta que
              // caducara.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Alpha Athletics',
        short_name: 'Alpha',
        description: 'Entrenamiento y nutrición 100% individualizados',
        lang: 'es',
        display: 'standalone',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
