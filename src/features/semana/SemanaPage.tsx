import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Sheet } from '../../components/ui/Sheet'
import { db, hoyIso, idCoach, useDbVersion } from '../../data/dbInstance'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
import { preguntaPendienteDelCoach } from '../../domain/preguntaDelCoach'
import { resumenSemanal } from '../../domain/resumenSemanal/calcular'
import {
  armarSemana,
  microcicloVigente,
  resumenSemana,
  semanaEsAdelantada,
  semanaEsVencida,
} from '../../domain/rutaEntrenamiento'
import { rangoDeLaSemana, cuestionariosDeLaSemana, resumirLaSemana } from '../../domain/semana/resumen'
import type { Cuestionario } from '../../domain/types'
import { MensajesVidaBandeja } from '../bienestar/MensajesVidaBandeja'
import { TarjetaVidaCard } from '../bienestar/TarjetaVidaCard'
import { CabeceraSemanal } from '../chat/CabeceraSemanal'
import { remitentesDe } from '../chat/remitentes'
import { ResponderCuestionario } from '../cuestionarios/ResponderCuestionario'
import { NotasDeLaSemana } from '../entrenar/NotasDeLaSemana'
import { esDeLaCadena } from '../preguntas/preguntasDeLaCadena'
import { PreguntaDelCoach } from '../hoy/PreguntaDelCoach'
import { TarjetaDeLaSemana } from '../hoy/TarjetaDeLaSemana'
import { Boton3D } from '../../components/ui/Boton3D'

/**
 * SEMANA, la bandeja de la semana (paso 6 del rediseño).
 *
 * Reúne lo que estaba repartido: la revisión con voz, las notas del coach, lo que toca
 * responder, los mensajes de estilo de vida y el chat del equipo. **No inventa datos**:
 * las «tareas de Manuela» no existen en `main` y no se pintan; las notas y la revisión no
 * llevan un contador de «leído» porque nadie lo guarda.
 *
 * El resumen «N de M» cuenta sesiones pautadas y cuestionarios, nada más: una respuesta solo
 * suma si su fecha cae en la semana mostrada (la del mes pasado no infla esta), y lo pendiente
 * cuenta como de esta. Un check-in diario, una nota o una revisión escuchada no tienen estado
 * de hecho; contarlos sería un número que la app no puede sostener.
 */
