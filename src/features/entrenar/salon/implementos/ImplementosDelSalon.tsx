import type { ImplementosDeSesion } from './implementosDeSesion'

/**
 * EL MATERIAL, APOYADO ALREDEDOR: el quinto de los cinco puntos del encargo.
 *
 * Va al pie del muro derecho, sobre el rodapié que traza la arquitectura de la sala: es
 * donde está el material en un gimnasio de verdad, arrimado a la pared y no en medio del
 * paso. Cada implemento es una silueta y un nombre corto — la silueta es la que se lee de
 * un vistazo mientras se orbita, y el nombre la que quita la duda.
 *
 * ## Lo que estas siluetas NO son
 *
 * No son fotos ni iconos de una librería: son cuatro trazos cada una, dibujados aquí. Un
 * icono importado sería una petición más y una dependencia nueva para dibujar una barra
 * con dos discos. Y no son geometría de la escena 3D: el material del salón se enseña en
 * la interfaz porque cambia con la sesión —hoy barra y polea, mañana mancuernas— y meter
 * eso en el lienzo obligaría a reconstruir la malla cada vez que cambia el ejercicio.
 *
 * ## Las claves de las siluetas son las del dominio
 *
 * Cada silueta se busca por el identificador de `Implemento` de
 * `domain/biomecanica/implementos.ts`, que es quien clasifica. No hay aquí ninguna clave
 * inventada ni ninguna que el dominio no pueda devolver: una silueta huérfana parece
 * vocabulario del sistema y no lo es, y la siguiente persona la copiaría. La única que no
 * sale de esa tabla es `cardio`, la superficie sobre la que se corre, que el dominio no
 * clasifica a propósito —una cinta no aporta carga— y está explicado donde se decide.
 *
 * ## Cuando no se puede deducir, se dice
 *
 * Los ejercicios cuyo nombre no delata material se cuentan aparte y se enseñan como lo que
 * son. Colgar una barra por defecto sería enseñar material que a lo mejor no se usa, y en
 * un gimnasio eso es mandar a alguien a la estación equivocada.
 *
 * ## ES UN ESTANTE, NO UNA FILA DE MIGAS: por qué la caja se ajusta a lo que pinta
 *
 * El testigo que mide esta pantalla no lee el DOM: apaga la marca `data-testigo` y cuenta
 * los píxeles de pantalla que cambian, dentro y fuera del rectángulo marcado. Con eso, una
 * caja ancha con el contenido pegado a un lado sale mal por dos sitios a la vez —la mitad
 * vacía del rectángulo no aporta nada y el aporte real queda tan pequeño que el ruido de la
 * propia pantalla (el reloj corriendo, la marquesina) lo alcanza— y el material se cae de
 * la lista de lo que se ve. Le pasó el 29-ago: el rectángulo medía 199×24 y el aporte
 * pintado era de 2.725 píxeles, a un suspiro de perderse.
 *
 * De ahí las dos decisiones de forma, y las dos son la misma:
 *
 * - **la caja se ajusta al contenido** (`w-fit`, con el tope de ancho puesto por quien lo
 *   coloca). El rectángulo marcado ES el estante, no el hueco donde cabría;
 * - **el material se apila en columna**, una pieza por línea y todas del mismo ancho, en
 *   vez de amontonarse en una tira de 24 píxeles de alto. Un estante arrimado a la pared
 *   se lee de un vistazo mientras se orbita; una tira de etiquetas al pie, no.
 *
 * El rótulo de encima —«material de la sesión»— es el mismo gesto que el de la cámara al
 * otro lado del suelo: dice qué es ese montón de siluetas sin obligar a deducirlo.
 */

