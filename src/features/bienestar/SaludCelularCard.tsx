import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import {
  generarCodigoAtajo,
  leerEstadoSalud,
  otorgarPermisoE,
  revocarCodigoAtajo,
  revocarPermisoE,
  type EstadoSalud,
  type Motivo,
} from '../../data/salud/saludCelular'
import {
  ALCANCE_CASILLA_E,
  DATOS_CASILLA_E,
  DECLARACION,
  FECHA_VERSION_AUTORIZACION,
  TEXTO_CASILLA_E,
  VERSION_AUTORIZACION,
} from '../../domain/interesados/formulario'
import { ENLACE_ATAJO_ICLOUD, esEnlaceDeIcloud, plataformaDe, type Plataforma } from '../../domain/salud/atajo'

/**
 * SALUD DE TU CELULAR (Fase A, migración 0093): la casilla E, el código del atajo y el enlace.
 *
 * Decisiones de Bryan (28-sep): iPhone con un Atajo de Apple que manda un resumen al día;
 * Android con registro a mano en el check-in (el atajo no existe allí); permiso con una casilla
 * E nueva y específica para los seis datos, SIN marcar de antemano, revocable (Ley 1581).
 *
 * TRES COSAS QUE ESTA PANTALLA NO HACE, A PROPÓSITO:
 *   - No se pinta hasta que la base responde (`salud_estado`). Si la migración 0093 todavía no
 *     está aplicada, o no hay nube, no aparece nada: mejor no enseñar un botón que no puede
 *     funcionar. Así el código puede llegar antes que la migración sin romper Bienestar.
 *   - No guarda el código en ningún sitio. Vive en el estado de este componente el rato que
 *     la persona lo copia y se pierde al salir: en la base solo queda su hash.
 *   - No genera el código sin el permiso: sin la E no hay botón, y la base lo rechazaría igual.
 *
 * El texto de la casilla, su alcance y la declaración salen de `domain/interesados/formulario`,
 * los mismos que el formulario público: un solo texto firmado, una sola versión.
 */

const ESTILO_BOTON = 'press rounded-full px-4 py-2 font-display text-xs disabled:opacity-40'
const BOTON_PRINCIPAL = `${ESTILO_BOTON} btn-cristal-rojo`
const BOTON_SECUNDARIO = `${ESTILO_BOTON} border border-linea bg-surface-2 text-texto`

const MENSAJE_DE_ERROR: Record<Motivo, string> = {
  sin_nube: 'Esta función necesita conexión. Vuelve a intentarlo cuando la tengas.',
  sin_permiso: 'Primero tienes que autorizar la casilla E.',
  error: 'No se pudo. Vuelve a intentarlo en un momento.',
}

