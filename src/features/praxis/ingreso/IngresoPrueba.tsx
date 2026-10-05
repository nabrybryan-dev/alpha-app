import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FRASES_DE_PASO, MENSAJES_DE_BLOQUE, TURNOS_VOZ, type TurnoId } from '../../../domain/praxis/ingreso/guion'
import {
  TOQUES_DE_SALUD, TOQUES_RAPIDOS, armarResultado, detenerCronometro, formatoTiempo, idDetalle, iniciarCronometro, pasarASegmento,
  siguienteToque, valoresDeExtraccion,
  type ConteosDeTurnos, type Cronometro, type ModoPrueba, type RespuestaIngreso, type ResultadoModo, type Valores,
} from '../../../domain/praxis/ingreso/prueba'
import type { Trato } from '../motor/entorno'
import { FormularioIngreso } from './FormularioIngreso'
import { PasoDeToque, PasoDeTurno, type SalidaDeTurno } from './PasosDeVoz'
import { ResultadoPrueba } from './ResultadoPrueba'
import { useHablaDePraxis } from './useHablaDePraxis'

/**
 * /praxis/ingreso-prueba: la PRUEBA con cronómetro del cuestionario de ingreso (Bryan, 2-oct-2026). El equipo lo
 * llena HABLANDO con Praxis y ESCRIBIENDO, y se compara cuánto tarda cada forma.
 *
 * Nada se guarda: ni en la base ni en el navegador. Lo hablado lo convierte en texto el reconocimiento de voz del
 * teléfono (Google o Apple) y Praxis solo recibe el texto, que la función `praxis-registro` etiqueta (`accion:
 * 'ingreso'`) sin guardar nada. El resultado se muestra en pantalla y «Copiar resultado» saca un texto con SOLO
 * tiempos y conteos.
 *
 * El cronómetro empieza al tocar el modo y para en «Confirmar». Hablando se parte en cuatro: preciso, contexto,
 * sí o no (con las pocas opciones cerradas que no son de salud) y revisión.
 */
type Etapa = 'inicio' | 'turnos' | 'toques' | 'revision' | 'escribir' | 'resultado'

export interface PropsIngresoPrueba {
  trato: Trato
  /** A dónde lleva «Salir». */
  salida: string
  /** Un turno hablado a la función, ya con la sesión puesta. */
  extraer: (turno: TurnoId, texto: string) => Promise<RespuestaIngreso>
  /** Reloj en milisegundos. Por defecto `performance.now`; las pruebas pasan uno propio. */
  reloj?: () => number
}

const relojReal = (): number => performance.now()
const SIN_CONTEOS: ConteosDeTurnos = { porVoz: 0, porTeclado: 0, repetidos: 0, detenidos: 0 }

const grupoDe = (id: string): 'rapidas' | 'si_no' => (TOQUES_RAPIDOS.includes(id) ? 'rapidas' : 'si_no')

