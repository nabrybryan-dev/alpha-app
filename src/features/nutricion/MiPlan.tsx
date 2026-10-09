import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { esHora, leerPauta } from '../../domain/nutricion/pauta'
import { AVISO_SIN_MACROS, macrosDelDia } from '../../domain/nutricion/macrosDelDia'
import { calcularPerfil } from '../../domain/nutricion/perfilCalculado'
import { hoyIso } from '../../data/dbInstance'
import { PerfilCalculadoVista } from './PerfilCalculadoVista'
import { SheetCambios } from './SheetCambios'
import { SheetDespensa } from './SheetDespensa'
import { respuestasDe, visibilidadDelAsesorado } from '../../data/visibilidadDelAsesorado'
import type { MenuDia, TipoDia } from '../../domain/types'
import { comidaDe } from './comidaDe'
import { MiPlanSimple } from './MiPlanSimple'

/**
 * El plan nutricional completo, por secciones.
 *
 * Lo que lo separa de una hoja de cálculo bonita: cada alimento pautado tiene
 * un botón que lo lleva al diario ya escrito. El plan deja de ser algo que se
 * lee y pasa a ser algo desde lo que se registra, que es donde se pierde la
 * adherencia — entre saber qué toca comer y anotar que se comió.
 */

const SECCIONES = [
  'Mi perfil',
  'Contexto',
  'Ondulación',
  'Menús',
  'Intercambios',
  'Mercado',
  'Suplementos',
] as const

type Seccion = (typeof SECCIONES)[number]

const TIPOS: TipoDia[] = ['ALTO', 'BAJO', 'CHEAT']

const kcalDelTipo = (plan: Parameters<typeof macrosDelDia>[0], tipo: TipoDia) => {
  const m = macrosDelDia(plan, tipo)
  return m ? `${m.kcal.toLocaleString('es-CO')} kcal` : 'sin macros'
}

