import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { esHora, leerPauta } from '../../domain/nutricion/pauta'
import { calcularPerfil } from '../../domain/nutricion/perfilCalculado'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { visibilidadDe } from '../../domain/nutricion/visibilidad'
import { hoyIso } from '../../data/dbInstance'
import { PerfilCalculadoVista } from './PerfilCalculadoVista'
import type { MenuDia, TipoComida, TipoDia } from '../../domain/types'

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

/**
 * A que comida del diario corresponde el titulo del menu.
 *
 * Los titulos los escribe el coach ("Desayuno · overnight oats"), asi que se
 * mira solo la primera palabra. Lo que no encaje cae en snack, que es donde
 * viven las medias mananas y los pre-entrenos.
 */
function comidaDe(titulo: string): TipoComida {
  const primera = titulo.trim().split(/[\s·]/)[0].toLowerCase()
  return (['desayuno', 'almuerzo', 'cena'] as const).find((c) => c === primera) ?? 'snack'
}

export default function MiPlan() {
  const { usuario } = useSesion()
  useDbVersion()
  const navegar = useNavigate()

  const plan = db.nutricion.planByUsuario(usuario.id)
  const [seccion, setSeccion] = useState<Seccion>('Mi perfil')
  const [tipoMenu, setTipoMenu] = useState<TipoDia>('ALTO')

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

  const menu = plan.menus.find((m) => m.tipoDia === tipoMenu) ?? plan.menus[0]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navegar('/nutricion')}
          aria-label="Volver al diario"
          className="press h-9 w-9 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <h1 className="font-display text-xl text-texto">Tu plan nutricional</h1>
      </header>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {secciones.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeccion(s)}
            aria-pressed={seccion === s}
            className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
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
          perfil={calcularPerfil(
            (db.perfilNutricion.byUsuario(usuario.id)?.respuestas ?? {}) as Respuestas,
            hoyIso(),
          )}
          // Sin fila guardada se ven las tres cifras: es el caso normal, y ver
          // el propio progreso es parte del acompanamiento.
          visibilidad={visibilidadDe(undefined)}
          nombre={usuario.nombre}
        />
      )}

      {seccion === 'Contexto' && (
        <section className="rounded-2xl border border-linea bg-surface-1 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
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
              const macros = plan.macrosPorDia[tipo]
              return (
                <div
                  key={tipo}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-linea bg-surface-2 p-3"
                >
                  <span className="text-sm font-semibold text-texto">
                    {plan.etiquetasDia?.[tipo] ?? tipo}
                  </span>
                  <span className="cifras text-right text-[11px] text-tenue">
                    <b className="text-texto">{macros.kcal.toLocaleString('es-CO')}</b> kcal
                    <span className="block">
                      P {macros.proteinaG} · C {macros.carbosG} · G {macros.grasaG}
                    </span>
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
                <span className="cifras block text-[10px] opacity-70">
                  {plan.macrosPorDia[tipo].kcal.toLocaleString('es-CO')} kcal
                </span>
              </button>
            ))}
          </div>

          <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-[11px] leading-snug text-tenue">
            Todos los pesos son <b className="text-texto">en el estado que dice la etiqueta</b>. Si
            dice cocido, se pesa cocido.
          </p>

          <ComidasDelMenu menu={menu} onRegistrar={registrar} />
        </section>
      )}

      {seccion === 'Intercambios' && (
        <section className="flex flex-col gap-3">
          <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-[11px] leading-snug text-tenue">
            Cambia <b className="text-texto">dentro del grupo, no entre grupos</b>. Cada cantidad
            aporta lo mismo que sustituye.
          </p>
          {plan.equivalencias.map((grupo) => (
            <div key={grupo.grupo} className="rounded-2xl border border-linea bg-surface-1 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
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

function ComidasDelMenu({
  menu,
  onRegistrar,
}: {
  menu: MenuDia
  onRegistrar: (linea: string, tituloComida: string) => void
}) {
  return (
    <>
      {menu.comidas.map((comida) => (
        <div key={comida.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-sm text-texto">{comida.titulo}</h3>
            <span className="cifras shrink-0 text-[11px] text-tenue">{comida.hora}</span>
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {comida.alimentos.filter((a) => !esHora(a)).map((alimento) => (
              <li key={alimento} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-sm leading-snug text-texto">{alimento}</span>
                <button
                  type="button"
                  onClick={() => onRegistrar(alimento, comida.titulo)}
                  aria-label={`Registrar ${alimento}`}
                  className="press h-7 w-7 shrink-0 rounded-full border border-accion/50 text-sm font-bold text-accion"
                >
                  +
                </button>
              </li>
            ))}
          </ul>

          {comida.nota && (
            <p className="mt-2 text-[11px] leading-snug text-tenue">{comida.nota}</p>
          )}
        </div>
      ))}
    </>
  )
}
