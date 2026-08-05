import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { calcularPerfil, senalesDeLaEncuesta } from '../../domain/nutricion/perfilCalculado'
import { motivosDeRevision, visibilidadDe } from '../../domain/nutricion/visibilidad'
import {
  DIAS_MINIMOS,
  ventanaEnergetica,
  type VentanaEnergetica,
} from '../../domain/nutricion/ventanaEnergetica'
import {
  entrenosEnVentana,
  gastoEjercicioDiario,
  minutosTipicos,
  type GastoEjercicio,
} from '../../domain/nutricion/gastoEjercicio'
import { resumenDelDia } from '../../domain/nutricion/resumen'
import type { VeredictoEnergetico } from '../../domain/nutricion/composicion'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'
import type { VisibilidadAsesorado } from '../../domain/types'

/**
 * El puesto de trabajo de la nutricionista: qué cifras ve cada asesorado.
 *
 * ARRIBA VAN LOS QUE ESPERAN. No es una lista alfabética con una columna de
 * estado: quien entra aquí lo hace para resolver algo, y lo que hay que
 * resolver tiene que estar donde cae el ojo. El resto se consulta.
 *
 * Y en cada ficha se enseñan las cifras COMPLETAS, aunque el asesorado no las
 * vea. Decidir si alguien debe ver su porcentaje de grasa sin ver ese
 * porcentaje sería decidir a ciegas.
 */

interface Ficha {
  id: string
  nombre: string
  respuestas: Respuestas
  guardada: VisibilidadAsesorado | undefined
  motivos: string[]
  esperando: boolean
  /** Media de ingesta de sus últimos días registrados. `null` si aún no bastan. */
  ventana: VentanaEnergetica | null
  /** Lo que gastó entrenando en esos MISMOS días. `null` si no se pudo calcular. */
  gasto: GastoEjercicio | null
}

/**
 * El gasto de entreno de la misma ventana que la ingesta.
 *
 * Los dos periodos tienen que ser el mismo. Restar el entreno de una semana a la
 * ingesta media de otra daría una disponibilidad que no es de ningún tramo.
 *
 * La duración sale del test post de sus sesiones —el único sitio donde queda
 * registrada— y se resume en su mediana, porque una `Sesion` no lleva fecha y no
 * se puede emparejar con el día que el check-in dice que entrenó.
 */
function gastoDeLaVentana(usuarioId: string, respuestas: Respuestas, hoy: string, dias: number) {
  const duraciones = db.microciclos
    .byUsuario(usuarioId)
    .flatMap((m) => m.sesiones)
    .map((s) => s.testPost?.duracionMin)
    .filter((min): min is number => typeof min === 'number')

  const peso = Number(respuestas.pesoKg)
  return gastoEjercicioDiario(
    entrenosEnVentana(db.bienestar.byUsuario(usuarioId), hoy, dias),
    Number.isFinite(peso) ? peso : null,
    dias,
    minutosTipicos(duraciones),
  )
}

/**
 * Los días con registro de esta persona, uno por fecha, para la ventana.
 *
 * Se miran los últimos 30 días naturales y no todo el historial: la ventana solo
 * usa los 7 más recientes, y recorrer un año de fechas para quedarse con una
 * semana sería trabajo tirado en cada render de la lista.
 */
function diasRegistrados(usuarioId: string, hoy: string, porId: (id: string) => AlimentoIndice | undefined) {
  return Array.from({ length: 30 }, (_, i) => {
    const fecha = restarDias(hoy, i + 1)
    return { fecha, total: resumenDelDia(db.registroComidas.delDia(usuarioId, fecha), porId) }
  })
}