function fechaLarga(iso: string | null): string {
  if (!iso) return ''
  const f = new Date(iso)
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fechaYHora(iso: string | null): string {
  if (!iso) return ''
  const f = new Date(iso)
  return Number.isNaN(f.getTime())
    ? ''
    : f.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

interface SaludCelularCardProps {
  /** Solo para pruebas: por defecto se deduce del teléfono. */
  plataforma?: Plataforma
  /** Solo para pruebas: por defecto, el enlace de iCloud de `domain/salud/atajo`. */
  enlaceDelAtajo?: string
}

export function SaludCelularCard({ plataforma: plataformaPropia, enlaceDelAtajo = ENLACE_ATAJO_ICLOUD }: SaludCelularCardProps) {
  const plataforma =
    plataformaPropia ?? plataformaDe(navigator.userAgent, (navigator as { maxTouchPoints?: number }).maxTouchPoints ?? 0)

  // undefined = todavía leyendo · null = sin nube o la base no respondió (no se pinta nada)
  const [estado, setEstado] = useState<EstadoSalud | null | undefined>(undefined)
  const [autoriza, setAutoriza] = useState(false)
  const [declara, setDeclara] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [revocando, setRevocando] = useState(false)
  const [borrar, setBorrar] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Si la relectura falla NO se borra lo que ya se sabe: la pantalla no puede desaparecer a
  // mitad de un flujo (con el código recién generado a la vista, por ejemplo).
  const cargar = useCallback(async () => {
    const nuevo = await leerEstadoSalud()
    if (nuevo) setEstado(nuevo)
  }, [])

  useEffect(() => {
    // En Android no hay atajo: no hace falta ni preguntarle a la base.
    if (plataforma === 'android') return
    let vivo = true
    void leerEstadoSalud().then((e) => {
      if (vivo) setEstado(e)
    })
    return () => {
      vivo = false
    }
  }, [plataforma])

  if (plataforma === 'android') {
    return (
      <Card>
        <p className="text-sm font-bold text-texto">Salud de tu celular</p>
        <p className="mt-1 text-xs text-tenue">
          El atajo de Alpha solo funciona en iPhone. En Android, anota tus pasos, tu sueño y tu peso a
          mano en el check-in de arriba: es lo que tu coach lee cada mañana.
        </p>
      </Card>
    )
  }

  if (!estado) return null

  const fallar = (motivo: Motivo) => setError(MENSAJE_DE_ERROR[motivo])

  const autorizar = async () => {
    setOcupado(true)
    setError(null)
    setAviso(null)
    const r = await otorgarPermisoE()
    setOcupado(false)
    if (!r.ok) return fallar(r.motivo)
    setAutoriza(false)
    setDeclara(false)
    await cargar()
  }

  const generar = async () => {
    setOcupado(true)
    setError(null)
    setAviso(null)
    setCambiando(false)
    const r = await generarCodigoAtajo()
    setOcupado(false)
    if (!r.ok) return fallar(r.motivo)
    setCodigo(r.codigo)
    setCopiado(false)
    await cargar()
  }

  const quitarCodigo = async () => {
    setOcupado(true)
    setError(null)
    const r = await revocarCodigoAtajo()
    setOcupado(false)
    if (!r.ok) return fallar(r.motivo)
    setCodigo(null)
    setAviso('Listo: ese código ya no funciona. Puedes generar otro cuando quieras.')
    await cargar()
  }

  const revocar = async () => {
    setOcupado(true)
    setError(null)
    const r = await revocarPermisoE(borrar)
    setOcupado(false)
    if (!r.ok) return fallar(r.motivo)
    setCodigo(null)
    setRevocando(false)
    setBorrar(true)
    setAviso(
      `Listo: revocaste tu permiso. Tu código ya no funciona${
        r.muestrasBorradas > 0 ? ` y borramos ${r.muestrasBorradas} datos que ya habías enviado` : ''
      }. Puedes borrar el atajo de tu iPhone.`,
    )
    await cargar()
  }

  const copiar = async () => {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
    } catch {
      setError('No se pudo copiar. Mantén el dedo sobre el código y elige «Copiar».')
    }
  }

  const enlaceValido = esEnlaceDeIcloud(enlaceDelAtajo)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-texto">Salud de tu celular</p>
        {estado.permiso && <Badge tono="verde">Permiso activo</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-tenue">
        Opcional. Si quieres, tu iPhone le manda a Alpha un resumen al día de seis datos de tu app Salud
        (los ves abajo) para que tu coach ajuste tu plan. Si no lo activas, sigues igual con tu check-in.
      </p>

      {aviso && (
        <p role="status" className="mt-3 rounded-tag border border-linea bg-surface-2 p-2.5 text-xs text-texto">
          {aviso}
        </p>
      )}

      {!estado.permiso ? (
        <div className="mt-3 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs text-texto">
              <span className="font-bold">E.</span> {TEXTO_CASILLA_E}
            </legend>
            <ul aria-label="Los seis datos" className="ml-4 list-disc text-xs text-tenue">
              {DATOS_CASILLA_E.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="text-[11px] leading-snug text-tenue">{ALCANCE_CASILLA_E}</p>
            <div role="group" aria-label="Casilla E">
              <Chip etiqueta="Sí, lo autorizo" seleccionado={autoriza} onSeleccionar={() => setAutoriza((v) => !v)} />
            </div>
          </fieldset>
          <div role="group" aria-label="Declaración">
            <Chip etiqueta="Acepto la declaración" seleccionado={declara} onSeleccionar={() => setDeclara((v) => !v)} />
            <p className="mt-2 text-[11px] leading-snug text-tenue">{DECLARACION}</p>
          </div>
          <p className="text-[11px] text-tenue">
            Versión del texto: {VERSION_AUTORIZACION} ({FECHA_VERSION_AUTORIZACION}) · Canal: app
          </p>
          <button
            type="button"
            onClick={() => void autorizar()}
            disabled={!autoriza || !declara || ocupado}
            className={`${BOTON_PRINCIPAL} w-full py-2.5`}
          >
            {ocupado ? 'Guardando…' : 'Autorizar'}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-[11px] text-tenue">
            Autorizaste esto el {fechaLarga(estado.permisoDesde) || 'día que lo marcaste'} (texto {VERSION_AUTORIZACION}).
            Lo ven tu coach y el equipo de Alpha con acceso a entrenamiento.
          </p>

          {codigo ? (
            <div className="rounded-tag border border-rojo/40 bg-rojo/10 p-3">
              <p className="text-xs font-bold text-texto">Tu código del atajo</p>
              <code
                aria-label="Tu código"
                className="mt-1.5 block select-all break-all rounded-tag bg-surface-2 p-2 text-sm font-bold text-texto"
              >
                {codigo}
              </code>
              <p className="mt-1.5 text-[11px] leading-snug text-tenue">
                Solo se muestra esta vez. Cópialo ahora y pégalo cuando el atajo te lo pida. Si lo pierdes, generas
                otro y el anterior deja de funcionar.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void copiar()} className={BOTON_PRINCIPAL}>
                  {copiado ? 'Copiado ✓' : 'Copiar'}
                </button>
                <button type="button" onClick={() => setCodigo(null)} className={BOTON_SECUNDARIO}>
                  Ya lo guardé
                </button>
              </div>
            </div>
          ) : estado.codigoActivo ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-texto">
                Tu atajo tiene un código activo desde {fechaLarga(estado.codigoCreadoEn) || 'hace poco'}.
              </p>
              <p className="text-[11px] text-tenue">
                {estado.codigoUltimoUsoEn
                  ? `Último envío: ${fechaYHora(estado.codigoUltimoUsoEn)}.`
                  : 'Todavía no ha llegado ningún envío.'}
                {estado.ultimaMuestra ? ` Último día con datos: ${estado.ultimaMuestra}.` : ''}
              </p>
              {cambiando ? (
                <div className="rounded-tag border border-linea bg-surface-2 p-2.5">
                  <p className="text-xs text-texto">
                    El código anterior dejará de funcionar y tendrás que pegar el nuevo en el atajo. ¿Seguimos?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void generar()} disabled={ocupado} className={BOTON_PRINCIPAL}>
                      Sí, generar otro
                    </button>
                    <button type="button" onClick={() => setCambiando(false)} className={BOTON_SECUNDARIO}>
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setCambiando(true)} className={BOTON_SECUNDARIO}>
                    Generar otro código
                  </button>
                  <button type="button" onClick={() => void quitarCodigo()} disabled={ocupado} className={BOTON_SECUNDARIO}>
                    Quitar el código
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => void generar()} disabled={ocupado} className={`${BOTON_PRINCIPAL} w-full py-2.5`}>
              {ocupado ? 'Generando…' : 'Generar mi código'}
            </button>
          )}

          <div>
            <p className="text-xs font-bold text-texto">Cómo se activa en tu iPhone</p>
            <ol className="ml-4 mt-1 list-decimal text-xs text-tenue">
              <li>Genera tu código y cópialo.</li>
              <li>Abre el atajo desde tu iPhone y toca «Obtener atajo».</li>
              <li>Cuando el atajo te pida el código, pégalo.</li>
              <li>Acepta el acceso a Salud y deja activada la automatización diaria.</li>
            </ol>
            {enlaceValido ? (
              <a
                href={enlaceDelAtajo}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BOTON_SECUNDARIO} mt-2 inline-block`}
              >
                Abrir el atajo
              </a>
            ) : (
              <p className="mt-2 text-[11px] text-tenue">
                El atajo todavía no está publicado. Cuando esté listo, el botón para abrirlo aparecerá aquí.
              </p>
            )}
          </div>

          {revocando ? (
            <div className="rounded-tag border border-linea bg-surface-2 p-3">
              <p className="text-xs font-bold text-texto">Revocar mi permiso</p>
              <p className="mt-1 text-[11px] leading-snug text-tenue">
                Dejamos de leer tus datos y tu código se apaga al instante. Puedes volver a autorizar cuando quieras.
              </p>
              <div className="mt-2">
                <Chip
                  etiqueta="Borrar también los datos que ya envié"
                  seleccionado={borrar}
                  onSeleccionar={() => setBorrar((v) => !v)}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void revocar()} disabled={ocupado} className={BOTON_PRINCIPAL}>
                  {ocupado ? 'Revocando…' : 'Revocar'}
                </button>
                <button type="button" onClick={() => setRevocando(false)} className={BOTON_SECUNDARIO}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRevocando(true)}
              className="self-start text-[11px] font-bold text-tenue underline"
            >
              Revocar mi permiso
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[11px] leading-snug text-rojo">
          {error}
        </p>
      )}
    </Card>
  )
}
