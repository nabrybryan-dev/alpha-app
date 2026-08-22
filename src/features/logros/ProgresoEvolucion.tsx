import { useState } from 'react'
import { db } from '../../data/dbInstance'
import { cargaPorGrupo, formatearSeries } from '../../domain/fatiga'
import { nivelDeSeries } from '../../domain/nivelDeVolumen'
import type { MedidaCorporal, NivelVolumen } from '../../domain/types'

interface Punto {
  etiqueta: string
  valor: number
}

const ANCHO = 300
const ALTO = 96
const PAD = 6

/** Coordenadas SVG (x uniforme, y invertida y normalizada al rango de datos). */
function coordenadas(puntos: Punto[]): { x: number; y: number }[] {
  if (puntos.length === 0) return []
  const ys = puntos.map((p) => p.valor)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const rango = max - min || 1
  const paso = puntos.length > 1 ? (ANCHO - 2 * PAD) / (puntos.length - 1) : 0
  return puntos.map((p, i) => ({
    x: PAD + i * paso + (puntos.length === 1 ? (ANCHO - 2 * PAD) / 2 : 0),
    y: PAD + (1 - (p.valor - min) / rango) * (ALTO - 2 * PAD),
  }))
}

/**
 * El gráfico no cambia: cambia SU RELLENO.
 *
 * Antes, bajo la línea había un degradado rojo. Después hubo cuerpo: la pieza E,
 * recortada con la misma cadena de path que dibujaba ese degradado. Y no
 * funcionaba.
 *
 * POR QUÉ SE CAMBIÓ. La cuña mide 300x96 de viewBox — en un móvil de 390, unos
 * 125 px de alto por 390 de ancho. La pieza E es una cámara que SUBE por un
 * cuerpo: su eje es vertical y la ventana es de 3,1:1. A esa altura no puede
 * enseñar un cuerpo, solo el trozo que le toque, así que se leían dos
 * pantorrillas cortadas y cálidas flotando en un triángulo — lo único con color
 * de toda la pantalla.
 *
 * Una TEXTURA se lee a cualquier tamaño; un plano que recorre un sujeto, no. Por
 * eso ahora hay suelo agrietado, y de paso aparece un significado que antes no
 * estaba: el área bajo la curva es el terreno que ya llevas andado.
 *
 * ES UNA IMAGEN FIJA, NO UN LOOP, y también a propósito: una cuña de 125 px no
 * gana nada con vídeo y sí paga su peso, su decodificación y la lógica de pausa
 * fuera de pantalla. Son 55 KB de WebP contra los 437 KB del vídeo de E.
 *
 * El recorte se eligió por PROPORCIÓN, no por brillo. El primer intento usaba una
 * zona de 980x672 con mediana 32 y se veía negra: `object-cover` recortaba su
 * centro, que era lo más oscuro. El que sirve es 700x300 —razón 2,33:1, parecida
 * a la de la cuña— con mediana 44.
 *
 * Lo que NO se tocó: la geometría (300x96, PAD 6), la normalización al rango,
 * `.dibujar-linea` con su `pathLength={1}`, `.area-aparece`, el círculo del
 * último punto y el toggle Peso/Fuerza.
 */
function GraficoLinea({ puntos, unidad }: { puntos: Punto[]; unidad: string }) {
  const pts = coordenadas(puntos)
  if (pts.length === 0) {
    return (
      <div className="grid h-24 place-items-center text-xs text-silver-500">
        Aún no hay datos suficientes para el gráfico.
      </div>
    )
  }
  const linea = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${linea} L ${pts[pts.length - 1].x.toFixed(1)} ${ALTO} L ${pts[0].x.toFixed(1)} ${ALTO} Z`
  const ultimo = pts[pts.length - 1]
  const idGrad = `grad-${unidad}`
  const idClip = `recorte-${unidad}`

  return (
    <svg width="100%" viewBox={`0 0 ${ANCHO} ${ALTO}`} className="block" role="img" aria-label="Gráfico de evolución">
      <defs>
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accion)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--accion)" stopOpacity="0" />
        </linearGradient>
        {/* El recorte ES el área. La misma cadena de path que dibujaba el relleno. */}
        <clipPath id={idClip}>
          <path d={area} />
        </clipPath>
      </defs>
      {pts.length > 1 && (
        <g className="area-aparece" clipPath={`url(#${idClip})`}>
          <foreignObject x="0" y="0" width={ANCHO} height={ALTO}>
            <img
              src="/fondos/terreno-progreso.webp"
              alt=""
              aria-hidden="true"
              width={700}
              height={300}
              className="h-full w-full object-cover"
            />
          </foreignObject>
          {/* El rojo de marca por encima. Es el mismo degradado de antes: mantiene
              la continuidad con la línea y baja la pieza a un plano de fondo. */}
          <rect x="0" y="0" width={ANCHO} height={ALTO} fill={`url(#${idGrad})`} />
        </g>
      )}
      {pts.length > 1 && (
        <path
          className="dibujar-linea"
          d={linea}
          fill="none"
          stroke="var(--accion)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      )}
      <circle cx={ultimo.x} cy={ultimo.y} r="4.5" fill="var(--accion)" stroke="var(--ink-900)" strokeWidth="2" />
    </svg>
  )
}

