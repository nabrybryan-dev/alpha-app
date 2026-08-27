import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { calcularRacha } from '../../domain/gamification'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { senalesDeLaEncuesta } from '../../domain/nutricion/perfilCalculado'
import { visibilidadDe } from '../../domain/nutricion/visibilidad'
import { SheetVetados } from './SheetVetados'

function fechaAtras(hoy: string, dias: number): string {
  const fecha = new Date(`${hoy}T00:00:00`)
  fecha.setDate(fecha.getDate() - dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

interface FilaEquipo {
  usuario: ReturnType<typeof db.usuarios.asesorados>[number]
  pct: number | undefined
  registrados: number
  si: number
  parcial: number
  no: number
  racha: number
  tienePlan: boolean
  aguaHoyMl: number
}

interface DatosEquipo {
  filas: FilaEquipo[]
  pendientes: number
}

/**
 * Lo ya calculado para el equipo entero. Una sola entrada: esta pantalla mira a
 * todos, no a una persona, así que no hay nada por lo que trocearla.
 *
 * La llave es la versión del estado más el día. `useDbVersion()` sube con
 * CUALQUIER cambio -escritura local o hidratación desde la nube-, y el día
 * entra porque la ventana de 30 días y la racha se miden contra hoy.
 *
 * Va FUERA del componente y no en un `useMemo` por una razón concreta: arriba
 * hay un `return` temprano para quien no es staff, y un hook por debajo de un
 * return condicional viola las reglas de hooks. Una función normal no tiene ese
 * problema.
 */
let memoEquipo: { version: number; hoy: string; datos: DatosEquipo } | undefined

function datosDelEquipo(version: number, hoy: string): DatosEquipo {
  if (memoEquipo && memoEquipo.version === version && memoEquipo.hoy === hoy) {
    return memoEquipo.datos
  }
  const datos = calcularEquipo(hoy)
  memoEquipo = { version, hoy, datos }
  return datos
}

function calcularEquipo(hoy: string): DatosEquipo {
  const limite = fechaAtras(hoy, 30)
  // Una sola vez. Antes se pedía la lista de asesorados dos veces -una para el
  // contador de pendientes y otra para las filas-, y cada llamada filtra la
  // tabla de usuarios entera.
  const asesorados = db.usuarios.asesorados()

  // Cuántos esperan decisión. Va en el enlace: si no se ve el número, nadie
  // entra a mirar hasta que alguien pregunte.
  const pendientes = asesorados.filter((a) => {
    const respuestas = (db.perfilNutricion.byUsuario(a.id)?.respuestas ?? {}) as Respuestas
    return (
      visibilidadDe(db.visibilidad.byUsuario(a.id), senalesDeLaEncuesta(respuestas)).estado ===
      'en_espera'
    )
  }).length

  const filas = asesorados
    .map((a): FilaEquipo => {
      // `adherenciasByUsuario` filtra la lista completa de adherencias. Se
      // pedía DOS veces por asesorado -una para la ventana de 30 días y otra
      // para la racha-, así que con 26 asesorados eran 52 recorridos donde
      // bastan 26.
      const todas = db.nutricion.adherenciasByUsuario(a.id)

      // Y una sola pasada en vez de cuatro sobre la misma lista.
      let si = 0
      let parcial = 0
      let no = 0
      let registrados = 0
      const fechasDeRacha: string[] = []
      for (const x of todas) {
        if (x.estado !== 'no') fechasDeRacha.push(x.fecha)
        if (x.fecha < limite) continue
        registrados += 1
        if (x.estado === 'si') si += 1
        else if (x.estado === 'parcial') parcial += 1
        else no += 1
      }

      const pct =
        registrados === 0 ? undefined : Math.round(((si + parcial * 0.5) / registrados) * 100)

      return {
        usuario: a,
        pct,
        registrados,
        si,
        parcial,
        no,
        racha: calcularRacha(fechasDeRacha, hoy).actual,
        tienePlan: Boolean(db.nutricion.planByUsuario(a.id)),
        aguaHoyMl: db.nutricion.hidratacionDe(a.id, hoy),
      }
    })
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))

  return { filas, pendientes }
}

