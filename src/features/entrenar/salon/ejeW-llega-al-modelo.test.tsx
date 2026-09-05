import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
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
import { NIVELES_ANATOMICOS } from '../capas/nivelesAnatomicos'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * EL EJE W, DESDE EL DEDO HASTA EL MODELO.
 *
 * `mallaDelNivel.test.ts` comprueba que los cinco niveles construyen cinco escenas
 * distintas; eso sería cierto aunque el salón no le pasara la capa a nadie. Este archivo
 * comprueba el otro tramo del cable: que la `w` del salón LLEGA al visor y decide lo que
 * el visor dibuja. Un visor que sabe leer `w` y un salón que no se la pasa es
 * exactamente el fallo que se está cerrando, y estuvo semanas en verde.
 *
 * ## Por qué se monta el componente y no la ruta
 *
 * La sesión que la agenda destaca hoy en el seed de demo es la metabólica, y una sesión
 * metabólica no tiene ejercicios con patrón: por `/entrenar` se entra al hueco
 * `sinPatron`, donde el visor NO se monta —ver `sinPatron.test.tsx`— y no hay modelo del
 * que hablar. Así que aquí se monta el salón con una sesión de FUERZA del mismo
 * microciclo, que es la que pone un sujeto en el centro. El dato de entrada se elige; el
 * camino ya lo cubre `salon.test.tsx`.
 *
 * ## Cómo se ve aquí una prop que no se puede leer
 *
 * En jsdom no hay WebGL, así que el modelo no se dibuja y no se puede mirar el búfer. Lo
 * que sí es observable es el efecto que `w` tiene en lo RENDERIZADO: con la prop puesta
 * el visor cambia su selector de tres botones (Ambas / Músculo / Hueso) por el rótulo
 * del nivel y su resumen. Ese rótulo es la sombra de la prop —si el salón deja de
 * pasarla, el visor vuelve al selector y estos tests se caen—, y los textos salen de
 * `NIVELES_ANATOMICOS`, no escritos aquí a mano: dos listas de nombres se separan.
 */

/** La primera sesión del seed cuyo ejercicio en curso SÍ tiene sujeto que dibujar. */
function sesionConSujeto(sesiones: readonly Sesion[]): Sesion {
  const conSujeto = sesiones.find((s) => {
    const enCurso = s.ejercicios.find((e) => !ejercicioCompleto(e)) ?? s.ejercicios[0]
    return !!enCurso && !!patronDeCategoria(enCurso.categoria, enCurso.nombre)
  })
  if (!conSujeto) throw new Error('el seed de demo no trae ninguna sesión con sujeto')
  return conSujeto
}

