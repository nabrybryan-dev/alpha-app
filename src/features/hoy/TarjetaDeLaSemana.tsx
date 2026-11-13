import { useDisenoFinal } from '../../app/organizacionViva'
import { Cifra3D } from '../../components/ui/Cifra3D'
import type { ResumenSemanal } from '../../domain/resumenSemanal/calcular'

interface TarjetaDeLaSemanaProps {
  nombre: string
  resumen: ResumenSemanal
  /** `nuevo` = el aspecto de la maqueta «Diseño final 3» (asesorado); `clasico` = el de main (staff, hasta el paso 9). */
  diseno?: 'nuevo' | 'clasico'
  /** Solo para pruebas: manda sobre la cuenta con sesión. */
  disenoFinal?: boolean
}

function Fila({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-linea py-2 first:border-t-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">{etiqueta}</span>
      <span className="text-right">
        <span className="cifras text-sm font-semibold text-texto">{valor}</span>
        {nota && <span className="mt-0.5 block text-xs leading-snug text-tenue">{nota}</span>}
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
export function TarjetaDeLaSemana({ nombre, resumen, diseno = 'clasico', disenoFinal }: TarjetaDeLaSemanaProps) {
  const final = useDisenoFinal(disenoFinal)
  if (final) return <CasillasDeLaSemana nombre={nombre} resumen={resumen} />
  const { regularidad } = resumen

  return (
    <section
      aria-label="Tu semana en números"
      className={
        diseno === 'nuevo'
          ? 'hoy-tarjeta'
          : 'rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm'
      }
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

function Casilla({ valor, sufijo, etiqueta, leyenda }: { valor: number | undefined; sufijo: string; etiqueta: string; leyenda: string }) {
  return (
    <div className="hoy-cifra-hundida">
      <Cifra3D valor={valor} sufijo={sufijo} tamano={30} etiqueta={etiqueta} />
      <small aria-hidden="true">{leyenda}</small>
    </div>
  )
}

/**
 * La revisión de la semana de «Alpha · Rediseño» (maqueta 7, `salida.html:1309-1322`): tres casillas hundidas con cifra
 * en relieve. Solo con el diseño final. Las mismas reglas de la pieza: hechos sin adjetivos y, si falta un dato, la raya
 * y la promesa, nunca un cero. Los check-ins quedan en una línea aparte para no perder ese dato.
 */
function CasillasDeLaSemana({ nombre, resumen }: { nombre: string; resumen: ResumenSemanal }) {
  const { regularidad } = resumen
  const sinMicrociclo = resumen.sesionesPautadas === 0
  const pct = resumen.adherenciaPct
  return (
    <section aria-label="Tu semana en números" className="hoy-tarjeta">
      <p className="mb-2 font-display text-sm text-texto">Tu semana, {nombre}</p>
      <div className="grid grid-cols-3 gap-2">
        <Casilla
          valor={sinMicrociclo ? undefined : resumen.sesionesHechas}
          sufijo={`/${resumen.sesionesPautadas}`}
          etiqueta={sinMicrociclo ? 'sesiones sin microciclo activo' : `${resumen.sesionesHechas} de ${resumen.sesionesPautadas} sesiones hechas`}
          leyenda="sesiones hechas"
        />
        <Casilla
          valor={pct}
          sufijo="%"
          etiqueta={pct === undefined ? 'nutrición sin registro esta semana' : `${pct} % de nutrición cumplida`}
          leyenda="nutrición cumplida"
        />
        <Casilla
          valor={regularidad.estado === 'medido' ? regularidad.indice : undefined}
          sufijo="/100"
          etiqueta={
            regularidad.estado === 'medido'
              ? `${regularidad.indice} de 100 en regularidad del sueño`
              : 'regularidad del sueño sin medir todavía'
          }
          leyenda="regularidad del sueño"
        />
      </div>
      {sinMicrociclo && <p className="mt-2 text-xs leading-snug text-tenue">todavía no tienes microciclo activo</p>}
      {regularidad.estado !== 'medido' && (
        <p className="mt-2 text-xs leading-snug text-tenue">{regularidad.motivo}; cuando estén, esto ya es un número</p>
      )}
      <p className="mt-2 text-xs text-tenue">Check-ins: {resumen.checkinsDeLaSemana} de 7 días</p>
    </section>
  )
}
