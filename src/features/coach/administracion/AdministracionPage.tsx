import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { useLectura } from '../../../components/ui/useLectura'
import { adminTablero } from '../../../data/consola/adminTablero'
import {
  NOMBRE_SECCION,
  contarQueRequierenAccion,
  seccionRequiereAccion,
  SECCIONES,
  type Seccion,
  type SeccionLeida,
} from '../../../domain/adminTablero'
import { EntradaMiPlan } from '../../plan/EntradaMiPlan'
import { Cargando, CLASE_ETIQUETA } from '../../plan/comun'
import { useCapacidades } from '../consola/useCapacidades'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { TarjetaSeccion, type EnlaceSeccion } from './TarjetaSeccion'

/**
 * ÁREA ADMINISTRATIVA (migración 0102; ESPEC-ADMINISTRACION-INTERACTIVA.md): antes «Estrategia» de
 * Manuela. Siete secciones en el orden de la espec, cada una en tres capas plegables:
 *
 *   1. la tarjeta (semáforo, UNA frase y UNA cifra);
 *   2. al tocarla, 3-6 filas de detalle con su cifra y su dueño (y un gráfico simple si ayuda);
 *   3. al tocar una fila, su fuente (archivo, corte, huella) y «qué hacer».
 *
 * Una sola sección abierta a la vez en teléfono; la última abierta se recuerda en el navegador
 * (con try/catch: sin almacenamiento la pantalla funciona igual). Filtros: solo «todo / requiere
 * acción». Los influencers, el buzón de mercadeo y los comentarios ya tienen su pantalla: aquí se
 * resumen y se enlazan, no se duplican. Sin dato = gris «FALTA», nunca 0 ni texto inventado.
 */

const CLAVE_ABIERTAS = 'alpha.admin.abiertas'

function esTelefono(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  } catch {
    return false
  }
}

function leerAbiertas(): Seccion[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ABIERTAS)
    if (!crudo) return []
    const v: unknown = JSON.parse(crudo)
    if (!Array.isArray(v)) return []
    const validas = v.filter((x): x is Seccion => typeof x === 'string' && (SECCIONES as readonly string[]).includes(x))
    // En teléfono solo cabe una abierta.
    return esTelefono() ? validas.slice(0, 1) : validas
  } catch {
    return []
  }
}

function guardarAbiertas(abiertas: Seccion[]): void {
  try {
    window.localStorage.setItem(CLAVE_ABIERTAS, JSON.stringify(abiertas))
  } catch {
    /* sin almacenamiento (ventana privada, datos bloqueados): la pantalla no lo necesita */
  }
}

type Filtro = 'todo' | 'accion'

export default function AdministracionPage() {
  const { lectura, reintentar } = useLectura(adminTablero)
  const [abiertas, setAbiertas] = useState<Seccion[]>(leerAbiertas)
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const sesion = useSesionOpcional()
  const { tiene } = useCapacidades()
  const puedeCreadores = sesion?.usuario.rol === 'coach' || tiene('revisar_creadores')

  const alternar = useCallback((seccion: Seccion) => {
    setAbiertas((antes) => {
      const yaAbierta = antes.includes(seccion)
      const despues = yaAbierta
        ? antes.filter((s) => s !== seccion)
        : esTelefono()
          ? [seccion]
          : [...antes, seccion]
      guardarAbiertas(despues)
      return despues
    })
  }, [])

  const enlaceDe = (seccion: Seccion): EnlaceSeccion | null => {
    if (seccion === 'influencers' && puedeCreadores) return { a: '/coach/creadores', texto: 'Abrir el tablero de creadores' }
    if (seccion === 'mercadeo' && puedeCreadores) return { a: '/coach/creadores', texto: 'Abrir el buzón de mercadeo (al final de Creadores)' }
    if (seccion === 'plataforma') return { a: '/mi-entreno', texto: 'Abrir el buzón de comentarios de la app' }
    return null
  }

  const secciones: SeccionLeida[] | null = lectura?.ok ? lectura.datos : null
  const visibles = secciones === null ? [] : filtro === 'todo' ? secciones : secciones.filter(seccionRequiereAccion)
  const pidenAccion = secciones === null ? 0 : contarQueRequierenAccion(secciones)
  const cortes = secciones === null ? [] : secciones.flatMap((s) => (s.estado === 'sin_corte' ? [] : [s.corte]))
  const corteReciente = cortes.length > 0 ? [...cortes].sort().at(-1) : null

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>Estrategia</p>
        <h2 className="font-display text-2xl uppercase text-texto">Área administrativa</h2>
        <p className="text-sm text-tenue">
          {secciones === null
            ? 'Cómo va el negocio, de lo más general a lo más detallado.'
            : corteReciente
              ? `Último corte cargado: ${corteReciente}. Toca una tarjeta para ver el detalle.`
              : 'Todavía no hay ningún corte cargado.'}
        </p>
      </header>

      <EntradaMiPlan />

      {lectura === null && <Cargando texto="Cargando el área administrativa…" />}
      {lectura !== null && !lectura.ok && (
        <FalloDeLectura texto={`No se pudo leer el área administrativa (${lectura.error}).`} onReintentar={reintentar} />
      )}

      {secciones !== null && (
        <>
          <div role="group" aria-label="Filtro" className="flex items-center gap-2">
            {(
              [
                ['todo', 'Todo'],
                ['accion', `Requiere acción · ${pidenAccion}`],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filtro === id}
                onClick={() => setFiltro(id)}
                className={`press min-h-[44px] rounded-full border px-4 text-xs font-bold ${
                  filtro === id ? 'border-texto bg-texto text-bg' : 'border-linea text-texto'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          {visibles.length === 0 && (
            <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
              Ninguna sección pide acción en este corte.
            </p>
          )}

          <ol className="flex flex-col gap-3">
            {visibles.map((s) => (
              <li key={s.seccion}>
                <TarjetaSeccion
                  leida={s}
                  nombre={NOMBRE_SECCION[s.seccion]}
                  abierta={abiertas.includes(s.seccion)}
                  soloAccion={filtro === 'accion'}
                  enlace={enlaceDe(s.seccion)}
                  onAlternar={() => alternar(s.seccion)}
                />
              </li>
            ))}
          </ol>
        </>
      )}

      {secciones !== null && (
        <p className="text-[11.5px] text-tenue">
          Lo que dice «FALTA» no es cero: es un dato que nadie ha cargado todavía. La carga la hace un importador con el OK de
          Bryan; esta pantalla solo lee.{' '}
          <Link to="/" className="underline">
            Volver a Mi día
          </Link>
        </p>
      )}
    </div>
  )
}
