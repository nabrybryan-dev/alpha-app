import { useMemo, useState } from 'react'
import { ARTICULACIONES, NOMBRE_DE_TIPO } from '../../../domain/patrones/articulaciones'
import {
  demostracionesDe,
  DEMOSTRACIONES,
  DEMOSTRACION_POR_ID,
  type Demostracion,
} from '../../../domain/patrones/demostraciones'
import { SEXO_POR_DEFECTO, SEXOS, type Sexo } from '../../../domain/patrones/juegoDeHuesos'
import { VisorPatron } from './VisorPatron'

/**
 * Lo que se ve en el botón, y lo que lee quien no ve. Con palabras y no con ♂/♀ a
 * propósito: un símbolo lo dibuja el sistema operativo, distinto en cada teléfono, y el
 * guardián de `emojis-como-iconos.test.ts` lo cazó a la primera.
 */
const ETIQUETA_DE_SEXO: Record<Sexo, string> = { neutro: 'Neutro', hombre: 'Hombre', mujer: 'Mujer' }
const NOMBRE_DE_SEXO: Record<Sexo, string> = {
  neutro: 'Huesos neutros',
  hombre: 'Huesos de hombre',
  mujer: 'Huesos de mujer',
}

/**
 * El sujeto, aislado, ejerciendo una acción cada vez.
 *
 * Un ejercicio mezcla varias articulaciones a la vez y eso es lo que hay que
 * entender al final. Pero antes hace falta ver **una sola cosa moviéndose**: el
 * codo doblándose y nada más, desde el plano en el que ese movimiento ocurre.
 *
 * Aquí no hay escenario a propósito. Al estudiar una articulación el suelo y la
 * bahía son ruido, y además estas demostraciones no se apoyan en nada: el
 * sujeto flota para que nada distraiga del segmento que se mueve.
 */
export interface ExploradorAnatomicoProps {
  /**
   * Por dónde abrir. Se llega aquí desde un ejercicio concreto, así que empezar
   * por la articulación que ese ejercicio mueve ahorra buscar lo que se venía a
   * ver. Un id que no existe cae en el arranque por defecto en vez de dejar la
   * pantalla en blanco: viene de fuera y no se puede confiar en él.
   */
  articulacionInicial?: string
  /**
   * La cadena del ejercicio del que se viene. Con `cerrada`, las
   * articulaciones del apoyo se demuestran con el pie fijo —el fémur bajando
   * sobre la tibia, la pelvis echándose atrás— que es lo que de verdad hacen
   * dentro de una sentadilla o un peso muerto.
   */
  cadena?: 'cerrada' | 'abierta'
}

