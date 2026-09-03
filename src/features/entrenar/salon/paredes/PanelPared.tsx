import type { ClaveDeCampo, ContenidoDePared } from './contenidoPared'
import { CIFRAS_DEL_MURO } from './muros'
import { ESCORZO_DE_PARED, TOPE_PARED } from '../huecos'

/**
 * LOS NUEVE CAMPOS DEL EJERCICIO, COLGADOS DE LOS MUROS.
 *
 * Es el hueco `paredes` de `huecos.ts`: lo corto y esencial del ejercicio, a la altura de
 * la mirada y al borde del cuadro. No decide nada — los nueve textos vienen ya repartidos y
 * ya recortados de `contenidoPared()`, que es la función pura donde vive la invariante de
 * que lo que no cabe aquí está íntegro en el panel de abajo.
 *
 * ## Qué cambió, y por qué
 *
 * Antes salían juntos, en dos columnas del 42 % pegadas al borde de arriba. En el
 * iPhone eso era lo que Bryan describió como «ocho paneles encajonando al sujeto por los
 * dos lados»: dos tercios del ancho ocupados por tarjetas y el cuerpo asomando por el
 * pasillo del medio. Siguen estando todos —no se ha perdido un solo campo— pero ya no
 * salen juntos ni deciden ellos la maqueta:
 *
 * - los cinco de EJECUTAR (`MURO_IZQUIERDO`: qué ejercicio, cómo se hace, cuántas series,
 *   con cuánta carga y hasta dónde) cuelgan del muro izquierdo, en columna estrecha;
 * - los cuatro de MEDIR (`MURO_DERECHO`: dónde va el móvil, a qué distancia, qué palanca y
 *   qué velocidad) se los lleva el módulo de la cámara, que es de quien son: son los
 *   ajustes del encuadre, y leerlos junto al trípode es leerlos donde se usan.
 *
 * Este archivo exporta las tres piezas de esa repartición —el panel suelto, la columna del
 * muro y las dos listas— y no monta ninguna maqueta de pantalla completa. Quién va dónde
 * lo decide `SalonEntrenar`, que es el que sabe qué más hay en el cuadro.
 *
 * ## Por qué no toca los textos
 *
 * Ni recorta, ni añade puntos suspensivos, ni reordena. Si esta capa recortara por su
 * cuenta habría dos sitios decidiendo el mismo tope y se separarían al primer ajuste —
 * exactamente lo que `TOPE_PARED` está puesto en `huecos.ts` para evitar. Aquí el tope
 * solo se USA: para poder auditarlo desde fuera con `data-tope`.
 *
 * ## Por qué no recibe el puntero
 *
 * Toda la capa va con `pointer-events-none`. Las paredes se leen mientras la cámara
 * orbita, y el gesto de orbitar es un arrastre horizontal sobre el sujeto: una pared que
 * capturase el puntero se comería el arrastre justo en el borde de la pantalla, que es
 * donde el pulgar empieza el gesto. No hay nada que tocar en una pared; lo tocable son el
 * suelo (el registro), el módulo de la cámara y el borde de abajo (el panel).
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
  carga: 'Carga',
  rir: 'Fallo',
}

export interface PanelCampoProps {
  campo: ClaveDeCampo
  texto: string
  /** Hacia dónde se escorza el panel. El muro se inclina HACIA el centro del cuadro. */
  lado: 'izquierda' | 'derecha'
  /**
   * La versión de una sola línea, para cuando el panel va dentro de otro módulo.
   *
   * El rótulo y el texto siguen siendo dos párrafos —la auditoría lee el segundo, y esa
   * lectura no puede depender de dónde esté colgado el panel—, pero se ponen en una fila
   * en vez de uno debajo del otro. Es lo que permite que los cuatro campos de medida
   * quepan dentro del módulo de la cámara sin comerse el suelo del salón.
   */
  denso?: boolean
  /** Clases extra de la caja. Sirve para que quepa en una fila (`min-w-0 flex-1`). */
  className?: string
}

/**
 * UN CAMPO COLGADO DEL MURO.
 *
 * Estructura fija y auditada desde fuera: `data-campo` dice cuál es, `data-tope` con
 * cuántos caracteres se contó, el primer párrafo es el rótulo y el segundo el texto. Esa
 * forma no se toca aunque cambie el sitio donde cuelga.
 */