export default function MiPlan() {
  const { usuario } = useSesion()
  useDbVersion()
  const navegar = useNavigate()

  const plan = db.nutricion.planByUsuario(usuario.id)
  const [seccion, setSeccion] = useState<Seccion>('Mi perfil')
  const [tipoMenu, setTipoMenu] = useState<TipoDia>('ALTO')
  /** La línea del plan cuya hoja de cambios está abierta. */
  const [cambiando, setCambiando] = useState<string | null>(null)
  const [despensaAbierta, setDespensaAbierta] = useState(false)
  /** Con `vistaSimple`: la persona pidió el plan completo desde la lista sencilla. Siempre arranca en false. */
  const [verCompleto, setVerCompleto] = useState(false)

  // Lo que decidió la nutricionista, o lo que la encuesta pide retener mientras
  // ella no haya decidido. Ver `visibilidadDelAsesorado`.
  const respuestas = respuestasDe(usuario.id)
  const visibilidad = visibilidadDelAsesorado(usuario.id)

  if (!plan) {
    return (
      <p className="rounded-2xl border border-linea bg-surface-1 p-6 text-center text-sm text-tenue">
        Tu plan nutricional viene en camino.
      </p>
    )
  }

  const secciones: Seccion[] = [
    ...SECCIONES.filter((s) => s !== 'Suplementos' || plan.suplementacion.length > 0),
  ]

  /** Manda un alimento pautado al diario, ya escrito y listo para confirmar. */
  const registrar = (linea: string, tituloComida: string) => {
    const [pauta] = leerPauta(linea)
    if (!pauta) return
    navegar('/nutricion', {
      state: {
        desdeElPlan: {
          busqueda: pauta.busqueda,
          gramos: pauta.gramos,
          comida: comidaDe(tituloComida),
        },
      },
    })
  }

  /**
   * Cambia entre la lista sencilla y el plan completo. Sube al principio porque las dos
   * pantallas miden distinto: sin subir, quien pulsó el botón del pie de la lista se queda
   * en el fondo del plan completo, sin ver ni sus pestañas ni la vuelta.
   */
  const cambiarVista = (completo: boolean) => {
    setVerCompleto(completo)
    // El botón de la lista promete «mercado, suplementos y cambios»: el plan completo se abre
    // en Mercado y no en «Mi perfil» —la primera pestaña—, para que lo prometido sea lo
    // primero que se ve y no haya que buscarlo entre siete pestañas.
    if (completo) setSeccion('Mercado')
    window.scrollTo({ top: 0 })
  }

  // La versión sin pestañas: toda la comida de la semana en una sola pantalla, en vez de
  // repartida en siete secciones. Mismo `plan`, mismo `registrar` — solo cambia cómo se pinta.
  // Le faltan el mercado, los suplementos y el cambio de alimentos: de ahí sale `verCompleto`.
  const vistaSimple = Boolean(db.perfiles.byUsuario(usuario.id)?.vistaSimple)
  if (vistaSimple && !verCompleto) {
    return (
      <MiPlanSimple
        plan={plan}
        onRegistrar={registrar}
        onVolver={() => navegar('/nutricion')}
        onVerCompleto={() => cambiarVista(true)}
      />
    )
  }

  const menu = plan.menus.find((m) => m.tipoDia === tipoMenu) ?? plan.menus[0]

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Solo llega aquí quien entró por la lista sencilla (`vistaSimple`): para el resto
          el plan completo es el de siempre y no hay a qué volver. */}
      {vistaSimple && (
        <button
          type="button"
          onClick={() => cambiarVista(false)}
          className="press min-h-[44px] self-start text-sm font-semibold text-accion underline underline-offset-4"
        >
          Volver a la lista sencilla
        </button>
      )}

      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navegar('/nutricion')}
          aria-label="Volver al diario"
          className="press h-11 w-11 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <h1 className="font-display text-xl text-texto">Tu plan nutricional</h1>
        {/* La despensa vive aquí y no en el diario a propósito: es la pantalla
            que PROPONE cambios, y el sentido de saber qué hay en casa es dejar
            de proponer lo que no está. */}
        <button
          type="button"
          onClick={() => setDespensaAbierta(true)}
          className="press relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ml-auto shrink-0 rounded-full border border-linea bg-surface-2 px-3 py-1.5 text-xs font-semibold text-tenue"
        >
          En casa
        </button>
      </header>

      <SheetCambios linea={cambiando} onCerrar={() => setCambiando(null)} />
      <SheetDespensa
        asesoradoId={usuario.id}
        abierto={despensaAbierta}
        onCerrar={() => setDespensaAbierta(false)}
      />

      <div className="-mx-1 -my-2 flex gap-2 overflow-x-auto px-1 py-2 pb-3">
        {secciones.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeccion(s)}
            aria-pressed={seccion === s}
            className={`press relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              seccion === s
                ? 'border-accion bg-accion/15 text-texto'
                : 'border-linea bg-surface-2 text-tenue'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {seccion === 'Mi perfil' && (
        <PerfilCalculadoVista
          perfil={calcularPerfil(respuestas, hoyIso())}
          visibilidad={visibilidad}
          nombre={usuario.nombre}
        />
      )}

      {seccion === 'Contexto' && (
        <section className="rounded-2xl border border-linea bg-surface-1 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
            Antes de los números
          </p>
          <p className="mt-2 text-sm leading-relaxed text-texto">{plan.analisis}</p>
        </section>
      )}

      {seccion === 'Ondulación' && (
        <section className="rounded-2xl border border-linea bg-surface-1 p-4">
          <h2 className="font-display text-base text-texto">Por qué las calorías ondulan</h2>
          <p className="mt-2 text-sm leading-relaxed text-tenue">
            Comes más el día que entrenas fuerte y menos el día que descansas. El total de la semana
            es el mismo que un déficit plano, pero el carbohidrato llega cuando lo puedes usar.{' '}
            <b className="text-texto">La proteína no se mueve nunca.</b>
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {TIPOS.map((tipo) => {
              const macros = macrosDelDia(plan, tipo)
              return (
                <div
                  key={tipo}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-linea bg-surface-2 p-3"
                >
                  <span className="text-sm font-semibold text-texto">
                    {plan.etiquetasDia?.[tipo] ?? tipo}
                  </span>
                  <span className="cifras text-right text-xs text-tenue">
                    {macros ? (
                      <>
                        <b className="text-texto">{macros.kcal.toLocaleString('es-CO')}</b> kcal
                        <span className="block">
                          P {macros.proteinaG} · C {macros.carbosG} · G {macros.grasaG}
                        </span>
                      </>
                    ) : (
                      AVISO_SIN_MACROS
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {seccion === 'Menús' && menu && (
        <section className="flex flex-col gap-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
            {TIPOS.filter((t) => plan.menus.some((m) => m.tipoDia === t)).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoMenu(tipo)}
                aria-pressed={tipoMenu === tipo}
                className={`press shrink-0 rounded-2xl border px-3 py-2 text-left transition-colors ${
                  tipoMenu === tipo
                    ? 'border-accion bg-accion/15 text-texto'
                    : 'border-linea bg-surface-2 text-tenue'
                }`}
              >
                <span className="block text-xs font-semibold">
                  {plan.etiquetasDia?.[tipo] ?? tipo}
                </span>
                <span className="cifras block text-xs opacity-70">
                  {kcalDelTipo(plan, tipo)}
                </span>
              </button>
            ))}
          </div>

          <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-xs leading-snug text-tenue">
            Todos los pesos son <b className="text-texto">en el estado que dice la etiqueta</b>. Si
            dice cocido, se pesa cocido.
          </p>

          <ComidasDelMenu menu={menu} onRegistrar={registrar} onCambiar={setCambiando} />
        </section>
      )}

      {seccion === 'Intercambios' && (
        <section className="flex flex-col gap-3">
          <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-xs leading-snug text-tenue">
            Cambia <b className="text-texto">dentro del grupo, no entre grupos</b>. Cada cantidad
            aporta lo mismo que sustituye.
          </p>
          {plan.equivalencias.map((grupo) => (
            <div key={grupo.grupo} className="rounded-2xl border border-linea bg-surface-1 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
                {grupo.grupo}
              </p>
              <p className="mt-1 text-sm font-semibold text-texto">{grupo.base}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {grupo.opciones.map((opcion) => (
                  <li key={opcion} className="text-sm leading-snug text-tenue">
                    {opcion}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {seccion === 'Mercado' && (
        <section className="rounded-2xl border border-linea bg-surface-1 p-4">
          <h2 className="font-display text-base text-texto">Mercado de 15 días</h2>
          <p className="mt-1 text-xs text-tenue">Compra una vez, cumple dos semanas.</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {plan.listaCompras.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-snug text-texto">
                <span aria-hidden="true" className="text-tenue">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {seccion === 'Suplementos' && (
        <section className="rounded-2xl border border-linea bg-surface-1 p-4">
          <h2 className="font-display text-base text-texto">Lo que sí vale la pena</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {plan.suplementacion.map((item) => (
              <li key={item} className="text-sm leading-snug text-texto">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.seccionesEspeciales.map((especial) => (
        <section key={especial.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
          <h2 className="font-display text-base text-texto">{especial.titulo}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-tenue">
            {especial.contenido}
          </p>
        </section>
      ))}
    </div>
  )
}

export function ComidasDelMenu({
  menu,
  onRegistrar,
  onCambiar,
}: {
  menu: MenuDia
  onRegistrar: (linea: string, tituloComida: string) => void
  onCambiar: (linea: string) => void
}) {
  return (
    <>
      {menu.comidas.map((comida) => (
        <div key={comida.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-sm text-texto">{comida.titulo}</h3>
            <span className="cifras shrink-0 text-xs text-tenue">{comida.hora}</span>
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {comida.alimentos.filter((a) => !esHora(a)).map((alimento) => (
              <li key={alimento} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-sm leading-snug text-texto">{alimento}</span>
                {/* «No tengo esto» va ANTES del «+», y no es casual: quien no
                    tiene el alimento no llega nunca a registrarlo. */}
                <button
                  type="button"
                  onClick={() => onCambiar(alimento)}
                  aria-label={`Por qué cambiar ${alimento}`}
                  className="press grid h-11 w-11 shrink-0 place-items-center"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-linea text-sm text-tenue" aria-hidden="true">
                    ⇄
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRegistrar(alimento, comida.titulo)}
                  aria-label={`Registrar ${alimento}`}
                  className="press grid h-11 w-11 shrink-0 place-items-center"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-accion/50 text-sm font-bold text-accion" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {comida.nota && (
            <p className="mt-2 text-xs leading-snug text-tenue">{comida.nota}</p>
          )}
        </div>
      ))}
    </>
  )
}
