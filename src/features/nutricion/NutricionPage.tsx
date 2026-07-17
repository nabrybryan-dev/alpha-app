import { useState } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { AnilloMacro } from '../../components/ui/AnilloMacro'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, useDbVersion } from '../../data/dbInstance'
import type { TipoDia } from '../../domain/types'
import { Acordeon } from './Acordeon'
import { AdherenciaDia } from './AdherenciaDia'
import { MenuDia } from './MenuDia'

const TIPOS_DIA: TipoDia[] = ['ALTO', 'BAJO', 'CHEAT']

export default function NutricionPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const [tipoDia, setTipoDia] = useState<TipoDia>('ALTO')

  const plan = db.nutricion.planByUsuario(usuario.id)

  if (!plan) {
    return (
      <EmptyState
        titulo="Tu plan nutricional viene en camino"
        detalle="El coach está preparando tu plan individualizado."
      />
    )
  }

  const macros = plan.macrosPorDia[tipoDia]
  const kcalProteina = macros.proteinaG * 4
  const kcalCarbos = macros.carbosG * 4
  const kcalGrasa = macros.grasaG * 9
  const kcalTotales = kcalProteina + kcalCarbos + kcalGrasa

  return (
    <div className="flex flex-col gap-4">
      <section className="entrada entrada-1 pt-2">
        <p className="kicker">Plan individualizado</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-texto">Nutrición</h2>
      </section>

      <div className="entrada entrada-2">
        <AdherenciaDia usuarioId={usuario.id} />
      </div>

      <Acordeon numero="01" titulo="Análisis completo" abiertoInicial>
        <p className="text-sm leading-relaxed text-texto/90">{plan.analisis}</p>
      </Acordeon>

      <Acordeon numero="02" titulo="Macros por tipo de día" abiertoInicial>
        <div className="mb-3 flex gap-2">
          {TIPOS_DIA.map((tipo) => (
            <Chip key={tipo} etiqueta={tipo} seleccionado={tipoDia === tipo} onSeleccionar={() => setTipoDia(tipo)} />
          ))}
        </div>
        <div className="mb-3 text-center">
          <p className="cifras font-display text-4xl leading-none text-texto">
            {Math.round(macros.kcal)}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
            kcal objetivo del día
          </p>
        </div>
        <div key={tipoDia} className="flex items-start justify-around rounded-xl border border-hairline bg-surface-2/50 px-2 py-3">
          <AnilloMacro etiqueta="Proteína" gramos={macros.proteinaG} pct={(kcalProteina / kcalTotales) * 100} color="var(--rojo)" />
          <AnilloMacro etiqueta="Carbos" gramos={macros.carbosG} pct={(kcalCarbos / kcalTotales) * 100} color="var(--ambar)" />
          <AnilloMacro etiqueta="Grasas" gramos={macros.grasaG} pct={(kcalGrasa / kcalTotales) * 100} color="var(--verde)" />
        </div>
      </Acordeon>

      <Acordeon numero="03" titulo={`Tus ${plan.menus.length} menús`}>
        <div className="flex flex-col gap-6">
          {plan.menus.map((menu) => (
            <MenuDia key={menu.nombre} menu={menu} />
          ))}
        </div>
      </Acordeon>

      <Acordeon numero="04" titulo="Tabla de equivalencias">
        <div className="flex flex-col gap-4">
          {plan.equivalencias.map((eq) => (
            <div key={eq.grupo}>
              <p className="text-sm font-bold text-rojo">{eq.grupo}</p>
              <p className="text-xs text-tenue">Base: {eq.base} — intercámbiala por:</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-texto/90">
                {eq.opciones.map((op) => (
                  <li key={op}>{op}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Acordeon>

      <Acordeon numero="05" titulo="Lista de compras · 15 días">
        <ul className="grid grid-cols-1 gap-1.5 text-sm text-texto/90">
          {plan.listaCompras.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-verde" aria-hidden="true">▸</span>
              {item}
            </li>
          ))}
        </ul>
      </Acordeon>

      <Acordeon numero="06" titulo="Suplementación">
        <ul className="flex flex-col gap-2 text-sm text-texto/90">
          {plan.suplementacion.map((s) => (
            <li key={s} className="rounded-lg border border-linea bg-surface-2 px-3 py-2">
              {s}
            </li>
          ))}
        </ul>
      </Acordeon>

      {plan.seccionesEspeciales.map((seccion, i) => (
        <Acordeon key={seccion.titulo} numero={String(7 + i).padStart(2, '0')} titulo={seccion.titulo}>
          <p className="text-sm leading-relaxed text-texto/90">{seccion.contenido}</p>
        </Acordeon>
      ))}
    </div>
  )
}
