import {
  BAJADA,
  formatearPrecio,
  PRECIO_MENSUAL_COP,
  QUE_RECIBES,
  RESPALDO,
  TITULAR,
} from '../../domain/interesados/vitrina'

/**
 * La presentación que va ENCIMA del formulario de interesados: quiénes somos, qué recibe la
 * persona, en qué nos apoyamos (con la fuente a la vista) y el precio. Solo texto y un enlace
 * que baja al formulario: ni campos ni botones, para que el formulario siga siendo lo único
 * que se toca. El contenido vive en `domain/interesados/vitrina.ts`.
 */
export function Vitrina({ anclaFormulario }: { anclaFormulario: string }) {
  return (
    <section aria-label="Qué es Alpha" className="flex flex-col gap-4">
      <header>
        <p className="kicker">Alpha Athletics</p>
        <h1 className="font-display text-3xl leading-tight text-texto">{TITULAR}</h1>
        <p className="mt-2 text-sm text-tenue">{BAJADA}</p>
      </header>

      <div className="rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <h2 className="font-display text-lg text-texto">Qué recibes</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-texto">
          {QUE_RECIBES.map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden="true" className="text-accion">
                ✓
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-texto">
          <span className="font-display text-xl">{formatearPrecio(PRECIO_MENSUAL_COP)}</span>
          <span className="text-tenue"> al mes</span>
        </p>
      </div>

      <div className="rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <h2 className="font-display text-lg text-texto">En qué nos apoyamos</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {RESPALDO.map((r) => (
            <li key={r.frase}>
              <p className="text-sm font-bold text-texto">{r.frase}</p>
              <p className="mt-1 text-sm text-tenue">{r.detalle}</p>
              <p className="mt-1 text-xs text-tenue">Fuente: {r.fuente}</p>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={`#${anclaFormulario}`}
        className="press rounded-boton border border-linea py-3 text-center font-display text-sm uppercase tracking-wide text-texto"
      >
        Empezar: 3 preguntas
      </a>
    </section>
  )
}
