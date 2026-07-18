import { Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { calcularRacha } from '../../domain/gamification'

function fechaAtras(hoy: string, dias: number): string {
  const fecha = new Date(`${hoy}T00:00:00`)
  fecha.setDate(fecha.getDate() - dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/**
 * Panel de la nutricionista (Manuela): evaluación nutricional de todo el
 * equipo — adherencia de 30 días, racha, plan asignado e hidratación de hoy.
 * Solo staff (nutricionista o coach) puede entrar.
 */
export default function EquipoNutricionPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const limite = fechaAtras(hoy, 30)

  if (usuario.rol !== 'nutricionista' && usuario.rol !== 'coach') {
    return <Navigate to="/" replace />
  }

  const filas = db.usuarios
    .asesorados()
    .map((a) => {
      const adherencias = db.nutricion.adherenciasByUsuario(a.id).filter((x) => x.fecha >= limite)
      const si = adherencias.filter((x) => x.estado === 'si').length
      const parcial = adherencias.filter((x) => x.estado === 'parcial').length
      const no = adherencias.filter((x) => x.estado === 'no').length
      const registrados = adherencias.length
      const pct = registrados === 0 ? undefined : Math.round(((si + parcial * 0.5) / registrados) * 100)
      const racha = calcularRacha(
        db.nutricion.adherenciasByUsuario(a.id).filter((x) => x.estado !== 'no').map((x) => x.fecha),
        hoy,
      )
      return {
        usuario: a,
        pct,
        registrados,
        si,
        parcial,
        no,
        racha: racha.actual,
        tienePlan: Boolean(db.nutricion.planByUsuario(a.id)),
        aguaHoyMl: db.nutricion.hidratacionDe(a.id, hoy),
      }
    })
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))

  return (
    <div className="flex flex-col gap-4">
      <section className="pt-2">
        <p className="kicker">Evaluación nutricional del equipo</p>
        <h2 className="font-display text-3xl text-texto">Nutrición Alpha</h2>
        <p className="mt-1 text-xs text-tenue">
          Adherencia de los últimos 30 días · ordenado de mayor a menor atención requerida
        </p>
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