/** El color sigue a la etiqueta, que ahora es la misma que usa la hoja PERFIL. */
const CLASE_NIVEL: Record<NivelVolumen, string> = {
  'Muy Alto': 'text-accion',
  Alto: 'text-silver-200',
  Normal: 'text-silver-400',
  Bajo: 'text-silver-500',
  'Muy Bajo': 'text-silver-500',
}

export function ProgresoEvolucion({ usuarioId }: { usuarioId: string }) {
  const [metrica, setMetrica] = useState<'peso' | 'fuerza'>('peso')

  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = (perfil?.medidas ?? []) as MedidaCorporal[]
  const microciclos = db.microciclos.byUsuario(usuarioId)
  const microActivo = microciclos.find((m) => m.estado === 'activo') ?? microciclos[microciclos.length - 1]

  // Peso: de las medidas; si hay pocas, se completa con los check-ins.
  let puntosPeso: Punto[] = medidas
    // `pesoKg` es opcional desde que «Mis medidas» dejó de pedirlo a quien
    // tiene la composición corporal apagada: una medición puede traer solo
    // perímetros, y esa no dibuja punto en la curva de peso.
    .filter((m) => m.pesoKg !== undefined && m.pesoKg > 0)
    .map((m) => ({ etiqueta: m.fecha, valor: m.pesoKg as number }))
  if (puntosPeso.length < 2) {
    const desdeCheckins = db.bienestar
      .byUsuario(usuarioId)
      .filter((c) => c.pesoKg !== undefined)
      .map((c) => ({ etiqueta: c.fecha, valor: c.pesoKg as number }))
    if (desdeCheckins.length > puntosPeso.length) puntosPeso = desdeCheckins
  }

  // Fuerza: tonelaje (Σ carga × reps) por sesión registrada del microciclo.
  const puntosFuerza: Punto[] = (microActivo?.sesiones ?? [])
    .map((s) => ({
      etiqueta: s.nombre,
      valor: s.ejercicios.reduce(
        (t, e) => t + e.series.reduce((acc, ser) => acc + ser.cargaKg * (ser.reps ?? 0), 0),
        0,
      ),
    }))
    .filter((p) => p.valor > 0)

  const puntos = metrica === 'peso' ? puntosPeso : puntosFuerza
  const unidad = metrica === 'peso' ? 'kg' : 'kg vol'
  const actual = puntos[puntos.length - 1]?.valor
  const primero = puntos[0]?.valor
  const delta = actual !== undefined && primero !== undefined ? Math.round((actual - primero) * 10) / 10 : undefined

  // Volumen por grupo (series pautadas en el microciclo).
  const grupos = microActivo ? cargaPorGrupo(microActivo) : []
  const maxSeries = Math.max(1, ...grupos.map((g) => g.seriesPautadas))

  // Medidas: desviación del último registro vs el anterior.
  const ultima = medidas[medidas.length - 1]
  const previa = medidas[medidas.length - 2]
  /**
   * Los perímetros más la composición corporal.
   *
   * El porcentaje de grasa y la masa magra se venían guardando en `MedidaCorporal`
   * y no se enseñaban en ninguna pantalla: la lista solo recorría `perimetros`.
   * Entraban a la base y no salían nunca.
   */
  const perimetros: [string, number, string][] = ultima
    ? [
        ...Object.entries(ultima.perimetros).map(
          ([nombre, cm]): [string, number, string] => [nombre, cm, 'cm'],
        ),
        ...(ultima.pgPct !== undefined
          ? ([['Grasa', ultima.pgPct, '%']] as [string, number, string][])
          : []),
        ...(ultima.masaMagraKg !== undefined
          ? ([['Masa magra', ultima.masaMagraKg, 'kg']] as [string, number, string][])
          : []),
      ]
    : []

  /** El valor anterior del mismo dato, para calcular la desviación. */
  const previoDe = (nombre: string): number | undefined => {
    if (nombre === 'Grasa') return previa?.pgPct
    if (nombre === 'Masa magra') return previa?.masaMagraKg
    return previa?.perimetros[nombre]
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Gráfico de evolución con toggle Peso / Fuerza */}
      <div className="rounded-bloque border border-ink-500 bg-ink-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-silver-500">
              {metrica === 'peso' ? 'Peso en ayunas' : 'Carga de trabajo'}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="cifras text-3xl font-bold leading-none text-silver-100">
                {actual !== undefined ? actual.toLocaleString('es-CO') : '—'}
                <span className="text-base font-medium text-silver-500"> {unidad}</span>
              </span>
              {delta !== undefined && delta !== 0 && (
                <span className={`cifras text-sm font-bold ${delta < 0 ? 'text-accion' : 'text-silver-400'}`}>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 rounded-full bg-ink-600 p-1">
            {(['peso', 'fuerza'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetrica(m)}
                className={`press rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200 ${
                  metrica === m ? 'bg-accion text-white' : 'text-silver-400'
                }`}
              >
                {m === 'peso' ? 'Peso' : 'Fuerza'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <GraficoLinea key={metrica} puntos={puntos} unidad={unidad} />
        </div>
        <p className="mt-2 text-[11px] text-silver-500">
          {metrica === 'peso'
            ? 'Peso en ayunas registrado a lo largo del tiempo.'
            : 'Tonelaje (carga × reps) por sesión del microciclo actual.'}
        </p>
      </div>

      {/* Volumen por grupo: lo pautado y lo hecho, uno encima del otro.
          Antes solo se veía lo pautado, así que no había pantalla donde mirar
          dónde se está quedando corta —que es justo lo que abre conversación en
          la revisión—. */}
      {grupos.length > 0 && (
        <div className="rounded-bloque border border-ink-500 bg-ink-800 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-sm text-silver-100">Volumen por grupo</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-silver-500">
              Microciclo
            </span>
          </div>
          {/* La etiqueta (ALTO, NORMAL…) describe el PLAN, no lo hecho. Sin
              decirlo, "Espalda 0/15 ALTO" se lee como que va sobrada de volumen
              cuando lleva cero series. */}
          <p className="mb-3 text-[11px] leading-snug text-silver-500">
            Barra clara y etiqueta: lo que te pautó tu coach. Barra roja y primer número: lo
            que llevas registrado.
          </p>
          <div className="flex flex-col gap-3">
            {grupos.map((g) => {
              const nivel = nivelDeSeries(g.seriesPautadas)
              return (
                <div key={g.grupo} className="grid grid-cols-[76px_1fr_62px] items-center gap-2.5">
                  <span className="truncate text-xs font-semibold text-silver-200">{g.grupo}</span>
                  <span className="flex flex-col gap-1">
                    <span className="h-1.5 overflow-hidden rounded-full bg-ink-500">
                      <span
                        className="barra-crece block h-full rounded-full bg-silver-400"
                        style={{ width: `${Math.round((g.seriesPautadas / maxSeries) * 100)}%` }}
                      />
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-ink-500">
                      <span
                        className="barra-crece block h-full rounded-full bg-accion"
                        style={{ width: `${Math.round((g.seriesHechas / maxSeries) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="cifras block text-[11px] font-bold text-silver-100">
                      {formatearSeries(g.seriesHechas)}/{formatearSeries(g.seriesPautadas)}
                    </span>
                    <span
                      className={`block text-[9px] font-bold uppercase tracking-[0.06em] ${CLASE_NIVEL[nivel]}`}
                    >
                      {nivel}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Medidas · desviación del último registro */}
      {perimetros.length > 0 && (
        <div>
          <p className="mb-2 px-1 font-display text-sm text-silver-100">Medidas · última desviación</p>
          <div className="grid grid-cols-2 gap-2.5">
            {perimetros.map(([nombre, valor, unidad]) => {
              const antes = previoDe(nombre)
              const d = antes !== undefined ? Math.round((valor - antes) * 10) / 10 : undefined
              return (
                <div key={nombre} className="rounded-tarjeta border border-ink-500 bg-ink-800 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-silver-500">{nombre}</p>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="cifras text-xl font-bold text-silver-100">
                      {valor}
                      <span className="text-xs font-medium text-silver-500"> {unidad}</span>
                    </span>
                    {d !== undefined && d !== 0 && (
                      <span className={`cifras text-[11px] font-bold ${d < 0 ? 'text-accion' : 'text-silver-400'}`}>
                        {d > 0 ? '+' : ''}
                        {d}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
