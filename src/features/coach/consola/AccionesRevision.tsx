import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import {
  casosFirmaDePersona,
  registrarFirma,
  subirFirma,
  urlDelCaso,
  validarArchivoFirma,
  type CasoFirma,
} from '../../../data/consola/casosFirma'
import { db } from '../../../data/dbInstance'
import {
  detenerPublicacion,
  prepararFirma,
  reanudarPublicacion,
  reportarRiesgo,
  type Orden,
} from '../../../data/consola/ordenes'
import { useCapacidades } from './useCapacidades'

/**
 * «Detener publicación», «Reanudar», «Reportar riesgo» y «Preparar para firmar» de una
 * persona, sobre la semana que SE VA A CARGAR (Módulo 1 de la maqueta,
 * DISENO-CONSOLA-V2.md §2.1 y §4, ampliado por CONTRATO-FIRMA-Y-REANUDAR.md, 25-sep).
 * Escribe en `ordenes` (migración 0083/0084) y, para la firma, en el bucket `firmas` y en
 * la RPC `registrar_firma` — solo al pulsar los botones, nunca al montar.
 *
 * `semanaObjetivo` NO es «el lunes de hoy»: quien pinta la lista (`RevisionSemanaTab`) ya
 * la calculó con `semanaObjetivoDeAcciones` — la semana que se va a cargar para ESTA
 * persona, no la que está terminando. Bryan revisa sábado/domingo y la carga real es el
 * lunes siguiente; la guarda de la carga (repo de agentes) compara `objetivo.semana_inicio`
 * contra la semana NUEVA, así que apuntar a la semana en curso no detendría (ni
 * reanudaría) nada.
 *
 * El motivo se pide en un cuadro DENTRO de la página para las cuatro acciones, nunca con
 * `prompt`/`confirm` del navegador (encargo, punto 2): eso no se puede probar con Testing
 * Library ni queda registrado en la propia pantalla.
 */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `28-sep`, sin depender de `toLocaleDateString` (en es-CO abrevia con punto: «sept.») —
 *  determinista, para que el texto del botón no cambie con el navegador que lo corra. */
function formatoDiaMes(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(fecha.getTime())) return iso
  return `${fecha.getUTCDate()}-${MESES_CORTOS[fecha.getUTCMonth()]}`
}

