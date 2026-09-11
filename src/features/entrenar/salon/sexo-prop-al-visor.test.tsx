import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../../app/SessionProvider'
import { ThemeProvider } from '../../../app/ThemeProvider'
import { db, hoyIso } from '../../../data/dbInstance'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import { indiceRecuperacion } from '../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import type { SexoDeFicha } from '../../../domain/types'
import RutaPage from '../RutaPage'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * EL SEXO DE LA FICHA LLEGA AL VISOR — o no llega, y eso también se prueba.
 *
 * La mitad de abajo ya existía: `juegoDeHuesos.ts` y la prop `sexo` de
 * `VisorPatron`. Esto es la costura de arriba: que el salón le pase al visor lo
 * que el coach indicó en la ficha, tal cual —'mujer' es 'mujer', 'hombre' es
 * 'hombre'—, y que sin dato NO le pase nada, para que el defecto lo decida el
 * visor y no el salón.
 *
 * El visor se sustituye por un espía porque jsdom no tiene WebGL; lo que dibuja
 * cada juego lo vigila `juegoDeHuesos.test.ts`. Aquí solo importa QUÉ recibe.
 */

const espia = vi.hoisted(() => ({ recibidas: [] as Record<string, unknown>[] }))

vi.mock('../visor/VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    espia.recibidas.push(props)
    return null
  },
}))

function montarSalon(sexo: SexoDeFicha | undefined) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion = microciclo.sesiones.find((s) => s.ejercicios.length > 0)
  const hoy = hoyIso()
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  render(
    <MemoryRouter>
      <SalonEntrenar
        microciclo={microciclo}
        ruta={db.ruta.byUsuario(usuario.id)}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
        sexo={sexo}
      />
    </MemoryRouter>,
  )
}

function ultimoSexo(): unknown {
  const ultima = espia.recibidas[espia.recibidas.length - 1]
  if (!ultima) throw new Error('el salón no montó el visor ni una vez')
  return ultima.sexo
}

describe('el sexo de la ficha llega al visor', () => {
  beforeEach(() => {
    espia.recibidas.length = 0
    localStorage.clear()
  })

  it('sin dato en la ficha, el visor no recibe sexo: el defecto lo pone el visor', () => {
    montarSalon(undefined)
    expect(ultimoSexo()).toBeUndefined()
  })

  it('mujer en la ficha es mujer en el visor, y hombre es hombre', () => {
    montarSalon('mujer')
    expect(ultimoSexo()).toBe('mujer')
    espia.recibidas.length = 0
    montarSalon('hombre')
    expect(ultimoSexo()).toBe('hombre')
  })

  /**
   * De punta a punta, con la ficha de verdad: `RutaPage` lee `db.perfiles` de
   * quien mira y se lo da al salón. Con el seed de demo la sesión es Valentina,
   * cuya ficha dice mujer; al quitárselo, el visor deja de recibirlo.
   */
  it('la pestaña Entrenar pasa lo que dice la ficha de quien mira', async () => {
    const montar = () =>
      render(
        <ThemeProvider>
          <SessionProvider>
            <MemoryRouter>
              <RutaPage />
            </MemoryRouter>
          </SessionProvider>
        </ThemeProvider>,
      )

    expect(db.perfiles.byUsuario('u-valentina')?.sexo).toBe('mujer')
    const primera = montar()
    await vi.waitFor(() => expect(ultimoSexo()).toBe('mujer'))
    primera.unmount()

    db.perfiles.guardarSexo('u-valentina', undefined)
    espia.recibidas.length = 0
    montar()
    await vi.waitFor(() => expect(espia.recibidas.length).toBeGreaterThan(0))
    expect(ultimoSexo()).toBeUndefined()
  })
})