export function PanelCampo({ campo, texto, lado, denso = false, className = '' }: PanelCampoProps) {
  return (
    <div
      data-campo={campo}
      data-tope={TOPE_PARED}
      // Sin desenfoque, y con el fondo en `--ink-900` casi opaco. Esta caja no es una
      // superficie fija: cuelga del muro y se escorza con la cámara, que orbita sobre el
      // sujeto. Un `backdrop-filter` aquí obliga a remuestrear la región en CADA
      // fotograma de la órbita, y encima sobre el lienzo del sujeto — que es lo mismo que
      // la regla del repo prohíbe para el scroll, pero peor.
      className={`rounded-[9px] border border-white/10 bg-ink-900/85 ${
        denso ? 'flex items-baseline gap-2 px-2 py-1' : 'px-2 py-1.5'
      } ${lado === 'izquierda' ? 'origin-left text-left' : 'origin-right text-right'} ${className}`}
      // La pared se INCLINA hacia el centro, y no es decoración: un rótulo plano pegado al
      // borde se lee como una etiqueta flotando sobre la imagen; escorzado se lee como un
      // muro alrededor del sujeto. Los grados los pone `ESCORZO_DE_PARED` en `huecos.ts` y
      // no este archivo: la pared del ejercicio y la de la prescripción sin sujeto son el
      // mismo muro, y dos números iguales en dos archivos se separan al primer ajuste.
      style={{
        transform: `rotateY(${lado === 'izquierda' ? ESCORZO_DE_PARED.grados : -ESCORZO_DE_PARED.grados}deg)`,
        boxShadow: '0 6px 18px -12px rgba(0,0,0,.9)',
      }}
    >
      <p
        className={`text-[7.5px] font-bold uppercase leading-none tracking-[0.16em] text-silver-500 ${
          denso ? 'shrink-0' : ''
        }`}
      >
        {ROTULO[campo]}
      </p>
      <p
        className={`text-[10.5px] font-semibold leading-snug text-silver-200 ${
          denso ? 'min-w-0 flex-1' : 'mt-0.5'
        }`}
      >
        {texto}
      </p>
    </div>
  )
}

export interface MuroDeCamposProps {
  /** `true` si ya cuelga de un `CuadroDePared`: el marco y el escorzo los pone el cuadro. */
  enCuadro?: boolean
  /** Los nueve textos cortos, tal como los devuelve `contenidoPared()`. */
  contenido: ContenidoDePared
  /** Qué campos cuelga esta columna. */
  campos: readonly ClaveDeCampo[]
  lado: 'izquierda' | 'derecha'
  denso?: boolean
  className?: string
}

/**
 * UNA COLUMNA DE MURO: varios campos colgados del mismo plano.
 *
 * La `perspective` va en ESTA columna y no en un ancestro común: alcanza solo a los HIJOS
 * DIRECTOS, así que puesta más arriba el `rotateY` de los paneles se aplicaría igual y NO
 * escorzaría — se pagaría el coste sin ver el efecto, y sin que nada se pusiera en rojo.
 */
export function MuroDeCampos({ contenido, campos, lado, denso, className = '' }: MuroDeCamposProps) {
  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      style={{
        perspective: `${ESCORZO_DE_PARED.perspectiva}px`,
        perspectiveOrigin: lado === 'izquierda' ? 'right center' : 'left center',
      }}
    >
      {agrupar(campos).map((bloque) =>
        bloque.enFila ? (
          <div key={bloque.campos.join('+')} className="flex gap-1">
            {bloque.campos.map((campo) => (
              <PanelCampo
                key={campo}
                campo={campo}
                texto={contenido[campo]}
                lado={lado}
                denso={denso}
                className="min-w-0 flex-1"
              />
            ))}
          </div>
        ) : (
          bloque.campos.map((campo) => (
            <PanelCampo key={campo} campo={campo} texto={contenido[campo]} lado={lado} denso={denso} />
          ))
        ),
      )}
    </div>
  )
}

/**
 * PARTE LA LISTA EN BLOQUES: lo que va en columna y lo que va en una fila.
 *
 * Las cifras que vengan SEGUIDAS se juntan en una fila; todo lo demás se apila. Agrupar
 * por vecindad y no por una segunda lista escrita a mano tiene una consecuencia que
 * importa: el orden lo sigue mandando `CAMPOS_DE_PARED` y esto no puede reordenar ni
 * perder un campo — lo que entra, sale, y en el mismo orden.
 *
 * Existe porque con los cinco campos apilados el cuadro del ejercicio medía 249 px de 844
 * —el 30 % de la pantalla— y rozaba el borde de arriba. Series, carga y RIR son tres
 * valores de dos palabras: en fila ocupan una altura en vez de tres.
 */
function agrupar(
  campos: readonly ClaveDeCampo[],
): { enFila: boolean; campos: ClaveDeCampo[] }[] {
  const bloques: { enFila: boolean; campos: ClaveDeCampo[] }[] = []
  for (const campo of campos) {
    const enFila = CIFRAS_DEL_MURO.has(campo)
    const ultimo = bloques[bloques.length - 1]
    if (ultimo && ultimo.enFila === enFila) ultimo.campos.push(campo)
    else bloques.push({ enFila, campos: [campo] })
  }
  // Una cifra sola no es una fila: es un panel normal, y en fila se estiraría al ancho
  // entero con el rótulo pegado a la izquierda, que se lee peor que apilado.
  for (const b of bloques) if (b.enFila && b.campos.length < 2) b.enFila = false
  return bloques
}
