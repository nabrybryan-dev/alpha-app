import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { TotalDia } from '../../domain/nutricion/dia'
import type { RegistroComida } from '../../domain/types'
import { VISIBILIDAD_POR_DEFECTO } from '../../domain/nutricion/visibilidad'
import { ResumenDia } from './ResumenDia'
import { FilaComida } from './FilaComida'
import { reiniciarOrganizacionViva, useOrganizacionVisible } from '../../app/organizacionViva'
import { CUENTAS_CON_DISENO_FINAL } from '../../domain/praxis/rapidezLocal'

/**
 * Las tarjetas nuevas de Nutricion (PR 431) quedan detras de una bandera de build,
 * apagada por defecto: sin `VITE_NUTRI_TARJETAS_ACTIVO=true` se ve el aspecto de siempre.
 */
const TOTAL: TotalDia = {
  porDia: { kcal: 500, proteina_g: 40, carbos_g: 60, grasa_g: 20 },
  parciales: new Set(),
  margenPct: 10,
}
const META = { kcal: 2000, proteinaG: 120, carbosG: 220, grasaG: 60 }
const COMIDA: RegistroComida = {
  id: 'c1',
  usuarioId: 'u-valentina',
  momentoIso: '2026-10-22T13:27:00',
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'estimado',
  items: [],
}

const pintar = () =>
  render(
    <>
      <ResumenDia total={TOTAL} meta={META} visibilidad={VISIBILIDAD_POR_DEFECTO} />
      <FilaComida comida={COMIDA} kcal={0} resumen="" verKcal onAbrir={() => {}} />
    </>,
  ).container.innerHTML

describe('bandera de las tarjetas nuevas de Nutricion', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    reiniciarOrganizacionViva()
  })

  it('con la bandera apagada, la cuenta con el diseño final ve las tarjetas nuevas (13-nov) y otra cuenta no', () => {
    vi.stubEnv('VITE_NUTRI_TARJETAS_ACTIVO', '')
    const conSesion = (usuarioId: string) => {
      function Sesion() {
        useOrganizacionVisible(usuarioId)
        return null
      }
      return render(
        <>
          <Sesion />
          <ResumenDia total={TOTAL} meta={META} visibilidad={VISIBILIDAD_POR_DEFECTO} />
          <FilaComida comida={COMIDA} kcal={0} resumen="" verKcal onAbrir={() => {}} />
        </>,
      )
    }
    const propia = conSesion([...CUENTAS_CON_DISENO_FINAL][0]!)
    for (const c of ['nutri-resumen', 'nutri-tile-macro', 'nutri-fila-comida']) expect(propia.container.innerHTML).toContain(c)
    propia.unmount()
    reiniciarOrganizacionViva()
    expect(conSesion('00000000-0000-0000-0000-0000000000cc').container.innerHTML).not.toContain('nutri-')
  })

  it('apagada (por defecto) no aparece ninguna clase nutri-', () => {
    vi.stubEnv('VITE_NUTRI_TARJETAS_ACTIVO', '')
    expect(pintar()).not.toContain('nutri-')
  })
  it('encendida pinta las clases nuevas', () => {
    vi.stubEnv('VITE_NUTRI_TARJETAS_ACTIVO', 'true')
    const html = pintar()
    for (const c of ['nutri-resumen', 'nutri-pista-kcal', 'nutri-tile-macro', 'nutri-chip-margen', 'nutri-fila-comida'])
      expect(html).toContain(c)
  })
})
