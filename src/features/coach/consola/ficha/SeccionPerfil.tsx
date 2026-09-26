import { Badge } from '../../../../components/ui/Badge'
import {
  datosAlimentacion,
  edadDe,
  leerCribado,
  partirObjetivo,
  type ColorCribado,
} from '../../../../domain/consolaCoach/perfilCompleto'
import { Falta, ListaDatos, Tarjeta } from '../piezas'
import type { DatosPersona } from '../usePersona'

/**
 * Quién es la persona: objetivo, edad, experiencia, disponibilidad, pauta del bloque;
 * su cribado con el semáforo; y lo que dijo de su alimentación.
 */

const DIAS_CORTOS: Record<string, string> = {
  LUNES: 'L',
  MARTES: 'M',
  MIÉRCOLES: 'X',
  JUEVES: 'J',
  VIERNES: 'V',
  SÁBADO: 'S',
  DOMINGO: 'D',
}

function Disponibilidad({ dias }: { dias: readonly string[] | undefined }) {
  return (
    <span className="flex gap-1" aria-label={dias ? `Días: ${dias.join(', ')}` : 'Días sin decir'}>
      {Object.entries(DIAS_CORTOS).map(([dia, corto]) => {
        const puede = dias?.includes(dia)
        return (
          <span
            key={dia}
            className={`grid h-6 w-6 place-items-center rounded-md border text-[10.5px] font-bold ${
              puede ? 'border-rojo/50 bg-rojo/15 text-rojo' : 'border-linea text-tenue/60'
            }`}
          >
            {corto}
          </span>
        )
      })}
    </span>
  )
}