function formatoHora(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function nombreDe(usuarioId: string): string {
  return db.usuarios.byId(usuarioId)?.nombre ?? 'alguien del equipo'
}

type TipoAccion = 'detener' | 'reportar' | 'reanudar' | 'preparar_firma'

interface AccionesRevisionProps {
  usuarioId: string
  /** La semana que se va a cargar para esta persona (`semanaObjetivoDeAcciones`), NO el
   *  lunes de la semana en curso. */
  semanaObjetivo: string
  /** Las órdenes ya traídas por quien pinta la lista (una sola consulta para toda la
   *  cartera) — este componente solo filtra las que le tocan a `usuarioId`+`semanaObjetivo`.
   *  Tiene que incluir `detener` Y `reanudar` para poder calcular la detención vigente. */
  ordenes: readonly Orden[]
  /** Avisa a quien pinta la lista de que hay una orden nueva, para refrescar `ordenes`. */
  onOrdenCreada: () => void
}

function etiquetaBoton(tipo: TipoAccion, fecha: string): string {
  switch (tipo) {
    case 'detener':
      return `Detener la semana del ${fecha}`
    case 'reportar':
      return `Reportar riesgo (semana del ${fecha})`
    case 'reanudar':
      return `Reanudar la semana del ${fecha}`
    case 'preparar_firma':
      return 'Preparar para firmar'
  }
}

function etiquetaMotivo(tipo: TipoAccion, fecha: string): string {
  switch (tipo) {
    case 'detener':
      return `Motivo para detener la semana del ${fecha}`
    case 'reportar':
      return `Motivo del riesgo reportado (semana del ${fecha})`
    case 'reanudar':
      return `Motivo para reanudar la semana del ${fecha}`
    case 'preparar_firma':
      return `Motivo para preparar el caso de firma (semana del ${fecha})`
  }
}

function etiquetaConfirmar(tipo: TipoAccion): string {
  switch (tipo) {
    case 'detener':
      return 'Confirmar detener'
    case 'reportar':
      return 'Confirmar reporte'
    case 'reanudar':
      return 'Confirmar reanudar'
    case 'preparar_firma':
      return 'Confirmar preparación'
  }
}

/** Cada 30 s mientras el caso está en un estado que espera a OTRA parte (el equipo de
 *  mesa, o la verificación) — no mientras espera al staff (`listo_para_firmar`, donde el
 *  botón de acción ya está en pantalla) ni en un estado final. */
const ESTADOS_QUE_REFRESCAN = new Set<CasoFirma['estado']>(['preparando', 'firmado'])
const MS_REFRESCO_CASO = 30_000
const ESTADOS_CASO_ACTIVO = new Set<CasoFirma['estado']>(['preparando', 'listo_para_firmar', 'firmado'])

const ETIQUETA_ESTADO_CASO: Record<CasoFirma['estado'], string> = {
  preparando: 'Preparando el caso para firmar…',
  listo_para_firmar: 'Caso listo para firmar.',
  firmado: 'Firma subida — esperando verificación del equipo de mesa…',
  verificado: 'Caso verificado.',
  rechazado: 'Caso rechazado.',
  caducado: 'El caso caducó. Prepáralo de nuevo si sigue haciendo falta.',
}

export function AccionesRevision({ usuarioId, semanaObjetivo, ordenes, onOrdenCreada }: AccionesRevisionProps) {
  const { cargando: cargandoCapacidades, tiene, usuarioId: actorId } = useCapacidades()
  const [abierta, setAbierta] = useState<TipoAccion | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // ── El ciclo de firma: preparar, descargar, subir el .sig, registrar ──────────────────
  const [caso, setCaso] = useState<CasoFirma | null>(null)
  const [esperandoCaso, setEsperandoCaso] = useState(false)
  const [archivoFirma, setArchivoFirma] = useState<File | null>(null)
  const [errorFirma, setErrorFirma] = useState<string | null>(null)
  const [infoFirma, setInfoFirma] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [subiendoFirma, setSubiendoFirma] = useState(false)

  const fechaLegible = formatoDiaMes(semanaObjetivo)

  const esDeEstaPersonaYSemana = (orden: Orden) =>
    orden.objetivo.usuario_id === usuarioId && orden.objetivo.semana_inicio === semanaObjetivo

  const riesgo = ordenes.find((o) => o.tipo === 'reportar_riesgo' && esDeEstaPersonaYSemana(o))

  // Detener vigente (contrato §1): para esta persona y semana, la orden MÁS RECIENTE
  // entre `detener` y `reanudar` es un `detener`. Una `reanudar` posterior a la última
  // `detener` apaga la detención; el paso del tiempo por sí solo, no.
  const ultimaDetencionOReanudacion = ordenes
    .filter((o) => (o.tipo === 'detener' || o.tipo === 'reanudar') && esDeEstaPersonaYSemana(o))
    .reduce<Orden | undefined>(
      (masReciente, o) => (!masReciente || o.creadaEn > masReciente.creadaEn ? o : masReciente),
      undefined,
    )
  const detencionVigente = ultimaDetencionOReanudacion?.tipo === 'detener' ? ultimaDetencionOReanudacion : undefined

  const puedeDetener = tiene('detener_publicacion')
  const puedeReportar = tiene('reportar_riesgo')
  const puedeFirma = tiene('leer_entrenamiento')

  const abrir = (tipo: TipoAccion) => {
    setError(null)
    setInfo(null)
    setMotivo('')
    setAbierta(tipo)
  }

  const cancelar = () => {
    setAbierta(null)
    setMotivo('')
    setError(null)
  }

  const enviar = async () => {
    if (!abierta) return
    if (!motivo.trim()) {
      setError('Escribe el motivo antes de enviar.')
      return
    }
    if (!actorId) {
      setError('Sin sesión: no se puede enviar.')
      return
    }
    setEnviando(true)
    setError(null)
    const params = { usuarioId, semanaInicio: semanaObjetivo, motivo: motivo.trim(), actorId }
    const resultado =
      abierta === 'detener'
        ? await detenerPublicacion(params)
        : abierta === 'reportar'
          ? await reportarRiesgo(params)
          : abierta === 'reanudar'
            ? await reanudarPublicacion(params)
            : await prepararFirma(params)
    setEnviando(false)

    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setInfo(
      resultado.yaExistia
        ? abierta === 'detener'
          ? `Ya estaba detenida la semana del ${fechaLegible}.`
          : abierta === 'reportar'
            ? 'Ya habías reportado este riesgo.'
            : 'Ya se había registrado esta acción.'
        : null,
    )
    if (abierta === 'preparar_firma') {
      // Todavía no hay fila de `casos_firma`: la crea el equipo de mesa dentro de su
      // ciclo de sincronización (20 min). Mientras tanto la sección de firma queda
      // «esperando» y empieza a refrescar sola — ver el efecto más abajo.
      setEsperandoCaso(true)
      setErrorFirma(null)
      setInfoFirma(null)
    }
    setAbierta(null)
    setMotivo('')
    onOrdenCreada()
  }

  // ── Cargar el caso de firma vigente al montar / cambiar de persona o semana ───────────
  useEffect(() => {
    let vivo = true
    casosFirmaDePersona(usuarioId, semanaObjetivo).then((lista) => {
      if (!vivo) return
      const vigente = lista[0] ?? null
      setCaso(vigente)
      if (vigente) setEsperandoCaso(false)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId, semanaObjetivo])

  // ── Refrescar cada 30 s mientras el caso espera a otra parte ───────────────────────────
  useEffect(() => {
    const activo = esperandoCaso || (caso !== null && ESTADOS_QUE_REFRESCAN.has(caso.estado))
    if (!activo) return
    const intervalo = setInterval(() => {
      casosFirmaDePersona(usuarioId, semanaObjetivo).then((lista) => {
        const encontrado = lista[0] ?? null
        setCaso(encontrado)
        if (encontrado) setEsperandoCaso(false)
      })
    }, MS_REFRESCO_CASO)
    return () => clearInterval(intervalo)
  }, [esperandoCaso, caso, usuarioId, semanaObjetivo])

  const descargarCaso = async () => {
    if (!caso?.rutaDecision) return
    setDescargando(true)
    setErrorFirma(null)
    const resultado = await urlDelCaso(caso.rutaDecision)
    setDescargando(false)
    if (!resultado.ok) {
      setErrorFirma(resultado.error)
      return
    }
    window.open(resultado.url, '_blank', 'noopener,noreferrer')
  }

  const elegirArchivoFirma = (elegido: File | undefined) => {
    setErrorFirma(null)
    setInfoFirma(null)
    if (!elegido) {
      setArchivoFirma(null)
      return
    }
    const validacion = validarArchivoFirma(elegido)
    if (!validacion.ok) {
      setErrorFirma(validacion.motivo)
      setArchivoFirma(null)
      return
    }
    setArchivoFirma(elegido)
  }

  const subirYRegistrarFirma = async () => {
    if (!caso?.rutaDecision || !archivoFirma) return
    setSubiendoFirma(true)
    setErrorFirma(null)
    const subida = await subirFirma(caso.rutaDecision, archivoFirma)
    if (!subida.ok) {
      setSubiendoFirma(false)
      setErrorFirma(subida.error)
      return
    }
    const registro = await registrarFirma(caso.id)
    setSubiendoFirma(false)
    if (!registro.ok) {
      setErrorFirma(registro.error)
      return
    }
    setCaso(registro.caso)
    setArchivoFirma(null)
    setInfoFirma('Firma subida y registrada.')
  }

  const casoActivo = caso !== null && ESTADOS_CASO_ACTIVO.has(caso.estado)

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-linea pt-2.5">
      {info && <p className="text-[11px] text-tenue">{info}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {detencionVigente ? (
          <>
            <Badge tono="rojo">
              Detenida la semana del {fechaLegible} por {nombreDe(detencionVigente.actorId)} a las{' '}
              {formatoHora(detencionVigente.creadaEn)}
            </Badge>
            <button
              type="button"
              className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:cursor-not-allowed disabled:opacity-40"
              disabled={cargandoCapacidades || !puedeDetener}
              onClick={() => abrir('reanudar')}
            >
              {etiquetaBoton('reanudar', fechaLegible)}
            </button>
            {!cargandoCapacidades && !puedeDetener && (
              <span className="text-[11px] text-tenue">— hace falta la capacidad «detener publicación».</span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="tecla-3d rounded-lg border border-rojo/50 bg-rojo/10 px-3 py-1.5 text-xs font-bold text-rojo disabled:cursor-not-allowed disabled:opacity-40"
              disabled={cargandoCapacidades || !puedeDetener}
              onClick={() => abrir('detener')}
            >
              {etiquetaBoton('detener', fechaLegible)}
            </button>
            {!cargandoCapacidades && !puedeDetener && (
              <span className="text-[11px] text-tenue">— hace falta la capacidad «detener publicación».</span>
            )}
          </>
        )}

        {riesgo && (
          <Badge tono="ambar">
            Riesgo reportado por {nombreDe(riesgo.actorId)} (semana del {fechaLegible})
          </Badge>
        )}
        <button
          type="button"
          className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:cursor-not-allowed disabled:opacity-40"
          disabled={cargandoCapacidades || !puedeReportar}
          onClick={() => abrir('reportar')}
        >
          {etiquetaBoton('reportar', fechaLegible)}
        </button>
        {!cargandoCapacidades && !puedeReportar && (
          <span className="text-[11px] text-tenue">— hace falta la capacidad «reportar riesgo».</span>
        )}
      </div>

      {detencionVigente && (
        <p className="text-[11.5px] text-tenue">
          Detenida hasta que alguien con permiso la reanude: no se reanuda sola por el simple paso del tiempo.
        </p>
      )}

      {abierta && (
        <div className="rounded-lg border border-dashed border-linea bg-surface-2 p-2.5">
          <label
            className="text-[11px] font-bold uppercase tracking-wide text-tenue"
            htmlFor={`motivo-${abierta}-${usuarioId}`}
          >
            {etiquetaMotivo(abierta, fechaLegible)}
          </label>
          <textarea
            id={`motivo-${abierta}-${usuarioId}`}
            className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-rojo">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="tecla-3d rounded-lg bg-rojo px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              {enviando ? 'Enviando…' : etiquetaConfirmar(abierta)}
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              disabled={enviando}
              onClick={cancelar}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Preparar para firmar y el ciclo de descarga/subida ───────────────────────── */}
      {puedeFirma && (
        <div className="flex flex-col gap-2 border-t border-dashed border-linea pt-2.5">
          {!casoActivo && !abierta && (
            <button
              type="button"
              className="tecla-3d self-start rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:cursor-not-allowed disabled:opacity-40"
              disabled={cargandoCapacidades}
              onClick={() => abrir('preparar_firma')}
            >
              {etiquetaBoton('preparar_firma', fechaLegible)}
            </button>
          )}

          {esperandoCaso && !caso && <p className="text-[11px] text-tenue">{ETIQUETA_ESTADO_CASO.preparando}</p>}

          {caso && (
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-tenue">
                {ETIQUETA_ESTADO_CASO[caso.estado]}
                {caso.estado === 'rechazado' && caso.error ? ` ${caso.error}` : ''}
              </p>

              {caso.estado === 'listo_para_firmar' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="tecla-3d self-start rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:opacity-50"
                    disabled={descargando}
                    onClick={() => void descargarCaso()}
                  >
                    {descargando ? 'Generando enlace…' : 'Descargar el caso'}
                  </button>

                  <label
                    className="text-[11px] font-bold uppercase tracking-wide text-tenue"
                    htmlFor={`firma-${usuarioId}`}
                  >
                    Subir la firma (.sig)
                  </label>
                  {/*
                    Sin `accept=".sig"` a propósito: algunos navegadores de prueba (y
                    `@testing-library/user-event`) filtran en silencio un archivo que no
                    casa con `accept` — el usuario ni se entera de por qué no pasó nada.
                    `elegirArchivoFirma` valida y explica el motivo en la propia página.
                  */}
                  <input
                    id={`firma-${usuarioId}`}
                    type="file"
                    onChange={(e) => elegirArchivoFirma(e.target.files?.[0])}
                  />

                  <button
                    type="button"
                    className="tecla-3d self-start rounded-lg bg-verde px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    disabled={!archivoFirma || subiendoFirma}
                    onClick={() => void subirYRegistrarFirma()}
                  >
                    {subiendoFirma ? 'Subiendo…' : 'Registrar firma'}
                  </button>
                </div>
              )}

              {errorFirma && <p className="text-xs text-rojo">{errorFirma}</p>}
              {infoFirma && <p className="text-[11px] text-tenue">{infoFirma}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
