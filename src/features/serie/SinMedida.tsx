import type { SerieSinMedida } from '../../domain/serieMedida'
import { TrazaAltura } from './TrazaAltura'

/**
 * La serie que no se pudo medir.
 *
 * Tres decisiones que no conviene deshacer:
 *
 *  · **El fallo va arriba, no oculto.** En la primera tarjeta, con motivos
 *    concretos y numerados, no con un «no se pudo procesar». Cada motivo es una
 *    cifra que el asesorado puede comprobar en su propio vídeo.
 *  · **El aviso no es rojo.** En Alpha el rojo es la marca; los estados usan un
 *    ámbar propio y llevan además punto y borde, para leerse sin depender del
 *    color.
 *  · **Lo medido no se tira.** El recorrido, el pico y la traza sí se midieron
 *    y se enseñan. El hueco de repeticiones va con una raya, nunca con un cero:
 *    un cero es un dato, una raya es una ausencia.
 */
export function SinMedida({ serie }: { serie: SerieSinMedida }) {
  const { motivos, loQuedoMedido, fotogramas, trazaAltura } = serie

  return (
    <div className="flex flex-col gap-3.5">
      <section className="entrada entrada-1 rounded-2xl border border-ambar/35 bg-ambar/10 p-4">
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ambar">
          <span aria-hidden className="size-1.5 rounded-full bg-ambar" />
          Sin repeticiones
        </p>
        <h2 className="mt-1.5 font-display text-xl leading-tight text-silver-100">
          No pude medir la serie
        </h2>

        <ol className="mt-3.5 flex flex-col gap-3">
          {motivos.map((m, i) => (
            <li key={m.clave} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 font-mono text-[11px] tabular-nums text-ambar/80"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="text-[13.5px] leading-snug text-silver-300">
                <b className="font-semibold text-silver-100">{m.titulo}</b>{' '}
                <b className="font-semibold text-silver-100">{m.cifra}</b> {m.detalle}
              </p>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-silver-100 transition-colors hover:bg-surface-3"
        >
          Cómo grabar la serie
        </button>
      </section>

      <section className="entrada entrada-2 rounded-2xl border border-hairline bg-surface-2 p-4">
        <h3 className="font-display text-sm uppercase tracking-[0.14em] text-silver-300">
          Lo que sí quedó medido
        </h3>

        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Cifra rotulo="Vertical" valor={loQuedoMedido.verticalCm} unidad="cm" decimales={1} />
          <Cifra rotulo="Pico" valor={loQuedoMedido.picoMs} unidad="m/s" decimales={2} />
          <Cifra rotulo="Reps" valor={loQuedoMedido.reps} unidad="" decimales={0} />
        </dl>

        <div className="mt-4 text-silver-300">
          <TrazaAltura traza={trazaAltura} />
        </div>

        <p className="mt-3 text-[13px] leading-snug text-silver-400">
          {fotogramas.conObjeto} de {fotogramas.totales} fotogramas con el implemento a la vista.
        </p>
      </section>
    </div>
  )
}

/**
 * Una cifra, o su ausencia.
 *
 * `null` se pinta como una raya. Es la diferencia entre «medí cero» y «no pude
 * medir», y en esta pantalla es justo lo que hay que distinguir.
 */
function Cifra({
  rotulo,
  valor,
  unidad,
  decimales,
}: {
  rotulo: string
  valor: number | null
  unidad: string
  decimales: number
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-silver-500">{rotulo}</dt>
      <dd className="mt-0.5 font-display text-2xl leading-none text-silver-100">
        {valor === null ? (
          <span aria-label="sin dato" className="text-silver-500">
            —
          </span>
        ) : (
          <>
            {valor.toFixed(decimales).replace('.', ',')}
            {unidad && (
              <span className="ml-1 font-body text-[12px] font-normal text-silver-400">
                {unidad}
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  )
}
