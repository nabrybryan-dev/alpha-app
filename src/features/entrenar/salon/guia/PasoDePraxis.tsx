import type { PasoDelGuion } from './guionDelDia'

/**
 * UN PASO DE LO QUE PRAXIS CUENTA. El orden es el de quien está por entrenar: qué se hace, qué cambió,
 * qué pidió el coach y cómo se ejecuta. Las dudas van plegadas: se abren solo si hay duda. Las acciones
 * son texto, no teclas, y lo único con peso es «Seguir».
 */

const ROTULO = 'text-[11px] font-bold uppercase tracking-[0.14em]'

function Bloque({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className="mt-3">
      <h4 className={`${ROTULO} text-tenue`}>{rotulo}</h4>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-texto">{texto}</p>
    </div>
  )
}

export function PasoDePraxis({ paso }: { paso: PasoDelGuion }) {
  return (
    <>
      {paso.prescripcion && <p className="cifras text-sm font-semibold text-texto">{paso.prescripcion}</p>}
      {paso.frases.map((f) => (
        <p key={f} className="mt-1 whitespace-pre-line text-sm leading-relaxed text-texto">
          {f}
        </p>
      ))}
      {paso.nuevo.length > 0 && (
        <div className="mt-3">
          <h4 className={ROTULO} style={{ color: 'var(--oro)' }}>
            Nuevo
          </h4>
          {paso.nuevo.map((n) => (
            <p key={n} className="mt-1 text-sm text-texto">
              {n}
            </p>
          ))}
        </div>
      )}
      {paso.notaCoach && <Bloque rotulo="Tu coach te pide" texto={paso.notaCoach} />}
      {paso.tecnica && <Bloque rotulo="Cómo hacerlo" texto={paso.tecnica} />}
      {paso.dudas.length > 0 && (
        <div className="mt-3">
          <h4 className={`${ROTULO} text-tenue`}>Dudas</h4>
          {paso.dudas.map((d) => (
            <details key={d.pregunta} className="border-b border-linea">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-texto">{d.pregunta}</summary>
              <p className="pb-3 text-sm leading-relaxed text-tenue">{d.respuesta}</p>
            </details>
          ))}
        </div>
      )}
    </>
  )
}