export default function SemanaPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const [abierto, setAbierto] = useState<Cuestionario | undefined>()

  const microciclo = microcicloVigente(db.microciclos.byUsuario(usuario.id), hoy)
  const dias = microciclo ? armarSemana(microciclo, hoy) : undefined
  const cumplimiento = dias ? resumenSemana(dias) : { programadas: 0, completadas: 0 }
  const notas = notasDelMicrociclo(microciclo)

  const asignados = db.cuestionarios.asignadosA(usuario.id).filter((q) => !esDeLaCadena(q))
  const respuestas = db.cuestionarios.respuestasDe(usuario.id)
  const pendientes = asignados.filter((q) => !respuestas.some((r) => r.cuestionarioId === q.id))
  const rango = rangoDeLaSemana(hoy)
  const cuestionarios = cuestionariosDeLaSemana(asignados, respuestas, rango)
  const cuenta = resumirLaSemana({
    sesionesPautadas: cumplimiento.programadas,
    sesionesHechas: cumplimiento.completadas,
    cuestionariosTotal: cuestionarios.total,
    cuestionariosRespondidos: cuestionarios.respondidos,
  })

  const checkins = db.bienestar.byUsuario(usuario.id)
  const adherencias = db.nutricion.adherenciasByUsuario(usuario.id)
  const resumen = resumenSemanal({
    sesiones: microciclo?.sesiones ?? [],
    checkins,
    adherenciaPct: adherencias.length ? porcentajeAdherencia(adherencias) : undefined,
  })
  const hiloCoach = db.mensajes.hilo(usuario.id, idCoach())
  const preguntaCoach = preguntaPendienteDelCoach(hiloCoach, idCoach())
  const nombreCoach = db.usuarios.byId(idCoach())?.nombre.split(' ')[0] ?? 'Tu coach'
  const remitentes = remitentesDe(db.usuarios.list(), usuario.id)
  // El último del EQUIPO, no solo del coach: la nutricionista escribe con su propia firma.
  const ultimoDelEquipo = remitentes
    .flatMap((remitente) =>
      db.mensajes.hilo(usuario.id, remitente.id).filter((m) => m.deId === remitente.id),
    )
    .sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))
    .at(-1)
  const equipo =
    remitentes.length > 1 ? 'Escríbele a tu coach o a tu nutricionista' : 'Escríbele a tu coach'

  return (
    // Sigue el tema de la persona (decisión de Bryan, 28-oct): la cabecera y la
    // barra inferior ya lo siguen, y forzar el cuerpo a claro partía la app en dos.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-5">
      <header className="entrada entrada-1">
        <p className="kicker">Tu semana</p>
        <h2 className="mt-1 font-display text-3xl leading-none text-texto">Semana</h2>
        <p className="mt-1.5 text-sm text-tenue">
          {rango.etiqueta}. Todo lo de esta semana en un sitio.
        </p>
      </header>

      <section
        aria-label="Resumen de la semana"
        data-bloque="resumen"
        className="entrada entrada-2 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
      >
        <div className="flex items-end justify-between gap-3">
          <p className="cifras font-display text-3xl leading-none text-texto">
            {cuenta.hechas}
            <span className="text-base text-tenue"> / {cuenta.total}</span>
          </p>
          <p className="text-right text-sm text-tenue">{cuenta.texto}</p>
        </div>
        {cuenta.total > 0 && (
          <div
            className="mt-3 flex gap-1"
            role="img"
            aria-label={`${cuenta.pct} % de la semana hecho`}
          >
            {cuenta.segmentos.map((hecho, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${hecho ? 'bg-accion' : 'bg-linea'}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-tenue">Sesiones</dt>
            <dd className="cifras text-sm font-bold text-texto">
              {cumplimiento.completadas} de {cumplimiento.programadas}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tenue">Check-ins</dt>
            <dd className="cifras text-sm font-bold text-texto">{resumen.checkinsDeLaSemana} de 7</dd>
          </div>
          <div>
            <dt className="text-xs text-tenue">Cuestionarios</dt>
            <dd className="cifras text-sm font-bold text-texto">{pendientes.length} por hacer</dd>
          </div>
        </dl>
        {microciclo && semanaEsAdelantada(microciclo, hoy) && (
          <p className="mt-3 text-xs text-tenue">Tu semana {microciclo.numero} empieza el {microciclo.fechaInicio}.</p>
        )}
        {microciclo && semanaEsVencida(microciclo, hoy) && (
          <p className="mt-3 text-xs text-tenue">Tu semana terminó; el coach prepara la siguiente.</p>
        )}
      </section>

      <CabeceraSemanal>
        <TarjetaDeLaSemana nombre={usuario.nombre.split(' ')[0]} resumen={resumen} />
        {preguntaCoach && <PreguntaDelCoach texto={preguntaCoach.texto} nombreCoach={nombreCoach} />}
      </CabeceraSemanal>

      {notas.length > 0 && (
        <section aria-label="Notas de la semana" className="entrada entrada-3">
          <NotasDeLaSemana notas={notas} />
        </section>
      )}

      <section
        aria-label="Lo que te toca responder"
        data-bloque="responder"
        className="entrada entrada-3 flex flex-col gap-2 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
      >
        <h3 className="font-display text-base text-texto">Lo que te toca responder</h3>
        {pendientes.length === 0 ? (
          <p className="text-sm text-tenue">Nada pendiente. Todo al día.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-texto">{q.titulo}</span>
                  <span className="block text-xs text-tenue">{q.preguntas.length} preguntas</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAbierto(q)}
                  className="press min-h-[44px] shrink-0 rounded-full border border-linea px-3 text-xs font-bold text-texto"
                >
                  Responder
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link to="/cuestionarios" className="text-xs font-semibold text-texto underline underline-offset-2">
          Ver todos mis cuestionarios
        </Link>
        <TarjetaVidaCard usuarioId={usuario.id} />
      </section>

      <MensajesVidaBandeja usuarioId={usuario.id} />

      <section
        aria-label="Chat con tu equipo"
        data-bloque="chat"
        className="entrada entrada-4 flex flex-col gap-2 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
      >
        <h3 className="font-display text-base text-texto">Chat con tu equipo</h3>
        <p className="text-sm text-tenue">
          {ultimoDelEquipo ? `«${ultimoDelEquipo.texto}»` : equipo}
        </p>
        <Boton3D
          to="/chat"
          className="self-start"
        >
          Abrir el chat
        </Boton3D>
      </section>

      {microciclo && dias && (
        <section aria-label="Tu semana, día por día" className="entrada entrada-5">
          <p className="kicker mb-2">Día por día</p>
          <ul className="grid grid-cols-7 gap-1">
            {dias.map((dia) => (
              <li key={dia.fechaIso} className="rounded-lg border border-linea p-1 text-center">
                <span className="block text-[10px] uppercase tracking-wide text-tenue">
                  {dia.abreviatura}
                </span>
                <span className="mt-1 block text-xs font-bold text-texto">
                  {dia.sesionId === undefined ? '—' : dia.estado === 'completada' ? '✓' : '·'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet abierto={abierto !== undefined} titulo={abierto?.titulo ?? ''} onCerrar={() => setAbierto(undefined)}>
        {abierto && (
          <ResponderCuestionario
            cuestionario={abierto}
            onEnviar={(valores) => {
              db.cuestionarios.responder(abierto.id, usuario.id, valores)
              setAbierto(undefined)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
