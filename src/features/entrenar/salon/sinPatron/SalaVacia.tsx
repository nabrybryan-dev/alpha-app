import type { ReactNode } from 'react'
import { BAHIA } from '../../../../domain/escenario/laboratorio'
// El módulo del trazado NO se llama `salaVacia.ts`, y no es capricho: en un sistema de
// archivos que no distingue mayúsculas —Windows, macOS— `./salaVacia` y `./SalaVacia`
// son el mismo camino, y el import se resolvía a este propio archivo. El componente
// salía `undefined` y React se caía con «Element type is invalid» sin decir por qué.
import { LIENZO, trazarSalaVacia } from './trazadoDeSala'

/**
 * EL CENTRO CUANDO NO HAY SUJETO: la sala, con nadie dentro.
 *
 * Bryan abrió `/entrenar` un día de cardio y no vio un salón: vio cuatro tarjetas sobre
 * negro liso. La decisión escrita es la contraria y no admite lectura:
 *
 * > los ejercicios sin patrón de movimiento **abren el salón igual**, con sus paredes y
 * > su prescripción, pero **sin sujeto ejecutando en el centro**. La pantalla no cambia
 * > de naturaleza según el día.
 *
 * Así que aquí está la habitación: el muro cilíndrico, el riel del panel, el disco del
 * suelo con su retícula y el bordillo de la bahía de medida. Falta el cuerpo, y solo el
 * cuerpo.
 *
 * ## La habitación ES el rectángulo, y por eso recibe hijos
 *
 * Bryan volvió a mirar el iPhone un día de cardio y el arreglo había funcionado a medias:
 * la habitación se leía como habitación, pero los cuatro datos de la prescripción salían
 * FUERA de ella, cuatro tarjetas planas en el tercio de arriba, con una franja negra vacía
 * entre ellas y el techo del muro. Seguían siendo el dashboard de tarjetas que el salón
 * vino a quitar, solo que reubicado. El encargo no admite lectura: «en las paredes, la
 * información principal del ejercicio», y «arriba no hay texto suelto, ni cuadros, ni
 * tarjetas».
 *
 * La causa no era el estilo: era el ÁRBOL. `SalonSinSujeto` era hermano de `SalaVacia`, los
 * dos tendidos sobre la pantalla entera, así que sus paneles se anclaban al borde de arriba
 * del SALÓN y no al borde de arriba de la SALA — que empezaba mucho más abajo. Por eso esta
 * pieza acepta `children` y los pinta DENTRO del rectángulo de la habitación: colgar un
 * dato del muro es, literalmente, meterlo en la caja del muro.
 *
 * ## Y por eso la sala se estira
 *
 * La caja era `h-[46vh] max-h-[420px]` centrada: en un teléfono de 390 × 844 salía un
 * cuadrado de 390 y dejaba 27vh de negro por arriba y otro tanto por abajo. Ahora se estira
 * de arriba a abajo hasta donde `SUELO_DEL_SALON` reserva el mobiliario del suelo, y la
 * franja desaparece. El trazado aguanta el cambio de proporción sin retocar un número: el
 * lienzo se sirve con `slice`, que recorta en vez de destapar, y el muro está trazado de
 * −228 a 588 en un cuadro de 360 — hay dibujo de sobra a los lados. Recortar más ancho no
 * cambia NADA de la lectura vertical, que es la que dice «esto es una habitación»: el
 * rodapié sigue cayendo al 83 % del alto y el muro sigue ocupando lo de arriba. La sala se
 * ve más cerca, y ya está.
 *
 * `max-w-[64vh]` es el tope que impide lo contrario: en una ventana de escritorio, ancha y
 * baja, la caja se volvería apaisada, `slice` recortaría en VERTICAL y se comería el suelo
 * entero — quedaría un muro sin habitación.
 *
 * ## Por qué no se orbita
 *
 * Porque orbitar es un gesto SOBRE alguien. Sin sujeto, arrastrar el dedo daría vueltas
 * a una habitación vacía buscando qué mirar, y la única respuesta sería más pared. La
 * sala se ofrece desde el sitio desde el que se graba —la estación— y se queda quieta.
 *
 * El trazado sale entero de `salaVacia.ts`, que es puro y no depende de React: aquí solo
 * se pintan las figuras y se les pone color.
 *
 * ## La habitación respira, y cuánto cuesta
 *
 * «Así se ve aunque sin movimiento todavía», dijo Bryan. Una sala vacía y quieta es un
 * dibujo, no un sitio. Así que hay dos movimientos, y ni uno más: la luz del muro se
 * desplaza muy despacio de un lado a otro, y el suelo respira. Los dos viven en
 * `tokens.css` como `.sala-luz` y `.sala-aliento`.
 *
 * **Ni uno de los dos toca la geometría.** No se reproyecta la sala, no se recalcula un
 * trazado y no corre JavaScript por fotograma: son dos `<div>` vacíos con un degradado,
 * uno animando `transform` y el otro `opacity`, que son las dos únicas propiedades que el
 * compositor resuelve sin volver a pintar. La alternativa evidente —animar la opacidad de
 * la retícula en el propio SVG— se descartó midiendo: son 199 segmentos de trazo entre las
 * dos retículas, y una animación que el compositor no promocione los rerrasteriza en cada
 * fotograma durante la hora que dura una sesión con la pantalla encendida.
 *
 * Y se apagan solos donde deben: con `prefers-reduced-motion: reduce` los dos se quedan
 * quietos, y la regla `[data-camara-abierta] *` de `tokens.css` los pausa mientras el
 * encoder graba, igual que a las demás animaciones del área.
 */

