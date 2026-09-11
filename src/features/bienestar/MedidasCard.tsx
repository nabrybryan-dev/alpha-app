import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { IconoRegla } from '../../components/ui/Icono'
import { db, hoyIso } from '../../data/dbInstance'
import type { MedidaCorporal } from '../../domain/types'
import {
  MEDIDAS,
  revisarMedidas,
  type ClaveDeMedida,
  type MedidasDelCuerpo,
  type ReparoDeMedida,
} from '../../domain/medidas'
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
 * ## Aquí no hay una lista de medidas, y eso es lo importante
 *
 * Las ocho —su orden, su etiqueta, cómo se toma cada una y entre qué dos números es
 * posible— viven en `domain/medidas.ts` y este formulario las PINTA. Tenerlas escritas
 * también aquí sería tener dos catálogos: el día que el rango del fémur cambiara, el
 * dominio rechazaría lo que la ficha sigue pidiendo, y eso no fallaría en ningún test —se
 * vería como un campo que no deja guardar sin decir por qué.
 *
 * Y lo que se escribe se valida con `revisarMedidas` ANTES de guardar. No es un lujo: la
 * trampa más frecuente de un campo de centímetros es el número en la escala equivocada
 * —el fémur en milímetros, la coma corrida— y eso, guardado, no se distingue de un dato
 * bueno.
 */

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
  const [valores, setValores] = useState<Partial<Record<ClaveDeMedida, string>>>({})
  /** Lo que el dominio ha dicho que está mal, para pintarlo bajo su campo. */
  const [reparos, setReparos] = useState<ReparoDeMedida[]>([])

  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = perfil?.medidas ?? []
  const ultima = medidas[medidas.length - 1] as MedidaCorporal | undefined
  const previa = medidas[medidas.length - 2] as MedidaCorporal | undefined

  /** Lo escrito, con las claves del dominio. Lo que se dejó en blanco, no va. */
  const cuerpoEscrito = (): MedidasDelCuerpo => {
    const cuerpo: MedidasDelCuerpo = {}
    for (const { clave } of MEDIDAS) {
      const v = numeroDe(valores[clave] ?? '')
      if (v !== undefined) cuerpo[clave] = v
    }
    return cuerpo
  }

  /**
   * Al menos una medida escrita.
   *
   * Sin esta condición se guardaría una medición vacía: una fila con fecha y nada más,
   * que ensucia el historial del coach y no dice nada de nadie.
   *
   * Que estén DENTRO DE RANGO no se comprueba aquí, y es a propósito: un botón apagado no
   * dice por qué. El reparo se enseña al intentar guardar, con el mensaje que escribe el
   * dominio, debajo del campo que lo tiene.
   */
  const puedeGuardar = Object.keys(cuerpoEscrito()).length > 0

  const guardar = () => {
    if (!puedeGuardar) return
    const cuerpo = cuerpoEscrito()
    // EL DOMINIO DECIDE SI ESTO SE PUEDE GUARDAR. La ficha no repite sus rangos: los pide.
    const reparosDelDominio = revisarMedidas(cuerpo)
    if (reparosDelDominio.length > 0) {
      setReparos(reparosDelDominio)
      return
    }
    db.perfiles.agregarMedida(usuarioId, {
      fecha: hoyIso(),
      // SIN PESO, Y NO POR OLVIDO. La báscula ya se pregunta en el check-in diario, que es
      // donde tiene sentido —el peso se mueve cada día y estas medidas no—, y pedirla
      // aquí otra vez la convertía en la cuarta superficie de peso de la app. Ausente no
      // es cero: esta medición no trae peso porque no se midió aquí.
      alturaCm: ultima?.alturaCm ?? 0,
      // `perimetros` SE QUEDA VACÍO Y NO SE TOCA. Es el mapa de claves abiertas donde
      // conviven «Cadera» y «Glúteos» para el mismo dato; las ocho de la ficha van en
      // `cuerpo`, que tiene el catálogo cerrado. Lo que ya esté guardado ahí se sigue
      // enseñando, pero no se escribe nada nuevo.
      perimetros: {},
      cuerpo,
    })
    setAbierto(false)
    setGuardado(true)
    setValores({})
    setReparos([])
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

      {/* EL RESUMEN LEE LAS DOS COSAS: las ocho de la ficha (`cuerpo`) y lo que hubiera
          en `perimetros` de antes. Sin la primera lista, una toma recién guardada dejaría
          la tarjeta con la fecha y nada debajo; sin la segunda, el historial viejo de
          quien lleva meses midiéndose desaparecería de la pantalla. */}
      {ultima && !abierto && (ultima.cuerpo || Object.keys(ultima.perimetros).length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-hairline pt-2.5">
          {MEDIDAS.filter(({ clave }) => ultima.cuerpo?.[clave] !== undefined).map(({ clave, etiqueta }) => (
            <span key={clave} className="text-xs text-tenue">
              {etiqueta}{' '}
              <span className="cifras font-bold text-texto">{ultima.cuerpo?.[clave]}</span>
              <Delta actual={ultima.cuerpo?.[clave] ?? 0} previa={previa?.cuerpo?.[clave]} />
            </span>
          ))}
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
              {/* LAS OCHO SALEN DE LA TABLA DEL DOMINIO, en su orden. Ni la etiqueta ni
                  el protocolo están escritos aquí: escribirlos otra vez sería tener dos
                  catálogos que pueden decir cosas distintas. */}
              {MEDIDAS.map(({ clave, etiqueta, comoSeMide, unidad }) => {
                const reparo = reparos.find((r) => r.campo === clave)
                return (
                  <label key={clave} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 text-xs text-tenue">
                        {etiqueta} ({unidad})
                        {/* CÓMO SE MIDE, al lado del campo y no en un pie de página. Una
                            longitud sin protocolo no es una medida: el fémur medido desde
                            la cadera y desde el trocánter son dos números distintos, y el
                            que se compara dentro de tres meses tiene que salir del mismo
                            sitio. */}
                        <span className="mt-0.5 block text-[10px] leading-snug text-tenue/70">
                          {comoSeMide}
                        </span>
                      </span>
                      <input
                        inputMode="decimal"
                        value={valores[clave] ?? ''}
                        onChange={(e) => {
                          setValores((prev) => ({ ...prev, [clave]: e.target.value }))
                          // El reparo se va al tocar el campo: dejarlo puesto mientras se
                          // corrige convierte un aviso en un regaño.
                          if (reparo) setReparos((prev) => prev.filter((r) => r.campo !== clave))
                        }}
                        placeholder={ultima?.cuerpo?.[clave] !== undefined ? String(ultima.cuerpo[clave]) : '—'}
                        aria-invalid={reparo ? true : undefined}
                        className={`w-24 shrink-0 rounded-lg border bg-surface-2 px-3 py-2 text-right text-sm text-texto focus:outline-none ${
                          reparo ? 'border-rojo' : 'border-hairline focus:border-rojo'
                        }`}
                      />
                    </span>
                    {/* EL REPARO, CON LAS PALABRAS DEL DOMINIO Y DEBAJO DE SU CAMPO. Tal
                        cual viene: es el sitio donde está escrito qué es posible y qué no,
                        y reescribir el mensaje aquí sería una tercera versión de la regla. */}
                    {reparo && (
                      <span role="alert" className="text-[10px] leading-snug text-rojo">
                        {reparo.motivo}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
          {/* UN REPARO QUE NO ES DE NINGÚN CAMPO no se puede pintar debajo de ninguno, y
              tampoco se puede tragar: sería un botón que no guarda y no dice por qué. */}
          {reparos
            .filter((r) => !MEDIDAS.some((m) => m.clave === r.campo))
            .map((r) => (
              <p key={r.campo || 'todo'} role="alert" className="mt-2 text-[10px] leading-snug text-rojo">
                {r.motivo}
              </p>
            ))}
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