export function IngresoPrueba({ trato, salida, extraer, reloj = relojReal }: PropsIngresoPrueba) {
  const usted = trato === 'usted'
  const t = (tu: string, us: string): string => (usted ? us : tu)
  const habla = useHablaDePraxis()
  const titulo = useRef<HTMLHeadingElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [crono, setCrono] = useState<Cronometro | null>(null)
  const [ahora, setAhora] = useState(0)
  const [valores, setValores] = useState<Valores>({})
  const [alLlegar, setAlLlegar] = useState<Valores | null>(null)
  const [turnoIdx, setTurnoIdx] = useState(0)
  const [saltados, setSaltados] = useState<ReadonlySet<string>>(new Set())
  const [prioritarios, setPrioritarios] = useState<string[]>([])
  const [anunciados, setAnunciados] = useState<ReadonlySet<string>>(new Set())
  const [conteos, setConteos] = useState<ConteosDeTurnos>(SIN_CONTEOS)
  const [resultados, setResultados] = useState<{ voz: ResultadoModo | null; escribir: ResultadoModo | null }>({ voz: null, escribir: null })

  // El reloj de la pantalla: solo corre mientras el cronómetro corre.
  const corriendo = crono !== null && crono.fin === null
  useEffect(() => {
    if (!corriendo) return
    const id = window.setInterval(() => setAhora(reloj()), 250)
    return () => window.clearInterval(id)
  }, [corriendo, reloj])

  const sumarConteo = (c: Partial<ConteosDeTurnos>) => setConteos((x) => ({
    porVoz: x.porVoz + (c.porVoz ?? 0), porTeclado: x.porTeclado + (c.porTeclado ?? 0),
    repetidos: x.repetidos + (c.repetidos ?? 0), detenidos: x.detenidos + (c.detenidos ?? 0),
  }))

  function empezar(modo: ModoPrueba) {
    habla.callar()
    const ya = reloj()
    setCrono(iniciarCronometro(modo, ya)); setAhora(ya)
    setValores({}); setAlLlegar(null); setTurnoIdx(0); setSaltados(new Set()); setPrioritarios([]); setAnunciados(new Set()); setConteos(SIN_CONTEOS)
    setEtapa(modo === 'voz' ? 'turnos' : 'escribir')
  }

  function aSegmento(segmento: Parameters<typeof pasarASegmento>[1]) {
    const ya = reloj()
    setCrono((c) => (c ? pasarASegmento(c, segmento, ya) : c))
  }

  function aLaRevision(final: Valores) {
    setAlLlegar(final)
    aSegmento('revision')
    setEtapa('revision')
    habla.decir(FRASES_DE_PASO.aRevision[usted ? 'usted' : 'tu'])
  }

  function terminarTurno(s: SalidaDeTurno) {
    const conteo: Partial<ConteosDeTurnos> = { repetidos: s.repetidos }
    let nuevos = valores
    if (s.tipo === 'campos') {
      nuevos = { ...valores, ...valoresDeExtraccion(s.campos) }
      setValores(nuevos)
      setPrioritarios((p) => [...new Set([...p, ...s.toques])])
      if (s.via === 'voz') conteo.porVoz = 1; else conteo.porTeclado = 1
    } else if (s.tipo === 'detenido') conteo.detenidos = 1
    sumarConteo(conteo)

    if (turnoIdx + 1 < TURNOS_VOZ.length) {
      aSegmento(TURNOS_VOZ[turnoIdx + 1].bloque)
      setTurnoIdx(turnoIdx + 1)
      return
    }
    aSegmento('sino')
    if (!siguienteToque(TOQUES_RAPIDOS, nuevos, saltados) && !siguienteToque(TOQUES_DE_SALUD, nuevos, saltados)) aLaRevision(nuevos)
    else setEtapa('toques')
  }

  function despuesDeUnToque(nuevos: Valores, saltadosAhora: ReadonlySet<string>, grupo: string) {
    setAnunciados((a) => new Set([...a, grupo]))
    if (siguienteToque(TOQUES_RAPIDOS, nuevos, saltadosAhora) || siguienteToque(TOQUES_DE_SALUD, nuevos, saltadosAhora, prioritarios)) return
    aLaRevision(nuevos)
  }

  function responderToque(id: string, valor: string, detalle?: string) {
    const nuevos = { ...valores, [id]: valor, ...(detalle ? { [idDetalle(id)]: detalle } : {}) }
    setValores(nuevos)
    despuesDeUnToque(nuevos, saltados, grupoDe(id))
  }

  function saltarToque(id: string) {
    const s = new Set([...saltados, id])
    setSaltados(s)
    despuesDeUnToque(valores, s, grupoDe(id))
  }

  function confirmar() {
    if (!crono) return
    const fin = detenerCronometro(crono, reloj())
    const r = armarResultado({
      cronometro: fin, final: valores, alLlegarALaRevision: alLlegar ?? undefined, turnos: fin.modo === 'voz' ? conteos : undefined,
    })
    setCrono(fin)
    setResultados((x) => ({ ...x, [fin.modo]: r }))
    habla.callar()
    setEtapa('resultado')
  }

  function reiniciar() {
    habla.callar()
    setCrono(null); setValores({}); setAlLlegar(null); setResultados({ voz: null, escribir: null }); setTurnoIdx(0); setEtapa('inicio')
  }

  const cambiar = (id: string, valor: string) => setValores((v) => ({ ...v, [id]: valor }))
  const transcurrido = crono ? formatoTiempo(Math.max(0, (crono.fin ?? ahora) - crono.inicio)) : null

  // El toque que toca ahora: primero las opciones rápidas, después las de salud.
  const toque = etapa === 'toques'
    ? (siguienteToque(TOQUES_RAPIDOS, valores, saltados) ?? siguienteToque(TOQUES_DE_SALUD, valores, saltados, prioritarios))
    : null

  // Al cambiar de paso, el foco va al título nuevo (y un lector de pantalla lo lee). En el inicio no se roba el foco.
  const clavePaso = `${etapa}-${turnoIdx}-${toque?.id ?? ''}`
  useEffect(() => { if (etapa !== 'inicio') titulo.current?.focus({ preventScroll: false }) }, [clavePaso, etapa])

  return (
    <div className="praxis ingreso">
      <main className="ing-app">
        <header className="ing-top">
          <Link className="ing-salir" to={salida}>{t('Salir', 'Salir')}</Link>
          {transcurrido !== null && etapa !== 'resultado' && (
            <p className="ing-reloj" role="timer" aria-label={`Tiempo: ${transcurrido}`}><span aria-hidden="true">{transcurrido}</span></p>
          )}
          <button type="button" className="ing-voz" aria-pressed={habla.activa} onClick={habla.alternar}>
            {habla.activa ? t('Voz de Praxis: sí', 'Voz de Praxis: sí') : t('Voz de Praxis: no', 'Voz de Praxis: no')}
          </button>
        </header>
        <h1 className="ing-h1">{t('Prueba de ingreso', 'Prueba de ingreso')}</h1>

        {etapa === 'inicio' && (
          <section aria-labelledby="ing-inicio">
            <h2 id="ing-inicio" className="ing-h2" tabIndex={-1} ref={titulo}>{t('Hablando o escribiendo', 'Hablando o escribiendo')}</h2>
            <p className="ing-aviso">
              {t(
                'Prueba interna. Nada se guarda. Lo que digas se convierte en texto con el reconocimiento de voz de tu teléfono (Google o Apple) y Praxis solo recibe el texto.',
                'Prueba interna. Nada se guarda. Lo que diga se convierte en texto con el reconocimiento de voz de su teléfono (Google o Apple) y Praxis solo recibe el texto.',
              )}
            </p>
            <p className="ing-nota">
              {t(
                'Elige cómo llenar el cuestionario. El tiempo empieza cuando tocas y para cuando confirmas. Puedes hacer los dos, uno después del otro.',
                'Elija cómo llenar el cuestionario. El tiempo empieza cuando toca y para cuando confirma. Puede hacer los dos, uno después del otro.',
              )}
            </p>
            <div className="ing-botones">
              <button type="button" className="ing-boton ing-boton-primario" onClick={() => empezar('voz')}>{t('Hablando', 'Hablando')}</button>
              <button type="button" className="ing-boton ing-boton-primario" onClick={() => empezar('escribir')}>{t('Escribiendo', 'Escribiendo')}</button>
            </div>
          </section>
        )}

        {etapa === 'turnos' && (
          <PasoDeTurno
            key={turnoIdx} indice={turnoIdx} turno={TURNOS_VOZ[turnoIdx]} t={t} usted={usted} habla={habla}
            extraer={extraer} alTerminar={terminarTurno} titulo={titulo}
          />
        )}

        {etapa === 'toques' && toque && (
          <PasoDeToque
            key={toque.id} campo={toque} t={t} usted={usted} habla={habla} titulo={titulo}
            anuncio={anunciados.has(grupoDe(toque.id)) ? null : grupoDe(toque.id) === 'rapidas'
              ? FRASES_DE_PASO.aToques[usted ? 'usted' : 'tu']
              : MENSAJES_DE_BLOQUE.si_no[usted ? 'usted' : 'tu']}
            prioritario={prioritarios.includes(toque.id)}
            alResponder={(v, d) => responderToque(toque.id, v, d)} alSaltar={() => saltarToque(toque.id)}
          />
        )}

        {(etapa === 'revision' || etapa === 'escribir') && (
          <section aria-labelledby="ing-revision">
            <h2 id="ing-revision" className="ing-h2" tabIndex={-1} ref={titulo}>
              {etapa === 'revision' ? t('Revisa tu formulario', 'Revise su formulario') : t('Llénalo a mano', 'Llénelo a mano')}
            </h2>
            <p className="ing-nota">
              {etapa === 'revision'
                ? FRASES_DE_PASO.aRevision[usted ? 'usted' : 'tu']
                : t('Todo a mano. Lo que no sepas, déjalo vacío. No se envía nada hasta que confirmes.', 'Todo a mano. Lo que no sepa, déjelo vacío. No se envía nada hasta que confirme.')}
            </p>
            <FormularioIngreso valores={valores} alCambiar={cambiar} t={t} marcarVacios={etapa === 'revision'} />
            <div className="ing-botones">
              <button type="button" className="ing-boton ing-boton-primario ing-confirmar" onClick={confirmar}>{t('Confirmar', 'Confirmar')}</button>
            </div>
          </section>
        )}

        {etapa === 'resultado' && (
          <section aria-labelledby="ing-resultado-t">
            <h2 id="ing-resultado-t" className="ing-sr" tabIndex={-1} ref={titulo}>{t('Resultado', 'Resultado')}</h2>
            <ResultadoPrueba
              voz={resultados.voz} escribir={resultados.escribir} t={t}
              alProbarOtro={(modo) => empezar(modo)} alReiniciar={reiniciar}
            />
          </section>
        )}
      </main>
    </div>
  )
}
