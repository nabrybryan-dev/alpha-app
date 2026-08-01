import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'
import { familia } from '../../domain/nutricion/estado'
import {
  alimentosRecientes,
  kcalDeComida,
  resumenDelDia,
} from '../../domain/nutricion/resumen'
import type { RegistroComida, TipoComida, TipoDia } from '../../domain/types'
import { AdherenciaDia } from './AdherenciaDia'
import { DetalleComida } from './DetalleComida'
import { FilaComida } from './FilaComida'
import { Hidratacion } from './Hidratacion'
import { PanelCalibracion } from './PanelCalibracion'
import { PanelMicros } from './PanelMicros'
import { ResumenDia } from './ResumenDia'
import { SheetBuscarAlimento } from './SheetBuscarAlimento'
import { SheetCantidad } from './SheetCantidad'
import { semanaDe } from '../../domain/nutricion/semana'
import { TiraSemana } from './TiraSemana'
import { VistaSemana } from './VistaSemana'
import { resumenDeSemana } from '../../domain/nutricion/semanaResumen'

/**
 * El diario del día: lo que el asesorado se comió, contra lo que le tocaba.
 *
 * Las cuatro comidas se pintan SIEMPRE, aunque estén vacías. Una lista que solo
 * muestra lo ya registrado esconde lo que falta, y lo que falta es justo lo que
 * hay que recordarle. Tocar una vacía abre el buscador directamente: del "me
 * falta la cena" a estar buscando, en un toque.
 */

const COMIDAS: TipoComida[] = ['desayuno', 'almuerzo', 'cena', 'snack']

/** Lo que "Mi plan" manda por la navegación al tocar el + de un alimento. */
interface DesdeElPlan {
  desdeElPlan?: { busqueda: string; gramos: number | null; comida: TipoComida }
}

/** Hora por defecto de cada comida cuando se crea. La cambia después. */
const HORAS: Record<TipoComida, string> = {
  desayuno: '08:00',
  almuerzo: '13:00',
  cena: '19:30',
  snack: '16:00',
}

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const fechaBonita = (iso: string) => {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return FECHA_LARGA.format(new Date(anio, mes - 1, dia))
}

