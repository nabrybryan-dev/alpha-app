import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { ejercicioCompleto } from '../../../domain/cumplimiento'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import { patronDeCategoria } from '../../../domain/patrones/catalogo'
import type { HuellaDeRepeticion } from '../../../domain/patrones/huella'
import { indiceRecuperacion } from '../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../../domain/types'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * EL FANTASMA LLEGA AL VISOR — o no llega, y eso también se prueba.
 *
 * La parte A del fantasma dejó el motor listo para pintar una segunda figura
 * translúcida y `VisorPatron` con la prop `fantasma`; la parte B trae la huella real del
 * encoder hasta la serie registrada. Esto es la costura entre las dos: que el salón, con
 * una serie que TRAE huella, le pase esa huella al visor; que sin ninguna medida no le
 * pase nada —no se inventa un fantasma—; y que la de la semana pasada valga cuando hoy
 * no hay ninguna.
 *
 * El visor se sustituye por un espía porque jsdom no tiene WebGL; la geometría del
 * fantasma se prueba en `visor/motor.subir.test.ts` y `fantasma.test.ts`. Aquí solo
 * importa QUÉ recibe.
 */

const espia = vi.hoisted(() => ({ recibidas: [] as Record<string, unknown>[] }))

vi.mock('../visor/VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    espia.recibidas.push(props)
    return null
  },
}))

const HUELLA_DE_HOY: HuellaDeRepeticion = { duracionSeg: 2.6, fase: [1, 0.6, 0.2, 0, 0.3, 0.7, 1] }
const HUELLA_DE_LA_SEMANA_PASADA: HuellaDeRepeticion = { duracionSeg: 3.1, fase: [1, 0.5, 0, 0.5, 1] }

function conHuella(ejercicio: EjercicioPrescrito, huella: HuellaDeRepeticion): EjercicioPrescrito {
  return {
    ...ejercicio,
    sets: Math.max(ejercicio.sets, 3),
    series: [
      { orden: 1, cargaKg: 60, reps: 8, rir: 2, velocidad: { pvPct: 11, hayEscala: false, calidad: 'buena', huella } },
    ],
  }
}

/** La primera sesión del seed cuyo ejercicio en curso SÍ tiene sujeto que dibujar. */
function sesionConSujeto(sesiones: readonly Sesion[]): Sesion {
  const conSujeto = sesiones.find((s) => {
    const enCurso = s.ejercicios.find((e) => !ejercicioCompleto(e)) ?? s.ejercicios[0]
    return !!enCurso && !!patronDeCategoria(enCurso.categoria, enCurso.nombre)
  })
  if (!conSujeto) throw new Error('el seed de demo no trae ninguna sesión con sujeto')
  return conSujeto
}

/** La misma sesión, con el ejercicio en curso reemplazado. */
function conEnCurso(sesion: Sesion, cambiar: (e: EjercicioPrescrito) => EjercicioPrescrito): Sesion {
  const enCurso = sesion.ejercicios.find((e) => !ejercicioCompleto(e)) ?? sesion.ejercicios[0]
  return { ...sesion, ejercicios: sesion.ejercicios.map((e) => (e === enCurso ? cambiar(e) : e)) }
}

function montar(opciones: { sesion?: (s: Sesion) => Sesion; previo?: (m: Microciclo, s: Sesion) => Microciclo } = {}) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const base = sesionConSujeto(microciclo.sesiones)
  const sesion = opciones.sesion ? opciones.sesion(base) : base
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
        microcicloPrevio={opciones.previo ? opciones.previo(microciclo, base) : undefined}
        ruta={db.ruta.byUsuario(usuario.id)}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
      />
    </MemoryRouter>,
  )
}

function ultimoFantasma(): unknown {
  const ultima = espia.recibidas[espia.recibidas.length - 1]
  if (!ultima) throw new Error('el salón no montó el visor ni una vez')
  return ultima.fantasma
}

describe('el fantasma llega al visor', () => {
  beforeEach(() => {
    espia.recibidas.length = 0
    localStorage.clear()
  })

  it('sin ninguna medida, el visor no recibe fantasma: no se inventa uno', () => {
    montar()
    expect(ultimoFantasma()).toBeUndefined()
  })

  it('con una serie de HOY que trae huella, esa huella es el fantasma', () => {
    montar({ sesion: (s) => conEnCurso(s, (e) => conHuella(e, HUELLA_DE_HOY)) })
    expect(ultimoFantasma()).toEqual(HUELLA_DE_HOY)
  })

  it('sin medida hoy, vale la de la semana pasada del mismo ejercicio', () => {
    montar({
      previo: (m, s) => ({
        ...m,
        id: `${m.id}-previo`,
        sesiones: [conEnCurso(s, (e) => conHuella({ ...e, id: 'otro-id' }, HUELLA_DE_LA_SEMANA_PASADA))],
      }),
    })
    expect(ultimoFantasma()).toEqual(HUELLA_DE_LA_SEMANA_PASADA)
  })

  it('hoy manda sobre la semana pasada', () => {
    montar({
      sesion: (s) => conEnCurso(s, (e) => conHuella(e, HUELLA_DE_HOY)),
      previo: (m, s) => ({
        ...m,
        id: `${m.id}-previo`,
        sesiones: [conEnCurso(s, (e) => conHuella(e, HUELLA_DE_LA_SEMANA_PASADA))],
      }),
    })
    expect(ultimoFantasma()).toEqual(HUELLA_DE_HOY)
  })
})
