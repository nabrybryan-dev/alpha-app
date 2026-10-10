import { useState } from 'react'
import { pRatio } from '../../../../domain/consolaCoach/pRatio'
import { masaMagraEstimada } from '../../../../domain/consolaCoach/composicionEstimada'
import { fechaCorta, seriePeso, seriesPerimetros, tendencia } from '../../../../domain/consolaCoach/perfilCompleto'
import { pesoEstimado, type ConfianzaPeso, type PesoEstimado } from '../../../../domain/estimadores/pesoEstimado'
import { checkinsConDatoAnotado } from '../../../../domain/estimadores/datoAnotado'
import { GraficaLinea } from '../graficas'
import { Falta, Tarjeta } from '../piezas'
import type { DatosPersona } from '../usePersona'

/**
 * El cuerpo en el tiempo: la curva del peso (check-ins + medidas + formulario), los
 * perímetros que tenga, y el P-ratio entre las dos últimas medidas con masa magra.
 */

/** Kilos con coma decimal (es-CO): 87,8 · 83,35. Mínimo un decimal, máximo dos. */
function kg(n: number): string {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

const ETIQUETA_CONFIANZA: Record<ConfianzaPeso, { texto: string; clase: string }> = {
  alta: { texto: 'rango estrecho', clase: 'text-texto' },
  media: { texto: 'rango medio', clase: 'text-texto' },
  baja: { texto: 'rango ancho: faltan pesajes', clase: 'text-ambar' },
}

/** «baja ≈ 0,7 kg por semana» / «sube ≈ …» / «estable». Por debajo de 0,2 kg/sem es ruido. */
function textoTendencia(porSemana: number): string {
  if (Math.abs(porSemana) < 0.2) return 'estable'
  return `${porSemana < 0 ? 'baja' : 'sube'} ≈ ${kg(Math.abs(porSemana))} kg por semana`
}

/**
 * El peso de HOY como estimación con rango (`pesoEstimado`), para que el coach no lea un
 * número suelto donde hay pocos datos. Se dibuja distinto de un dato medido a propósito:
 * borde punteado y la palabra «estimado» a la vista. Solo consola del coach.
 */
function BloquePesoEstimado({ e }: { e: PesoEstimado }) {
  const confianza = ETIQUETA_CONFIANZA[e.confianza]
  return (
    <div
      className="mt-3 rounded-bloque border border-dashed border-linea px-3 py-2.5"
      role="group"
      aria-label="Peso de hoy, estimado"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="kicker text-xs">Peso de hoy, estimado</p>
        <p className={`text-xs font-bold ${confianza.clase}`}>{confianza.texto}</p>
      </div>
      <p className="cifras mt-1 text-2xl font-bold leading-tight text-texto">
        entre {kg(e.bajoKg)} y {kg(e.altoKg)} kg
      </p>
      <p className="mt-1 text-xs text-tenue">
        Centro {kg(e.centroKg)} kg · calculado con {e.n} {e.n === 1 ? 'pesaje' : 'pesajes'} · último el{' '}
        {fechaCorta(e.ultimoPesaje.fecha)}
        {e.kgPorSemana !== undefined && <> · {textoTendencia(e.kgPorSemana)}</>}
      </p>
      {e.metodo === 'ultimo_dato' && (
        <p className="mt-1 text-xs text-tenue">
          Con menos de 3 pesajes (o menos de una semana de datos) no hay tendencia: el rango solo se abre con los
          días que pasan.
        </p>
      )}
      {e.apartados.map((a) => (
        <p key={a.fecha} className="mt-1 text-xs text-ambar">
          1 pesaje apartado por raro: {kg(a.pesoKg)} kg el {fechaCorta(a.fecha)}. Revísalo.
        </p>
      ))}
    </div>
  )
}

/** Lo que `SeccionPeso` lee de la persona: se acota para poder probarla sin armar toda la ficha. */
type DatosDelPeso = Pick<DatosPersona, 'hoy' | 'checkins' | 'perfil' | 'perfilNutricion'>

export function SeccionPeso({ datos, i, className = '' }: { datos: DatosDelPeso; i: number; className?: string }) {
  const serie = seriePeso(datos.checkins, datos.perfil?.medidas ?? [], datos.perfilNutricion)
  const t = tendencia(serie)
  // El estimado solo cuenta pesos que alguien anotó: el check-in arrastra el peso anterior y un
  // peso copiado doce veces no es una tendencia plana, es un dato. La gráfica sí los enseña todos.
  const { anotados, apartados } = checkinsConDatoAnotado(datos.checkins, 'pesoKg')
  const estimado = pesoEstimado(
    seriePeso(anotados, datos.perfil?.medidas ?? [], datos.perfilNutricion).map((p) => ({ fecha: p.fecha, pesoKg: p.valor })),
    datos.hoy,
  )
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
          {estimado && <BloquePesoEstimado e={estimado} />}
          {estimado && apartados > 0 && (
            <p className="mt-1 text-xs leading-snug text-tenue">
              {apartados === 1
                ? 'No se contó 1 peso repetido del reporte anterior: no se sabe si se pesó ese día.'
                : `No se contaron ${apartados} pesos repetidos del reporte anterior: no se sabe si se pesó esos días.`}
            </p>
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
  // Con `cuerpo.cuelloCm` (2026-09-27), una medida sin masa magra medida a mano puede
  // seguir sirviendo: si trae cintura + cuello (+ caderas en mujeres) y el sexo de la
  // ficha, `masaMagraEstimada` la calcula con la misma fórmula US Navy del formulario de
  // nutrición. Lo medido (bioimpedancia) sigue ganando; esto solo llena el hueco.
  const conMagra = medidas
    .map((m) => ({ ...m, masaMagraKg: masaMagraEstimada(m, datos.perfil?.sexo) }))
    .filter((m) => m.masaMagraKg !== undefined && m.pesoKg !== undefined)

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
        como="El P-ratio necesita masa magra antes y después: bioimpedancia, % graso con peso, o cintura + cuello (+ caderas en mujeres) con el sexo puesto en la ficha."
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
        Misma fórmula que <span className="cifras">composicion.py::p_ratio</span>. Cuando no hay masa magra medida,
        se estima con cintura + cuello (+ caderas en mujeres), fórmula US Navy.
      </p>
    </Tarjeta>
  )
}