/**
 * Panel de la nutricionista (Manuela): evaluación nutricional de todo el
 * equipo — adherencia de 30 días, racha, plan asignado e hidratación de hoy.
 * Solo staff (nutricionista o coach) puede entrar.
 */
export default function EquipoNutricionPage() {
  const { usuario } = useSesion()
  const version = useDbVersion()
  const hoy = hoyIso()
  /** El asesorado cuyo panel de vetos está abierto. */
  const [vetando, setVetando] = useState<{ id: string; nombre: string } | null>(null)

  if (usuario.rol !== 'nutricionista' && usuario.rol !== 'coach') {
    return <Navigate to="/" replace />
  }

  const { filas, pendientes } = datosDelEquipo(version, hoy)


  return (
    <div className="flex flex-col gap-4">
      <SheetVetados
        asesoradoId={vetando?.id ?? null}
        nombre={vetando?.nombre ?? ''}
        onCerrar={() => setVetando(null)}
      />

      <section className="pt-2">
        <p className="kicker">Evaluación nutricional del equipo</p>
        <h2 className="font-display text-3xl text-texto">Nutrición Alpha</h2>
        <p className="mt-1 text-xs text-tenue">
          Adherencia de los últimos 30 días · ordenado de mayor a menor atención requerida
        </p>
        {/* Sin este enlace la pantalla de decisiones existe y no la alcanza
            nadie: la ruta estaba, pero no había por dónde entrar. */}
        <Link
          to="/equipo-nutricion/cifras"
          className="press mt-3 inline-block rounded-full border border-linea bg-surface-2 px-3 py-1.5 text-xs font-semibold text-texto"
        >
          Qué cifras ve cada asesorado
          {pendientes > 0 && (
            <span className="ml-2 rounded-full bg-accion px-1.5 py-0.5 text-[10px] font-bold text-white">
              {pendientes}
            </span>
          )}
        </Link>
      </section>

      <section className="flex flex-col gap-2.5">
        {filas.map((f) => (
          <Card key={f.usuario.id} className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-texto">
              {f.usuario.avatarIniciales}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-base text-texto">{f.usuario.nombre}</h3>
                {!f.tienePlan && <Badge tono="ambar">sin plan</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tenue">
                {f.pct === undefined ? (
                  <span className="font-bold text-rojo">Sin registros de adherencia</span>
                ) : (
                  <span>
                    Adherencia{' '}
                    <span className={`cifras font-bold ${f.pct >= 75 ? 'text-verde' : f.pct >= 50 ? 'text-ambar' : 'text-rojo'}`}>
                      {f.pct}%
                    </span>{' '}
                    ({f.si}✓ · {f.parcial}± · {f.no}✗ en {f.registrados} días)
                  </span>
                )}
                <span>Racha {f.racha}</span>
                {f.aguaHoyMl > 0 && <span>Agua hoy {(f.aguaHoyMl / 1000).toFixed(1)}L</span>}
              </div>
              {/* El número va en el botón porque el cero es el dato que importa:
                  «0 vetados» de alguien que declaró una alergia es justo lo que
                  hay que ver desde la lista, sin entrar a mirar. */}
              <button
                type="button"
                onClick={() => setVetando({ id: f.usuario.id, nombre: f.usuario.nombre })}
                className="press mt-1.5 rounded-full border border-linea bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-texto"
              >
                No debe comer ({db.vetados.byUsuario(f.usuario.id).length})
              </button>
            </div>
          </Card>
        ))}
      </section>

      <p className="text-center text-[10px] text-tenue">
        Vista de staff: aquí se evalúa cumplimiento nutricional, no datos personales de entrenamiento.
      </p>
    </div>
  )
}