export function SeccionPerfil({ datos, i }: { datos: DatosPersona; i: number }) {
  const { perfil, perfilNutricion, hoy, lecturaRecortada } = datos

  if (!perfil) {
    return (
      <Tarjeta titulo="Perfil" i={i} className="xl:col-span-7">
        <Falta
          que={lecturaRecortada ? 'Tu permiso no alcanza a la ficha de esta persona' : 'Esta persona no tiene ficha (perfiles)'}
          como={
            lecturaRecortada
              ? 'La tabla perfiles solo la lee el coach (política perfiles_leer). Hace falta una política de lectura para leer_entrenamiento.'
              : 'Se crea al cargar su primer microciclo o al registrar su primera medida.'
          }
        />
      </Tarjeta>
    )
  }

  const objetivo = partirObjetivo(perfil.objetivos)
  const edad = edadDe(perfil, perfilNutricion, hoy)
  const volumen = Object.entries(perfil.volumenSemanal ?? {})

  const datosPerfil = [
    { etiqueta: 'Edad', valor: edad !== undefined ? `${edad} años` : 'Sin dato' },
    {
      etiqueta: 'Experiencia',
      valor:
        perfil.peldanoAlfa !== undefined
          ? `Peldaño ${perfil.peldanoAlfa} de 7 en la Escala Alfa${perfil.valoraciones?.length ? ` · ${perfil.valoraciones.length} valoraciones` : ''}`
          : 'Sin peldaño calculado todavía',
    },
    {
      etiqueta: 'Disponibilidad',
      valor: (
        <span className="flex flex-col gap-1">
          <span>
            {perfil.diasEntrenamiento} días/semana · {perfil.tiempoSesionMin} min por sesión
          </span>
          <Disponibilidad dias={perfil.diasDisponibles} />
          {!perfil.diasDisponibles?.length && (
            <span className="text-[11px] text-tenue">No ha dicho qué días: se lo pide la pantalla de salud.</span>
          )}
        </span>
      ),
    },
    { etiqueta: 'Fase energética', valor: perfil.faseEnergetica || 'Sin pauta cargada' },
    ...(perfil.proteinaGkg !== undefined ? [{ etiqueta: 'Proteína', valor: `${perfil.proteinaGkg} g/kg` }] : []),
    ...(perfil.pasosObjetivo !== undefined
      ? [{ etiqueta: 'Pasos objetivo', valor: perfil.pasosObjetivo.toLocaleString('es-CO') }]
      : []),
    ...(perfil.somatotipo ? [{ etiqueta: 'Somatotipo', valor: perfil.somatotipo }] : []),
  ]

  return (
    <Tarjeta titulo="Perfil" i={i} className="xl:col-span-7">
      {objetivo.apartados.length === 0 && !objetivo.titular ? (
        <Falta que="Sin objetivo escrito" como="El objetivo sale de la ficha (perfiles.objetivos); lo escribe el coach." />
      ) : (
        <div className="mb-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Objetivo</p>
          <p className="mt-0.5 text-[15px] font-bold leading-snug text-texto">
            {objetivo.titular ?? objetivo.apartados[0]?.titulo ?? objetivo.apartados[0]?.texto}
          </p>
          {objetivo.apartados.length > (objetivo.titular ? 0 : 1) && (
            <details className="group mt-1.5 text-[13px]">
              <summary className="cursor-pointer select-none text-xs font-bold text-tenue hover:text-texto">
                Leer la carta completa ({objetivo.apartados.length} apartados)
              </summary>
              <div className="desplegar mt-2 flex flex-col gap-2">
                {objetivo.apartados.map((a, n) => (
                  <p key={n} className="leading-relaxed text-texto/85">
                    {a.titulo && <span className="mr-1 font-bold text-texto">{a.titulo}:</span>}
                    {a.texto}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <ListaDatos datos={datosPerfil} />
      {volumen.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Volumen semanal por grupo</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {volumen.map(([grupo, nivel]) => (
              <span key={grupo} className="rounded-tag border border-linea bg-surface-2 px-2 py-0.5 text-[11.5px]">
                <span className="text-tenue">{grupo}</span> <span className="font-bold text-texto">{nivel}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

const TONO_CRIBADO: Record<ColorCribado, { badge: 'rojo' | 'ambar' | 'verde' | 'neutro'; texto: string }> = {
  rojo: { badge: 'rojo', texto: 'Rojo' },
  ambar: { badge: 'ambar', texto: 'Ámbar' },
  verde: { badge: 'verde', texto: 'Verde' },
  sin_dato: { badge: 'neutro', texto: 'Sin dato' },
}

/** El cribado de salud con su semáforo y cada «sí» con lo que escribió la persona. */
export function SeccionCribado({ datos, i, className = 'xl:col-span-5' }: { datos: DatosPersona; i: number; className?: string }) {
  const lectura = leerCribado(datos.cribado)
  const tono = TONO_CRIBADO[lectura.color]
  return (
    <Tarjeta
      titulo="Lesiones y cribado de salud"
      i={i}
      className={className}
      extra={<Badge tono={tono.badge}>{tono.texto}</Badge>}
    >
      {!datos.cribado ? (
        <Falta
          que={datos.lecturaRecortada ? 'Tu permiso no alcanza al cribado' : 'Sin cribado contestado'}
          como={
            datos.lecturaRecortada
              ? 'cribado solo lo lee el coach (cribado_lee_lo_suyo). Hace falta una política para leer_entrenamiento.'
              : 'Se lo pide la app al abrir Hoy (PAR-Q + los nueve de la entrada mínima).'
          }
        />
      ) : (
        <>
          <p className="text-sm text-texto/90">{lectura.motivo}</p>
          <p className="mt-0.5 text-[11px] text-tenue">
            Contestado el {datos.cribado.fecha} · fuente {datos.cribado.fuente}. Rojo = síntomas con el esfuerzo o
            enfermedad cardíaca; ámbar = cualquier otro «sí». Descriptivo: no decide si entrena.
          </p>
          {lectura.positivos.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {lectura.positivos.map((p) => (
                <li key={p.campo} className="rounded-lg border border-ambar/35 bg-ambar/10 px-2.5 py-1.5 text-[12.5px]">
                  <span className="font-bold text-texto">{p.etiqueta}</span>
                  {p.detalle && <span className="text-texto/80"> — «{p.detalle}»</span>}
                </li>
              ))}
            </ul>
          )}
          {lectura.sinDeclarar.length > 0 && (
            <p className="mt-2 text-[11px] text-tenue">Sin declarar: {lectura.sinDeclarar.join(', ')}.</p>
          )}
        </>
      )}
    </Tarjeta>
  )
}

/** Lo que el formulario de nutrición dice de su alimentación, más el plan cargado. */
export function SeccionAlimentacion({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const lista = datosAlimentacion(datos.perfilNutricion)
  return (
    <Tarjeta titulo="Alimentación" i={i} className={className}>
      {lista.length === 0 ? (
        <Falta
          que="Sin formulario de nutrición"
          como="Lo contesta la persona en Nutrición → «Tu perfil alimentario» (perfil_alimentario)."
        />
      ) : (
        <>
          <ListaDatos datos={lista} />
          {datos.perfilNutricion?.completadaEn && (
            <p className="mt-2 text-[11px] text-tenue">Formulario completado el {datos.perfilNutricion.completadaEn.slice(0, 10)}.</p>
          )}
        </>
      )}
      <div className="mt-3 border-t border-linea pt-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Plan nutricional</p>
        {datos.planNutricional ? (
          <p className="mt-1 text-[13px] leading-relaxed text-texto/90">
            {datos.planNutricional.analisis || 'Plan cargado sin análisis escrito.'}
          </p>
        ) : (
          <p className="mt-1 text-[12.5px] text-tenue">Sin plan nutricional cargado (planes_nutricionales).</p>
        )}
      </div>
    </Tarjeta>
  )
}
