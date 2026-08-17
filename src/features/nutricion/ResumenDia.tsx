import { AnilloMacro } from '../../components/ui/AnilloMacro'
import { ProgressBar } from '../../components/ui/ProgressBar'
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
  { clave: 'proteina_g', meta: 'proteinaG', etiqueta: 'Proteína', color: 'var(--accion)' },
  { clave: 'carbos_g', meta: 'carbosG', etiqueta: 'Carbos', color: 'var(--azul)' },
  { clave: 'grasa_g', meta: 'grasaG', etiqueta: 'Grasas', color: 'var(--ambar)' },
] as const

const pct = (valor: number, tope: number) => (tope > 0 ? Math.min(100, (valor / tope) * 100) : 0)

export function ResumenDia({ total, meta, visibilidad, notaFase }: ResumenDiaProps) {
  const kcal = Math.round(total.porDia.kcal ?? 0)
  const restan = meta.kcal - kcal

  return (
    <section className="rounded-3xl border border-linea bg-surface-1 p-4">
      {visibilidad.verContadorKcal && (
        <div className="flex items-center gap-4">
          <AnilloMacro
            etiqueta="del día"
            gramos={kcal}
            pct={pct(kcal, meta.kcal)}
            color="var(--accion)"
            unidad="kcal"
          />
          <div className="min-w-0 flex-1">
            <p className="cifras text-2xl font-bold leading-none text-texto">
              {kcal.toLocaleString('es-CO')}
            </p>
            <p className="text-xs text-tenue">de {meta.kcal.toLocaleString('es-CO')} kcal</p>
            <p className="mt-1 text-xs font-semibold text-accion">
              {restan > 0
                ? `faltan ${restan.toLocaleString('es-CO')}`
                : restan === 0
                  ? 'justo en la meta'
                  : `${Math.abs(restan).toLocaleString('es-CO')} por encima`}
            </p>
          </div>
        </div>
      )}

      {visibilidad.verObjetivoCalorico && (
        <div className={`flex flex-col gap-2.5 ${visibilidad.verContadorKcal ? 'mt-4' : ''}`}>
          {MACROS.map((macro) => {
            const valor = Math.round(total.porDia[macro.clave] ?? 0)
            const tope = meta[macro.meta]
            return (
              <div key={macro.clave}>
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-tenue">{macro.etiqueta}</span>
                  <span className="cifras text-tenue">
                    <b className="text-texto">{valor}</b> / {tope} g
                  </span>
                </div>
                <ProgressBar pct={pct(valor, tope)} />
              </div>
            )
          })}
        </div>
      )}

      {/* Sin nada encima, el margen no necesita separador: sería una raya bajo
          un hueco. */}
      <div
        className={`flex flex-wrap items-center gap-2 ${
          visibilidad.verContadorKcal || visibilidad.verObjetivoCalorico
            ? 'mt-4 border-t border-linea pt-3'
            : ''
        }`}
      >
        <span className="rounded-full border border-linea bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-texto">
          ±{total.margenPct} %
        </span>
        <span className="min-w-0 flex-1 text-[11px] leading-snug text-tenue">
          {notaFase ?? 'Margen de tu registro de hoy'}
        </span>
      </div>

      {/* Un nutriente parcial no se avisa por pedantería: significa que la cifra
          de arriba es un SUELO, y quien la lea tiene que saberlo. */}
      {total.parciales.size > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-tenue">
          Falta el dato de {total.parciales.size}{' '}
          {total.parciales.size === 1 ? 'nutriente' : 'nutrientes'} en algún alimento: lo sumado es
          un mínimo.
        </p>
      )}
    </section>
  )
}