/**
 * Se traza al cargar el módulo, no en cada repintado.
 *
 * La cámara no se mueve y la geometría de la sala no depende de nada de fuera, así que
 * el resultado es una constante: recalcularlo en cada render serían doscientas líneas de
 * retícula reproyectadas para dibujar exactamente lo mismo.
 */
const SALA_TRAZADA = trazarSalaVacia()

export interface SalaVaciaProps {
  /**
   * Lo que va DENTRO de la habitación: la prescripción colgada de los muros.
   *
   * Es una prop y no un hermano tendido por encima, y en esa diferencia está el arreglo
   * entero. Un panel que se ancla al borde de arriba de la PANTALLA flota sobre el salón;
   * el mismo panel anclado al borde de arriba de esta caja está colgado del muro. Como el
   * rectángulo recorta (`overflow-hidden`), nada que se cuelgue aquí puede salirse de la
   * habitación ni por accidente.
   */
  children?: ReactNode
}

export function SalaVacia({ children }: SalaVaciaProps) {
  return (
    // Se estira, no se centra: `items-stretch` es el valor por omisión del flex, así que
    // la caja toma todo el alto que le deje el hueco. Quien decide ese alto es el salón
    // con `SUELO_DEL_SALON`, que es donde está escrito qué hay abajo.
    <div className="pointer-events-none absolute inset-0 flex justify-center px-2 py-2">
      <div
        data-sala="entrenar"
        className="relative w-full max-w-[64vh] overflow-hidden rounded-xl"
      >
        <svg
          viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
          preserveAspectRatio="xMidYMid slice"
          className="block h-full w-full text-ink-1000"
          role="presentation"
        >
          {/* La profundidad del muro. Una pared de un solo tono plano se lee como un
              fondo; con la luz cayendo de abajo arriba se lee como pared. El color es
              `currentColor` —el `text-ink-1000` del lienzo— para no escribir aquí ningún
              valor que la paleta ya tiene. */}
          <defs>
            <linearGradient id="sala-vacia-profundidad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.78" />
              <stop offset="0.55" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* El aire de la sala. Va debajo de todo: entre el borde del disco del suelo y
              el arranque del muro hay unos centímetros que en la sala de verdad tampoco
              tienen geometría, y sin este fondo se verían como una raja clara. */}
          <rect x="0" y="0" width={LIENZO.ancho} height={LIENZO.alto} className="fill-ink-1000" />

          <path d={SALA_TRAZADA.muro} className="fill-ink-800" />
          <path d={SALA_TRAZADA.muro} fill="url(#sala-vacia-profundidad)" />
          <path d={SALA_TRAZADA.suelo} className="fill-ink-900" />

          {/* La retícula: es lo que convierte el suelo en un instrumento y no en un
              fondo. La fina y la gruesa se distinguen por trazo y por opacidad, igual
              que en el suelo de verdad se distinguen por grosor y por color. */}
          <path
            d={SALA_TRAZADA.reticulaMenor}
            fill="none"
            strokeWidth="0.4"
            className="stroke-silver-500/15"
          />
          <path
            d={SALA_TRAZADA.reticulaMayor}
            fill="none"
            strokeWidth="0.7"
            className="stroke-silver-500/30"
          />
          <path
            d={SALA_TRAZADA.bordillo}
            fill="none"
            strokeWidth="1.1"
            className="stroke-silver-500/40"
          />

          {/* Los tres horizontes del muro: donde apoya, dónde cuelgan los marcadores y
              dónde remata. Con ellos la pared se lee como pared; sin ellos es un plano
              oscuro que podría ser cualquier cosa. */}
          <path d={SALA_TRAZADA.rodapie} fill="none" strokeWidth="1.2" className="stroke-silver-500/35" />
          <path d={SALA_TRAZADA.riel} fill="none" strokeWidth="0.8" className="stroke-silver-500/20" />
          <path d={SALA_TRAZADA.remate} fill="none" strokeWidth="0.8" className="stroke-silver-500/15" />
        </svg>

        {/* LA LUZ DEL MURO, yendo y viniendo. Es la primera de las dos señales de que
            esto es un sitio y no un dibujo: una lámina con un degradado suave que se
            desplaza en `transform`, veintiún segundos de ida y otros tantos de vuelta.
            Va DEBAJO de la leyenda y de los datos a propósito — una luz que pasara por
            encima del texto lo haría parpadear, y la regla es que el dato se lea igual
            de bien con movimiento que sin él. */}
        <div className="sala-luz" aria-hidden="true" />

        {/* Y EL SUELO RESPIRANDO. La retícula no cambia de forma —no se reproyecta nada—:
            lo que sube y baja es un halo tenue apoyado sobre el disco, y basta para que
            los cuadros parezcan tomar aire. */}
        <div className="sala-aliento" aria-hidden="true" />

        {/* LA MISMA LEYENDA QUE EL VISOR, porque es la misma retícula y salen del mismo
            sitio: `BAHIA`. Un día de cardio el suelo se puede seguir leyendo en cuadros. */}
        <p className="pointer-events-none absolute bottom-2 right-3 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
          retícula {BAHIA.pasoMenor * 100} cm
          <span className="mx-1 text-white/20">·</span>
          {BAHIA.pasoMayor * 100} cm
        </p>

        {/* LO QUE CUELGA DE LOS MUROS. Último en el árbol y por tanto encima de la sala,
            pero DENTRO de ella: es la diferencia entre un dato colgado y una tarjeta
            flotando. */}
        {children}
      </div>
    </div>
  )
}
