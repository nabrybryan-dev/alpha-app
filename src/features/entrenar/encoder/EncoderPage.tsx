import { useMemo, useRef, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { gLocal } from './nucleo/analisis'
import { useCaptura, type Ajustes, type Resultado } from './useCaptura'
import {
  aCsv,
  anadirATanda,
  CLAVE_TANDA,
  criteriosDeLaTanda,
  leerTanda,
  pvDeReferencia,
  type Medicion,
  type Modo,
  type Referencia,
} from './tanda'


/**
 * Una lectura del instrumento. Tipografía tabular: si los números bailan de
 * ancho al cambiar de cifra no se leen de reojo, y así es como se leen aquí
 * —el teléfono en el trípode y tú a tres metros.
 *
 * `principal` marca las tres que deciden si la toma sirve: fps, marcas y
 * ángulo. Las demás son diagnóstico, y enseñarlas al mismo tamaño hacía que las
 * que mandan se perdieran entre ellas.
 */
function Medida({
  nombre,
  valorRef,
  inicial = '—',
  principal = false,
}: {
  nombre: string
  valorRef: React.RefObject<HTMLElement | null>
  inicial?: string
  principal?: boolean
}) {
  return (
    <span className={`flex flex-col ${principal ? 'gap-0.5' : 'gap-0'}`}>
      <span
        className={`uppercase tracking-[0.14em] text-white/40 ${
          principal ? 'text-[9px]' : 'text-[8px]'
        }`}
      >
        {nombre}
      </span>
      <b
        ref={valorRef as React.RefObject<HTMLSpanElement>}
        className={`font-mono tabular-nums leading-none text-white ${
          principal ? 'text-lg' : 'text-xs font-normal text-white/70'
        }`}
      >
        {inicial}
      </b>
    </span>
  )
}

function Campo({
  etiqueta,
  children,
  ancho = 'w-full',
}: {
  etiqueta: string
  children: React.ReactNode
  ancho?: string
}) {
  return (
    <label className={`flex flex-col gap-1 ${ancho}`}>
      <span className="text-[11px] uppercase tracking-wide text-tenue">{etiqueta}</span>
      {children}
    </label>
  )
}

const claseEntrada =
  'min-h-11 rounded-xl border border-linea bg-surface-2 px-3 text-sm text-texto ' +
  'outline-none focus:border-rojo/60'

export default function EncoderPage() {
  const [referencia, setReferencia] = useState<Referencia>('diana4')
  const [modo, setModo] = useState<Modo>('serie')
  const [dianaW, setDianaW] = useState(140)
  const [dianaH, setDianaH] = useState(220)
  const [sepMm, setSepMm] = useState(400)
  const [diametroMm, setDiametroMm] = useState(450)
  const [tolTono, setTolTono] = useState(22)
  const [sentido, setSentido] = useState<'subir' | 'bajar'>('subir')
  const [lat, setLat] = useState(4.534)
  const [alt, setAlt] = useState(1480)

  const [ejercicio, setEjercicio] = useState('')
  const [cargaKg, setCargaKg] = useState('')
  const [repsReales, setRepsReales] = useState('')
  const [vRef, setVRef] = useState('')
  const [vRefUltima, setVRefUltima] = useState('')
  const [nota, setNota] = useState('')

  const [tanda, setTanda] = useState<Medicion[]>(leerTanda)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)

  const gRef = useMemo(() => gLocal(lat, alt), [lat, alt])

  const ajustes: Ajustes = {
    referencia,
    dianaMm: [dianaW, dianaH],
    sepMm,
    diametroMm,
    tolTono,
    sentido,
    modo,
    gRef,
  }

  // Los nodos vivos son de la pantalla, que es quien los pinta. El hook solo
  // los escribe desde el bucle de captura.
  const videoRef = useRef<HTMLVideoElement>(null)
  const capaRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLElement>(null)
  const pixelesRef = useRef<HTMLElement>(null)
  const marcasRef = useRef<HTMLElement>(null)
  const escalaRef = useRef<HTMLElement>(null)
  const anguloRef = useRef<HTMLElement>(null)
  const muestrasRef = useRef<HTMLElement>(null)
  const relojRef = useRef<HTMLElement>(null)

  const captura = useCaptura(ajustes, {
    video: videoRef,
    capa: capaRef,
    medidas: {
      fps: fpsRef,
      pixeles: pixelesRef,
      marcas: marcasRef,
      separacion: escalaRef,
      angulo: anguloRef,
      muestras: muestrasRef,
      reloj: relojRef,
    },
  })
  const { resultado } = captura

  function alTocarVisor(ev: React.MouseEvent<HTMLCanvasElement>) {
    const capa = ev.currentTarget
    // El lienzo se procesa a 640 px pero se ve al ancho que sea: sin esta regla
    // de tres, tocar la marca fijaría el color de otro sitio de la imagen.
    const r = capa.getBoundingClientRect()
    const x = Math.round(((ev.clientX - r.left) / r.width) * capa.width)
    const y = Math.round(((ev.clientY - r.top) / r.height) * capa.height)
    captura.fijarEn(x, y)
  }

  const guardar = () => {
    if (!resultado) return
    const { sAnadidos, sMaquina } = captura.cronometro()
    const serie = resultado.tipo === 'serie' && resultado.datos.ok ? resultado.datos : null
    const gravedad = resultado.tipo === 'gravedad' && resultado.datos.ok ? resultado.datos : null
    const numero = (t: string) => (t.trim() === '' ? undefined : Number(t))
    const vRefN = numero(vRef)
    const vRefUltimaN = numero(vRefUltima)

    const fila: Medicion = {
      fecha: new Date().toISOString(),
      modo,
      ejercicio: ejercicio.trim(),
      cargaKg: numero(cargaKg),
      repsReales: numero(repsReales),
      repsDetectadas: serie ? serie.reps.length : 0,
      vPrimera: serie?.vPrimera,
      vUltima: serie?.vUltima,
      vRef: vRefN,
      vRefUltima: vRefUltimaN,
      pvPct: serie?.pvPct,
      pvRefPct: pvDeReferencia(vRefN, vRefUltimaN),
      fpsReal: serie?.fpsReal ?? gravedad?.fpsReal,
      unidad: serie?.unidad,
      calidad: serie
        ? serie.calidad.nivel
        : gravedad
          ? gravedad.veredicto === 'VERDE'
            ? 'buena'
            : gravedad.veredicto === 'DUDOSA'
              ? 'dudosa'
              : 'descartada'
          : 'descartada',
      motivos: serie ? serie.calidad.motivos.join('|') : (gravedad?.avisos.join('|') ?? ''),
      aceleracion: gravedad?.aceleracion,
      errorPct: gravedad?.errorPct,
      sAnadidos,
      sMaquina,
      nota: nota.trim(),
    }

    setTanda(anadirATanda(fila))
    // Lo que cambia de una serie a la siguiente se limpia; ejercicio y carga se
    // quedan puestos, que es como se encadena una tanda de verdad.
    setNota('')
    setRepsReales('')
    setVRef('')
    setVRefUltima('')
  }

  const exportar = () => {
    const csv = aCsv(tanda)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `fase2-encoder-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const vaciar = () => {
    if (!window.confirm('¿Vaciar la tanda? Exporta el CSV antes si no lo has hecho.')) return
    setTanda([])
    localStorage.removeItem(CLAVE_TANDA)
  }

  const criterios = criteriosDeLaTanda(tanda)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Encoder de cámara</h1>
          <Badge tono="ambar">fase 2</Badge>
        </div>
        <p className="text-sm text-tenue">
          Mide velocidad de barra con la cámara del teléfono. Está aquí para{' '}
          <b className="text-texto">probar el protocolo en el gimnasio</b>, no para asesorar.
        </p>
      </header>

      {/* Este aviso no se puede cerrar a propósito. La prueba de gravedad es la
          que valida escala y tiempos, y hasta que apruebe cualquier cifra de
          aquí es creíble sin ser cierta — que es el modo de fallo peligroso. */}
      <div className="rounded-panel border border-ambar/40 bg-ambar/10 p-3">
        <p className="text-sm text-texto">
          <b className="text-ambar">Números provisionales.</b> La prueba de gravedad todavía no ha
          aprobado, así que estos valores sirven para juzgar <i>la herramienta</i> — si detecta, si
          estorba, cuánto tarda— y no para decidir cargas de nadie.
        </p>
      </div>

      {/* El instrumento. Va oscuro en los dos temas y a sangre dentro de su
          marco: no es una tarjeta más del panel, es el aparato que miras a tres
          metros con el teléfono en el trípode. Tratarlo como al resto de
          tarjetas era lo que lo hacía desaparecer entre ellas. */}
      <section className="overflow-hidden rounded-panel border border-white/10 bg-[#0a0a0a] shadow-lg">
        <div className="relative bg-black" style={{ aspectRatio: '4 / 3' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-contain"
          />
          <canvas
            ref={capaRef}
            onClick={alTocarVisor}
            className="absolute inset-0 h-full w-full"
          />
          {!captura.camaraAbierta && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="px-8 text-center text-sm text-white/50">
                Abre la cámara y toca una marca para fijar su color.
              </p>
            </div>
          )}
          {captura.grabando && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rojo" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-white">
                grabando
              </span>
            </div>
          )}
        </div>

        {/* Las tres que deciden si la toma sirve, grandes; el resto, de apoyo.
            Se escriben por textContent desde el bucle: 60 renders por segundo
            hundirían los fps, y los fps son uno de los criterios. */}
        <div className="flex items-end gap-5 border-t border-white/10 px-4 pt-3">
          <Medida nombre="fps" valorRef={fpsRef} principal />
          <Medida nombre="marcas" valorRef={marcasRef} principal />
          <Medida nombre="ángulo" valorRef={anguloRef} principal />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pb-3 pt-2">
          <Medida nombre="escala" valorRef={escalaRef} />
          <Medida nombre="píxeles" valorRef={pixelesRef} />
          <Medida nombre="muestras" valorRef={muestrasRef} inicial="0" />
          <Medida nombre="reloj" valorRef={relojRef} />
        </div>

        {captura.aviso && (
          <p className="border-t border-white/10 px-4 py-3 text-sm text-white/70">
            {captura.aviso}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
          {!captura.camaraAbierta ? (
            <button
              type="button"
              onClick={captura.abrirCamara}
              className="min-h-14 flex-1 rounded-xl bg-rojo px-4 text-base font-bold text-white active:opacity-90"
            >
              Abrir cámara
            </button>
          ) : (
            <button
              type="button"
              disabled={!captura.listoParaGrabar}
              onClick={() => (captura.grabando ? captura.parar() : captura.empezar())}
              className={`min-h-14 flex-1 rounded-xl px-4 text-base font-bold transition-colors disabled:opacity-40 ${
                captura.grabando
                  ? 'bg-rojo text-white'
                  : 'border border-white/15 bg-white/10 text-white'
              }`}
            >
              {captura.grabando ? 'Parar y analizar' : 'Grabar serie'}
            </button>
          )}
        </div>
      </section>

      <ResultadoMedicion resultado={resultado} modo={modo} />

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <b className="text-sm">Guardar la medición</b>
          <span className="font-mono text-xs text-tenue">
            {tanda.length} en la tanda
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Campo etiqueta="Ejercicio" ancho="w-40">
            <input
              className={claseEntrada}
              value={ejercicio}
              onChange={(e) => setEjercicio(e.target.value)}
              placeholder="sentadilla"
            />
          </Campo>
          <Campo etiqueta="Carga (kg)" ancho="w-24">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={cargaKg}
              onChange={(e) => setCargaKg(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Reps que hizo" ancho="w-28">
            <input
              className={claseEntrada}
              inputMode="numeric"
              value={repsReales}
              onChange={(e) => setRepsReales(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="v ref primera" ancho="w-28">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={vRef}
              onChange={(e) => setVRef(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="v ref última" ancho="w-28">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={vRefUltima}
              onChange={(e) => setVRefUltima(e.target.value)}
            />
          </Campo>
        </div>
        <p className="text-xs text-tenue">
          Las repeticiones <b className="text-texto">las cuentas tú</b>: es el modo de fallo
          dominante de las apps de cámara y no aparece si solo miras los m/s. Y hacen falta{' '}
          <b className="text-texto">las dos</b> velocidades de referencia, porque el %PV es un
          cociente entre ellas.
        </p>
        <input
          className={claseEntrada}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="nota: rep fantasma al soltar, luz de frente…"
        />
        <button
          type="button"
          disabled={!resultado}
          onClick={guardar}
          className={`min-h-12 rounded-xl px-4 text-sm font-bold transition-colors ${
            resultado
              ? 'bg-rojo text-white'
              : 'cursor-not-allowed border border-linea bg-surface-2 text-tenue'
          }`}
        >
          Guardar medición
        </button>
      </Card>

      <Card className="flex flex-col gap-3">
        <b className="text-sm">Criterios de la fase 2</b>
        <ul className="flex flex-col gap-1.5">
          {criterios.map((c) => (
            <li
              key={c.etiqueta}
              className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-l-2 py-0.5 pl-3 ${
                c.cumple === undefined
                  ? 'border-linea'
                  : c.cumple ? 'border-verde' : 'border-rojo bg-rojo/5'
              }`}
            >
              <span className="text-sm text-texto">{c.etiqueta}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-tenue">{c.umbral}</span>
                <b
                  className={`font-mono tabular-nums ${
                    c.cumple === undefined
                      ? 'text-sm font-normal text-tenue'
                      : c.cumple ? 'text-base text-verde' : 'text-base text-rojo'
                  }`}
                >
                  {c.valor ?? '--'}
                </b>
              </span>
              {c.detalle && (
                <span className="w-full font-mono text-[11px] text-tenue">{c.detalle}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportar}
            disabled={tanda.length === 0}
            className="min-h-11 rounded-xl border border-linea bg-surface-3 px-4 text-sm font-medium disabled:opacity-40"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={vaciar}
            disabled={tanda.length === 0}
            className="min-h-11 rounded-xl border border-linea px-4 text-sm text-tenue disabled:opacity-40"
          >
            Vaciar tanda
          </button>
        </div>
      </Card>

      <details
        open={ajustesAbiertos}
        onToggle={(e) => setAjustesAbiertos((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-panel glass p-4"
      >
        <summary className="cursor-pointer text-sm font-bold">Ajustes de la toma</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          <Campo etiqueta="Referencia" ancho="w-44">
            <select
              className={claseEntrada}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value as Referencia)}
            >
              <option value="diana4">diana de 4 marcas</option>
              <option value="marcadores">dos marcadores</option>
              <option value="disco">disco de la barra</option>
            </select>
          </Campo>
          <Campo etiqueta="Modo" ancho="w-44">
            <select
              className={claseEntrada}
              value={modo}
              onChange={(e) => setModo(e.target.value as Modo)}
            >
              <option value="serie">serie</option>
              <option value="gravedad">prueba de gravedad</option>
            </select>
          </Campo>
          {referencia === 'diana4' && (
            <>
              <Campo etiqueta="Diana ancho (mm)" ancho="w-32">
                <input
                  className={claseEntrada}
                  inputMode="numeric"
                  value={dianaW}
                  onChange={(e) => setDianaW(Number(e.target.value) || 0)}
                />
              </Campo>
              <Campo etiqueta="Diana alto (mm)" ancho="w-32">
                <input
                  className={claseEntrada}
                  inputMode="numeric"
                  value={dianaH}
                  onChange={(e) => setDianaH(Number(e.target.value) || 0)}
                />
              </Campo>
            </>
          )}
          {referencia === 'marcadores' && (
            <Campo etiqueta="Separación real (mm)" ancho="w-40">
              <input
                className={claseEntrada}
                inputMode="numeric"
                value={sepMm}
                onChange={(e) => setSepMm(Number(e.target.value) || 0)}
              />
            </Campo>
          )}
          {referencia === 'disco' && (
            <Campo etiqueta="Diámetro del disco (mm)" ancho="w-44">
              <select
                className={claseEntrada}
                value={diametroMm}
                onChange={(e) => setDiametroMm(Number(e.target.value))}
              >
                <option value={450}>450 · bumper / olímpico 20-25 kg</option>
                <option value={400}>400 · olímpico 15 kg</option>
                <option value={325}>325 · olímpico 10 kg de hierro</option>
              </select>
            </Campo>
          )}
          <Campo etiqueta="Concéntrica" ancho="w-32">
            <select
              className={claseEntrada}
              value={sentido}
              onChange={(e) => setSentido(e.target.value as 'subir' | 'bajar')}
            >
              <option value="subir">al subir</option>
              <option value="bajar">al bajar</option>
            </select>
          </Campo>
          <Campo etiqueta="Tolerancia de tono" ancho="w-40">
            <input
              type="range"
              min={6}
              max={45}
              value={tolTono}
              onChange={(e) => setTolTono(Number(e.target.value))}
              className="min-h-11"
            />
          </Campo>
          <Campo etiqueta="Latitud (°)" ancho="w-28">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value) || 0)}
            />
          </Campo>
          <Campo etiqueta="Altitud (m)" ancho="w-28">
            <input
              className={claseEntrada}
              inputMode="numeric"
              value={alt}
              onChange={(e) => setAlt(Number(e.target.value) || 0)}
            />
          </Campo>
        </div>
        <p className="mt-3 text-xs text-tenue">
          La gravedad de aquí es <b className="font-mono text-texto">{gRef.toFixed(4)} m/s²</b>, no
          9,81: eso es un promedio, y en los Andes el valor real ronda 9,775. Compararse contra
          9,81 gastaría un 0,35 % del presupuesto de error con el signo siempre en la misma
          dirección.
        </p>
      </details>
    </div>
  )
}

