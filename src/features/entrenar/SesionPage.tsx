import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import { preparacionDe } from '../../data/plantillas/preparacionBase'
import { ejercicioCompleto, sesionCompleta } from '../../domain/cumplimiento'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido } from '../../domain/types'
import { PreparacionSesion } from './PreparacionSesion'
import { RegistroSerie } from './RegistroSerie'
import { TestPostSesion } from './TestPostSesion'
import { VisorContenido } from '../contenidos/VisorContenido'

export default function SesionPage() {
  const { sesionId } = useParams()
  const { usuario } = useSesion()
  useDbVersion()
  const [demo, setDemo] = useState<Contenido | undefined>()
  const [cerrada, setCerrada] = useState(false)

  const microciclo = db.microciclos
    .byUsuario(usuario.id)
    .find((m) => m.sesiones.some((s) => s.id === sesionId))
  const sesion = microciclo?.sesiones.find((s) => s.id === sesionId)

  if (!microciclo || !sesion) {
    return <EmptyState titulo="Sesión no encontrada" detalle="Vuelve al microciclo y elige una sesión." />
  }

  const todasRegistradas = sesionCompleta(sesion)

  if (cerrada) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="text-5xl" aria-hidden="true">🏆</span>
        <h2 className="font-display text-3xl text-texto">Sesión {sesion.nombre} registrada</h2>
        <p className="text-lg font-bold text-verde">+{XP_POR_ACCION.sesion} XP</p>
        <p className="max-w-xs text-sm text-tenue">
          Tus datos ya quedaron guardados para la próxima decisión de programación del coach.
        </p>
        <Link
          to="/"
          className="mt-2 rounded-xl bg-rojo px-6 py-3 font-display text-sm text-white"
        >
          Volver a Hoy →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="kicker">Microciclo M{microciclo.numero}</p>
        <h2 className="font-display text-3xl text-texto">{sesion.nombre}</h2>
      </section>

      <PreparacionSesion
        partes={preparacionDe(sesion)}
        onMarcar={(parteId) => db.microciclos.marcarParte(microciclo.id, sesion.id, parteId)}
        onVerDemo={setDemo}
      />

      {sesion.tipo === 'metabolica' && (
        <Card>
          <p className="kicker">Bloques de la sesión</p>
          <ul className="mt-2 flex flex-col gap-2">
            {(sesion.bloquesCardio ?? []).map((bloque) => (
              <li key={bloque.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label={bloque.hechoEn ? `Desmarcar ${bloque.titulo}` : `Marcar ${bloque.titulo}`}
                  onClick={() => db.microciclos.marcarParte(microciclo.id, sesion.id, bloque.id)}
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold ${
                    bloque.hechoEn ? 'border-verde bg-verde text-white' : 'border-linea text-tenue'
                  }`}
                >
                  ✓
                </button>
                <div className={bloque.hechoEn ? 'opacity-60' : ''}>
                  <p className="text-sm font-bold text-texto">
                    {bloque.titulo}
                    {bloque.duracionMin ? (
                      <span className="ml-1 text-xs font-normal text-tenue">· {bloque.duracionMin} min</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-tenue">{bloque.indicaciones}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sesion.tipo !== 'metabolica' && sesion.ejercicios.map((ejercicio) => {
        const completo = ejercicioCompleto(ejercicio)
        const siguienteOrden = ejercicio.series.length + 1
        const contenidoDemo = ejercicio.contenidoDemoId
          ? db.contenidos.byId(ejercicio.contenidoDemoId)
          : undefined

        return (
          <Card key={ejercicio.id} className={completo ? 'opacity-75' : ''}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="kicker">{ejercicio.categoria}</p>
                <h3 className="mt-0.5 font-display text-lg text-texto">{ejercicio.nombre}</h3>
              </div>
              {completo && <Badge tono="verde">✓ Hecho</Badge>}
            </div>

            <p className="mt-2 rounded-lg border border-rojo-osc bg-rojo/5 p-2.5 font-mono text-[13px] font-bold leading-snug text-texto">
              {ejercicio.prescripcion}
            </p>
            <p className="mt-2 text-[13px] italic text-tenue">{ejercicio.cues}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-tenue">
              <Badge>Rango {ejercicio.rango}</Badge>
              <Badge>RIR {ejercicio.rirObjetivo}</Badge>
              <Badge>Descanso {ejercicio.descansoMin} min</Badge>
              {contenidoDemo && (
                <button
                  type="button"
                  onClick={() => setDemo(contenidoDemo)}
                  className="ml-auto text-xs font-bold text-azul"
                >
                  🎬 Ver técnica
                </button>
              )}
            </div>

            {ejercicio.series.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {ejercicio.series.map((serie) => (
                  <li key={serie.orden} className="flex items-center gap-2 text-sm text-texto">
                    <span className="text-xs text-tenue">S{serie.orden}</span>
                    <span className="font-bold">{serie.cargaKg} kg</span>
                    <span>× {serie.reps} reps</span>
                    <span className="text-tenue">RIR {serie.rir}</span>
                  </li>
                ))}
              </ul>
            )}

            {!completo && (
              <div className="mt-3">
                <RegistroSerie
                  key={siguienteOrden}
                  ejercicio={ejercicio}
                  orden={siguienteOrden}
                  onGuardar={(serie) => db.microciclos.registrarSerie(microciclo.id, ejercicio.id, serie)}
                />
              </div>
            )}
          </Card>
        )
      })}

      {todasRegistradas && !sesion.testPost && (
        <TestPostSesion
          onGuardar={(test) => {
            db.microciclos.guardarTestPost(microciclo.id, sesion.id, test)
            setCerrada(true)
          }}
        />
      )}

      {todasRegistradas && sesion.testPost && (
        <Card>
          <p className="text-sm font-bold text-verde">Sesión completa ✓</p>
          <p className="mt-1 text-sm text-tenue">
            Duración {sesion.testPost.duracionMin} min · RPE {sesion.testPost.rpeSesion}/10 · Recuperación{' '}
            {sesion.testPost.prsEntrada}/10
          </p>
        </Card>
      )}

      <Sheet abierto={demo !== undefined} titulo={demo?.titulo ?? ''} onCerrar={() => setDemo(undefined)}>
        {demo && <VisorContenido contenido={demo} />}
      </Sheet>
    </div>
  )
}
