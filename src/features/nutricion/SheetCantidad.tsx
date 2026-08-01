import { useMemo, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Stepper } from '../../components/ui/Stepper'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'
import { escalar } from '../../domain/nutricion/porcion'
import { revisarItem } from '../../domain/nutricion/topes'
import { MARGENES } from '../../domain/nutricion/dia'

/**
 * Hoja de cantidad: cuánto comió de un alimento y cómo lo supo.
 *
 * Son dos pasos y el primero casi nunca aparece. La pregunta de crudo o cocido
 * (R1) solo se hace la PRIMERA vez que registra ese alimento, porque la
 * respuesta se recuerda: el mismo arroz pesado crudo o pesado cocido cambia sus
 * calorías por tres, y es el error más caro de todo el registro.
 *
 * Ninguno de los avisos bloquea. Un tope superado se enseña y se deja pasar: si
 * la app le impidiera guardar lo que de verdad comió, aprendería a no registrar
 * los días raros, que son justo los que hay que ver.
 */

const PASO_G = 5

/**
 * Tope del control, no del registro.
 *
 * El `Stepper` limita a 999 por defecto y aquí eso estorba: 1,5 L de agua son
 * 1.500 g y una tajada grande de sandía se acerca, los dos consumos normales
 * que el módulo de topes cita para explicar por qué el límite va en CALORÍAS y
 * no en gramos. Con 999 la app le recortaría el vaso de agua sin decírselo, que
 * es peor que cualquier aviso. Este número solo evita que un dedo torpe teclee
 * un número absurdo; quien avisa de verdad es `revisarItem`.
 */
const TOPE_CONTROL_G = 5000

interface OpcionEstado {
  alimento: AlimentoIndice
  /** 'Crudo' / 'Cocido'. */
  etiqueta: string
  /** Por qué elegir esta. */
  pista: string
}

interface SheetCantidadProps {
  abierto: boolean
  /** El alimento a registrar. `null` mientras no haya ninguno elegido. */
  alimento: AlimentoIndice | null
  /**
   * Las variantes entre las que hay que preguntar, o `null` si no hay que
   * preguntar nada -porque solo existe en un estado o porque ya contestó una
   * vez-. Lo decide quien abre la hoja, que es quien conoce la preferencia.
   */
  preguntarEstado: OpcionEstado[] | null
  /** 'Almuerzo', 'Cena'… Va en el botón para que sepa dónde lo está metiendo. */
  nombreComida: string
  onCerrar: () => void
  /** Contestó la pregunta de crudo/cocido. Se recuerda para siempre. */
  onElegirEstado: (alimento: AlimentoIndice) => void
  onAgregar: (alimento: AlimentoIndice, gramos: number, fuePesado: boolean) => void
}

const nombreCorto = (nombre: string) => (nombre.split(',')[0] ?? nombre).toLowerCase()

const redondear = (valor: number | null, decimales = 0) =>
  valor === null ? null : Number(valor.toFixed(decimales))

/**
 * El `key` es lo que hace que cada alimento arranque limpio.
 *
 * Sin él, los 250 g del arroz se quedarían puestos al abrir el aceite, y 250 g
 * de aceite son 2.200 kcal que nadie escribió: el error entra por lo que la
 * pantalla ya traía, no por lo que el asesorado tocó.
 *
 * Se remonta desde AQUÍ y no desde quien abre la hoja, para que la garantía no
 * dependa de que nadie se olvide de poner el `key` fuera. Es el mismo patrón
 * que `SesionPage`, donde olvidarlo escribía la sesión vieja sobre la nueva.
 */
export function SheetCantidad(props: SheetCantidadProps) {
  if (!props.alimento) return null
  return <CuerpoCantidad {...props} key={props.alimento.id} alimento={props.alimento} />
}

