import { etiquetaDelTipoDeDia, tipoDiaDeLaFecha } from '../../domain/nutricion/tipoDiaDeLaFecha'
import { useEffect, useRef, useState } from 'react'
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
import type { RegistroComida, TipoComida } from '../../domain/types'
import { AdherenciaDia } from './AdherenciaDia'
import { DetalleComida } from './DetalleComida'
import { FilaComida } from './FilaComida'
import { Hidratacion } from './Hidratacion'
import { estaCalibrado } from '../../domain/nutricion/calibracion'
import { condicionesDeclaradas } from '../../domain/nutricion/embarazo'
import { PanelCalibracion } from './PanelCalibracion'
import { PanelMicros } from './PanelMicros'
import { gramosDeReceta, RECETAS, type Receta } from '../../data/recetas'
import { recetaAlRegistro } from '../../domain/nutricion/recetaAlRegistro'
import { anotar, desanotar, distintas, rachaDeRecetas, type RecetaProbada } from '../../domain/recetasProbadas'
import { escribirJSON, leerJSON } from '../../lib/persistencia'
import { RecetasCarousel } from './RecetasCarousel'
import { ResumenDia } from './ResumenDia'
import { AVISO_SIN_MACROS, macrosDelDia } from '../../domain/nutricion/macrosDelDia'
import { SheetBuscarAlimento } from './SheetBuscarAlimento'
import { SheetCantidad } from './SheetCantidad'
import { semanaDe } from '../../domain/nutricion/semana'
import { TiraSemana } from './TiraSemana'
import { visibilidadDelAsesorado } from '../../data/visibilidadDelAsesorado'
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
  /** Qué comida creó cada receta, para poder deshacer exactamente esa. */
  const comidasDeReceta = useRef(new Map<string, string>())

  /**
   * Las recetas ya cocinadas, en el teléfono y con la clave del usuario.
   *
   * No entra en `limpiarBorradoresLocales`: los borradores se borran al cerrar
   * sesión porque son kilos y reps a medio escribir de otra persona, y aquí la
   * clave ya lleva el id —nadie ve lo de nadie—. Borrarlo al salir solo serviría
   * para tirarle la racha a quien vuelve a entrar en su propio teléfono.
   */
  const claveProbadas = `alpha-recetas-${usuario.id}`
  const [probadas, setProbadasEstado] = useState<RecetaProbada[]>(() =>
    leerJSON<RecetaProbada[]>(claveProbadas, []),
  )
  const setProbadas = (nuevas: RecetaProbada[]) => {
    setProbadasEstado(nuevas)
    escribirJSON(claveProbadas, nuevas)
  }
  // `detalle` es la comida que se está mirando entera; `comidaAbierta` es en
  // cuál va a caer lo que se busque. Son distintas: desde el detalle se abre el
  // buscador sin dejar de estar en el detalle.
  const [detalle, setDetalle] = useState<TipoComida | null>(null)
  const [verSemana, setVerSemana] = useState(false)
  const [comidaAbierta, setComidaAbierta] = useState<TipoComida | null>(prefijo?.comida ?? null)
  const [elegido, setElegido] = useState<AlimentoIndice | null>(null)

  const plan = db.nutricion.planByUsuario(usuario.id)
  // El tipo de día sale del plan y de la fecha que se mira; antes estaba fijo en ALTO.
  const tipoDia = tipoDiaDeLaFecha(plan, fecha)
  const delDia = db.registroComidas.delDia(usuario.id, fecha)

  // Misma función que usa "Mi plan": el contador del diario y las cifras del
  // perfil obedecen a una sola decisión, resuelta en un solo sitio.
  const visibilidad = visibilidadDelAsesorado(usuario.id)

  const pruebas = db.calibracion.byUsuario(usuario.id).map((p) => ({
    alimentoId: p.alimentoId,
    gramosEstimados: p.gramosEstimados,
    gramosReales: p.gramosReales,
    fecha: p.fecha,
  }))
  const diasPesando = db.calibracion.diasPesando(usuario.id)

  /**
   * Con qué margen nacen las comidas de hoy.
   *
   * Se decide AL CREARLAS, no al leerlas. La calibración cambia con el tiempo:
   * quien calibró ayer no estimaba igual de bien hace tres semanas, y derivarlo
   * en la lectura reescribiría el margen de todo su historial cada vez que
   * mejora. Lo que se registró con ±25 % se queda con ±25 %.
   */
  const confianzaDeHoy = estaCalibrado(pruebas, diasPesando) ? 'estimado_calibrado' : 'estimado'


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

  /**
   * Lo que la asesorada declaró, y lo que comió hoy: los dos deciden el aviso.
   *
   * Las condiciones bajan su límite de vitamina A -2.800 en embarazo o
   * lactancia, no 3.000-. Los nombres callan el aviso diario del hígado, que va
   * por frecuencia desde el 2026-08-09. Ver `techos.ts`.
   *
   * Se mira contra `fecha` y no contra hoy porque el diario se puede abrir en
   * un día pasado: un embarazo que ya caducó no debe teñir la semana anterior.
   */
  const respuestasSuyas = db.perfilNutricion.byUsuario(usuario.id)?.respuestas ?? {}
  const condiciones = [...condicionesDeclaradas(respuestasSuyas, fecha)]

  const nombresDelDia = delDia.flatMap((comida) =>
    comida.items.map((item) => porId(item.alimentoId)?.nombre ?? ''),
  )

  /**
   * Las recetas que se cocinaron ESTE día, con su porción. Se listan debajo del
   * carrusel: lo que ya entró al día no se esconde, para que el asesorado vea
   * que sus kcal están contadas y de dónde salen.
   */
  const recetasDeHoy = probadas
    .filter((p) => p.fecha === fecha)
    .map((p) => {
      const receta = RECETAS.find((r) => r.id === p.recetaId)
      if (!receta) return null
      return { receta, gramos: gramosDeReceta(receta), kcal: receta.ajuste.kcal }
    })
    .filter((r): r is { receta: Receta; gramos: number; kcal: number } => r !== null)

  const porTipo = (tipo: TipoComida) => delDia.find((c) => c.comida === tipo)

  /**
   * Una receta entra como comida propia, no dentro de la que ya hubiera.
   *
   * Así el «Deshacer» puede borrarla entera sin tocar lo que la persona había
   * registrado antes: mezclarla en el snack existente obligaría a quitar ítem a
   * ítem y bastaría un ingrediente repetido para llevarse por delante el que ya
   * estaba.
   */
  const registroDeRecetas = {
    agregar: (receta: Receta) => {
      const plan = recetaAlRegistro(receta, `${fecha}T${new Date().toTimeString().slice(0, 5)}:00`)
      if (!plan.puede) return
      const comidaId = db.registroComidas.abrirComida({ ...plan.comida, usuarioId: usuario.id })
      for (const item of plan.items) db.registroComidas.agregarItem(usuario.id, comidaId, item)
      comidasDeReceta.current.set(receta.id, comidaId)
      setProbadas(anotar(probadas, receta.id, fecha))
    },
    deshacer: (receta: Receta) => {
      const comidaId = comidasDeReceta.current.get(receta.id)
      if (!comidaId) return
      db.registroComidas.borrarComida(usuario.id, comidaId)
      comidasDeReceta.current.delete(receta.id)
      // La racha baja con la comida. Si no, el número seguiría diciendo que
      // cocinó algo que ya no está registrado en ninguna parte.
      setProbadas(desanotar(probadas, receta.id, fecha))
    },
  }

  /** Una comida que todavía no existe en la base, solo para poder pintarla. */
  const vacia = (tipo: TipoComida): RegistroComida => ({
    id: `vacia-${tipo}`,
    usuarioId: usuario.id,
    momentoIso: `${fecha}T${HORAS[tipo]}:00`,
    comida: tipo,
    cocinadoPorEl: true,
    aceiteG: null,
    salG: null,
    confianza: confianzaDeHoy,
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
      confianza: confianzaDeHoy,
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

  const meta = macrosDelDia(plan, tipoDia)
  if (!meta) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-linea bg-surface-1 p-6 text-center text-sm text-tenue"
      >
        {AVISO_SIN_MACROS}
      </p>
    )
  }

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
        visibilidad={visibilidad}
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
      <header>
        <h1 className="font-display text-xl text-texto">Nutrición</h1>
        <p className="mt-0.5 text-xs capitalize text-tenue">
          {fechaBonita(fecha)} · {etiquetaDelTipoDeDia(plan, tipoDia)}
        </p>
      </header>

      <TiraSemana
        fecha={fecha}
        hoy={hoyIso()}
        conRegistro={conRegistro}
        onElegir={setFecha}
        onSemana={() => setVerSemana(true)}
      />

      <ResumenDia total={total} meta={meta} visibilidad={visibilidad} />

      <RecetasCarousel
        recetas={RECETAS}
        kcalRestantes={Math.max(0, Math.round(meta.kcal - (total.porDia.kcal ?? 0)))}
        registro={registroDeRecetas}
        cocinadas={distintas(probadas)}
        racha={rachaDeRecetas(probadas, fecha).actual}
        cocinadasHoy={recetasDeHoy}
      />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm text-texto">Comidas</h2>
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
                verKcal={visibilidad.verContadorKcal}
                onAbrir={() => setDetalle(tipo)}
              />
            )
          })}
        </div>
      </section>

      <PanelMicros total={total} condiciones={condiciones} nombresDelDia={nombresDelDia} />

      <PanelCalibracion
        pruebas={pruebas}
        diasPesando={diasPesando}
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

      {/* El plan completo, a un toque desde donde se registra. En la maqueta es
          una fila al pie; la ruta de siempre se conserva. */}
      <Link
        to="/nutricion/plan"
        aria-label="Tu plan"
        className="press flex items-center justify-between gap-3 rounded-2xl border border-linea bg-surface-1 p-3"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-texto">Tu plan</span>
          <span className="block text-xs leading-snug text-tenue">
            Menús, intercambios, mercado, suplementos y tu perfil
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-tenue">
          ›
        </span>
      </Link>

      {hojas}
    </div>
  )
}
