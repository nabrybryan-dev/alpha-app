import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { Semaforo } from '../../components/ui/Semaforo'
import { db, useDbVersion } from '../../data/dbInstance'
import { GenerarMicrocicloSheet } from './GenerarMicrocicloSheet'
import { PautadoVsRealizado } from './PautadoVsRealizado'
import { resumenAsesorado } from './resumenAsesorado'

const PESTANAS = ['Resumen', 'Entrenamiento', 'Vida', 'Nutrición', 'Cuestionarios'] as const
type Pestana = (typeof PESTANAS)[number]

export default function AsesoradoDetallePage() {
  const { usuarioId } = useParams()
  useDbVersion()
  const [pestana, setPestana] = useState<Pestana>('Resumen')
  const [iaAbierta, setIaAbierta] = useState(false)

  const usuario = usuarioId ? db.usuarios.byId(usuarioId) : undefined
  if (!usuario) {
    return <EmptyState titulo="Asesorado no encontrado" detalle="Vuelve a la lista de asesorados." />
  }

  const resumen = resumenAsesorado(db, usuario)
  const perfil = db.perfiles.byUsuario(usuario.id)
  const checkins = [...db.bienestar.byUsuario(usuario.id)].reverse().slice(0, 7)
  const adherencias = db.nutricion.adherenciasByUsuario(usuario.id)
  const respuestas = db.cuestionarios.respuestasDe(usuario.id)
  const cuestionarios = db.cuestionarios.asignadosA(usuario.id)
  const premiaciones = db.premiaciones.byUsuario(usuario.id)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-3 text-sm font-bold text-texto">
          {usuario.avatarIniciales}
        </span>
        <div className="flex-1">
          <h2 className="font-display text-2xl text-texto">{usuario.nombre}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {resumen.microciclo && <Badge>M{resumen.microciclo.numero} activo</Badge>}
            <Semaforo datos={resumen.semaforo} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIaAbierta(true)}
          className="rounded-xl bg-rojo px-4 py-2.5 text-left font-display text-xs leading-tight text-white"
        >
          Generar
          <br />
          microciclo ⚡
        </button>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {PESTANAS.map((p) => (
          <Chip key={p} etiqueta={p} seleccionado={pestana === p} onSeleccionar={() => setPestana(p)} />
        ))}
      </div>

      {pestana === 'Resumen' && (
        <div className="flex flex-col gap-3">
          {perfil ? (
            <>
              <Card>
                <p className="kicker">Objetivos</p>
                <p className="mt-1 text-sm text-texto/90">{perfil.objetivos}</p>
                <p className="mt-2 text-xs text-tenue">
                  {perfil.edad} años · {perfil.diasEntrenamiento} días/sem ·{' '}
                  {Math.floor(perfil.tiempoSesionMin / 60)}h{perfil.tiempoSesionMin % 60 || ''} por
                  sesión · {perfil.somatotipo}
                </p>
              </Card>
              <Card>
                <p className="kicker">Volumen semanal por grupo</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(perfil.volumenSemanal).map(([grupo, nivel]) => (
                    <Badge
                      key={grupo}
                      tono={nivel === 'Muy Alto' ? 'rojo' : nivel === 'Alto' ? 'ambar' : nivel === 'Bajo' ? 'azul' : 'neutro'}
                    >
                      {grupo}: {nivel}
                    </Badge>
                  ))}
                </div>
              </Card>
              <Card>
                <p className="kicker">Medidas recientes</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-tenue">
                        <th className="py-1 pr-2 font-bold">Fecha</th>
                        <th className="py-1 pr-2 font-bold">Peso</th>
                        <th className="py-1 pr-2 font-bold">PG%</th>
                        <th className="py-1 font-bold">Perímetros clave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...perfil.medidas].reverse().map((medida) => (
                        <tr key={medida.fecha} className="border-t border-linea">
                          <td className="py-1.5 pr-2 text-texto">{medida.fecha}</td>
                          <td className="py-1.5 pr-2 font-bold text-texto">{medida.pesoKg} kg</td>
                          <td className="py-1.5 pr-2 text-texto/90">{medida.pgPct ?? '—'}</td>
                          <td className="py-1.5 text-tenue">
                            {Object.entries(medida.perimetros)
                              .slice(0, 3)
                              .map(([k, v]) => `${k} ${v}`)
                              .join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {premiaciones.length > 0 && (
                <Card destacada>
                  <p className="kicker">Reconocimientos otorgados</p>
                  {premiaciones.map((premio) => (
                    <p key={premio.id} className="mt-1 text-sm text-texto/90">
                      ⭐ {premio.titulo} ({premio.fecha})
                    </p>
                  ))}
                </Card>
              )}
            </>
          ) : (
            <EmptyState titulo="Sin perfil" detalle="Este asesorado aún no tiene perfil cargado." />
          )}
        </div>
      )}

      {pestana === 'Entrenamiento' &&
        (resumen.microciclo ? (
          <PautadoVsRealizado microciclo={resumen.microciclo} />
        ) : (
          <EmptyState titulo="Sin microciclo activo" detalle="Genera el siguiente microciclo." />
        ))}

      {pestana === 'Vida' && (
        <div className="flex flex-col gap-2">
          {checkins.length === 0 ? (
            <EmptyState titulo="Sin check-ins" detalle="Este asesorado aún no registra bienestar." />
          ) : (
            checkins.map((c) => (
              <Card key={c.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-texto">{c.fecha}</p>
                  <p className="text-xs text-tenue">
                    {c.pesoKg ? `${c.pesoKg} kg · ` : ''}
                    {c.horasSueno ? `${c.horasSueno}h sueño · ` : ''}
                    {c.pasos ? `${c.pasos} pasos` : ''}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {c.entreno && <Badge>{c.entreno}</Badge>}
                  {c.estres === 'MUCHO' && <Badge tono="rojo">Estrés alto</Badge>}
                  {c.cansancio === 'MUCHO' && <Badge tono="ambar">Muy cansada</Badge>}
                  {c.calidadSueno === 'MALA' && <Badge tono="rojo">Durmió mal</Badge>}
                </div>
                {c.comentarios && <p className="mt-1 text-xs italic text-tenue">"{c.comentarios}"</p>}
              </Card>
            ))
          )}
        </div>
      )}

      {pestana === 'Nutrición' && (
        <Card>
          <p className="kicker">Adherencia del microciclo</p>
          {adherencias.length === 0 ? (
            <p className="mt-2 text-sm text-tenue">Sin registros de adherencia.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-texto">
                {adherencias.filter((a) => a.estado === 'si').length} cumplidos ·{' '}
                {adherencias.filter((a) => a.estado === 'parcial').length} parciales ·{' '}
                {adherencias.filter((a) => a.estado === 'no').length} no cumplidos
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {adherencias.slice(-14).map((a) => (
                  <span
                    key={a.id}
                    title={`${a.fecha}${a.comentario ? ` — ${a.comentario}` : ''}`}
                    className={`h-6 w-6 rounded ${
                      a.estado === 'si' ? 'bg-verde' : a.estado === 'parcial' ? 'bg-ambar' : 'bg-rojo'
                    }`}
                  />
                ))}
              </div>
              {adherencias
                .filter((a) => a.comentario)
                .slice(-3)
                .map((a) => (
                  <p key={a.id} className="mt-2 text-xs italic text-tenue">
                    {a.fecha}: "{a.comentario}"
                  </p>
                ))}
            </>
          )}
        </Card>
      )}

      {pestana === 'Cuestionarios' && (
        <div className="flex flex-col gap-2">
          {cuestionarios.map((cuestionario) => {
            const respuesta = respuestas.find((r) => r.cuestionarioId === cuestionario.id)
            return (
              <Card key={cuestionario.id}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-sm text-texto">{cuestionario.titulo}</h4>
                  {respuesta ? <Badge tono="verde">Respondido</Badge> : <Badge tono="ambar">Pendiente</Badge>}
                </div>
                {respuesta && (
                  <dl className="mt-2 flex flex-col gap-1.5 text-xs">
                    {cuestionario.preguntas.map((pregunta) => (
                      <div key={pregunta.id}>
                        <dt className="text-tenue">{pregunta.enunciado}</dt>
                        <dd className="font-bold text-texto">{respuesta.valores[pregunta.id] ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Link to="/coach" className="text-center text-sm font-bold text-tenue">
        ← Volver a asesorados
      </Link>

      <GenerarMicrocicloSheet abierto={iaAbierta} nombreAsesorado={usuario.nombre} onCerrar={() => setIaAbierta(false)} />
    </div>
  )
}
