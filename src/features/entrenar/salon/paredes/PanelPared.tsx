import { CAMPOS_DE_PARED, type ClaveDeCampo, type ContenidoDePared } from './contenidoPared'
import { ESCORZO_DE_PARED, TOPE_PARED } from '../huecos'

/**
 * LOS OCHO PANELES DE PARED.
 *
 * Es el hueco `paredes` de `huecos.ts`: lo corto y esencial del ejercicio, colgado a la
 * altura de la mirada alrededor del sujeto. No decide nada — los ocho textos vienen ya
 * repartidos y ya recortados de `contenidoPared()`, que es la función pura donde vive la
 * invariante de que lo que no cabe aquí está íntegro en el panel de abajo.
 *
 * ## Por qué no toca los textos
 *
 * Ni recorta, ni añade puntos suspensivos, ni reordena. Si esta capa recortara por su
 * cuenta habría dos sitios decidiendo el mismo tope y se separarían al primer ajuste —
 * exactamente lo que `TOPE_PARED` está puesto en `huecos.ts` para evitar. Aquí el tope
 * solo se USA: para dimensionar la caja (`--tope-pared` en `ch`) y para poder auditarlo
 * desde fuera con `data-tope`.
 *
 * ## Por qué no recibe el puntero
 *
 * Toda la capa va con `pointer-events-none`. Las paredes se leen mientras la cámara
 * orbita, y el gesto de orbitar es un arrastre horizontal sobre el sujeto: una pared que
 * capturase el puntero se comería el arrastre justo en el borde de la pantalla, que es
 * donde el pulgar empieza el gesto. No hay nada que tocar en una pared; lo tocable son
 * el suelo (el registro) y el borde de abajo (el panel).
 */

/** El rótulo corto de cada panel. El título largo viaja con el texto en `alPanel`. */
const ROTULO: Record<ClaveDeCampo, string> = {
  nombre: 'Ejercicio',
  tecnica: 'Técnica',
  colocacionMovil: 'Móvil',
  distancia: 'Distancia',
  brazoDeMomento: 'Palanca',
  velocidad: 'Velocidad',
  seriesReps: 'Series',
  rir: 'Fallo',
}

/**
 * Qué muro se lleva cada campo.
 *
 * Los dos muros se DERIVAN de `CAMPOS_DE_PARED` en vez de escribirse a mano como dos
 * listas. Escritos a mano, olvidar un campo o repetirlo no rompería nada: la pared
 * simplemente no saldría, y un panel que falta en una pantalla de ocho no se nota. Al
 * filtrar el array del contrato, los ocho salen siempre y salen una vez.
 *
 * El reparto: a la izquierda lo que se mira ANTES de levantar —qué ejercicio es, cómo se
 * hace, cuántas series y hasta dónde—; a la derecha lo que va de MEDIR —dónde va el
 * móvil, a qué distancia, qué palanca y qué velocidad—.
 */
const EN_LA_IZQUIERDA = new Set<ClaveDeCampo>(['nombre', 'tecnica', 'seriesReps', 'rir'])
const MURO_IZQUIERDO = CAMPOS_DE_PARED.filter((c) => EN_LA_IZQUIERDA.has(c))
const MURO_DERECHO = CAMPOS_DE_PARED.filter((c) => !EN_LA_IZQUIERDA.has(c))

export interface PanelParedProps {
  /** Los ocho textos cortos, tal como los devuelve `contenidoPared()`. */
  contenido: ContenidoDePared
}

function Panel({
  campo,
  texto,
  lado,
}: {
  campo: ClaveDeCampo
  texto: string
  lado: 'izquierda' | 'derecha'
}) {
  return (
    <div
      data-campo={campo}
      data-tope={TOPE_PARED}
      // Sin desenfoque, y con el fondo subido a `--ink-900` opaco. Esta caja no es una
      // superficie fija: cuelga del muro y se escorza con la cámara, que orbita sobre el
      // sujeto. Un `backdrop-filter` aquí obliga a remuestrear la región en CADA
      // fotograma de la órbita, y encima sobre el lienzo del sujeto — que es lo mismo
      // que la regla del repo prohibe para el scroll, pero peor. Los dos píxeles de blur
      // no se echan de menos: lo que hacía legible el rótulo era el velo, y ahora es
      // opaco.
      className={`rounded-[10px] border border-white/10 bg-ink-900 px-2.5 py-2 ${
        lado === 'izquierda' ? 'origin-left text-left' : 'origin-right text-right'
      }`}
      // La pared se INCLINA hacia el centro, y no es decoración: un rótulo plano pegado
      // al borde se lee como una etiqueta flotando sobre la imagen; escorzado se lee
      // como un muro alrededor del sujeto. Los grados los pone `ESCORZO_DE_PARED` en
      // `huecos.ts` y no este archivo: la pared del ejercicio y la de la prescripción
      // sin sujeto son el mismo muro, y dos números iguales en dos archivos se separan
      // al primer ajuste.
      style={{
        transform: `rotateY(${lado === 'izquierda' ? ESCORZO_DE_PARED.grados : -ESCORZO_DE_PARED.grados}deg)`,
        boxShadow: '0 6px 18px -12px rgba(0,0,0,.9)',
      }}
    >
      <p className="text-[8.5px] font-bold uppercase leading-none tracking-[0.16em] text-silver-500">
        {ROTULO[campo]}
      </p>
      <p className="mt-1 text-[11.5px] font-semibold leading-snug text-silver-100">{texto}</p>
    </div>
  )
}

/** Los ocho campos cortos del ejercicio, uno por panel, colgados de los dos muros. */
export function PanelPared({ contenido }: PanelParedProps) {
  return (
    <div
      data-paredes="8"
      className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-2 px-2 pt-2"
      style={{ paddingBottom: '0' }}
    >
      {/* La `perspective` va en CADA columna y no en un ancestro común: alcanza solo a
          los HIJOS DIRECTOS, así que puesta más arriba el `rotateY` de los paneles se
          aplicaría igual y NO escorzaría — se pagaría el coste sin ver el efecto, y sin
          que nada se pusiera en rojo. */}
      <div
        className="flex w-[42%] flex-col gap-1.5"
        style={{ perspective: `${ESCORZO_DE_PARED.perspectiva}px`, perspectiveOrigin: 'right center' }}
      >
        {MURO_IZQUIERDO.map((campo) => (
          <Panel key={campo} campo={campo} texto={contenido[campo]} lado="izquierda" />
        ))}
      </div>

      <div
        className="flex w-[42%] flex-col gap-1.5"
        style={{ perspective: `${ESCORZO_DE_PARED.perspectiva}px`, perspectiveOrigin: 'left center' }}
      >
        {MURO_DERECHO.map((campo) => (
          <Panel key={campo} campo={campo} texto={contenido[campo]} lado="derecha" />
        ))}
      </div>
    </div>
  )
}