function ResultadoMedicion({ resultado, modo }: { resultado: Resultado | null; modo: Modo }) {
  if (!resultado) {
    return (
      <Card>
        <p className="text-sm text-tenue">
          Sin medición todavía. Graba una {modo === 'gravedad' ? 'caída' : 'serie'} y aparecerá aquí.
        </p>
      </Card>
    )
  }

  if (resultado.tipo === 'gravedad') {
    const g = resultado.datos
    if (!g.ok) {
      return (
        <Card>
          <p className="text-sm text-rojo">No salió medición: {g.motivo}</p>
        </Card>
      )
    }
    const dentro = Math.abs(g.errorPct) <= 2
    return (
      <Card destacada className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <b className="font-mono text-3xl tabular-nums">{g.aceleracion.toFixed(3)}</b>
          <span className="text-sm text-tenue">m/s²</span>
          <span className={`ml-auto font-mono text-lg ${dentro ? 'text-verde' : 'text-rojo'}`}>
            {g.errorPct >= 0 ? '+' : ''}
            {g.errorPct.toFixed(2)} %
          </span>
        </div>
        <p className="font-mono text-xs text-tenue">
          {g.nMuestras} fotogramas · {g.fpsReal.toFixed(1)} fps · referencia {g.referencia} ·
          inclinación {g.inclinacionGrados.toFixed(0)}°
        </p>
        {g.errorPct > 0 && (
          <p className="text-xs text-ambar">
            Por encima de la g local, y el aire solo puede frenar: esto no es física, es escala o
            tiempos.
          </p>
        )}
        {g.avisos.length > 0 && (
          <p className="text-xs text-ambar">{g.avisos.join(' · ')}</p>
        )}
      </Card>
    )
  }

  const s = resultado.datos
  if (!s.ok) {
    return (
      <Card>
        <p className="text-sm text-rojo">
          No salió medición: {s.detalle ?? s.motivo}
          {s.fpsReal !== undefined && (
            <span className="font-mono text-xs text-tenue"> · {s.fpsReal.toFixed(1)} fps</span>
          )}
        </p>
      </Card>
    )
  }

  const tono = s.calidad.nivel === 'buena' ? 'verde' : s.calidad.nivel === 'dudosa' ? 'ambar' : 'rojo'
  return (
    <Card destacada className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge tono={tono}>{s.calidad.nivel}</Badge>
        <span className="font-mono text-xs text-tenue">
          {s.reps.length} reps · {s.fpsReal.toFixed(0)} fps · {(s.deteccion * 100).toFixed(0) } %
          detectado
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="flex items-baseline gap-2">
          <b className="font-mono text-2xl tabular-nums">{s.vPrimera.toFixed(3)}</b>
          <span className="text-xs text-tenue">v₁ {s.unidad}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <b className="font-mono text-2xl tabular-nums">{s.vUltima.toFixed(3)}</b>
          <span className="text-xs text-tenue">v última</span>
        </span>
        <span className="flex items-baseline gap-2">
          <b className="font-mono text-2xl tabular-nums">{s.pvPct.toFixed(1)}</b>
          <span className="text-xs text-tenue">%PV</span>
        </span>
      </div>
      {s.unidad === 'px/s' && (
        <p className="text-xs text-ambar">
          Sin escala: esto va en píxeles por segundo. El %PV sigue valiendo —es un cociente— pero
          los m/s no existen en esta toma.
        </p>
      )}
      {s.calidad.motivos.length > 0 && (
        <p className="font-mono text-xs text-ambar">{s.calidad.motivos.join(' · ')}</p>
      )}
    </Card>
  )
}
