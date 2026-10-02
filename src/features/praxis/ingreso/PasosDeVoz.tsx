import { useEffect, useRef, useState, type RefObject } from 'react'
import { LINEAS_DE_AYUDA } from '../../../domain/praxis/riesgo'
import { MENSAJES_DE_BLOQUE, TURNOS_VOZ, turnosDeBloque, type CampoIngreso, type TurnoVoz } from '../../../domain/praxis/ingreso/guion'
import { guionDelTurno, preguntaDeToque, tieneDetalle, type DerivacionIngreso, type RespuestaIngreso } from '../../../domain/praxis/ingreso/prueba'
import { useMantenerParaHablar } from './useMantenerParaHablar'

/**
 * Los pasos del modo HABLANDO: un turno hablado (mantener presionado) y un toque (botones). Cada uno dice lo que
 * Praxis dice, en voz y en texto, y avisa a quien lo monta cuando termina.
 */
export type Trato2 = (tu: string, usted: string) => string
interface Habla { decir: (texto: string) => boolean; callar: () => void }

export type SalidaDeTurno =
  | { tipo: 'campos'; campos: Record<string, string | number>; toques: string[]; via: 'voz' | 'teclado'; repetidos: number }
  | { tipo: 'detenido'; via: 'voz' | 'teclado'; repetidos: number }
  | { tipo: 'saltado'; repetidos: number }

const BLOQUE_N: Record<'preciso' | 'contexto', number> = { preciso: 1, contexto: 2 }
const ROTULO_BLOQUE: Record<'preciso' | 'contexto', string> = { preciso: 'Preciso', contexto: 'Contexto' }

const MOTIVOS: Record<Extract<RespuestaIngreso, { ok: false }>['motivo'], [string, string]> = {
  no_desplegada: ['La función de Praxis todavía no está encendida para esta prueba.', 'La función de Praxis todavía no está encendida para esta prueba.'],
  sin_sesion: ['No pude comprobar tu sesión. Entra de nuevo a la app.', 'No pude comprobar su sesión. Entre de nuevo a la app.'],
  red: ['No pude conectar con Praxis. Revisa tu internet.', 'No pude conectar con Praxis. Revise su internet.'],
  limite: ['Ya hiciste muchas pruebas en esta hora. Espera un rato.', 'Ya hizo muchas pruebas en esta hora. Espere un rato.'],
  no_entendi: ['No te entendí bien. ¿Lo intentas otra vez?', 'No le entendí bien. ¿Lo intenta otra vez?'],
  frase: ['Esa respuesta no se pudo leer. ¿Lo intentas otra vez?', 'Esa respuesta no se pudo leer. ¿Lo intenta otra vez?'],
}

