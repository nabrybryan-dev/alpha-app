import { FondoLoop } from '../../components/ui/FondoLoop'
import type { Perfil } from '../../domain/types'
import type { PautaDelBloque } from '../../domain/nutricion/pautaDelBloque'
import { direccion } from '../../lib/direccionesVisuales'
import { usePausaFueraDePantalla } from '../../lib/pausaFueraDePantalla'
import { ObjetivoDelBloque } from './ObjetivoDelBloque'

interface Fila {
  etiqueta: string
  valor: string
  /** Sale de la encuesta, no de la prescripción del coach. Se dice en pantalla. */
  estimado?: boolean
}

/**
 * La ventana de A que se ve dentro del disco, en píxeles de la pieza.
 *
 * De aquí sale TODO lo demás, y por eso son constantes y no cuatro números
 * sueltos en una clase. Es un cuadrado de 216 px centrado en (518, 216) sobre el
 * fotograma de 1280x720:
 *
 *   · **x=518 es el 40% del ancho.** Ahí está el disco de la barra: la placa roja
 *     y la mano. El recorte contiene entonces *un disco*, que es la frase de la
 *     pieza —«cada disco ocupa su sitio»— y de paso el rojo de marca. También es
 *     el máximo de luminancia medido (35,3 contra 33,4 en x=621), pero esa parte
 *     es marginal: **lo elige la composición, no el número**.
 *   · **y=216 es el 30% del alto.** La ventana ocupa y=108…324, así que no toca
 *     la banda de tinta de la propia pieza, que empieza en y=431 y en un recorte
 *     circular no aportaría nada.
 *
 * **Estos números describen el fotograma de HOY.** El re-grade del #96 movió el
 * centro de brillo de x=621 a x=518, y con el encaje viejo el disco pasó a
 * enseñar la cara del atleta en vez de la placa. Si una pieza se vuelve a
 * graduar, esto se vuelve a medir y a MIRAR: el número solo no habría cazado el
 * cambio, porque en el fotograma nuevo la luminancia está casi igualada.
 */
const LADO = 216
const CENTRO = { x: 518, y: 216 }

/** Diámetro del disco. El tope está justo debajo: ver `DiscoDespiece`. */
const DIAMETRO = 56

/**
 * La pieza A «Despiece» como un disco.
 *
 * LA PIEZA. *«La barra se desarma en el aire y cada disco ocupa su sitio.»* Es
 * literalmente esta tarjeta: la prescripción del coach repartida en filas que
 * ocupan cada una la suya. Ver
 * `docs/specs/2026-08-25-piezas-sin-colocar-diseno.md`.
 *
 * POR QUÉ UN DISCO, Y NO UNA LÁMINA. Hoy es superficie CLARA
 * (`data-theme="light"`), y en claro la pieza no puede ser suelo. Podría ser una
 * lámina rectangular, pero ese es ya el mecanismo de Contenidos y repetirlo es la
 * plantilla que la integración cinemática existe para quitar. Un disco es la única
 * forma que la frase pedía por su cuenta. Es también la decisión más discutible de
 * las tres: la única que inventa una forma que la app no usa en ningún otro sitio.
 *
 * EL ENCAJE VA EN PORCENTAJES DEL CONTENEDOR, NO EN PÍXELES, para que sobreviva a
 * que el disco cambie de tamaño. Con la ventana de lado `L` centrada en `(cx, cy)`
 * sobre una pieza de `W x H`:
 *
 *     ancho = 100·W/L %        alto = 100·H/L %
 *     left  = 50 − 100·cx/L %  top  = 50 − 100·cy/L %
 *
 * `max-w-none` NO ES OPCIONAL. El reset de Tailwind pone `max-width: 100%` a
 * `img`, y sin quitarlo el 592,6% se recorta a 100% **sin dar error**: la imagen
 * sale entera y pequeña y parece que el CSS no hizo nada.
 *
 * EL TOPE DE TAMAÑO. La ventana tiene 216 px de fuente, así que a densidad 3 el
 * disco no puede pasar de **72 CSS px** sin ampliar. A 56 va a 0,78x. Subirlo a 80
 * es un cambio de una cifra que nadie relacionaría con estirar una imagen, y por
 * eso el tope está aquí escrito y comprobado en `BloqueActual.test.tsx`.
 */
function DiscoDespiece() {
  const marco = usePausaFueraDePantalla<HTMLDivElement>()
  const pieza = direccion('A')
  const encaje = {
    width: `${(100 * 1280) / LADO}%`,
    height: `${(100 * 720) / LADO}%`,
    left: `${50 - (100 * CENTRO.x) / LADO}%`,
    top: `${50 - (100 * CENTRO.y) / LADO}%`,
  }

  return (
    <div
      ref={marco}
      aria-hidden="true"
      className="relative shrink-0 overflow-hidden rounded-full bg-ink-900"
      style={{ width: DIAMETRO, height: DIAMETRO }}
    >
      <FondoLoop
        poster={pieza.poster}
        video={pieza.video}
        preload="none"
        prioridad="auto"
        anchura={1280}
        altura={720}
        className="absolute max-w-none"
        estilo={encaje}
      />
    </div>
  )
}

/**
 * Qué persigue el bloque en el que está la persona.
 *
 * Solo se pinta lo que el coach cargó: fase energética, proteína y pasos son
 * prescripción, no cálculo. Si el perfil no los trae, la tarjeta desaparece en
 * vez de rellenarse con un valor por defecto que nadie recetó.
 */
export function BloqueActual({ perfil, pauta }: { perfil?: Perfil; pauta?: PautaDelBloque }) {
  if (!perfil) return null

  // `pauta` ya resuelve quién manda (el coach) y qué se dedujo de la encuesta.
  // Sin ella se lee el perfil tal cual, que es como funcionaba antes.
  const fase = pauta?.faseEnergetica ?? (perfil.faseEnergetica ? { valor: perfil.faseEnergetica, origen: 'coach' as const } : undefined)
  const prote = pauta?.proteinaGkg ?? (perfil.proteinaGkg !== undefined ? { valor: perfil.proteinaGkg, origen: 'coach' as const } : undefined)
  const pasos = pauta?.pasosObjetivo ?? (perfil.pasosObjetivo !== undefined ? { valor: perfil.pasosObjetivo, origen: 'coach' as const } : undefined)

  const filas: Fila[] = []
  if (fase) filas.push({ etiqueta: 'Fase energética', valor: fase.valor, estimado: fase.origen === 'calculado' })
  if (prote) {
    filas.push({
      etiqueta: 'Proteína',
      valor: `${prote.valor.toString().replace('.', ',')} g/kg`,
      estimado: prote.origen === 'calculado',
    })
  }
  if (pasos) {
    filas.push({
      etiqueta: 'Pasos',
      valor: `${pasos.valor.toLocaleString('es-CO')}/día`,
      estimado: pasos.origen === 'calculado',
    })
  }

  if (filas.length === 0 && !perfil.objetivos) return null

  return (
    <section className="relieve rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <DiscoDespiece />
        <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-tenue">
          Tu bloque actual
        </h2>
      </div>
      {perfil.objetivos && (
        <div className="mt-2">
          <ObjetivoDelBloque objetivos={perfil.objetivos} />
        </div>
      )}
      {filas.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2">
          {filas.map((f) => (
            <div
              key={f.etiqueta}
              className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-tenue">
                {f.etiqueta}
                {f.estimado && (
                  <span className="ml-1.5 text-[9.5px] uppercase tracking-wide text-tenue/70">
                    estimado
                  </span>
                )}
              </dt>
              <dd className="cifras text-sm font-bold text-texto">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
