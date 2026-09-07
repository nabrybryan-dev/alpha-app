import { patronDeCategoria } from '../../../../domain/patrones/catalogo'
import type { EjercicioPrescrito, ItemMarcable } from '../../../../domain/types'
import { ESCORZO_DE_PARED, TOPE_PARED } from '../huecos'

/**
 * LA PRESCRIPCIÓN EN LAS PAREDES CUANDO NO HAY SUJETO QUE ENSEÑAR.
 *
 * Es el hueco `sinPatron` de `huecos.ts`. El cardio y los cribados no tienen un gesto
 * resistido que poner en el centro: una bicicleta en zona 2 no es un patrón de
 * movimiento y un cribado de banderas rojas no es siquiera un ejercicio. Enseñar ahí un
 * patrón cualquiera sería peor que no enseñar ninguno.
 *
 * ## Lo que cambió, y por qué
 *
 * Este archivo pintaba cuatro tarjetas centradas sobre un negro liso propio. Bryan abrió
 * `/entrenar` en el iPhone un día de cardio y lo que vio no era un salón: era la lista
 * de tarjetas que este trabajo venía a quitar. La decisión escrita dice lo contrario y
 * no admite lectura:
 *
 * > los ejercicios sin patrón de movimiento **abren el salón igual**, con sus paredes y
 * > su prescripción (minutos, zona, ritmo, descanso), pero **sin sujeto ejecutando en el
 * > centro**. La pantalla no cambia de naturaleza según el día.
 *
 * Así que ahora esto no ocupa el centro: lo **rodea**. Los cuatro datos cuelgan de los
 * dos muros, con el mismo escorzo, el mismo fondo opaco y el mismo tope que los ocho
 * paneles del ejercicio —`ESCORZO_DE_PARED` y `TOPE_PARED` salen de `huecos.ts`, que es
 * de donde los saca también `paredes/PanelPared.tsx`—. Y no lleva fondo: el centro es la
 * sala, que la monta `SalaVacia`. Un día de fuerza hay alguien dentro de la habitación;
 * un día de cardio la habitación está igual y no hay nadie. Es la única diferencia que el
 * encargo admite.
 *
 * ## Y el arreglo de la segunda vuelta: DENTRO, no encima
 *
 * Lo anterior estaba escrito y era falso a medias. Este componente se montaba como
 * HERMANO de `SalaVacia`, los dos tendidos sobre la pantalla entera, así que su
 * `absolute inset-0` era el inset de la PANTALLA y no el de la sala: los cuatro paneles se
 * pegaban al borde de arriba del salón, la habitación empezaba un tercio más abajo, y
 * entre unos y otra quedaba una franja negra. Bryan volvió a abrirlo en el iPhone un día
 * de cardio y lo que vio fueron cuatro tarjetas planas sobre negro y la sala debajo:
 * exactamente el dashboard que este trabajo vino a quitar, solo que reubicado arriba.
 *
 * Ahora esto va como HIJO de `SalaVacia`, así que su `inset-0` es el rectángulo de la
 * habitación. Un panel al 0 % de esta caja es un panel a la altura del techo del muro, no
 * flotando sobre el salón. El componente no cambió ni un estilo para conseguirlo: cambió
 * de sitio en el árbol, que era donde estaba el fallo.
 *
 * ## De dónde sale «no hay patrón»
 *
 * De `patronDeCategoria()`, importada de `domain/patrones/catalogo`, que es donde vive la
 * regla: los alias de categoría, la lista por nombre y el `SIN_PATRON` que aparta el
 * cardio y los cribados. Copiar aquí esos términos sería tener dos listas que se separan
 * —y el día que el catálogo aprenda un patrón nuevo, este salón seguiría diciendo que no
 * lo hay—. Aquí solo se PREGUNTA.
 *
 * ## Y sigue sin montar el visor
 *
 * Este componente no importa `VisorPatron` ni `EstudioDelPatron`, ni condicionalmente, y
 * no abre ningún contexto WebGL. La sala vacía tampoco: se dibuja con trazos, porque una
 * habitación sin nadie dentro no se anima ni se orbita y no vale un contexto entero en
 * un móvil que a lo mejor está grabando una serie.
 */

/**
 * Si un ejercicio tiene patrón de movimiento que enseñar en 3D.
 *
 * Vive aquí y no en el salón para que la decisión de «con sujeto o sin sujeto» y la
 * pantalla que la representa sean lo mismo. Delega entera en el dominio.
 */
export function tienePatronDeMovimiento(ejercicio: EjercicioPrescrito | undefined): boolean {
  if (!ejercicio) return false
  return patronDeCategoria(ejercicio.categoria, ejercicio.nombre) !== undefined
}

/**
 * Deja una línea dentro del tope del hueco.
 *
 * `sinPatron` declara `topeDeTexto: TOPE_PARED`, igual que las paredes, y por el mismo
 * motivo: esto se lee de reojo mientras se mira la sala, no es una ficha. Recortar aquí
 * no pierde nada porque el texto completo del bloque baja íntegro al panel de abajo —el
 * recuadro `ejercicio` pinta `indicaciones` y `duracionMin` sin tocar—, que es la misma
 * invariante con la que funcionan las paredes.
 */
function enCorto(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= TOPE_PARED) return limpio
  return Array.from(limpio).slice(0, TOPE_PARED - 1).join('').trimEnd() + '…'
}

/** La zona o el RPE, si están escritos. No se inventa: si no está, se dice que no está. */
function zonaDe(texto: string): string | undefined {
  const encontrada = /\bzona\s*\d+|\bz[1-5]\b|\brpe\s*\d+(?:[-–]\d+)?/i.exec(texto)
  return encontrada?.[0]
}

