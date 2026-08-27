import { useRef, useState } from 'react'
import { fraseDelMicrociclo } from '../../data/contenido/frasesDelMicrociclo'
import { cargaPorGrupo, formatearSeries } from '../../domain/fatiga'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
import type { Microciclo } from '../../domain/types'
import { useMovimientoReducido } from '../../components/ui/movimientoReducido'
import { useInclinacionAlPuntero } from '../../lib/inclinacionAlPuntero'
import { escribirJSON, leerJSON } from '../../lib/persistencia'
import { NotasDeLaSemana } from './NotasDeLaSemana'

const CLAVE = 'alpha-portada-vista'

/**
 * El letrero de inicio de semana: lo primero que ve el asesorado al abrir un
 * microciclo nuevo, antes de las rutinas.
 *
 * SE VE UNA VEZ. Al cerrarlo queda marcado por id de microciclo, así que
 * reaparece solo cuando empieza el siguiente. Un cartel que sale cada día deja
 * de leerse a los dos días.
 *
 * Anatomía tomada de la «ficha forjada» del handoff (panel ink-900, franjas
 * separadas por hairline, eyebrow + display + pill mono, chips numerados y
 * disco de foco). El acento es el rojo Alpha, no el volt del mock: es la
 * decisión de marca de este proyecto.
 */
