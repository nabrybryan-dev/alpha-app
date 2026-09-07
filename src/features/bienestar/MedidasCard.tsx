import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { IconoRegla } from '../../components/ui/Icono'
import { db, hoyIso } from '../../data/dbInstance'
import type { MedidaCorporal } from '../../domain/types'
import { direccion } from '../../lib/direccionesVisuales'
import { usePausaFueraDePantalla } from '../../lib/pausaFueraDePantalla'
import { CheckDibujado } from '../entrenar/CheckDibujado'

/**
 * LAS OCHO MEDIDAS, Y SOLO ESTAS OCHO.
 *
 * Hasta el 2026-09-08 esto eran cinco perímetros de estética —cintura, cadera, abdomen,
 * muslo, brazo— y la báscula. Ahora son ocho, y seis de ellas son LONGITUDES DE HUESO: son
 * las que le faltan al sujeto 3D para dejar de ser el muñeco del atlas y ser esta persona.
 * Con la estatura sola, dos personas de 1,75 con fémures distintos se dibujan iguales, y
 * eso cambia el brazo de momento de cada ejercicio — que es lo que la app enseña.
 *
 * `clave` es lo que se guarda y NO se renombra: viaja dentro de `medidas` a `perfiles`, y
 * dos pantallas más (`coach/AsesoradoDetallePage` y `logros/ProgresoEvolucion`) la
 * imprimen tal cual. Por eso son nombres de persona y no identificadores: es la convención
 * que ya tenían los registros viejos (`Glúteos`, `Abdomen medio`).
 *
 * `ayuda` no es adorno: una longitud sin protocolo no es una medida. Medir el fémur desde
 * la cadera «por encima» y desde el trocánter dan dos números distintos, y el que se
 * compara con el de dentro de tres meses tiene que salir del mismo sitio.
 */
const MEDIDAS = [
  { clave: 'Tibia y peroné', etiqueta: 'Longitud de tibia y peroné', ayuda: 'de extremo a extremo, del tobillo a la rodilla' },
  { clave: 'Fémur', etiqueta: 'Longitud del fémur', ayuda: 'del trocánter (el hueso que sobresale en la cadera) a la rodilla' },
  { clave: 'Torso', etiqueta: 'Longitud del torso', ayuda: 'del hueco del cuello al ombligo, de pie y recto' },
  { clave: 'Antebrazo', etiqueta: 'Longitud del antebrazo', ayuda: 'del codo a la muñeca' },
  { clave: 'Brazo', etiqueta: 'Longitud del brazo', ayuda: 'del hombro al codo' },
  { clave: 'Ancho clavicular', etiqueta: 'Ancho clavicular', ayuda: 'de punta a punta de los hombros, por delante' },
  { clave: 'Cintura', etiqueta: 'Cintura', ayuda: 'en la parte más estrecha, sin apretar' },
  { clave: 'Caderas', etiqueta: 'Caderas', ayuda: 'en la parte más ancha' },
] as const

interface MedidasCardProps {
  usuarioId: string
  /**
   * Si esta persona ve sus cifras de composición corporal.
   *
   * Viene de la decisión de la nutricionista (migración 0018). En `false` la
   * tarjeta pierde la báscula —el campo, el placeholder y el kilaje del
   * resumen— y se queda solo con los perímetros, que su plan sí le pide.
   *
   * Por defecto `true`: quien no pase la prop se comporta como siempre.
   */
  verPeso?: boolean
}

