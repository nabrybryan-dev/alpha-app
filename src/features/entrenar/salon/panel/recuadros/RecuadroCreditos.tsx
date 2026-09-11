import { CREDITOS_DEL_GIMNASIO, obligaACitar } from '../../../visor/creditos'

/**
 * LOS CRÉDITOS DEL GIMNASIO, al pie del panel.
 *
 * Va aquí y no flotando sobre la sala porque el kit manda: encima del salón no se pone
 * ningún mando. El panel es el sitio donde ya vive lo que se consulta y no se toca durante
 * la serie —el calendario, el bloque, el encoder—, y esto es exactamente eso.
 *
 * Lo que la licencia exige es que el autor esté **visible y alcanzable**, no que se lea
 * bonito. Por eso cada obra es un enlace a su ficha y el nombre del autor va en el texto,
 * no escondido en un `title` ni en un atributo que solo lee una máquina.
 */
export function RecuadroCreditos() {
  return (
    <ul className="flex flex-col gap-2">
      {CREDITOS_DEL_GIMNASIO.map((f) => (
        <li key={f.enlace} className="rounded-bloque border border-white/10 bg-ink-700 px-3.5 py-2.5">
          <a
            href={f.enlace}
            target="_blank"
            rel="noreferrer"
            className="press text-sm font-semibold text-texto underline decoration-white/25 underline-offset-2"
          >
            {f.obra}
          </a>
          <p className="mt-0.5 text-xs text-tenue">
            {f.queEs}
          </p>
          <p className="mt-1 text-[11px] text-tenue">
            <span className="text-silver-300">{f.autor}</span>
            {' · '}
            <span className={obligaACitar(f) ? 'text-silver-400' : 'text-tenue'}>{f.licencia}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}
