import type { ResumenSemana } from '../../domain/nutricion/semanaResumen'
import type { Macros } from '../../domain/types'
import type { Visibilidad } from '../../domain/nutricion/visibilidad'

/**
 * La semana de un vistazo: cuánto registró, cuánto se aleja de la pauta y qué
 * días quedaron en blanco.
 *
 * LOS DÍAS SIN REGISTRO SE VEN, no se disimulan. Una barra a cero y una barra
 * ausente cuentan historias distintas, y la segunda es la que hay que mirar: si
 * el asesorado dejó de anotar el jueves, ningún promedio va a explicar por qué.
 */

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface VistaSemanaProps {
  resumen: ResumenSemana
  meta: Macros
  /**
   * Con el contador apagado esta pantalla era el rodeo: se apagaba el total del
   * diario y aquí seguía el promedio de kcal, el «vs. pauta» y un gráfico de
   * barras de calorías por día.
   *
   * Lo que se queda es la ADHERENCIA —qué días anotó, cuántas comidas—, que no
   * es una cifra sobre su cuerpo y es justo lo que hace útil la vista.
   */
  visibilidad: Visibilidad
  onVolver: () => void
  onElegirDia: (fecha: string) => void
}

export function VistaSemana({
  resumen,
  meta,
  visibilidad,
  onVolver,
  onElegirDia,
}: VistaSemanaProps) {
  // La barra más alta de la semana marca el tope, con la pauta como suelo para
  // que un día flojo no se dibuje enorme solo por ser el único.
  const techo = Math.max(meta.kcal, ...resumen.dias.map((d) => d.kcal))

  const stats = [
    { etiqueta: 'Días anotados', valor: `${resumen.diasRegistrados}`, unidad: 'de 7' },
    { etiqueta: 'Comidas', valor: `${resumen.comidasRegistradas}`, unidad: 'con datos' },
    // La media de proteína se mide contra una meta, así que va con el
    // interruptor del objetivo calórico, no con el del contador.
    ...(visibilidad.verObjetivoCalorico
      ? [
          {
            etiqueta: 'Proteína media',
            valor: `${resumen.promedioProteinaG}`,
            unidad: `de ${meta.proteinaG} g`,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver al diario"
          className="press h-9 w-9 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <h1 className="font-display text-xl text-texto">Tu semana</h1>
      </header>

      <section className="rounded-3xl border border-linea bg-surface-1 p-4">
        {!visibilidad.verContadorKcal ? (
          <p className="py-2 text-center text-sm leading-snug text-tenue">
            {resumen.diasRegistrados === 0
              ? 'Esta semana no has anotado nada todavía.'
              : 'Aquí ves qué días anotaste. Las cifras las está viendo tu nutricionista.'}
          </p>
        ) : resumen.diasRegistrados === 0 ? (
          <p className="py-2 text-center text-sm leading-snug text-tenue">
            Esta semana no has anotado nada todavía.
            <br />
            En cuanto registres un día, aquí verás cómo va.
          </p>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                Promedio registrado
              </p>
              <p className="cifras text-2xl font-bold leading-none text-texto">
                {resumen.promedioKcal.toLocaleString('es-CO')}
                <span className="text-sm font-normal text-tenue"> kcal</span>
              </p>
              {/* Se dice sobre cuántos días es la media. Un promedio de dos días
                  y uno de siete no se leen igual, y sin el número parecen lo mismo. */}
              <p className="text-[11px] text-tenue">
                sobre {resumen.diasRegistrados}{' '}
                {resumen.diasRegistrados === 1 ? 'día anotado' : 'días anotados'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                Vs. pauta
              </p>
              <p className="cifras text-lg font-bold leading-none text-accion">
                {resumen.contraPauta > 0 ? '+' : ''}
                {resumen.contraPauta.toLocaleString('es-CO')}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex h-24 items-end gap-1.5">
          {resumen.dias.map((dia, i) => (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => onElegirDia(dia.fecha)}
              aria-label={`${dia.fecha}: ${
                dia.registrado
                  ? visibilidad.verContadorKcal
                    ? `${dia.kcal} kcal`
                    : 'registrado'
                  : 'sin registrar'
              }`}
              className="press flex flex-1 flex-col items-center gap-1"
            >
              <span className="flex h-16 w-full items-end">
                {dia.registrado ? (
                  <span
                    className="w-full rounded-t-md bg-accion"
                    // Con el contador apagado todas las barras miden lo mismo:
                    // una barra proporcional a las kcal sigue siendo el
                    // contador, solo que dibujado.
                    style={{
                      height: visibilidad.verContadorKcal
                        ? `${Math.max(4, (dia.kcal / techo) * 100)}%`
                        : '100%',
                    }}
                  />
                ) : (
                  // Un día sin anotar se dibuja hueco, no a cero: la ausencia
                  // del dato es el dato.
                  <span className="h-full w-full rounded-md border border-dashed border-linea" />
                )}
              </span>
              <span className="text-[9px] font-bold uppercase text-tenue">{DOW[i]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.etiqueta} className="rounded-2xl border border-linea bg-surface-1 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-tenue">
              {stat.etiqueta}
            </p>
            <p className="cifras mt-1 text-lg font-bold leading-none text-texto">{stat.valor}</p>
            <p className="text-[10px] text-tenue">{stat.unidad}</p>
          </div>
        ))}
      </div>

      {resumen.diasRegistrados > 0 && resumen.diasRegistrados < 7 && (
        <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-[11px] leading-snug text-tenue">
          Faltan <b className="text-texto">{7 - resumen.diasRegistrados}</b> días por anotar. El
          promedio de arriba solo mira los que sí registraste, así que todavía no dice cómo fue la
          semana entera.
        </p>
      )}
    </div>
  )
}
