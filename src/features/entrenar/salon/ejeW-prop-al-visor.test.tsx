import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { ejercicioCompleto } from '../../../domain/cumplimiento'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import { patronDeCategoria } from '../../../domain/patrones/catalogo'
import { indiceRecuperacion } from '../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../domain/types'
import { CAPAS_W } from './huecos'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * EL CABLE, MIRADO POR DENTRO: qué recibe el visor cuando el dedo atraviesa.
 *
 * `ejeW-llega-al-modelo.test.tsx` comprueba el efecto de la prop —el rótulo del nivel
 * aparece, el selector viejo se retira—, y con eso basta para que quitar `w={w}` se
 * ponga rojo. Este archivo cierra el mismo agujero por el otro lado y con un mensaje que
 * no hay que interpretar: se sustituye el visor por un doble que anota las props que le
 * llegan, y se mira si `w` está entre ellas y si sigue al dedo.
 *
 * Vale la pena tenerlo aparte porque el fallo que se cierra hoy era EXACTAMENTE éste
 * —«`SalonEntrenar` no le pasa `w` al `VisorPatron`; solo le pasa `patron` y los números
 * de la serie»— y porque no depende de cómo el visor decida enseñar la capa: el día que
 * el rótulo cambie de sitio o de texto, este test seguirá diciendo si la capa llega.
 *
 * El doble devuelve `null` a propósito: aquí no se mira nada de lo que el visor pinta,
 * solo lo que recibe. Lo que el visor hace con la capa se comprueba en su sitio.
 */

interface PropsDelVisor {
  patron?: unknown
  w?: unknown
  datos?: unknown
}

const espia = vi.hoisted(() => ({ recibidas: [] as Record<string, unknown>[] }))

vi.mock('../visor/VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    espia.recibidas.push(props)
    return null
  },
}))

/** La primera sesión del seed cuyo ejercicio en curso SÍ tiene sujeto que dibujar. */
function sesionConSujeto(sesiones: readonly Sesion[]): Sesion {
  const conSujeto = sesiones.find((s) => {
    const enCurso = s.ejercicios.find((e) => !ejercicioCompleto(e)) ?? s.ejercicios[0]
    return !!enCurso && !!patronDeCategoria(enCurso.categoria, enCurso.nombre)
  })
  if (!conSujeto) throw new Error('el seed de demo no trae ninguna sesión con sujeto')
  return conSujeto
}

function montarSalonConSujeto(): HTMLElement {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion = sesionConSujeto(microciclo.sesiones)
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
      />
    </MemoryRouter>,
  )
  return document.querySelector('[data-salon="entrenar"]') as HTMLElement
}

/** Lo último que recibió el visor. */
function ultimasProps(): PropsDelVisor {
  const ultima = espia.recibidas[espia.recibidas.length - 1]
  if (!ultima) throw new Error('el salón no montó el visor ni una vez')
  return ultima as PropsDelVisor
}

function peldano(salon: HTMLElement, nombre: string): HTMLElement {
  const escalera = salon.querySelector('[role="group"][aria-label="Capa del cuerpo"]')
  if (!escalera) throw new Error('la escalera del eje W no está en el salón')
  return within(escalera as HTMLElement).getByRole('button', { name: nombre })
}

describe('el salón le pasa la capa al visor', () => {
  beforeEach(() => {
    localStorage.clear()
    espia.recibidas.length = 0
  })

  it('la prop `w` viaja al visor, y arranca en la piel', () => {
    montarSalonConSujeto()
    const props = ultimasProps()
    // El fallo que este test cierra, con sus palabras: «SalonEntrenar NO le pasa w al
    // VisorPatron (solo patron y los números de la serie)».
    expect(Object.keys(props), 'el salón dejó de pasarle `w` al visor').toContain('w')
    expect(props.w).toBe(0)
    // Y sigue pasando lo que ya pasaba: la capa se suma al patrón, no lo sustituye.
    expect(props.patron).toBeDefined()
  })

  it('la capa que recibe el visor es la del salón, escalón a escalón', async () => {
    const usuario = userEvent.setup()
    const salon = montarSalonConSujeto()
    for (const capa of CAPAS_W) {
      await usuario.click(peldano(salon, capa.nombre))
      expect(salon.getAttribute('data-w'), `el salón no se movió a la capa ${capa.w}`).toBe(
        String(capa.w),
      )
      expect(ultimasProps().w, `el visor se quedó en otra capa al pulsar ${capa.nombre}`).toBe(
        capa.w,
      )
    }
  })

  it('nunca le llega una capa fuera del eje', async () => {
    // `w` es `NivelW`, así que el tipo ya lo dice; lo que esto caza es el valor que
    // burla al tipo —un `undefined` de un estado a medio inicializar, un número salido
    // de una aritmética— que apagaría el filtro y devolvería el cuerpo entero sin que
    // nada se rompa.
    const usuario = userEvent.setup()
    const salon = montarSalonConSujeto()
    for (const capa of [...CAPAS_W].reverse()) {
      await usuario.click(peldano(salon, capa.nombre))
    }
    expect(espia.recibidas.length).toBeGreaterThan(CAPAS_W.length)
    for (const props of espia.recibidas) {
      expect([0, 1, 2, 3, 4]).toContain(props.w)
    }
  })

  it('atravesar no cambia de patrón: el sujeto es el mismo en las cinco capas', async () => {
    // El eje decide QUÉ se ve del cuerpo, no QUÉ cuerpo ni qué gesto. Se compara por
    // identidad y no por contenido: dos objetos iguales pero distintos remontarían la
    // escena entera en el visor, que es la otra forma de perder el gesto.
    const usuario = userEvent.setup()
    const salon = montarSalonConSujeto()
    const patronAlEmpezar = ultimasProps().patron
    for (const capa of CAPAS_W) {
      await usuario.click(peldano(salon, capa.nombre))
      expect(ultimasProps().patron).toBe(patronAlEmpezar)
    }
  })
})
