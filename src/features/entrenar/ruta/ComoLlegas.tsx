import type { Recuperacion } from '../../../domain/readiness'

/**
 * El tono del índice: cómo se llama y de qué color va.
 *
 * Se exporta porque la cifra ya no vive dentro de este bloque —subió al rótulo del
 * tramo, en la hoja del salón— y el color tiene que subir con ella. Un 88 en plata
 * cuando el texto de abajo dice «Recuperado» en verde son dos afirmaciones distintas
 * sobre el mismo dato.
 */
export function tonoDeRecuperacion(indice: number): { texto: string; clase: string; barra: string } {
  return tono(indice)
}

function tono(indice: number): { texto: string; clase: string; barra: string } {
  if (indice >= 70) return { texto: 'Recuperado', clase: 'text-accion', barra: 'bg-accion' }
  if (indice >= 50) return { texto: 'En trabajo', clase: 'text-silver-200', barra: 'bg-silver-200' }
  return { texto: 'Fatiga acumulada', clase: 'text-ambar', barra: 'bg-ambar' }
}

/**
 * Cómo llega la persona esta semana, según el índice de Hooper adaptado de sus
 * check-ins.
 *
 * Va aparte de las competencias a propósito: las competencias dicen qué sabe
 * hacer y esto dice cómo amaneció. Metido entre ellas, una mala semana se leería
 * como si hubiera perdido nivel, que es justo lo contrario de lo que pasa.
 */
export function ComoLlegas({ recuperacion }: { recuperacion: Recuperacion }) {
  const { indice, dias } = recuperacion
  if (indice === undefined) return null

  const t = tono(indice)

  return (
    // Sin marco y sin cabecera propia. El bloque entró en el salón dentro de un tramo de
    // la hoja, que ya le pone número, rótulo y la cifra a la derecha; el marco de aquí
    // era una tarjeta dentro de otra y el `<h3>` decía por segunda vez lo que el rótulo
    // acababa de decir. Queda `escena-prof` porque la barra sigue hundiéndose.
    <section className="escena-prof">
      <div
        role="progressbar"
        aria-valuenow={indice}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Índice de recuperación"
        // El carril hundido (`--prof-hueco`): lo que le falta al indice es materia
        // que falta. Mismo gesto que la barra de progreso de nivel y que las de
        // competencias, para que las cuatro se lean como el mismo instrumento.
        className="pozo-3d h-[5px] overflow-hidden rounded-full bg-ink-500"
      >
        {/* El relleno va por `scaleX` y no por `width`: width relayoutea en cada
            fotograma y esta pantalla corre con la pieza cinemática haciendo scrub
            de un canvas en su propio rAF. Es la técnica que `.barra-crece` ya usa
            en tokens.css. Va como `transition` y no como keyframe porque el valor
            cambia en vivo y una transición se re-dirige a mitad de camino. */}
        <span
          className={`block h-full w-full origin-left rounded-full transition-transform duration-base ease-salida ${t.barra}`}
          style={{ transform: `scaleX(${Math.max(0, Math.min(100, indice)) / 100})` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-silver-400">
        <span className={`font-bold ${t.clase}`}>{t.texto}</span> · sueño, cansancio, estrés y ánimo
        de tus últimos {dias} check-in{dias === 1 ? '' : 's'}. No es una nota: es el contexto con el
        que tu coach ajusta la carga.
      </p>
    </section>
  )
}
