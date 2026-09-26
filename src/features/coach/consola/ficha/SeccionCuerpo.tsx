import { useState } from 'react'
import { pRatio } from '../../../../domain/consolaCoach/pRatio'
import { fechaCorta, seriePeso, seriesPerimetros, tendencia } from '../../../../domain/consolaCoach/perfilCompleto'
import { GraficaLinea } from '../graficas'
import { Falta, Tarjeta } from '../piezas'
import type { DatosPersona } from '../usePersona'

/**
 * El cuerpo en el tiempo: la curva del peso (check-ins + medidas + formulario), los
 * perímetros que tenga, y el P-ratio entre las dos últimas medidas con masa magra.
 */

export function SeccionPeso({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const serie = seriePeso(datos.checkins, datos.perfil?.medidas ?? [], datos.perfilNutricion)
  const t = tendencia(serie)
  return (
    <Tarjeta
      titulo="Evolución del peso"
      i={i}
      className={className}
      extra={
        t?.delta !== undefined ? (
          <span className={`cifras text-xs font-bold ${t.delta > 0 ? 'text-ambar' : t.delta < 0 ? 'text-azul' : 'text-tenue'}`}>
            {t.delta > 0 ? '▲ +' : t.delta < 0 ? '▼ ' : '= '}
            {t.delta.toFixed(1)} kg · 4 sem
          </span>
        ) : undefined
      }
    >
      {serie.length === 0 ? (
        <Falta
          que="Sin ningún peso registrado"
          como="Llega con el check-in diario (campo peso), con una medida en la ficha o con el formulario de nutrición."
        />
      ) : (
        <>
          <GraficaLinea
            series={[{ nombre: 'Peso', puntos: serie }]}
            unidad="kg"
            descripcion={`Peso en el tiempo: ${serie.length} registros, del ${serie[0].fecha} al ${serie[serie.length - 1].fecha}.`}
          />
          {serie.length === 1 && (
            <p className="mt-1 text-[11px] text-tenue">Un solo registro: la curva aparece con el segundo.</p>
          )}
        </>
      )}
    </Tarjeta>
  )
}

export function SeccionPerimetros({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const series = seriesPerimetros(datos.perfil?.medidas ?? [], datos.perfilNutricion)
  // Los perímetros con más de un punto primero: son los que dibujan una curva.
  const nombres = [...series.keys()].sort(
    (a, b) => (series.get(b)?.length ?? 0) - (series.get(a)?.length ?? 0) || a.localeCompare(b),
  )
  const [elegidos, setElegidos] = useState<string[] | null>(null)
  const activos = (elegidos ?? nombres.slice(0, 1)).filter((n) => series.has(n))

  const alternar = (nombre: string) => {
    const base = elegidos ?? nombres.slice(0, 1)
    const siguiente = base.includes(nombre) ? base.filter((n) => n !== nombre) : [...base, nombre].slice(-4)
    setElegidos(siguiente)
  }

  return (
    <Tarjeta titulo="Perímetros" i={i} className={className}>
      {nombres.length === 0 ? (
        <Falta
          que="Sin ningún perímetro"
          como="Se toman en la tarjeta «Mis medidas» de la app o en el formulario de nutrición (cintura, cadera, cuello)."
        />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Perímetros a mostrar">
            {nombres.map((n) => {
              const activo = activos.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alternar(n)}
                  className={`tecla-3d rounded-tag border px-2 py-0.5 text-[11px] font-bold ${
                    activo ? 'border-rojo/60 bg-rojo/15 text-rojo' : 'border-linea bg-surface-2 text-tenue'
                  }`}
                >
                  {n} <span className="cifras font-normal opacity-70">{series.get(n)?.length}</span>
                </button>
              )
            })}
          </div>
          {activos.length === 0 ? (
            <p className="text-[12px] text-tenue">Elige un perímetro para ver su curva.</p>
          ) : (
            <GraficaLinea
              key={activos.join('|')}
              series={activos.map((n) => ({ nombre: n, puntos: series.get(n) ?? [] }))}
              unidad="cm"
              alto={180}
              descripcion={`Perímetros en el tiempo: ${activos.join(', ')}.`}
            />
          )}
        </>
      )}
    </Tarjeta>
  )
}

export function SeccionPRatio({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const medidas = [...(datos.perfil?.medidas ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const conMagra = medidas.filter((m) => m.masaMagraKg !== undefined && m.pesoKg !== undefined)

  let cuerpo
  if (medidas.length < 2) {
    cuerpo = (
      <Falta
        que={`Hacen falta al menos dos medidas para calcular el P-ratio; hoy hay ${medidas.length}.`}
        como="Cada medida de la ficha con peso y % graso (o masa magra) suma un punto. La cadena la escribe en la valoración ①."
      />
    )
  } else if (conMagra.length < 2) {
    cuerpo = (
      <Falta
        que={`Hay ${medidas.length} medidas, pero ${conMagra.length === 0 ? 'ninguna trae' : 'solo una trae'} masa magra.`}
        como="El P-ratio necesita masa magra antes y después (bioimpedancia o % graso con peso). Sin ella no se interpreta."
      />
    )
  } else {
    const antes = conMagra[conMagra.length - 2]
    const despues = conMagra[conMagra.length - 1]
    const r = pRatio(antes, despues)
    const ancho = r === undefined ? 0 : Math.max(0, Math.min(1, r))
    cuerpo = (
      <>
        <p className="text-xs text-tenue">
          {fechaCorta(antes.fecha)} ({antes.pesoKg} kg · {antes.masaMagraKg} kg magra) → {fechaCorta(despues.fecha)} (
          {despues.pesoKg} kg · {despues.masaMagraKg} kg magra)
        </p>
        {r === undefined ? (
          <p className="mt-2 text-sm font-bold text-tenue">No interpretable (cambio de peso menor que el umbral)</p>
        ) : (
          <>
            <p className="cifras mt-1.5 text-3xl font-bold text-texto">{r}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <div className="barra-crece h-full rounded-full bg-rojo" style={{ width: `${ancho * 100}%` }} />
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <Tarjeta titulo="Composición corporal · P-ratio" i={i} className={className}>
      {cuerpo}
      <p className="mt-2 text-[11px] leading-snug text-tenue">
        Fracción del cambio de peso que fue masa magra (0 = todo grasa, 1 = todo masa magra); no está acotado a 0-1.
        Misma fórmula que <span className="cifras">composicion.py::p_ratio</span>.
      </p>
    </Tarjeta>
  )
}
