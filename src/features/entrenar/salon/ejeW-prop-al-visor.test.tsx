import { fireEvent, render } from '@testing-library/react'
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

/**
 * ATRAVESAR EL CUERPO, CON EL GESTO QUE HAY.
 *
 * Antes esto pulsaba un peldaño de la escalera del eje W. La escalera se quitó el
 * 2026-09-04 —cinco botones tapando la sala— y las capas se recorren con el dedo sobre el
 * cuerpo: arrastrando en vertical, o hundiendo el dedo. Aquí se conduce por el arrastre,
 * que lleva a una capa concreta en un gesto; la aritmética del hundir se prueba pura en
 * `capas/hundirEnElCuerpo.test.ts`.
 *
 * ## POR QUÉ NO SE USA `fireEvent.pointerDown`
 *
 * Porque en jsdom **un `PointerEvent` no transporta `clientX` ni `clientY`**: llegan como
 * `undefined`, el desplazamiento sale `NaN` y el gesto no se mueve — sin error, sin aviso,
 * y con el manejador ejecutándose entero. Costó una vuelta y se caza igual que todo lo
 * demás: imprimiendo lo que llega, no leyendo el código.
 *
 * Un `MouseEvent` con el tipo `pointerdown` sí lleva las coordenadas y burbujea igual, así
 * que React lo entrega a `onPointerDown` sin enterarse. Es la misma familia de agujeros
 * que `jsdom` no tener `animate`: el entorno de prueba no falla, hace menos.
 */
function dedo(nodo: Element, tipo: string, x: number, y: number) {
  fireEvent(nodo, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
}

function atravesarHasta(salon: HTMLElement, capa: number) {
  const centro = salon.querySelector('[data-hueco="centro"]')
  if (!centro) throw new Error('el salón no tiene hueco centro')
  const actual = Number(salon.getAttribute('data-w') ?? 0)
  const escalones = capa - actual
  if (escalones === 0) return
  // Hacia dentro se arrastra hacia ARRIBA (dy negativa). El umbral lo pone
  // `gestoVertical.ts`; aquí se pasa de largo a propósito para no depender del número.
  const dy = escalones > 0 ? -200 : 200
  for (let i = 0; i < Math.abs(escalones); i++) {
    dedo(centro, 'pointerdown', 200, 400)
    dedo(centro, 'pointermove', 200, 400 + dy)
    dedo(centro, 'pointerup', 200, 400 + dy)
  }
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
    const salon = montarSalonConSujeto()
    for (const capa of CAPAS_W) {
      atravesarHasta(salon, capa.w)
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
    const salon = montarSalonConSujeto()
    for (const capa of [...CAPAS_W].reverse()) {
      atravesarHasta(salon, capa.w)
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
    const salon = montarSalonConSujeto()
    const patronAlEmpezar = ultimasProps().patron
    for (const capa of CAPAS_W) {
      atravesarHasta(salon, capa.w)
      expect(ultimasProps().patron).toBe(patronAlEmpezar)
    }
  })
})