function CuerpoCantidad({
  abierto,
  alimento,
  preguntarEstado,
  nombreComida,
  onCerrar,
  onElegirEstado,
  onAgregar,
}: SheetCantidadProps & { alimento: AlimentoIndice }) {
  const [gramos, setGramos] = useState(100)
  const [fuePesado, setFuePesado] = useState(true)

  const escalado = useMemo(() => escalar(alimento.por100g, gramos), [alimento, gramos])

  /**
   * `revisarItem` revienta a propósito cuando no hay kcal con las que comparar.
   * Aquí eso no puede llegar a pantalla, así que se pregunta antes: sin kcal no
   * hay aviso que dar, y el alimento se registra igual -su peso sigue siendo un
   * dato bueno aunque su composición esté incompleta-.
   */
  const avisos = useMemo(
    () => (alimento.por100g.kcal === null ? [] : revisarItem(alimento.por100g, gramos)),
    [alimento, gramos],
  )

  const kcal = redondear(escalado.kcal ?? null)
  const macros = (['proteina_g', 'carbos_g', 'grasa_g'] as const)
    .map((clave, i) => {
      const valor = redondear(escalado[clave] ?? null)
      return valor === null ? null : `${['P', 'C', 'G'][i]} ${valor}`
    })
    .filter(Boolean)
    .join(' · ')

  // Paso 1 · La pregunta que solo se hace una vez.
  if (preguntarEstado?.length) {
    return (
      <Sheet abierto={abierto} titulo="Una sola vez" onCerrar={onCerrar}>
        <p className="font-display text-xl leading-tight text-texto">
          ¿Cómo pesas el {nombreCorto(alimento.nombre)}?
        </p>
        <p className="mt-2 text-sm leading-snug text-tenue">
          Lo recordamos para siempre. Es la respuesta que más error evita: el mismo alimento puede
          multiplicar por tres sus calorías.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {preguntarEstado.map((opcion) => (
            <button
              key={opcion.alimento.id}
              type="button"
              onClick={() => onElegirEstado(opcion.alimento)}
              className="press flex items-center justify-between gap-3 rounded-2xl border border-linea bg-surface-2 p-4 text-left transition-colors hover:border-accion/50 active:bg-surface-3"
            >
              <span className="min-w-0">
                <span className="block font-display text-base text-texto">{opcion.etiqueta}</span>
                <span className="block text-xs leading-snug text-tenue">{opcion.pista}</span>
              </span>
              <span className="cifras shrink-0 text-sm font-bold text-accion">
                {redondear(opcion.alimento.por100g.kcal) ?? '—'} kcal
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    )
  }

  // Paso 2 · Cuánto.
  return (
    <Sheet abierto={abierto} titulo={alimento.nombre} onCerrar={onCerrar}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-tenue">
        <span className="rounded-full border border-linea bg-surface-2 px-2 py-0.5 uppercase tracking-wide">
          {alimento.estado}
        </span>
        <span className="cifras">
          {redondear(alimento.por100g.kcal) ?? '—'} kcal / 100 g
        </span>
      </div>

      <div className="mt-5">
        <Stepper
          etiqueta="Cantidad"
          valor={gramos}
          paso={PASO_G}
          minimo={0}
          maximo={TOPE_CONTROL_G}
          sufijo="g"
          grande
          onCambiar={setGramos}
        />
        <p className="cifras mt-2 text-center text-sm text-tenue">
          {kcal === null ? 'sin datos de energía' : `${kcal} kcal`}
          {macros && ` · ${macros}`}
        </p>
      </div>

      {alimento.medidas?.length ? (
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            Medidas de este alimento
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {alimento.medidas.map((medida) => (
              <button
                key={medida.nombre}
                type="button"
                onClick={() => setGramos(Math.round(medida.gramos))}
                aria-pressed={gramos === Math.round(medida.gramos)}
                className={`press rounded-full border px-3 py-2 text-left text-xs transition-colors ${
                  gramos === Math.round(medida.gramos)
                    ? 'border-accion bg-accion/15 text-texto'
                    : 'border-linea bg-surface-2 text-tenue'
                }`}
              >
                <span className="block font-semibold">{medida.nombre}</span>
                <span className="cifras block opacity-70">{Math.round(medida.gramos)} g</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
          ¿Cómo lo supiste?
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { pesado: true, etiqueta: 'Lo pesé', confianza: 'pesado' as const },
            { pesado: false, etiqueta: 'Lo estimé', confianza: 'estimado' as const },
          ].map((opcion) => (
            <button
              key={opcion.etiqueta}
              type="button"
              onClick={() => setFuePesado(opcion.pesado)}
              aria-pressed={fuePesado === opcion.pesado}
              className={`press rounded-2xl border p-3 text-left transition-colors ${
                fuePesado === opcion.pesado
                  ? 'border-accion bg-accion/15 text-texto'
                  : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              <span className="block text-sm font-semibold">{opcion.etiqueta}</span>
              <span className="cifras block text-[11px] opacity-70">
                margen ±{Math.round(MARGENES[opcion.confianza] * 100)} %
              </span>
            </button>
          ))}
        </div>
      </div>

      {avisos.map((aviso) => (
        <p
          key={aviso.mensaje}
          role="status"
          className="mt-4 rounded-2xl border border-ambar/40 bg-ambar/10 p-3 text-xs leading-snug text-texto"
        >
          {aviso.mensaje}
        </p>
      ))}

      <button
        type="button"
        onClick={() => onAgregar(alimento, gramos, fuePesado)}
        disabled={gramos <= 0}
        className="press mt-5 w-full rounded-2xl bg-accion py-4 font-display text-sm uppercase tracking-wide text-white disabled:opacity-40"
      >
        Agregar a {nombreComida}
      </button>
    </Sheet>
  )
}
