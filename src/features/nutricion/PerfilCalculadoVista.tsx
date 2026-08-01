import type { PerfilCalculado } from '../../domain/nutricion/perfilCalculado'
import type { Visibilidad } from '../../domain/nutricion/visibilidad'

/**
 * Lo que el asesorado ve de sus propias cifras.
 *
 * QUÉ SE ENSEÑA LO DECIDE `visibilidad`, no esta pantalla. Aquí solo se pinta.
 * El cálculo ya se hizo entero —el coach y la nutricionista lo ven completo—;
 * esto es la parte que llega a la persona.
 *
 * Y todo lo que se enseña va con su matiz. Un porcentaje de grasa sin decir que
 * es una estimación se lee como una medición, y unas calorías sin decir que
 * están pendientes de revisión se leen como una prescripción. Las dos cosas
 * serían mentira.
 */

interface PerfilCalculadoVistaProps {
  perfil: PerfilCalculado
  visibilidad: Visibilidad
  nombre: string
}

const cifra = (valor: number | null, decimales = 0) =>
  valor === null ? '—' : valor.toLocaleString('es-CO', { maximumFractionDigits: decimales })

export function PerfilCalculadoVista({ perfil, visibilidad, nombre }: PerfilCalculadoVistaProps) {
  const nadaQueVer = !visibilidad.verComposicion && !visibilidad.verObjetivoCalorico

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">Tu perfil</p>
        <h2 className="font-display text-lg text-texto">{nombre}</h2>
      </header>

      {visibilidad.estado === 'en_espera' && (
        // No se le dice "tienes una bandera": se le dice que su plan lo está
        // mirando una persona, que es lo que de verdad está pasando.
        <p className="rounded-2xl border border-azul/40 bg-azul/10 p-4 text-sm leading-snug text-texto">
          Tu nutricionista está revisando tus datos antes de mostrarte las cifras. Mientras tanto
          puedes registrar lo que comes con normalidad.
        </p>
      )}

      {visibilidad.verComposicion && (
        <section className="rounded-3xl border border-linea bg-surface-1 p-4">
          <h3 className="font-display text-sm text-texto">Tu composición</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Dato etiqueta="Grasa" valor={cifra(perfil.grasaPct, 1)} unidad="%" />
            <Dato etiqueta="Masa magra" valor={cifra(perfil.masaMagraKg, 1)} unidad="kg" />
            <Dato etiqueta="IMC" valor={cifra(perfil.imc, 1)} />
          </div>
          <p className="mt-3 text-[11px] leading-snug text-tenue">
            Es una <b className="text-texto">estimación</b> a partir de tus medidas, con un margen
            de 3 a 4 puntos. Sirve para seguir tu propia evolución, no para compararte con nadie.
          </p>
          {perfil.imc !== null && (
            // El IMC no distingue músculo de grasa. En una asesoría de fuerza
            // eso no es un matiz: es la diferencia entre un dato y un insulto.
            <p className="mt-1 text-[11px] leading-snug text-tenue">
              El IMC solo cruza peso y altura: no sabe cuánto de ese peso es músculo. Mira antes el
              porcentaje de grasa.
            </p>
          )}
        </section>
      )}

      {visibilidad.verObjetivoCalorico && (
        <section className="rounded-3xl border border-linea bg-surface-1 p-4">
          <h3 className="font-display text-sm text-texto">Tu gasto estimado</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Dato etiqueta="En reposo" valor={cifra(perfil.tmb)} unidad="kcal" />
            <Dato etiqueta="Actividad" valor={cifra(perfil.factorActividad, 2)} unidad="×" />
            <Dato etiqueta="Al día" valor={cifra(perfil.tdee)} unidad="kcal" />
          </div>

          {perfil.macros && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                Punto de partida
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Dato etiqueta="Proteína" valor={String(perfil.macros.proteinaG)} unidad="g" />
                <Dato etiqueta="Carbos" valor={String(perfil.macros.carbosG)} unidad="g" />
                <Dato etiqueta="Grasas" valor={String(perfil.macros.grasaG)} unidad="g" />
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-snug text-tenue">
            Es un <b className="text-texto">punto de partida calculado</b>, no tu plan. Tu
            nutricionista lo revisa y lo ajusta a ti.
          </p>
        </section>
      )}

      {perfil.energia && visibilidad.verObjetivoCalorico && (
        <section
          className={`rounded-2xl border p-4 ${
            perfil.energia.estado === 'problema'
              ? 'border-accion/40 bg-accion/10'
              : perfil.energia.estado === 'vigilancia'
                ? 'border-ambar/40 bg-ambar/10'
                : 'border-linea bg-surface-2'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            Energía disponible
          </p>
          <p className="cifras mt-1 text-lg font-bold text-texto">
            {perfil.energia.disponibilidad} kcal/kg
          </p>
          <p className="mt-1 text-[11px] leading-snug text-tenue">
            {perfil.energia.estado === 'problema'
              ? 'Estás comiendo menos de lo que tu cuerpo necesita para funcionar. Habla con tu nutricionista.'
              : perfil.energia.estado === 'vigilancia'
                ? 'Vas justo. Conviene que tu nutricionista lo mire.'
                : 'Tienes energía suficiente para entrenar y recuperarte.'}
          </p>
        </section>
      )}

      {nadaQueVer && visibilidad.estado !== 'en_espera' && (
        <p className="rounded-2xl border border-linea bg-surface-2 p-4 text-sm leading-snug text-tenue">
          Tu nutricionista prefiere trabajar contigo sin cifras por ahora. Sigue registrando: ella
          las está viendo todas.
        </p>
      )}

      {perfil.incompleto.length > 0 && (
        <p className="text-[11px] leading-snug text-tenue">
          Falta calcular {perfil.incompleto.join(', ')}: revisa que tus medidas estén completas.
        </p>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, unidad }: { etiqueta: string; valor: string; unidad?: string }) {
  return (
    <div className="rounded-2xl border border-linea bg-surface-2 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-tenue">{etiqueta}</p>
      <p className="cifras mt-1 text-lg font-bold leading-none text-texto">{valor}</p>
      {unidad && <p className="text-[10px] text-tenue">{unidad}</p>}
    </div>
  )
}
