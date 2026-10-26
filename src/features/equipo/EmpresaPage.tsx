import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  puedeVerAdministracion,
  puedeVerConsola,
  puedeVerCreadores,
  puedeVerEstrategias,
} from '../../app/accesoPanel'
import { useSesion } from '../../app/SessionProvider'
import { Sheet } from '../../components/ui/Sheet'
import { CAPACIDADES, type Capacidad } from '../../data/consola/capacidadesStaff'
import type { Sombrero } from '../../domain/equipo/sombreros'
import { ocupaPuestoCoach } from '../coach/consola/usePuestoCoach'
import { useFiltroSombrero } from './filtroSombreros'
import { Sombreros } from './Sombreros'
import { useCapacidadesVigentes } from './useCapacidadesVigentes'

/**
 * EMPRESA (maqueta 7, paso 11 del plan 14): las herramientas de cada sombrero, según los
 * permisos de la cuenta.
 *
 * No rehace ninguna pantalla: cada fila abre la ruta de siempre (consola, revisiones, mesa
 * del encoder, Praxis, nutrición del equipo, estrategias, administración, creadores). Lo
 * nuevo es el sitio único y el filtro de sombreros, que se comparte con el Hoy del equipo,
 * la Bandeja y Equipo.
 *
 * La hoja «Tus tres sombreros» dice qué ve, qué firma y con qué permiso cada uno, y las
 * capacidades REALES de la cuenta. El riesgo alto se nombra con su permiso
 * (`autorizar_excepcion`): la regla de que solo lo firma Bryan no se cambia aquí.
 */

interface Fila {
  titulo: string
  nota: string
  a: string
}

interface Grupo {
  sombrero: Sombrero
  titulo: string
  filas: Fila[]
}

function FilaDeHerramienta({ fila }: { fila: Fila }) {
  return (
    <li>
      <Link
        to={fila.a}
        className="press flex min-h-[56px] items-center justify-between gap-3 border-t border-linea"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-texto">{fila.titulo}</span>
          <span className="text-xs text-tenue">{fila.nota}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-tenue">›</span>
      </Link>
    </li>
  )
}

const SOMBREROS_DE_LA_HOJA: readonly { nombre: string; ve: string; firma: string; permiso: string }[] = [
  {
    nombre: 'Entreno',
    ve: 'Cartera y ficha, consola, revisiones, mesa del encoder y Praxis del equipo.',
    firma: 'Cambios de fase, planes renovados y primeros planes de riesgo bajo o medio. El riesgo alto solo con el permiso de autorizar excepciones.',
    permiso: 'rol coach o puesto de coach · leer_entrenamiento · aprobar_primer_plan · autorizar_excepcion',
  },
  {
    nombre: 'Nutrición',
    ve: 'La pestaña de nutrición de la ficha, la nutrición del equipo y las cifras por persona.',
    firma: 'Primeros planes nutricionales, planes renovados y alimentos vetados.',
    permiso: 'rol nutricionista · aprobar_primer_plan · aprobar_plan_estrategico',
  },
  {
    nombre: 'Administración',
    ve: 'Estrategias, administración, creadores, decisiones compartidas y los buzones.',
    firma: 'Decisiones compartidas (con las dos firmas), contactos de creadores y políticas.',
    permiso: 'ver_administracion · decisiones_compartidas · revisar_creadores · responder_mercadeo · organizar_plan',
  },
]

