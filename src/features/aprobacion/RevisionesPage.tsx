import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { decidirRevision, reproducirRevision, revisionesPendientes, type RevisionPendiente } from '../../data/nube/revisiones'
import { db, useDbVersion } from '../../data/dbInstance'

function Revision({ revision, actualizar }: { revision: RevisionPendiente; actualizar: () => void }) {
  useDbVersion()
  const [url, setUrl] = useState('')
  const [revisada, setRevisada] = useState(false)
  const [reproducida, setReproducida] = useState(false)
  const [correccion, setCorreccion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const nombre = db.usuarios.byId(revision.usuario_id)?.nombre ?? revision.usuario_id

  async function abrir() {
    setOcupado(true)
    setError('')
    try { setUrl(await reproducirRevision(revision)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir') }
    finally { setOcupado(false) }
  }

  async function decidir(aprobar: boolean) {
    setOcupado(true)
    setError('')
    try { await decidirRevision(revision, aprobar, correccion); actualizar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setOcupado(false) }
  }

  return <article className="rounded-tarjeta border border-linea bg-ink-900 p-4">
    <h2 className="font-semibold">{nombre} · {revision.semana}</h2>
    <p className="my-3 whitespace-pre-line text-sm">{revision.guion}</p>
    <button type="button" disabled={ocupado} onClick={() => void abrir()} className="min-h-[44px] underline">Abrir {revision.tipo}</button>
    {url && (revision.tipo === 'audio'
      ? <audio controls className="block w-full" src={url} onPlay={() => setReproducida(true)} onError={() => { setReproducida(false); setRevisada(false); setError('El audio no se pudo reproducir') }} />
      : <video controls playsInline src={url} className="max-h-96 w-full" onPlay={() => setReproducida(true)} onError={() => { setReproducida(false); setRevisada(false); setError('El vídeo no se pudo reproducir') }} />)}
    {revision.correccion_solicitada && <p role="status" className="my-2 text-sm">Corrección solicitada: {revision.correccion_solicitada}</p>}
    <label className="my-3 flex gap-2 text-sm"><input type="checkbox" disabled={!reproducida || ocupado} checked={revisada} onChange={e => setRevisada(e.target.checked)} />He revisado el guion y el archivo completo.</label>
    <button type="button" disabled={ocupado || !revisada || !revision.guion.trim() || !!revision.correccion_solicitada} onClick={() => void decidir(true)} className="min-h-[44px] rounded-boton bg-accion px-4 text-ink-1000 disabled:opacity-40">Aprobar esta versión</button>
    <label className="mt-4 block text-sm">Qué hay que corregir<textarea maxLength={4000} value={correccion} onChange={e => setCorreccion(e.target.value)} className="mt-1 block w-full rounded-boton border border-linea bg-bg p-2" /></label>
    <button type="button" disabled={ocupado || !correccion.trim()} onClick={() => void decidir(false)} className="min-h-[44px] underline disabled:opacity-40">Solicitar corrección</button>
    {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
  </article>
}

export default function RevisionesPage() {
  const [revisiones, setRevisiones] = useState<RevisionPendiente[] | null>(null)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    revisionesPendientes().then(datos => { if (vigente) { setRevisiones(datos); setError('') } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar la bandeja') })
    return () => { vigente = false }
  }, [recarga])
  function actualizar() { setRevisiones(null); setRecarga(n => n + 1) }
  return <section className="flex flex-col gap-4">
    <Link to="/coach" className="underline">Volver al panel</Link>
    <h1 className="text-xl font-bold">Revisiones pendientes</h1>
    <p className="text-sm text-tenue">Cada aprobación permite que la persona vea esta versión. Las correcciones esperan un archivo nuevo.</p>
    <button type="button" onClick={actualizar} className="min-h-[44px] underline">Actualizar bandeja</button>
    {error && <p role="alert">{error}</p>}
    {!revisiones && !error && <p role="status">Cargando revisiones…</p>}
    {revisiones?.length === 0 && <p>No hay revisiones pendientes.</p>}
    {revisiones?.map(r => <Revision key={`${r.usuario_id}:${r.semana}:${r.version}:${r.correccion_solicitada}`} revision={r} actualizar={actualizar} />)}
  </section>
}