export default function DiarioDia() {
  const { usuario } = useSesion()
  useDbVersion()

  /**
   * Lo que llega desde "Mi plan" al tocar el + de un alimento pautado.
   *
   * Se lee UNA vez, al montar, y no en un efecto: la navegación ya remonta esta
   * página, así que el estado inicial es el sitio correcto. Un efecto que
   * llamara a setState aquí volvería a abrir la hoja cada vez que el asesorado
   * la cerrara.
   */
  const ruta = useLocation()
  const [prefijo] = useState((ruta.state as DesdeElPlan | null)?.desdeElPlan)

  /**
   * Se consume una sola vez y se borra del historial.
   *
   * `state` de React Router vive en `history.state`, que SOBREVIVE a recargar la
   * página. Sin esto, el asesorado cerraba la hoja, recargaba, y se le volvía a
   * abrir sola con el alimento del plan todavía escrito: la pantalla trayendo
   * algo que él ya había descartado.
   *
   * El efecto solo toca el historial -no llama a setState-, que es exactamente
   * para lo que sirven los efectos: sincronizar con algo de fuera de React.
   */
  useEffect(() => {
    if (ruta.state) window.history.replaceState({}, '')
  }, [ruta.state])

  const [fecha, setFecha] = useState(hoyIso())
  const [tipoDia] = useState<TipoDia>('ALTO')
  // `detalle` es la comida que se está mirando entera; `comidaAbierta` es en
  // cuál va a caer lo que se busque. Son distintas: desde el detalle se abre el
  // buscador sin dejar de estar en el detalle.
  const [detalle, setDetalle] = useState<TipoComida | null>(null)
  const [verSemana, setVerSemana] = useState(false)
  const [comidaAbierta, setComidaAbierta] = useState<TipoComida | null>(prefijo?.comida ?? null)
  const [elegido, setElegido] = useState<AlimentoIndice | null>(null)

  const plan = db.nutricion.planByUsuario(usuario.id)
  const delDia = db.registroComidas.delDia(usuario.id, fecha)


  const porId = (id: string) => catalogoRepo.porId(id)
  // Sin useMemo a propósito: sumar un día son unas decenas de ítems que ya
  // están en memoria. Memorizarlo obligaría a declarar como dependencia una
  // lista que los repos devuelven nueva en cada render -así que no memorizaría
  // nada- y a cambio escondería el bug del día que sí importe.
  const total = resumenDelDia(delDia, porId)
  const semana = semanaDe(fecha)

  // Para los puntos de la tira: qué días de esta semana tienen algo anotado.
  const porDiaDeLaSemana = semana.map((dia) => db.registroComidas.delDia(usuario.id, dia))
  const conRegistro = new Set(
    semana.filter((_, i) => porDiaDeLaSemana[i].some((c) => c.items.length > 0)),
  )
  const recientes = alimentosRecientes(porDiaDeLaSemana.flat())

  const porTipo = (tipo: TipoComida) => delDia.find((c) => c.comida === tipo)

  /** Una comida que todavía no existe en la base, solo para poder pintarla. */
  const vacia = (tipo: TipoComida): RegistroComida => ({
    id: `vacia-${tipo}`,
    usuarioId: usuario.id,
    momentoIso: `${fecha}T${HORAS[tipo]}:00`,
    comida: tipo,
    cocinadoPorEl: true,
    aceiteG: null,
    salG: null,
    confianza: 'pesado',
    items: [],
  })

  /** La comida donde va a caer lo que registre. Se crea si aún no existe. */
  const asegurarComida = (tipo: TipoComida): string => {
    const yaEsta = porTipo(tipo)
    if (yaEsta) return yaEsta.id
    return db.registroComidas.abrirComida({
      usuarioId: usuario.id,
      momentoIso: `${fecha}T${HORAS[tipo]}:00`,
      comida: tipo,
      cocinadoPorEl: true,
      aceiteG: null,
      salG: null,
      confianza: 'pesado',
    })
  }

  /**
   * Si toca preguntar crudo/cocido para este alimento.
   *
   * Devuelve `null` cuando no hay nada que preguntar: o solo existe en un
   * estado, o el asesorado ya contestó una vez por esa familia -y esa respuesta
   * no se le vuelve a pedir nunca-.
   */
  const preguntaDe = (alimento: AlimentoIndice) => {
    if (db.registroComidas.preferencia(usuario.id, familia(alimento.nombre))) return null
    const variantes = catalogoRepo.variantesDe(alimento)
    if (variantes.length === 0) return null
    return variantes.map((v) => ({
      alimento: v,
      etiqueta: v.estado.charAt(0).toUpperCase() + v.estado.slice(1),
      pista: v.estado === 'crudo' ? 'Lo pesas antes de cocinar' : 'Lo pesas ya servido',
    }))
  }

  const resumenDe = (comida: RegistroComida) =>
    comida.items
      .map((i) => porId(i.alimentoId)?.nombre.split(',')[0] ?? '?')
      .join(' · ')

  const hechas = delDia.filter((c) => c.items.length > 0).length
  // Donde cae lo que se busque: la comida abierta desde el diario, o la que se
  // está mirando en el detalle.
  const destino = comidaAbierta ?? detalle

  if (!plan) {
    return (
      <p className="rounded-2xl border border-linea bg-surface-1 p-6 text-center text-sm text-tenue">
        Tu plan nutricional viene en camino. En cuanto esté, aquí verás tu diario.
      </p>
    )
  }

  const meta = plan.macrosPorDia[tipoDia]

  const hojas = (
    <>
      <SheetBuscarAlimento
  abierto={comidaAbierta !== null && elegido === null}
  recientes={recientes}
  consultaInicial={prefijo?.busqueda}
  onCerrar={() => setComidaAbierta(null)}
  onElegir={setElegido}
/>

<SheetCantidad
  abierto={elegido !== null}
  alimento={elegido}
  preguntarEstado={elegido ? preguntaDe(elegido) : null}
  nombreComida={destino ?? ''}
  gramosIniciales={prefijo?.gramos}
  onCerrar={() => setElegido(null)}
  onElegirEstado={(alimento) => {
    db.registroComidas.recordarPreferencia({
      usuarioId: usuario.id,
      familia: familia(alimento.nombre),
      estado: alimento.estado as 'crudo' | 'cocido' | 'seco',
    })
    setElegido(alimento)
  }}
  onAgregar={(alimento, gramos, fuePesado) => {
    if (!destino) return
    db.registroComidas.agregarItem(usuario.id, asegurarComida(destino), {
      alimentoId: alimento.id,
      gramos,
      fuePesado,
      estadoAsumido: alimento.estado as RegistroComida['items'][number]['estadoAsumido'],
    })
    setElegido(null)
    setComidaAbierta(null)
  }}
/>
    </>
  )

  if (verSemana) {
    return (
      <VistaSemana
        resumen={resumenDeSemana(porDiaDeLaSemana, semana, porId, meta.kcal)}
        meta={meta}
        onVolver={() => setVerSemana(false)}
        onElegirDia={(dia) => {
          setFecha(dia)
          setVerSemana(false)
        }}
      />
    )
  }

  // El detalle reemplaza al diario, no se apila encima: en un móvil dos capas
  // con scroll propio es donde se pierde la gente.
  if (detalle) {
    const comida = porTipo(detalle) ?? vacia(detalle)
    return (
      <>
        <DetalleComida
          comida={comida}
          onVolver={() => setDetalle(null)}
          onAgregar={() => setComidaAbierta(detalle)}
          onQuitarItem={(itemId) => db.registroComidas.quitarItem(usuario.id, comida.id, itemId)}
          onCambiar={(cambios) =>
            db.registroComidas.editarComida(usuario.id, asegurarComida(detalle), cambios)
          }
        />
        {hojas}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            Diario de comidas · Día {plan.etiquetasDia?.[tipoDia] ?? tipoDia}
          </p>
          <h1 className="font-display text-xl capitalize text-texto">{fechaBonita(fecha)}</h1>
        </div>
        <button
          type="button"
          onClick={() => setVerSemana(true)}
          className="press shrink-0 rounded-full border border-linea bg-surface-2 px-3 py-1.5 text-xs font-semibold text-texto"
        >
          Semana
        </button>
        <Link
          to="/nutricion/plan"
          className="press shrink-0 rounded-full border border-linea bg-surface-2 px-3 py-1.5 text-xs font-semibold text-texto"
        >
          Mi plan
        </Link>
      </header>

      <TiraSemana fecha={fecha} conRegistro={conRegistro} onElegir={setFecha} />

      <ResumenDia total={total} meta={meta} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm text-texto">Tus {COMIDAS.length} comidas de hoy</h2>
          <span className="cifras text-xs text-tenue">
            {hechas} / {COMIDAS.length}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {COMIDAS.map((tipo) => {
            const comida = porTipo(tipo) ?? vacia(tipo)
            return (
              <FilaComida
                key={tipo}
                comida={comida}
                kcal={kcalDeComida(comida, porId)}
                resumen={resumenDe(comida)}
                onAbrir={() => setDetalle(tipo)}
              />
            )
          })}
        </div>
      </section>

      <PanelMicros total={total} />

      <PanelCalibracion
        pruebas={db.calibracion.byUsuario(usuario.id).map((p) => ({
          alimentoId: p.alimentoId,
          gramosEstimados: p.gramosEstimados,
          gramosReales: p.gramosReales,
          fecha: p.fecha,
        }))}
        diasPesando={db.calibracion.diasPesando(usuario.id)}
        onRegistrar={({ alimentoId, estimados, reales }) =>
          db.calibracion.registrar({
            usuarioId: usuario.id,
            fecha: hoyIso(),
            alimentoId,
            gramosEstimados: estimados,
            gramosReales: reales,
          })
        }
      />

      {/* El agua y la adherencia son hechos del DÍA, igual que las comidas, así
          que viven aquí. Estaban en la vista del plan, que ahora es solo lo que
          el coach pautó -algo que se lee, no donde se registra-. */}
      <Hidratacion usuarioId={usuario.id} />
      <AdherenciaDia usuarioId={usuario.id} />

      {hojas}
    </div>
  )
}