export interface SalonSinSujetoProps {
  /** El ejercicio sin patrón, cuando lo que toca es un cribado o similar. */
  ejercicio?: EjercicioPrescrito
  /** Los bloques de la sesión metabólica, cuando no hay ejercicios que prescribir. */
  bloques?: readonly ItemMarcable[]
}

/** Un dato de la prescripción, colgado del muro con el escorzo de la pared. */
function PanelDePared({
  rotulo,
  valor,
  lado,
}: {
  rotulo: string
  valor: string
  lado: 'izquierda' | 'derecha'
}) {
  return (
    <div
      data-prescripcion={rotulo.toLowerCase()}
      data-tope={TOPE_PARED}
      className={`rounded-[10px] border border-white/10 bg-ink-900 px-2.5 py-2 ${
        lado === 'izquierda' ? 'origin-left text-left' : 'origin-right text-right'
      }`}
      style={{
        transform: `rotateY(${lado === 'izquierda' ? ESCORZO_DE_PARED.grados : -ESCORZO_DE_PARED.grados}deg)`,
        boxShadow: '0 6px 18px -12px rgba(0,0,0,.9)',
      }}
    >
      <dt className="text-[8.5px] font-bold uppercase leading-none tracking-[0.16em] text-silver-500">
        {rotulo}
      </dt>
      <dd className="mt-1 text-[11.5px] font-semibold leading-snug text-silver-100">{valor}</dd>
    </div>
  )
}

export function SalonSinSujeto({ ejercicio, bloques = [] }: SalonSinSujetoProps) {
  const texto = [
    ejercicio?.prescripcion,
    ejercicio?.cues,
    ...bloques.flatMap((b) => [b.titulo, b.indicaciones]),
  ]
    .filter(Boolean)
    .join(' ')

  const minutos = bloques.reduce((t, b) => t + (b.duracionMin ?? 0), 0)
  const zona = zonaDe(texto)
  const ritmo = bloques.find((b) => b.indicaciones)?.indicaciones ?? ejercicio?.cues
  const descanso = ejercicio
    ? `${String(ejercicio.descansoMin).replace('.', ',')} min entre series`
    : 'Continuo, sin descanso pautado'

  // El reparto entre los dos muros es el mismo criterio que en las paredes del
  // ejercicio: a la izquierda lo que fija el trabajo —cuánto y a qué intensidad—, a la
  // derecha cómo se lleva —a qué ritmo y con qué pausa—.
  const izquierda = [
    {
      rotulo: 'Minutos',
      valor: minutos > 0 ? `${minutos} min` : 'Sin minutos prescritos',
    },
    { rotulo: 'Zona', valor: zona ? enCorto(zona) : 'Sin zona ni RPE escritos' },
  ]
  const derecha = [
    { rotulo: 'Ritmo', valor: ritmo ? enCorto(ritmo) : 'Sin ritmo escrito' },
    { rotulo: 'Descanso', valor: enCorto(descanso) },
  ]

  return (
    // SIN FONDO. Antes había aquí un negro de estudio propio, y era exactamente lo que
    // tapaba la sala: el centro tiene que dejar ver la habitación que hay detrás. Y sin
    // puntero, como las paredes del ejercicio: no hay nada que tocar en un muro.
    <div data-sin-sujeto="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 flex justify-between gap-2 px-2 pt-2">
        <div
          className="flex w-[42%] flex-col gap-1.5"
          style={{
            perspective: `${ESCORZO_DE_PARED.perspectiva}px`,
            perspectiveOrigin: 'right center',
          }}
        >
          <dl className="flex flex-col gap-1.5">
            {izquierda.map((p) => (
              <PanelDePared key={p.rotulo} rotulo={p.rotulo} valor={p.valor} lado="izquierda" />
            ))}
          </dl>
        </div>

        <div
          className="flex w-[42%] flex-col gap-1.5"
          style={{
            perspective: `${ESCORZO_DE_PARED.perspectiva}px`,
            perspectiveOrigin: 'left center',
          }}
        >
          <dl className="flex flex-col gap-1.5">
            {derecha.map((p) => (
              <PanelDePared key={p.rotulo} rotulo={p.rotulo} valor={p.valor} lado="derecha" />
            ))}
          </dl>
        </div>
      </div>

      {/* EL AVISO, a ras de suelo y en la esquina de enfrente de la leyenda de la
          retícula. Que este ejercicio no tenga modelo hay que decirlo —un centro vacío sin
          declarar parece una pantalla rota— pero decirlo arriba lo convierte en el titular
          de la pantalla, que es como se leía hasta hoy: una línea suelta debajo de las
          tarjetas y encima de la sala. Abajo a la izquierda es una anotación de la escena,
          hace pareja con «retícula 10 cm · 50 cm» de la esquina derecha, y no le quita el
          sitio a ningún dato. Sin escorzo, como la leyenda: a la altura del suelo ya no hay
          muro del que colgarse, y girar una anotación que no está en una pared es fingir
          una profundidad que ahí no existe.

          `max-w-[52%]` es lo que impide que se meta debajo de la leyenda en un teléfono
          estrecho: las dos anotaciones se reparten el borde de abajo y ninguna pisa a la
          otra. */}
      <div className="absolute bottom-2 left-3 max-w-[52%] text-left">
        <p className="text-[9.5px] font-semibold leading-snug text-silver-300">
          {enCorto('Sin modelo 3D para este ejercicio.')}
        </p>
        <p className="text-[9px] leading-snug text-silver-500">
          {enCorto('No hay gesto resistido que enseñar.')}
        </p>
      </div>
    </div>
  )
}