export default function EmpresaPage() {
  const { usuario } = useSesion()
  const capacidades = useCapacidadesVigentes()
  const { cargando, tiene } = capacidades
  const esCoach = ocupaPuestoCoach(usuario.rol, cargando, tiene)
  const filtro = useFiltroSombrero()
  const [hojaAbierta, setHojaAbierta] = useState(false)

  if (usuario.rol === 'asesorado' && cargando) return null
  if (usuario.rol !== 'nutricionista' && !esCoach) return <Navigate to="/" replace />

  // Las MISMAS puertas que aplica `CoachLayout` (`accesoPanel.ts`): ningún enlace puede llevar
  // a una pantalla que después devuelva a la persona a la portada.
  const puesto = { esCoach, cargando, tiene }
  const puedeEstrategia = puedeVerEstrategias(puesto)
  const puedeAdmin = puedeVerAdministracion(puesto)
  const puedeCreadores = puedeVerCreadores(puesto)

  const entrenador: Fila[] = []
  if (puedeVerConsola(puesto)) {
    entrenador.push({ titulo: 'Consola del coach', nota: 'Siete pestañas por persona; mejor en escritorio.', a: '/coach/consola' })
  }
  if (esCoach) {
    entrenador.push({ titulo: 'Revisiones de voz y vídeo', nota: 'Programadas; la puerta de firma sigue hasta retirarla.', a: '/coach/revisiones' })
  }
  entrenador.push({ titulo: 'Mesa del encoder', nota: 'Calibrar y medir la barra; solo el equipo.', a: '/entrenar/encoder' })
  entrenador.push({ titulo: 'Praxis del equipo', nota: 'Probar el cosmos; cerrada a asesorados.', a: '/praxis' })

  const nutricion: Fila[] = [
    { titulo: 'Nutrición del equipo', nota: 'Adherencia y cifras por persona.', a: '/equipo-nutricion' },
    { titulo: 'Cifras de los asesorados', nota: 'Los números de nutrición, sin nombres de más.', a: '/equipo-nutricion/cifras' },
    { titulo: 'Planes por renovar', nota: 'Primeros planes y renovados; se firman en la Bandeja.', a: '/bandeja' },
  ]

  const administracion: Fila[] = []
  if (puedeEstrategia) {
    administracion.push({ titulo: 'Estrategias', nota: 'Mercadeo, investigación, creadores y bola de nieve.', a: '/coach/estrategias' })
  }
  if (puedeAdmin) {
    administracion.push({ titulo: 'Administración', nota: 'Finanzas, plataforma, plan, desvíos y riesgos.', a: '/coach/administracion' })
  }
  // `/marca` no pide capacidad: su puerta es `SoloEquipo`, y esta pantalla ya es del equipo.
  administracion.push({ titulo: 'Manual de marca', nota: 'Logos, colores y componentes; material interno del equipo.', a: '/marca' })
  if (puedeCreadores) {
    administracion.push({ titulo: 'Creadores', nota: 'El embudo y lo que espera criterio.', a: '/coach/creadores' })
  }

  const todos: Grupo[] = [
    { sombrero: 'entreno', titulo: 'Entrenador', filas: entrenador },
    { sombrero: 'nutricion', titulo: 'Nutrición', filas: nutricion },
    { sombrero: 'administracion', titulo: 'Administración', filas: administracion },
  ]
  const grupos = todos.filter((g) => g.filas.length > 0 && (filtro === 'todo' || filtro === g.sombrero))

  const capacidadesDeLaCuenta = CAPACIDADES.filter((c: Capacidad) => !cargando && tiene(c))

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Herramientas</p>
        <h2 className="font-display text-3xl leading-none text-texto">Empresa</h2>
        <p className="text-sm text-tenue">
          Las herramientas de cada sombrero, según tus permisos. Las pantallas de siempre, con el tacto nuevo.
        </p>
      </header>

      <Sombreros />

      <button
        type="button"
        onClick={() => setHojaAbierta(true)}
        className="press flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 text-left shadow-sm"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-texto">Tus tres sombreros</span>
          <span className="text-xs text-tenue">Qué ve, qué firma y con qué permiso cada uno.</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-tenue">›</span>
      </button>

      {grupos.length === 0 ? (
        <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
          No hay herramientas de este sombrero con tus permisos.
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g.sombrero} aria-label={g.titulo} className="flex flex-col">
            <h3 className="py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">{g.titulo}</h3>
            <ul className="rounded-tarjeta border border-linea bg-surface-1 px-4 shadow-sm">
              {g.filas.map((f) => (
                <FilaDeHerramienta key={f.a} fila={f} />
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet abierto={hojaAbierta} titulo="Tus tres sombreros" onCerrar={() => setHojaAbierta(false)}>
        <p className="text-sm text-tenue">
          No hay que cambiar de modo: es la misma persona el mismo día. Los tres se ven juntos y se filtran, y la
          seguridad del check-in sale siempre.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {SOMBREROS_DE_LA_HOJA.map((s) => (
            <div key={s.nombre} className="rounded-tarjeta border border-linea p-3">
              <p className="font-display text-sm text-texto">{s.nombre}</p>
              <p className="mt-1 text-xs text-texto/90"><b>Qué ve:</b> {s.ve}</p>
              <p className="mt-1 text-xs text-texto/90"><b>Qué firma:</b> {s.firma}</p>
              <p className="mt-1 text-xs text-tenue"><b>Permiso:</b> {s.permiso}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-linea pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Tu cuenta tiene</p>
          {cargando ? (
            <p className="mt-1 text-xs text-tenue" aria-busy="true">Cargando tus permisos…</p>
          ) : capacidadesDeLaCuenta.length === 0 ? (
            <p className="mt-1 text-xs text-tenue">Ninguno de estos permisos.</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {capacidadesDeLaCuenta.map((c) => (
                <li key={c} className="rounded-full border border-linea bg-surface-2 px-2.5 py-1 text-[11px] text-texto">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  )
}