function numeroDe(texto: string): number | undefined {
  const valor = Number.parseFloat(texto.replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : undefined
}

function Delta({ actual, previa }: { actual: number; previa?: number }) {
  if (previa === undefined || previa === actual) return null
  const delta = Math.round((actual - previa) * 10) / 10
  return (
    <span className={`cifras ml-1 text-[10px] font-bold ${delta < 0 ? 'text-accion' : 'text-tenue'}`}>
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )
}

/**
 * La pieza E «Físico» al lado de los campos: la cámara sube, la lista baja.
 *
 * LA PIEZA. *«La cámara sube por el físico y recorre las inserciones una a una.»*
 * Eso son los cinco perímetros de `PERIMETROS`. La pieza no acompaña a la lista:
 * es la misma cosa en otro registro. Ver
 * `docs/specs/2026-08-25-piezas-sin-colocar-diseno.md`.
 *
 * POR QUÉ UNA COLUMNA Y NO UNA BANDA. Esta pantalla es CLARA
 * (`data-theme="light"`, fondo `#f7f7f5`), y en claro la pieza no puede ser suelo:
 * una banda oscura a sangre es justo lo que Contenidos tuvo que resolver montando
 * la pieza como lámina. Aquí es un objeto con forma, y la forma no es un capricho:
 * un plano que sube por un cuerpo se lee en vertical.
 *
 * NO LLEVA TEXTO ENCIMA. La ventana da 63,4 de luminancia media, muy por encima
 * del techo de 18. La columna es marco; los campos van fuera, al lado.
 *
 * EL `encaje` DE E NO SE APLICA AQUÍ, Y APLICARLO SERÍA UN ERROR. En el catálogo E
 * lleva `origin-right scale-[1.213]` para sacar de cuadro la columna negra de su
 * 17,6% izquierdo. Pero un recorte 1:3 solo enseña 240 px de los 1280 y la ventana
 * empieza en x=632, muy a la derecha de esa columna. El encaje encima desplazaría
 * la ventana fuera del cuerpo. `object-[61%_50%]` sola da la misma medida —63,4—
 * sin transformación ninguna, y el negro queda fuera a cualquier alto.
 *
 * EL TOPE ES DE ALTO, NO DE ANCHO. El recorte es cover sobre una caja alta y
 * estrecha, así que la escala la manda el alto: `alto_destino / 720`. Con densidad
 * 3 el techo son **240 CSS px**, y por eso `max-h-60`. Sin ese tope un formulario
 * más largo estira la pieza sin que nadie se entere: es el fallo que
 * `fondos-de-tarjeta.test.ts` existe para cazar, y no se ve en un monitor.
 */
function ColumnaFisico() {
  const marco = usePausaFueraDePantalla<HTMLDivElement>()
  const pieza = direccion('E')

  return (
    <div
      ref={marco}
      aria-hidden="true"
      className="max-h-60 w-16 shrink-0 self-stretch overflow-hidden rounded-[10px] bg-ink-900"
    >
      <FondoLoop
        poster={pieza.poster}
        video={pieza.video}
        preload="none"
        prioridad="auto"
        anchura={1280}
        altura={720}
        className="h-full w-full object-cover object-[61%_50%]"
      />
    </div>
  )
}

/**
 * Registro de las ocho medidas del cuerpo, tomadas por el propio asesorado.
 *
 * Guarda en el perfil y sincroniza a la nube — el coach las ve en su panel, y seis de las
 * ocho son las que le dan al sujeto 3D del salón las proporciones de ESTA persona.
 *
 * El peso NO está aquí y no es un olvido: lo pregunta el check-in del día, que es donde
 * tiene sentido —el peso se mueve cada día y un fémur no—. `verPeso` sigue mandando sobre
 * el kilaje del resumen, que es lo único de composición corporal que queda en la tarjeta.
 */
export function MedidasCard({ usuarioId, verPeso = true }: MedidasCardProps) {
  const [abierto, setAbierto] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})

  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = perfil?.medidas ?? []
  const ultima = medidas[medidas.length - 1] as MedidaCorporal | undefined
  const previa = medidas[medidas.length - 2] as MedidaCorporal | undefined

  const medidasEscritas = (): Record<string, number> => {
    const escritas: Record<string, number> = {}
    for (const { clave } of MEDIDAS) {
      const v = numeroDe(valores[clave] ?? '')
      if (v !== undefined) escritas[clave] = v
    }
    return escritas
  }

  /**
   * Al menos una medida escrita.
   *
   * Sin esta condición se guardaría una medición vacía: una fila con fecha y nada más,
   * que ensucia el historial del coach y no dice nada de nadie.
   */
  const puedeGuardar = Object.keys(medidasEscritas()).length > 0

  const guardar = () => {
    if (!puedeGuardar) return
    db.perfiles.agregarMedida(usuarioId, {
      fecha: hoyIso(),
      // SIN PESO, Y NO POR OLVIDO. La báscula ya se pregunta en el check-in diario, que es
      // donde tiene sentido —el peso se mueve cada día y estas medidas no—, y pedirla
      // aquí otra vez la convertía en la cuarta superficie de peso de la app. Ausente no
      // es cero: esta medición no trae peso porque no se midió aquí.
      alturaCm: ultima?.alturaCm ?? 0,
      perimetros: medidasEscritas(),
    })
    setAbierto(false)
    setGuardado(true)
    setValores({})
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-texto">
            <IconoRegla className="h-[17px] w-[17px] shrink-0 text-tenue" />
            Mis medidas
          </p>
          <p className="mt-0.5 text-xs text-tenue">
            {/* El kilaje solo aparece si esta persona ve su composición Y esa
                medición traía peso. Enseñarlo aquí dejaría entrar por la puerta
                de atrás lo que el formulario ya dejó de pedir. */}
            {ultima
              ? verPeso && ultima.pesoKg !== undefined
                ? `Última: ${ultima.fecha} · ${ultima.pesoKg} kg`
                : `Última: ${ultima.fecha}`
              : 'Aún no hay mediciones registradas'}
          </p>
        </div>
        {!abierto && (
          <button
            type="button"
            onClick={() => {
              setAbierto(true)
              setGuardado(false)
            }}
            className="press shrink-0 rounded-full border border-hairline-fuerte px-4 py-2 font-display text-xs text-texto"
          >
            Registrar
          </button>
        )}
      </div>

      {ultima && Object.keys(ultima.perimetros).length > 0 && !abierto && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-hairline pt-2.5">
          {Object.entries(ultima.perimetros).map(([nombre, cm]) => (
            <span key={nombre} className="text-xs text-tenue">
              {nombre} <span className="cifras font-bold text-texto">{cm}</span>
              <Delta actual={cm} previa={previa?.perimetros[nombre]} />
            </span>
          ))}
        </div>
      )}

      {guardado && !abierto && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-texto">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-2.5 w-2.5" />
          </span>
          Medidas guardadas. El coach ya las ve.
        </p>
      )}

      {abierto && (
        <div className="entrada mt-3 border-t border-hairline pt-3">
          {/* La pieza acompaña a los CAMPOS, no al pie: el texto de instrucciones
              y los botones van debajo, a todo el ancho. */}
          <div className="flex gap-3">
            <ColumnaFisico />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {MEDIDAS.map(({ clave, etiqueta, ayuda }) => (
                <label key={clave} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 text-xs text-tenue">
                    {etiqueta} (cm)
                    {/* CÓMO SE MIDE, al lado del campo y no en un pie de página. Una
                        longitud sin protocolo no es una medida: el fémur medido desde la
                        cadera y desde el trocánter son dos números distintos, y el que se
                        compara dentro de tres meses tiene que salir del mismo sitio. */}
                    <span className="mt-0.5 block text-[10px] leading-snug text-tenue/70">{ayuda}</span>
                  </span>
                  <input
                    inputMode="decimal"
                    value={valores[clave] ?? ''}
                    onChange={(e) => setValores((prev) => ({ ...prev, [clave]: e.target.value }))}
                    placeholder={ultima?.perimetros[clave] ? String(ultima.perimetros[clave]) : '—'}
                    className="w-24 shrink-0 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-right text-sm text-texto focus:border-rojo focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-tenue">
            Anota al menos una; las que dejes vacías no se guardan. Mídete siempre en las
            mismas condiciones (en ayunas, misma hora) y con la cinta apoyada sin apretar.
            El peso se apunta en el check-in del día, no aquí.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="press flex-1 rounded-full border border-hairline py-2.5 font-display text-xs text-tenue"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!puedeGuardar}
              className="press btn-cristal-rojo flex-1 rounded-full py-2.5 font-display text-xs disabled:opacity-40"
            >
              Guardar ✓
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