export function PortadaMicrociclo({ microciclo }: { microciclo: Microciclo }) {
  // La MISMA inclinación de la ficha coleccionable de Logros, aquí sobre la
  // bandeja. No es adorno: la ficha flota delante de la pieza cinemática, y al
  // inclinarse se lee que hay una escena DETRÁS y no una imagen debajo. Es lo que
  // convierte el solape en profundidad. Grados cortos —6 en vez de 12— porque
  // esto es una superficie de lectura, no una carta que se manosea.
  const { ref: bandeja, alMover, alSalir } = useInclinacionAlPuntero<HTMLDivElement>({
    maxGrados: 6,
  })
  const [vistas, setVistas] = useState<string[]>(() => leerJSON<string[]>(CLAVE, []))
  // El envoltorio, para que la portada pueda irse por donde vino. No es el mismo
  // nodo que la bandeja: esa lleva el `transform` en linea del gesto del dedo, y
  // animarla se lo comeria.
  const envoltura = useRef<HTMLDivElement>(null)
  const reducido = useMovimientoReducido()
  if (vistas.includes(microciclo.id)) return null

  const marcarVista = () => {
    const nuevas = [...vistas, microciclo.id]
    escribirJSON(CLAVE, nuevas)
    setVistas(nuevas)
  }

  /**
   * Se va por donde vino, y MAS RAPIDO: 240 ms contra los 520 de la llegada.
   *
   * La asimetria no es un gusto — el repo ya tiene ese par escrito en el letrero
   * del descanso, 420 ms de entrada contra 240 de salida, con el comentario
   * literal «mas corta que la entrada: el sistema responde». Lo que llega puede
   * tomarse su tiempo; lo que se va tiene que quitarse de en medio.
   *
   * Va con WAAPI y no con una clase porque hay que esperar a que TERMINE para
   * marcar el microciclo como visto: con una keyframe habria que adivinar el
   * momento con un temporizador. La curva se escribe literal porque WAAPI no
   * resuelve `var()`.
   */
  const cerrar = () => {
    const nodo = envoltura.current
    if (!nodo || reducido || typeof nodo.animate !== 'function') return marcarVista()

    // EL MARCADO NO CUELGA DE LA ANIMACION, y esto es lo importante de aqui.
    //
    // Lo natural seria encadenar `.finished.then(marcarVista)`. Pero esa promesa
    // puede no resolver NUNCA: un navegador que no corre la linea de tiempo, una
    // pestaña en segundo plano, el nodo desmontado a media salida. Y el fallo
    // seria mudo — nada se rompe, simplemente la portada vuelve a salir la semana
    // que viene, y la siguiente. Que se vea UNA vez es la razon de ser de esta
    // pieza.
    //
    // Asi que se corre una carrera: gana la animacion si termina, y si no, el
    // reloj. El marcado ocurre igual, pase lo que pase.
    let hecho = false
    const unaVez = () => {
      if (hecho) return
      hecho = true
      marcarVista()
    }
    window.setTimeout(unaVez, 400)
    try {
      nodo
        .animate(
          [
            { opacity: 1, transform: 'perspective(900px) rotateX(0deg) translateY(0)' },
            { opacity: 0, transform: 'perspective(900px) rotateX(-6deg) translateY(-8px)' },
          ],
          { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
        )
        .finished.then(unaVez, unaVez)
    } catch {
      unaVez()
    }
  }

  // Los objetivos de la semana no se escriben: se leen del propio microciclo.
  const grupos = cargaPorGrupo(microciclo)
    .slice()
    .sort((a, b) => b.seriesPautadas - a.seriesPautadas)
  const prioritarios = grupos.slice(0, 5)
  const foco = prioritarios[0]
  const sesiones = microciclo.sesiones.length
  // Las series que la persona va a hacer de verdad, no la suma por grupo: desde
  // que el volumen se cuenta fraccionado, un ejercicio alimenta a varios grupos
  // y sumarlos daría un número mayor que el de series de la semana.
  const series = microciclo.sesiones.reduce(
    (total, s) => total + s.ejercicios.reduce((t, e) => t + e.sets, 0),
    0,
  )
  const notas = notasDelMicrociclo(microciclo)
  // La misma toda la semana: si cambiara en cada render sería ruido, no mensaje.
  const frase = fraseDelMicrociclo(microciclo.id)

  return (
    <div className="flex flex-col gap-3">
      {/* La envoltura concéntrica que el sistema ya declaraba y nadie usaba:
          `.bisel` es la bandeja exterior a 24 px y `.bisel-nucleo` el núcleo a 18.
          Aquí es lo que hace que la ficha FLOTE sobre la pieza en vez de posarse
          encima: la sombra va hacia ARRIBA, contra el sentido natural, que es como
          se lee que hay algo detrás y no debajo. */}
      {/* La llegada va AQUI y no en la bandeja de abajo: esa lleva el `transform`
          en linea que escribe el gesto del dedo, y una animacion encima se lo
          comeria. Ojo con un efecto de borde: el `transform` convierte este div
          en contexto de apilamiento durante los 520 ms, asi que su `z-index`
          pasa a ser local. No solapa con nada porque sus hermanos son tarjetas
          en flujo. */}
      <div
        ref={envoltura}
        className="portada-entra [perspective:900px]"
        style={{ position: 'relative', zIndex: 'var(--z-elevado)' }}
      >
      <div
        ref={bandeja}
        onPointerMove={alMover}
        onPointerLeave={alSalir}
        onPointerCancel={alSalir}
        className="bisel [transform-style:preserve-3d]"
        style={{
          boxShadow: '0 -18px 40px -24px rgba(0,0,0,.9), 0 10px 30px -18px rgba(0,0,0,.8)',
          transition: 'transform var(--dur-base) var(--ease-salida)',
        }}
      >
      <section className="bisel-nucleo overflow-hidden border border-ink-500 bg-ink-900 shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-ink-600 bg-gradient-to-b from-white/[.05] to-transparent px-[18px] pb-4 pt-[18px]">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-silver-500">
              Empieza tu microciclo
            </p>
            <h2 className="font-display mt-[7px] text-[25px] font-black leading-[1.04] tracking-[-0.015em] text-silver-100">
              MICROCICLO
              <br />
              {`M${microciclo.numero}`}
            </h2>
          </div>
          <span className="cifras shrink-0 rounded-full border border-accion/40 px-2.5 py-[5px] text-[10.5px] font-bold text-accion">
            {`${sesiones} SESIONES`}
          </span>
        </header>

        {prioritarios.length > 0 && (
          <div className="border-b border-ink-600 px-[18px] py-4">
            <p className="mb-[11px] text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
              {`Lo que trabajas esta semana · ${series} series`}
            </p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-[7px]">
              {prioritarios.map((g, i) => (
                <li
                  key={g.grupo}
                  className="flex items-center gap-[7px] rounded-[10px] border border-ink-500 bg-ink-700 px-[9px] py-2"
                >
                  <span className="cifras text-[10px] font-bold text-accion">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[11.5px] font-semibold text-silver-200">{g.grupo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {foco && (
          <div className="flex items-center gap-3.5 border-b border-ink-600 px-[18px] py-4">
            <span
              aria-hidden="true"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accion"
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="#08090a" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4.5" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
                Foco de la semana
              </p>
              <p className="font-display text-[18px] font-black uppercase text-accion">{foco.grupo}</p>
              <p className="text-xs text-silver-400">{`${formatearSeries(foco.seriesPautadas)} series programadas`}</p>
            </div>
          </div>
        )}

        {frase && (
          <p className="border-b border-ink-600 px-[18px] py-4 text-[13.5px] font-semibold leading-relaxed text-silver-200">
            {frase}
          </p>
        )}

        <div className="px-[18px] py-4">
          <button type="button" onClick={cerrar} className="press w-full rounded-full bg-accion py-3 text-[13px] font-bold uppercase tracking-wide text-ink-900">
            Empezar la semana
          </button>
        </div>
      </section>
      </div>
      </div>

      <NotasDeLaSemana notas={notas} />
    </div>
  )
}
