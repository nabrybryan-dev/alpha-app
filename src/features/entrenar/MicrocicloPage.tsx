import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { db, useDbVersion } from '../../data/dbInstance'
import { resumenMicrociclo, sesionCompleta } from '../../domain/cumplimiento'

export default function MicrocicloPage() {
  const { usuario } = useSesion()
  useDbVersion()

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')

  if (!microciclo) {
    return (
      <EmptyState
        titulo="Sin microciclo activo"
        detalle="El coach está preparando tu siguiente programación."
      />
    )
  }

  const resumen = resumenMicrociclo(microciclo)

  return (
    <div className="flex flex-col gap-4">
      <section className="entrada entrada-1 pt-2">
        <p className="kicker">Microciclo activo</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-texto">M{microciclo.numero}</h2>
        <p className="mt-1.5 text-sm text-tenue">
          Inició el {microciclo.fechaInicio} · cadencia de {microciclo.cadenciaDias} días
        </p>
        <div className="mt-3">
          <ProgressBar pct={resumen.pctRegistrado} etiqueta="Progreso del microciclo" />
          <p className="cifras mt-1.5 text-xs text-tenue">
            {resumen.sesionesRegistradas} de {resumen.sesionesTotales} sesiones registradas
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        {microciclo.sesiones.map((sesion, i) => {
          const registrada = sesionCompleta(sesion)
          return (
            <Link key={sesion.id} to={`/entrenar/sesion/${sesion.id}`} className={`entrada entrada-${Math.min(i + 2, 6)}`}>
              <Card className={`press flex items-center justify-between gap-3 ${registrada ? 'opacity-70' : ''}`}>
                <div>
                  <h3 className="font-display text-lg text-texto">
                    {sesion.nombre}
                    {sesion.tipo === 'metabolica' && (
                      <span className="ml-2 rounded-full bg-azul/15 px-2 py-0.5 align-middle text-[10px] font-bold text-azul">
                        CARDIO
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-tenue">
                    {sesion.tipo === 'metabolica'
                      ? `${(sesion.bloquesCardio ?? []).length} bloques · cardio`
                      : `${sesion.ejercicios.length} ejercicios`}
                  </p>
                </div>
                {registrada ? (
                  <span className="text-sm font-bold text-verde">✓ Registrada</span>
                ) : (
                  <span className="rounded-full bg-rojo px-3 py-1 text-xs font-bold text-white">
                    Entrenar →
                  </span>
                )}
              </Card>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
