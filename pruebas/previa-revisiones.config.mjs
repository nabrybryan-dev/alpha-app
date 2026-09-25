import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Solo para inspección local. La app de producción no importa estos dobles.
export default defineConfig({
  plugins: [react(), {
    name: 'revisiones-sinteticas',
    enforce: 'pre',
    resolveId(fuente, origen) {
      if (origen?.replaceAll('\\', '/').endsWith('/RevisionesPage.tsx')
          && ['../../data/nube/revisiones', '../../data/dbInstance'].includes(fuente)) {
        return resolve('pruebas/previa-revisiones-datos.ts')
      }
    },
  }],
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
})