/** `2026-08-03` menos N días, sin arrastrar la hora local. */
function restarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function CifrasAsesoradosPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const [abierta, setAbierta] = useState<string | null>(null)

  if (usuario.rol !== 'nutricionista' && usuario.rol !== 'coach') {
    return <Navigate to="/" replace />
  }

  const hoy = hoyIso()
  const porId = (id: string) => catalogoRepo.porId(id)

  const fichas: Ficha[] = db.usuarios.asesorados().map((a) => {
    const respuestas = (db.perfilNutricion.byUsuario(a.id)?.respuestas ?? {}) as Respuestas
    const guardada = db.visibilidad.byUsuario(a.id)
    const senales = senalesDeLaEncuesta(respuestas)
    const ventana = ventanaEnergetica(diasRegistrados(a.id, hoy, porId), hoy)
    return {
      id: a.id,
      nombre: a.nombre,
      respuestas,
      guardada,
      motivos: motivosDeRevision(senales),
      esperando: visibilidadDe(guardada, senales).estado === 'en_espera',
      ventana,
      gasto: ventana ? gastoDeLaVentana(a.id, respuestas, hoy, ventana.dias) : null,
    }
  })

  const esperando = fichas.filter((f) => f.esperando)
  const resto = fichas.filter((f) => !f.esperando)

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">Nutrición</p>
        <h1 className="font-display text-xl text-texto">Qué cifras ve cada asesorado</h1>
        <p className="mt-2 text-sm leading-snug text-tenue">
          El cálculo corre siempre y tú lo ves entero. Esto decide qué se le muestra a él.
        </p>
      </header>

      {esperando.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-sm text-accion">
            Esperan tu decisión · {esperando.length}
          </h2>
          <div className="flex flex-col gap-2">
            {esperando.map((ficha) => (
              <FichaAsesorado
                key={ficha.id}
                ficha={ficha}
                abierta={abierta === ficha.id}
                onAbrir={() => setAbierta(abierta === ficha.id ? null : ficha.id)}
                decisorId={usuario.id}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-sm text-texto">
          {esperando.length > 0 ? 'Los demás' : 'Tu cartera'} · {resto.length}
        </h2>
        <div className="flex flex-col gap-2">
          {resto.map((ficha) => (
            <FichaAsesorado
              key={ficha.id}
              ficha={ficha}
              abierta={abierta === ficha.id}
              onAbrir={() => setAbierta(abierta === ficha.id ? null : ficha.id)}
              decisorId={usuario.id}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

interface FichaProps {
  ficha: Ficha
  abierta: boolean
  onAbrir: () => void
  decisorId: string
}

function FichaAsesorado({ ficha, abierta, onAbrir, decisorId }: FichaProps) {
  // Con la ventana entra la disponibilidad energética. Sin ella `perfil.energia`
  // es `null` y la tarjeta lo dice, en vez de enseñar un número inventado.
  const perfil = calcularPerfil(ficha.respuestas, hoyIso(), {
    ingestaKcal: ficha.ventana?.ingestaKcal,
    gastoEjercicioKcal: ficha.gasto?.kcalDia,
  })
  const actual = visibilidadDe(ficha.guardada, senalesDeLaEncuesta(ficha.respuestas))
  const [nota, setNota] = useState(ficha.guardada?.nota ?? '')

  const decidir = (cambios: Partial<VisibilidadAsesorado>) => {
    db.visibilidad.decidir({
      usuarioId: ficha.id,
      verComposicion: actual.verComposicion,
      verObjetivoCalorico: actual.verObjetivoCalorico,
      verContadorKcal: actual.verContadorKcal,
      nota: nota.trim() || undefined,
      // Tocar cualquier interruptor cuenta como haber mirado: deja de estar en
      // espera aunque la señal que lo trajo siga ahí.
      estado: 'decidido',
      decididoPor: decisorId,
      decididoEn: new Date().toISOString(),
      ...cambios,
    })
  }

  const sinEncuesta = Object.keys(ficha.respuestas).length === 0

  return (
    <div className="rounded-2xl border border-linea bg-surface-1">
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierta}
        className="press flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-texto">{ficha.nombre}</span>
          <span className="block text-[11px] text-tenue">
            {sinEncuesta
              ? 'Sin encuesta respondida'
              : ficha.motivos.length > 0
                ? ficha.motivos.join(' · ')
                : 'Sin señales'}
          </span>
        </span>
        {ficha.esperando && (
          <span className="shrink-0 rounded-full bg-accion px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Revisar
          </span>
        )}
      </button>

      {abierta && (
        <div className="border-t border-linea p-3">
          {sinEncuesta ? (
            <p className="text-xs leading-snug text-tenue">
              Todavía no ha respondido la encuesta. Hasta que lo haga no hay cifras que calcular ni
              nada que decidir.
            </p>
          ) : (
            <>
              {/* Las cifras completas, siempre. Decidir si alguien debe ver su
                  porcentaje sin verlo sería decidir a ciegas. */}
              <div className="grid grid-cols-4 gap-2">
                <Cifra etiqueta="Grasa" valor={perfil.grasaPct} sufijo="%" />
                <Cifra etiqueta="Magra" valor={perfil.masaMagraKg} sufijo="kg" />
                <Cifra etiqueta="IMC" valor={perfil.imc} />
                <Cifra etiqueta="TDEE" valor={perfil.tdee} sufijo="kcal" />
              </div>

              <Energia ventana={ficha.ventana} veredicto={perfil.energia} gasto={ficha.gasto} />

              <div className="mt-4 flex flex-col gap-2">
                <Interruptor
                  etiqueta="Ve su composición corporal"
                  detalle="% de grasa, masa magra, IMC"
                  activo={actual.verComposicion}
                  onCambiar={(v) => decidir({ verComposicion: v })}
                />
                <Interruptor
                  etiqueta="Ve su objetivo calórico"
                  detalle="Sigue viendo su plan, sin la cifra"
                  activo={actual.verObjetivoCalorico}
                  onCambiar={(v) => decidir({ verObjetivoCalorico: v })}
                />
                <Interruptor
                  etiqueta="Ve el contador del diario"
                  detalle="Sigue registrando igual; tú lo ves todo"
                  activo={actual.verContadorKcal}
                  onCambiar={(v) => decidir({ verContadorKcal: v })}
                />
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                  Por qué lo decidiste así
                </span>
                {/* No la ve el asesorado: vive en una tabla aparte, solo staff. */}
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onBlur={() => decidir({})}
                  rows={2}
                  placeholder="Solo la ves tú y el coach"
                  className="mt-1 w-full rounded-xl border border-linea bg-surface-2 p-2 text-sm text-texto focus:border-accion focus:outline-none"
                />
              </label>

              {actual.estado === 'en_espera' && (
                <p className="mt-2 text-[11px] leading-snug text-tenue">
                  Mientras no toques nada, sus cifras están retenidas. Tocar cualquier interruptor
                  cuenta como haberlo mirado.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Cifra({
  etiqueta,
  valor,
  sufijo,
}: {
  etiqueta: string
  valor: number | null
  sufijo?: string
}) {
  return (
    <div className="rounded-xl border border-linea bg-surface-2 p-2 text-center">
      <p className="text-[9px] font-bold uppercase text-tenue">{etiqueta}</p>
      <p className="cifras text-sm font-bold text-texto">
        {valor === null ? '—' : valor.toLocaleString('es-CO')}
      </p>
      {sufijo && <p className="text-[9px] text-tenue">{sufijo}</p>}
    </div>
  )
}

/**
 * La disponibilidad energética, y de dónde sale.
 *
 * AQUÍ Y NO EN LA PANTALLA DEL ASESORADO, todavía. Es un veredicto sobre una
 * media de registros estimados y sobre un gasto de entreno que casi siempre es
 * un estimado también. Que lo lea una persona antes de que llegue a nadie es lo
 * coherente con el resto del apartado.
 *
 * NUNCA ENSEÑA EL NÚMERO SIN SU PROCEDENCIA. Sobre cuántos días, con qué margen,
 * con qué criterio y con qué gasto descontado: los cuatro cambian cómo se lee, y
 * sin ellos «24,1 kcal/kg» parece una medición.
 */
function Energia({
  ventana,
  veredicto,
  gasto,
}: {
  ventana: VentanaEnergetica | null
  veredicto: VeredictoEnergetico | null
  gasto: GastoEjercicio | null
}) {
  if (!ventana || !veredicto) {
    return (
      <p className="mt-3 rounded-xl border border-linea bg-surface-2 p-3 text-[11px] leading-snug text-tenue">
        Sin días suficientes para calcular su disponibilidad energética. Hacen falta{' '}
        {DIAS_MINIMOS} días registrados, sin contar hoy.
      </p>
    )
  }

  const tono =
    veredicto.estado === 'problema'
      ? 'border-accion/40 bg-accion/10'
      : veredicto.estado === 'vigilancia'
        ? 'border-ambar/40 bg-ambar/10'
        : 'border-linea bg-surface-2'

  return (
    <div className={`mt-3 rounded-xl border p-3 ${tono}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
          Energía disponible
        </p>
        <p className="cifras text-sm font-bold text-texto">
          {veredicto.disponibilidad} kcal/kg
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-tenue">
        Media de {ventana.ingestaKcal.toLocaleString('es-CO')} kcal sobre {ventana.dias}{' '}
        {ventana.dias === 1 ? 'día' : 'días'} registrados, con un margen de ±{ventana.margenPct} %.
      </p>
      {/* En su propio renglón: el criterio empieza en minúscula a propósito -es un
          fragmento- y pegado a la frase de arriba quedaba tras un punto. */}
      <p className="mt-0.5 text-[11px] leading-snug text-tenue">
        Umbral aplicado — {veredicto.criterio}.
      </p>
      {/* Sin este renglón el número se lee como si el gasto estuviera medido. */}
      <ProcedenciaDelGasto gasto={gasto} />
    </div>
  )
}

/**
 * Con qué gasto de entreno se hizo la resta, y de dónde salió.
 *
 * Un gasto medido y uno estimado no se leen igual, y no distinguirlos es lo que
 * hacía el cero: pasar por dato algo que nadie midió. Cuando el estimado viene
 * del suelo de minutos, la cifra se queda corta a propósito y hay que decirlo,
 * porque quedarse corto en el gasto sube la disponibilidad y suaviza la alerta.
 */
function ProcedenciaDelGasto({ gasto }: { gasto: GastoEjercicio | null }) {
  if (!gasto) {
    return (
      <p className="mt-1 text-[11px] leading-snug text-tenue">
        <b className="text-texto">Sin gasto de entrenamiento descontado</b> — falta su peso para
        poder calcularlo. La cifra real es más baja que esta.
      </p>
    )
  }

  if (gasto.sesiones === 0) {
    return (
      <p className="mt-1 text-[11px] leading-snug text-tenue">
        No consta ningún entreno en estos {gasto.dias} días, así que no se descuenta nada. Si
        entrenó sin registrarlo en su check-in, la cifra real es más baja.
      </p>
    )
  }

  return (
    <p className="mt-1 text-[11px] leading-snug text-tenue">
      Menos <b className="text-texto">{gasto.kcalDia.toLocaleString('es-CO')} kcal/día</b> de{' '}
      {gasto.sesiones} {gasto.sesiones === 1 ? 'entreno' : 'entrenos'} repartidos en {gasto.dias}{' '}
      días
      {gasto.estimadas > 0 &&
        ` — ${gasto.estimadas} sin duración registrada, calculado por lo bajo`}
      .
    </p>
  )
}

function Interruptor({
  etiqueta,
  detalle,
  activo,
  onCambiar,
}: {
  etiqueta: string
  detalle: string
  activo: boolean
  onCambiar: (activo: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-linea bg-surface-2 p-3">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-texto">{etiqueta}</span>
        <span className="block text-[10px] leading-snug text-tenue">{detalle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        onClick={() => onCambiar(!activo)}
        className={`press h-6 w-11 shrink-0 rounded-full border transition-colors ${
          activo ? 'border-accion bg-accion' : 'border-linea bg-surface-3'
        }`}
      >
        <span
          aria-hidden="true"
          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
            activo ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