/** Qué hacer cuando Praxis detiene un turno por riesgo o por salud. */
function Detenido({ d, t, alRepetir, alSeguir }: { d: DerivacionIngreso; t: Trato2; alRepetir: () => void; alSeguir: () => void }) {
  const riesgo = d.riesgo
  return (
    <div className="ing-detenido" role="alert">
      {riesgo ? (
        <>
          <p>{t(
            'Gracias por decírmelo. Lo que sientes importa más que esta prueba. Si estás en peligro o piensas en hacerte daño, llama ahora.',
            'Gracias por decírmelo. Lo que siente importa más que esta prueba. Si está en peligro o piensa en hacerse daño, llame ahora.',
          )}</p>
          {riesgo.tipo === 'quieta' && (
            <ul className="ing-lineas">
              {LINEAS_DE_AYUDA[riesgo.linea].map(([numero, boton, rotulo]) => (
                <li key={numero}><a className="ing-boton" href={`tel:${numero}`}>{boton}</a><span>{rotulo}</span></li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p>{t(
          'Eso de salud te lo pregunto aparte, con sí o no. Por ahora no anoto esta respuesta: repítela sin eso, o sigue.',
          'Eso de salud se lo pregunto aparte, con sí o no. Por ahora no anoto esta respuesta: repítala sin eso, o siga.',
        )}</p>
      )}
      <p className="ing-nota">{t('Es una prueba interna: no se avisa a nadie ni se guarda nada.', 'Es una prueba interna: no se avisa a nadie ni se guarda nada.')}</p>
      <div className="ing-botones">
        <button type="button" className="ing-boton ing-boton-primario" onClick={alRepetir}>{t('Repetir esta parte', 'Repetir esta parte')}</button>
        <button type="button" className="ing-boton" onClick={alSeguir}>{t('Seguir sin esta parte', 'Seguir sin esta parte')}</button>
      </div>
    </div>
  )
}

interface PropsTurno {
  indice: number
  turno: TurnoVoz
  t: Trato2
  usted: boolean
  habla: Habla
  extraer: (turno: TurnoVoz['id'], texto: string) => Promise<RespuestaIngreso>
  alTerminar: (s: SalidaDeTurno) => void
  titulo: RefObject<HTMLHeadingElement | null>
}

export function PasoDeTurno({ indice, turno, t, usted, habla, extraer, alTerminar, titulo }: PropsTurno) {
  const [fase, setFase] = useState<'esperando' | 'enviando' | 'detenido' | 'fallo'>('esperando')
  const [oido, setOido] = useState('')
  const [via, setVia] = useState<'voz' | 'teclado'>('voz')
  const [motivo, setMotivo] = useState<Extract<RespuestaIngreso, { ok: false }>['motivo']>('red')
  const [derivacion, setDerivacion] = useState<DerivacionIngreso | null>(null)
  const [repetidos, setRepetidos] = useState(0)
  const [escribiendo, setEscribiendo] = useState(false)
  const [borrador, setBorrador] = useState('')
  const vigente = useRef(true)
  useEffect(() => { vigente.current = true; return () => { vigente.current = false } }, [])

  const guion = guionDelTurno(turno, indice, usted)
  const { disponible, escuchando, vivo, aviso, propsBoton } = useMantenerParaHablar({
    t, habilitado: fase === 'esperando' || fase === 'fallo', alTexto: (texto) => { void enviar(texto, 'voz') },
  })
  const sinVoz = !disponible
  const textoSinVoz = t('Este navegador no tiene reconocimiento de voz. Escribe tu respuesta aquí.', 'Este navegador no tiene reconocimiento de voz. Escriba su respuesta aquí.')

  // Praxis lo dice (y se ve escrito). Un efecto por turno: no toca ningún estado.
  useEffect(() => {
    habla.decir([guion.entrada, guion.bloque, guion.pregunta, guion.ejemplo && t('Por ejemplo: ', 'Por ejemplo: ') + guion.ejemplo, sinVoz ? textoSinVoz : null].filter(Boolean).join(' '))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se dice una vez por turno, no cada vez que cambia el trato o la voz
  }, [indice])

  async function enviar(texto: string, como: 'voz' | 'teclado') {
    setVia(como); setOido(texto); setFase('enviando'); setDerivacion(null)
    const r = await extraer(turno.id, texto)
    if (!vigente.current) return
    if (!r.ok) { setMotivo(r.motivo); setFase('fallo'); setRepetidos((n) => n + 1); return }
    if (r.derivada) { setDerivacion(r.derivacion); setFase('detenido'); return }
    alTerminar({ tipo: 'campos', campos: r.campos, toques: r.toques, via: como, repetidos })
  }

  const n = BLOQUE_N[turno.bloque]
  const delBloque = turnosDeBloque(turno.bloque)
  const enBloque = delBloque.findIndex((x) => x.id === turno.id) + 1
  const mostrarCampo = escribiendo || sinVoz

  return (
    <section className="ing-paso" aria-labelledby="ing-pregunta">
      <p className="ing-pista">{t(`Parte ${n} de 3`, `Parte ${n} de 3`)} · {ROTULO_BLOQUE[turno.bloque]} · {enBloque} de {delBloque.length}</p>
      {guion.entrada && <p className="ing-praxis">{guion.entrada}</p>}
      <p className={guion.bloque ? 'ing-praxis' : 'ing-praxis ing-praxis-suave'}>{MENSAJES_DE_BLOQUE[turno.bloque][usted ? 'usted' : 'tu']}</p>
      <h2 id="ing-pregunta" className="ing-pregunta" tabIndex={-1} ref={titulo}>{guion.pregunta}</h2>
      {guion.ejemplo && <p className="ing-ejemplo">{t('Por ejemplo', 'Por ejemplo')}: «{guion.ejemplo}»</p>}
      {sinVoz && <p className="ing-nota">{textoSinVoz}</p>}

      {!sinVoz && (
        <>
          <button
            type="button" className="ing-hablar" aria-pressed={escuchando}
            disabled={fase === 'enviando' || fase === 'detenido'} {...propsBoton}
          >
            <span className="ing-hablar-anillo" aria-hidden="true" />
            <span className="ing-hablar-texto">{escuchando ? t('Te escucho… suelta para enviar', 'Le escucho… suelte para enviar') : t('Mantén presionado para hablar', 'Mantenga presionado para hablar')}</span>
          </button>
          <p className="ing-vivo" role="status" aria-live="polite">{escuchando ? (vivo ? `${vivo}…` : '') : aviso}</p>
        </>
      )}

      {fase === 'enviando' && <p className="ing-estado" role="status">{t('Praxis está leyendo tu respuesta…', 'Praxis está leyendo su respuesta…')}</p>}
      {oido && fase !== 'esperando' && <p className="ing-oido">{via === 'voz' ? t('Oí', 'Oí') : t('Escribiste', 'Escribió')}: «{oido}»</p>}

      {fase === 'fallo' && (
        <div className="ing-detenido" role="alert">
          <p>{t(...MOTIVOS[motivo])}</p>
          <div className="ing-botones">
            {oido && <button type="button" className="ing-boton ing-boton-primario" onClick={() => { void enviar(oido, via) }}>{t('Intentar de nuevo', 'Intentar de nuevo')}</button>}
            <button type="button" className="ing-boton" onClick={() => alTerminar({ tipo: 'saltado', repetidos })}>{t('Seguir sin esta parte', 'Seguir sin esta parte')}</button>
          </div>
        </div>
      )}
      {fase === 'detenido' && derivacion && (
        <Detenido
          d={derivacion} t={t}
          alRepetir={() => { setRepetidos((x) => x + 1); setFase('esperando'); setOido(''); setDerivacion(null) }}
          alSeguir={() => alTerminar({ tipo: 'detenido', via, repetidos })}
        />
      )}

      {(fase === 'esperando' || fase === 'fallo') && (
        mostrarCampo ? (
          <form className="ing-escribe" onSubmit={(e) => { e.preventDefault(); const tx = borrador.trim(); if (tx) { setBorrador(''); void enviar(tx, 'teclado') } }}>
            <label htmlFor="ing-borrador" className="ing-etiqueta">{t('Tu respuesta', 'Su respuesta')}</label>
            <textarea id="ing-borrador" className="ing-entrada" rows={3} value={borrador} onChange={(e) => setBorrador(e.target.value)} />
            <button type="submit" className="ing-boton" disabled={!borrador.trim()}>{t('Enviar', 'Enviar')}</button>
          </form>
        ) : (
          <button type="button" className="ing-enlace" onClick={() => setEscribiendo(true)}>{t('Prefiero escribir esta respuesta', 'Prefiero escribir esta respuesta')}</button>
        )
      )}
      <p className="ing-pie-paso">{t('Si no sabes algo, di «no sé» y seguimos.', 'Si no sabe algo, diga «no sé» y seguimos.')} · {indice + 1} / {TURNOS_VOZ.length}</p>
    </section>
  )
}

// ───────────────────────────── Los toques ─────────────────────────────

interface PropsToque {
  campo: CampoIngreso
  /** Lo que Praxis dice antes de la primera pregunta de este grupo. */
  anuncio: string | null
  /** La voz dejó entrever algo de esto: se pregunta primero. */
  prioritario: boolean
  t: Trato2
  usted: boolean
  habla: Habla
  alResponder: (valor: string, detalle?: string) => void
  alSaltar: () => void
  titulo: RefObject<HTMLHeadingElement | null>
}

export function PasoDeToque({ campo, anuncio, prioritario, t, usted, habla, alResponder, alSaltar, titulo }: PropsToque) {
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [detalle, setDetalle] = useState('')
  const pregunta = preguntaDeToque(campo, usted)

  useEffect(() => {
    habla.decir([anuncio, pregunta].filter(Boolean).join(' '))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por pregunta
  }, [campo.id])

  // El detalle de un «sí» se dicta o se escribe en su propio campo, SIN pasar por el modelo.
  const { disponible, escuchando, vivo, aviso, propsBoton } = useMantenerParaHablar({
    t, habilitado: pendiente !== null, alTexto: (texto) => setDetalle((d) => (d ? `${d} ${texto}` : texto)),
  })

  function elegir(valor: string) {
    if (valor === 'Sí' && tieneDetalle(campo)) { setPendiente(valor); return }
    alResponder(valor)
  }

  return (
    <section className="ing-paso" aria-labelledby="ing-pregunta">
      <p className="ing-pista">{t('Parte 3 de 3', 'Parte 3 de 3')} · {campo.salud ? t('Sí o no', 'Sí o no') : t('Toques', 'Toques')}</p>
      {anuncio && <p className="ing-praxis">{anuncio}</p>}
      {prioritario && <p className="ing-nota">{t('Te oí mencionar algo de esto: contéstalo con un toque.', 'Le oí mencionar algo de esto: contéstelo con un toque.')}</p>}
      <h2 id="ing-pregunta" className="ing-pregunta" tabIndex={-1} ref={titulo}>{pregunta}</h2>
      {pendiente === null ? (
        <>
          <div className="ing-opciones ing-opciones-grandes">
            {(campo.opciones ?? []).map((o) => (
              <button key={o} type="button" className="ing-opcion" onClick={() => elegir(o)}>{o}</button>
            ))}
          </div>
          <button type="button" className="ing-enlace" onClick={alSaltar}>{t('No sé', 'No sé')}</button>
        </>
      ) : (
        <div className="ing-detalle">
          <label className="ing-etiqueta" htmlFor="ing-detalle">{t('¿Cuál? Escríbelo o díctalo. No pasa por Praxis.', '¿Cuál? Escríbalo o díctelo. No pasa por Praxis.')}</label>
          <textarea id="ing-detalle" className="ing-entrada" rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          {disponible && (
            <>
              <button type="button" className="ing-boton" aria-pressed={escuchando} {...propsBoton}>
                {escuchando ? t('Te escucho… suelta', 'Le escucho… suelte') : t('Mantén presionado para dictar', 'Mantenga presionado para dictar')}
              </button>
              <p className="ing-vivo" role="status" aria-live="polite">{escuchando ? (vivo ? `${vivo}…` : '') : aviso}</p>
            </>
          )}
          <button type="button" className="ing-boton ing-boton-primario" onClick={() => alResponder(pendiente, detalle.trim())}>{t('Continuar', 'Continuar')}</button>
        </div>
      )}
    </section>
  )
}
