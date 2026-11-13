import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Rol } from '../domain/types'
import { piezasPara } from './catalogoDePiezas'
import type { PerfilAcceso } from './rutas'

/**
 * La Edge Function `praxis-organizar` no puede importar el catálogo (depende de react-router), así que lleva una
 * COPIA de los ids y nombres en `supabase/functions/praxis-organizar/menu.ts`. Esta prueba la mantiene al día:
 * si el catálogo cambia y la copia no, falla y dice cómo regenerarla (`GENERAR_MENU=1 npx vitest run src/app/menuOrganizar.test.ts`).
 */
const RUTA = 'supabase/functions/praxis-organizar/menu.ts'
const ASESORADO: PerfilAcceso = { rol: 'asesorado' as Rol, capacidades: new Set() }

const generar = (): string => {
  const filas = piezasPara(ASESORADO).map((p) => `  { id: ${JSON.stringify(p.id)}, nombre: ${JSON.stringify(p.nombreHablado)} },`)
  return `// GENERADO por src/app/menuOrganizar.test.ts: no se edita a mano. Ids y nombres de las piezas que ve un asesorado.
export const PIEZAS_DEL_MENU: readonly { id: string; nombre: string }[] = [
${filas.join('\n')}
]
`
}

describe('menú de piezas de praxis-organizar', () => {
  it('la copia del catálogo está al día', () => {
    if (process.env.GENERAR_MENU === '1') writeFileSync(RUTA, generar())
    expect(readFileSync(RUTA, 'utf8').replace(/\r\n/g, '\n')).toBe(generar())
  })
})