/** Las siluetas: cada implemento, en cuatro trazos sobre un lienzo de 24×16. */
const SILUETA: Record<string, React.ReactNode> = {
  barra: (
    <>
      <path d="M2 8h20" />
      <path d="M4 4v8M6 3v10M18 3v10M20 4v8" />
    </>
  ),
  mancuernas: (
    <>
      <path d="M8 8h8" />
      <path d="M5 4v8M8 3v10M16 3v10M19 4v8" />
    </>
  ),
  polea: (
    <>
      <path d="M12 2v7" />
      <circle cx="12" cy="2.5" r="1.6" />
      <path d="M8 9h8v3H8z" />
      <path d="M9 12v2M15 12v2" />
    </>
  ),
  maquina: (
    <>
      <path d="M4 14V4h6v10" />
      <path d="M10 7h8" />
      <path d="M18 5v6" />
    </>
  ),
  disco: (
    <>
      <circle cx="12" cy="8" r="6" />
      <circle cx="12" cy="8" r="1.6" />
    </>
  ),
  'polea-tobillera': (
    <>
      <path d="M4 2v6" />
      <path d="M4 8h9" />
      <path d="M13 5h5v6h-5z" />
    </>
  ),
  'guiado-inclinado': (
    <>
      <path d="M3 13h10" />
      <path d="M13 13 20 5" />
      <path d="M17 3v5h5" />
    </>
  ),
  'guiado-vertical': (
    <>
      <path d="M5 2v12M19 2v12" />
      <path d="M5 7h14" />
      <path d="M7 5v4M17 5v4" />
    </>
  ),
  'peso-corporal': (
    <>
      <path d="M2 6h20v6H2z" />
      <path d="M6 6v6M18 6v6" />
    </>
  ),
  cardio: (
    <>
      <path d="M3 13h14l4-6" />
      <path d="M5 13v2M17 13v2" />
    </>
  ),
}

/** El trazo por defecto cuando un implemento nuevo aún no tiene silueta propia. */
const GENERICA = (
  <>
    <path d="M4 4h16v8H4z" />
  </>
)

export interface ImplementosDelSalonProps {
  material: ImplementosDeSesion
  className?: string
  /** Dónde se apoya en el suelo. Lo decide quien monta las paredes. */
  style?: React.CSSProperties
}

export function ImplementosDelSalon({
  material,
  className = '',
  style,
}: ImplementosDelSalonProps) {
  if (material.implementos.length === 0 && material.sinDeducir === 0) return null

  return (
    // `w-fit`: el rectángulo marcado es el estante y nada más. El tope de ancho y la altura
    // a la que se apoya vienen de quien lo coloca, que es quien sabe qué más hay en ese
    // suelo; aquí solo se decide que la caja no sea más grande que lo que pinta.
    <div
      data-testigo="implementos"
      data-implementos={material.implementos.length}
      style={style}
      className={`flex w-fit flex-col items-end gap-1 ${className}`}
    >
      {/* El rótulo del estante, en la misma voz que el de la cámara del otro lado del
          suelo: versalitas finas, sin caja, para que titule sin competir con las piezas. */}
      <p className="text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-silver-500">
        Material de la sesión
      </p>

      {material.implementos.map((implemento) => (
        // `w-full` iguala el ancho de todas las piezas al de la más larga: es lo que hace
        // que un montón de etiquetas sueltas se lea como un estante y no como una nube.
        <span
          key={implemento.id}
          className="flex w-full items-center gap-2 rounded-[10px] border border-white/10 bg-ink-900/85 px-2.5 py-1.5"
        >
          <svg
            viewBox="0 0 24 16"
            aria-hidden="true"
            className="h-5 w-[30px] shrink-0 text-silver-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {SILUETA[implemento.id] ?? GENERICA}
          </svg>
          <span className="text-[10.5px] font-semibold leading-tight text-silver-200">
            {implemento.nombre}
          </span>
          {implemento.ejercicios > 1 && (
            <span className="cifras ml-auto pl-1 text-[10px] leading-none text-silver-500">
              ×{implemento.ejercicios}
            </span>
          )}
        </span>
      ))}

      {material.sinDeducir > 0 && (
        <span className="w-full rounded-[10px] border border-white/10 bg-ink-900/85 px-2.5 py-1.5 text-[9.5px] leading-tight text-silver-500">
          {material.sinDeducir} sin material escrito
        </span>
      )}
    </div>
  )
}