export function ExploradorAnatomico({ articulacionInicial, cadena = 'abierta' }: ExploradorAnatomicoProps = {}) {
  // Por defecto el codo: es la bisagra más clara y su límite —el olécranon
  // topando con su fosa— explica de una vez qué significa un grado de libertad.
  const [elegida, setElegida] = useState<Demostracion>(
    () =>
      (articulacionInicial ? demostracionesDe(articulacionInicial, cadena)[0] : undefined) ??
      DEMOSTRACION_POR_ID['demo-codo-codoFlex'] ??
      DEMOSTRACIONES[0],
  )
  const hermanas = demostracionesDe(elegida.articulacion.id, cadena)
  // La anatomía de verdad, apagada de salida: pesa 1 MB y no se baja hasta que se pide.
  const [hueso, setHueso] = useState(false)
  const [musculo, setMusculo] = useState(false)
  const [piel, setPiel] = useState(false)
  // Con qué huesos se dibuja el sujeto. Neutro es el de siempre; la app no sabe el sexo
  // de nadie, así que aquí se elige a mano.
  const [sexo, setSexo] = useState<Sexo>(SEXO_POR_DEFECTO)
  // Memorizado porque un array nuevo cada render reiniciaría el efecto que lo carga.
  const atlas = useMemo(
    () => [
      ...(hueso ? (['esqueleto'] as const) : []),
      ...(musculo ? (['musculos'] as const) : []),
      ...(piel ? (['piel'] as const) : []),
    ],
    [hueso, musculo, piel],
  )

  return (
    <div className="flex flex-col gap-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ambar">
          El sujeto y sus acciones
        </p>
        <h2 className="font-display text-xl uppercase leading-none tracking-tight text-texto">
          {elegida.articulacion.nombre}
        </h2>
        <p className="mt-1 text-[11px] text-silver-400">
          {NOMBRE_DE_TIPO[elegida.articulacion.tipo]} ·{' '}
          {elegida.articulacion.ejes.length === 1
            ? 'un grado de libertad'
            : `${elegida.articulacion.ejes.length} grados de libertad`}
        </p>
      </header>

      {/* Las articulaciones, en orden de la cadena y no alfabético. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ARTICULACIONES.map((a) => {
          const activa = a.id === elegida.articulacion.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setElegida(demostracionesDe(a.id, cadena)[0])}
              aria-pressed={activa}
              className={`press shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                activa
                  ? 'border-ambar/45 bg-ambar/15 text-ambar'
                  : 'border-ink-500 text-silver-400'
              }`}
            >
              {a.nombre}
            </button>
          )
        })}
      </div>

      {/* Los ejes de la elegida: solo si tiene más de uno, o no dice nada. */}
      {hermanas.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {hermanas.map((d) => {
            const activa = d.id === elegida.id
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setElegida(d)}
                aria-pressed={activa}
                className={`press rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${
                  activa ? 'border-silver-400 text-silver-100' : 'border-ink-500 text-silver-500'
                }`}
              >
                {d.eje.positivo} / {d.eje.negativo}
              </button>
            )
          })}
        </div>
      )}

      {/* `key` fuerza el remontaje al cambiar de acción: el visor calcula el
          encuadre y la traza al montarse, y sin esto se quedaría con los de la
          articulación anterior. */}
      {/* LA ANATOMÍA REAL, encima del sujeto que se mueve.
          No sustituye al muñeco: el muñeco se contrae y esto no, es una postura fija de un
          varón adulto de referencia. Sirve para ver CÓMO ES un músculo, no cómo trabaja.
          Por eso son dos interruptores y no un modo: se miran juntos. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-silver-500">Anatomía real</span>
        {([
          ['Esqueleto', hueso, setHueso],
          ['Musculatura', musculo, setMusculo],
          // La piel es la del atlas femenino: es lo único que ese atlas trae de cuerpo.
          ['Piel', piel, setPiel],
        ] as const).map(([nombre, activo, poner]) => (
          <button
            key={nombre}
            type="button"
            onClick={() => poner(!activo)}
            aria-pressed={activo}
            className={`press rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${
              activo ? 'border-ambar/45 bg-ambar/15 text-ambar' : 'border-ink-500 text-silver-500'
            }`}
          >
            {nombre}
          </button>
        ))}

        {/* EL SEXO DEL SUJETO: con qué huesos se dibuja el que se mueve. Neutro es el de
            siempre; hombre y mujer llevan las longitudes medidas en los dos atlas
            (`juegoDeHuesos.ts`). Va junto a la anatomía real porque es la misma pregunta
            —¿de quién es este cuerpo?— y se elige a mano porque la app no sabe el sexo de
            nadie. */}
        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-silver-500">Huesos</span>
        {SEXOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSexo(s)}
            aria-pressed={sexo === s}
            aria-label={NOMBRE_DE_SEXO[s]}
            title={NOMBRE_DE_SEXO[s]}
            className={`press rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${
              sexo === s ? 'border-ambar/45 bg-ambar/15 text-ambar' : 'border-ink-500 text-silver-500'
            }`}
          >
            {ETIQUETA_DE_SEXO[s]}
          </button>
        ))}
      </div>

      {/* La anatomía real ocupa más que el muñeco —es carne, no palos— y llega hasta los
          pies, así que la cámara se retira para que el cuerpo entero quepa. Sin ella, igual. */}
      <VisorPatron
        key={elegida.id}
        patron={elegida.patron}
        conEscenario={false}
        atlas={atlas}
        retirada={atlas.length > 0 ? 1.35 : 1}
        sexo={sexo}
      />
    </div>
  )
}