/** Monta el salón con una sesión de fuerza: sujeto en el centro y escalera del eje W. */
function montarSalonConSujeto(): HTMLElement {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion = sesionConSujeto(microciclo.sesiones)
  const ruta = db.ruta.byUsuario(usuario.id)
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
        ruta={ruta}
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

/** El peldaño de la escalera del eje W que corresponde a un nivel. */
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

describe('la capa del salón llega al modelo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('el salón monta el sujeto: hay lienzo en el centro', () => {
    // La comprobación de abajo no puede ser vacía: si el centro fuera el hueco
    // `sinPatron` no habría visor, y «no está el selector viejo» se cumpliría porque no
    // hay visor ninguno.
    const salon = montarSalonConSujeto()
    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    expect(centro.querySelector('canvas')).not.toBeNull()
    expect(salon.querySelector('[data-hueco="sinPatron"]')).toBeNull()
  })

  it('el visor arranca en la piel, con el rótulo del nivel y sin el selector viejo', () => {
    const salon = montarSalonConSujeto()
    const piel = NIVELES_ANATOMICOS[0]
    // El rótulo del nivel es la prueba de que la prop llegó: sin `w` el visor no lo
    // pinta. Los peldaños llevan el nombre en `aria-label`, que no es un nodo de texto,
    // así que esto no los está encontrando a ellos.
    expect(within(salon).getByText(piel.nombre)).toBeInTheDocument()
    expect(within(salon).getByText(piel.resumen)).toBeInTheDocument()
    // Y los dos mandos sobre lo mismo no conviven: con la capa puesta, el selector de
    // Ambas/Músculo/Hueso se retira. «Capa 4 con el botón Músculo pulsado» no tiene
    // respuesta que dar.
    expect(screen.queryByRole('button', { name: 'Ambas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Músculo' })).toBeNull()
  })

  it('atravesar las cinco capas cambia lo que el visor dice estar dibujando', async () => {
    // Es (a) visto desde la pantalla: los cinco escalones no son cinco números, son
    // cinco niveles distintos llegando al modelo. Si alguien quita `w={w}` del salón, el
    // rótulo desaparece y esto se cae entero.
    const salon = montarSalonConSujeto()
    const vistos: string[] = []
    for (const nivel of NIVELES_ANATOMICOS) {
      atravesarHasta(salon, nivel.w)
      expect(salon.getAttribute('data-w')).toBe(String(nivel.w))
      // El rótulo del visor, no el del peldaño: se busca por texto.
      const resumen = within(salon).getByText(nivel.resumen)
      expect(resumen).toBeInTheDocument()
      vistos.push(resumen.textContent ?? '')
    }
    // Cinco resúmenes distintos: ningún par de capas enseña la misma pantalla.
    expect(new Set(vistos).size).toBe(5)
  })

  it('el sujeto sigue con su gesto al atravesar: ni el patrón ni la fase se tocan', async () => {
    // El encargo, con las palabras de Bryan: «en cada una el sujeto sigue ejecutando su
    // gesto». Aquí se comprueba lo que jsdom sí alcanza: que cambiar de capa no reinicia
    // la fase del movimiento ni cambia de patrón. Si el visor se remontara al cambiar
    // `w` —por ejemplo metiéndola en las dependencias del efecto que crea el contexto
    // WebGL— el deslizador volvería a 0 y esto se pondría rojo.
    const salon = montarSalonConSujeto()
    const lienzo = within(salon).getByLabelText(/Modelo tridimensional del patrón/i)
    const patronAlEmpezar = lienzo.getAttribute('aria-label')
    expect(patronAlEmpezar).toBeTruthy()
    // Se mueve la fase a mitad del gesto, que es donde se nota si algo la reinicia: con
    // el valor por defecto un reinicio no se distinguiría de no hacer nada.
    // `fireEvent.change` y no `input.value = …`: escribir el valor a mano deja el
    // rastreador de React sin enterarse y el estado se queda en cero, así que el
    // deslizador enseñaría 40 y el modelo seguiría en el arranque del gesto. Medido:
    // con la asignación directa este test fallaba con «expected '0' to be '40'» en la
    // primera capa, y el fallo era del test, no del salón.
    const fase = within(salon).getByLabelText('Fase del movimiento') as HTMLInputElement
    fireEvent.change(fase, { target: { value: '40' } })
    expect((within(salon).getByLabelText('Fase del movimiento') as HTMLInputElement).value).toBe(
      '40',
    )

    for (const nivel of NIVELES_ANATOMICOS) {
      atravesarHasta(salon, nivel.w)
      expect(within(salon).getByText(nivel.resumen)).toBeInTheDocument()
      // El mismo patrón, capa a capa: el eje decide qué se ve, no qué se hace.
      expect(
        within(salon)
          .getByLabelText(/Modelo tridimensional del patrón/i)
          .getAttribute('aria-label'),
      ).toBe(patronAlEmpezar)
      // Y la misma fase: el gesto no vuelve al principio por atravesar.
      expect((within(salon).getByLabelText('Fase del movimiento') as HTMLInputElement).value).toBe(
        '40',
      )
    }
  })
})
