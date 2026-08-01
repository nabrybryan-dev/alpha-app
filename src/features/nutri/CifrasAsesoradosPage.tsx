import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { calcularPerfil, senalesDeLaEncuesta } from '../../domain/nutricion/perfilCalculado'
import { motivosDeRevision, visibilidadDe } from '../../domain/nutricion/visibilidad'
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
}

export default function CifrasAsesoradosPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const [abierta, setAbierta] = useState<string | null>(null)

  if (usuario.rol !== 'nutricionista' && usuario.rol !== 'coach') {
    return <Navigate to="/" replace />
  }

  const fichas: Ficha[] = db.usuarios.asesorados().map((a) => {
    const respuestas = (db.perfilNutricion.byUsuario(a.id)?.respuestas ?? {}) as Respuestas
    const guardada = db.visibilidad.byUsuario(a.id)
    const senales = senalesDeLaEncuesta(respuestas)
    return {
      id: a.id,
      nombre: a.nombre,
      respuestas,
      guardada,
      motivos: motivosDeRevision(senales),
      esperando: visibilidadDe(guardada, senales).estado === 'en_espera',
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
  const perfil = calcularPerfil(ficha.respuestas, hoyIso())
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
