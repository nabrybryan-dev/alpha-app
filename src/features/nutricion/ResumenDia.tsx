import { Cifra3D } from '../../components/ui/Cifra3D'
import type { Macros } from '../../domain/types'
import type { TotalDia } from '../../domain/nutricion/dia'
import type { Visibilidad } from '../../domain/nutricion/visibilidad'

/**
 * La tarjeta de arriba del diario: cuánto lleva, cuánto le falta y con cuánta
 * certeza se sabe.
 *
 * EL MARGEN SE ENSEÑA SIEMPRE. No es un adorno: un día pesado con báscula y uno
 * estimado a ojo pueden dar la misma cifra y no significar lo mismo. Si la
 * pantalla enseñara solo "1.840 kcal", el asesorado -y el coach- tratarían las
 * dos igual, y las decisiones del microciclo siguiente saldrían de un número
 * que nadie sabe si vale ±5 % o ±30 %.
 */

interface ResumenDiaProps {
  total: TotalDia
  meta: Macros
  /**
   * Qué cifras le toca ver. Las dos que se apagan aquí son las que la migración
   * 0018 describe con estas palabras:
   *
   *   · `verContadorKcal` → «el anillo y el "te faltan 400 kcal" del diario». Es
   *     el que más pesa de los tres: una pantalla de perfil se mira una vez, el
   *     contador cinco veces al día.
   *   · `verObjetivoCalorico` → «"2.100 kcal · P 115 · C 240 · G 62"», o sea las
   *     metas. Sin ellas las barras de macro no tienen contra qué medir, así que
   *     se van con el mismo interruptor: dejarlas sería dejar la misma cifra con
   *     la que negociar, repartida en tres.
   *
   * Lo que NO se apaga nunca: el margen. Habla de la calidad del dato, no del
   * cuerpo de nadie, y sin él el registro se lee como si fuera exacto.
   */
  visibilidad: Visibilidad
  /** En qué fase va: "Vas 12 días pesando. Faltan 3 para dejar la báscula." */
  notaFase?: string
}

const MACROS = [
  { clave: 'proteina_g', meta: 'proteinaG', etiqueta: 'proteína', color: 'text-logrado' },
  { clave: 'carbos_g', meta: 'carbosG', etiqueta: 'carbohidratos', color: 'text-azul' },
  { clave: 'grasa_g', meta: 'grasaG', etiqueta: 'grasa', color: 'text-ambar' },
] as const

const pct = (valor: number, tope: number) => (tope > 0 ? Math.min(100, (valor / tope) * 100) : 0)

export function ResumenDia({ total, meta, visibilidad, notaFase }: ResumenDiaProps) {
  const kcal = Math.round(total.porDia.kcal ?? 0)
  const restan = meta.kcal - kcal

  return (
    <section className="relieve rounded-3xl border border-linea bg-surface-1 p-4">
      <h2 className="font-display text-sm text-texto">Lo que llevas hoy</h2>

      {visibilidad.verContadorKcal && (
        <>
          <div className="mt-2 flex items-end gap-3">
            <Cifra3D
              valor={kcal}
              tamano={38}
              etiqueta={`${kcal.toLocaleString('es-CO')} kilocalorías registradas hoy`}
            />
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-xs text-tenue">de {meta.kcal.toLocaleString('es-CO')} kcal</p>
              <p className="mt-0.5 text-xs font-semibold text-accion">
                {restan > 0
                  ? `faltan ${restan.toLocaleString('es-CO')}`
                  : restan === 0
                    ? 'justo en la meta'
                    : `${Math.abs(restan).toLocaleString('es-CO')} por encima`}
              </p>
            </div>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct(kcal, meta.kcal))}
            aria-label="Progreso de calorías del día"
          >
            <div
              className="h-full origin-left rounded-full bg-placa"
              style={{
                transform: `scaleX(${(pct(kcal, meta.kcal) / 100).toFixed(3)})`,
                transition: 'transform var(--dur-informativo) var(--muelle-informativo)',
              }}
            />
          </div>
        </>
      )}

      {visibilidad.verObjetivoCalorico && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {MACROS.map((macro) => {
            const valor = Math.round(total.porDia[macro.clave] ?? 0)
            const tope = meta[macro.meta]
            return (
              <div
                key={macro.clave}
                className="rounded-2xl border border-linea bg-surface-2 px-2 py-2 text-center"
              >
                <span className={macro.color}>
                  <Cifra3D
                    valor={valor}
                    tamano={22}
                    sufijo=" g"
                    etiqueta={`${valor} gramos de ${macro.etiqueta}, de ${tope}`}
                  />
                </span>
                <p className="mt-0.5 text-xs leading-tight text-tenue">
                  {macro.etiqueta}
                  <br />
                  de {tope}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-snug text-tenue">
        Solo suma lo que registras: el plan es la guía, no lo comido.
      </p>

      {/* Sin nada encima, el margen no necesita separador: sería una raya bajo
          un hueco. */}
      <div
        className={`flex flex-wrap items-center gap-2 border-t border-linea pt-3 ${
          visibilidad.verContadorKcal || visibilidad.verObjetivoCalorico ? 'mt-3' : ''
        }`}
      >
        <span className="rounded-full border border-linea bg-surface-2 px-2.5 py-1 text-xs font-semibold text-texto">
          ±{total.margenPct} %
        </span>
        <span className="min-w-0 flex-1 text-xs leading-snug text-tenue">
          {notaFase ?? 'Margen de tu registro de hoy'}
        </span>
      </div>

      {/* Un nutriente parcial no se avisa por pedantería: significa que la cifra
          de arriba es un SUELO, y quien la lea tiene que saberlo. */}
      {total.parciales.size > 0 && (
        <p className="mt-2 text-xs leading-snug text-tenue">
          Falta el dato de {total.parciales.size}{' '}
          {total.parciales.size === 1 ? 'nutriente' : 'nutrientes'} en algún alimento: lo sumado es
          un mínimo.
        </p>
      )}
    </section>
  )
}
