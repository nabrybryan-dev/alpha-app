import type { ResumenSemanal } from '../../domain/resumenSemanal/calcular'

interface TarjetaDeLaSemanaProps {
  nombre: string
  resumen: ResumenSemanal
}

function Fila({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-linea py-2 first:border-t-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">{etiqueta}</span>
      <span className="text-right">
        <span className="cifras text-sm font-semibold text-texto">{valor}</span>
        {nota && <span className="mt-0.5 block text-[11px] leading-snug text-tenue">{nota}</span>}
      </span>
    </div>
  )
}

/**
 * Los números de la persona, debajo del vídeo de su revisión semanal.
 *
 * **Enseña hechos, no adjetivos.** No dice si la semana fue buena: dice cuántas
 * sesiones hizo de las que tocaban. Los cortes que separan un «bien» de un
 * «regular» los pone el entrenador, y todavía no están escritos.
 *
 * Y cuando falta un dato, **enseña la promesa** en vez de un cero: «llevas tres
 * de siete noches; el domingo que viene esto ya es un número». Una barra que se
 * llena tira más que un número que aparece de la nada — y un cero en el sueño
 * se lee como una acusación que nadie ha medido.
 */
export function TarjetaDeLaSemana({ nombre, resumen }: TarjetaDeLaSemanaProps) {
  const { regularidad } = resumen

  return (
    <section
      aria-label="Tu semana en números"
      className="rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
    >
      <p className="mb-1 font-display text-sm text-texto">Tu semana, {nombre}</p>

      <Fila
        etiqueta="Sesiones"
        valor={`${resumen.sesionesHechas} de ${resumen.sesionesPautadas}`}
        nota={resumen.sesionesPautadas === 0 ? 'todavía no tienes microciclo activo' : undefined}
      />
      <Fila
        etiqueta="Alimentación"
        valor={resumen.adherenciaPct === undefined ? '—' : `${resumen.adherenciaPct} %`}
        nota={resumen.adherenciaPct === undefined ? 'sin registro esta semana' : undefined}
      />
      <Fila etiqueta="Check-ins" valor={`${resumen.checkinsDeLaSemana} de 7 días`} />
      {regularidad.estado === 'medido' ? (
        <Fila
          etiqueta="Regularidad del sueño"
          valor={`${regularidad.indice} de 100`}
          nota={`sobre ${regularidad.nochesConDato} noches registradas`}
        />
      ) : (
        <Fila
          etiqueta="Regularidad del sueño"
          valor="aún no"
          nota={`${regularidad.motivo}; cuando estén, esto ya es un número`}
        />
      )}
    </section>
  )
}
