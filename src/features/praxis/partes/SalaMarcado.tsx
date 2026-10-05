import type { Trato } from '../motor/entorno'

/**
 * La sala: la barra, el agujero negro (lienzo `#onda`), la frase, las cinco órbitas, los
 * controles y el muelle de texto. Marcado quieto: lo gobierna el motor.
 *
 * Con `conectada` es la sala de la conversación real: sin el rótulo de ejemplo, sin el modo
 * «Rápido» del check-in guiado y sin el botón de micrófono de la maqueta, que era una
 * simulación. Los dos botones siguen en el marcado, ocultos, porque el motor los busca por su id.
 *
 * La voz de verdad es MANTENER PRESIONADO el agujero (`#agujeroHablar`, ver motor/hablar.ts):
 * un botón transparente que el motor coloca justo encima del disco. Lo que va entendiendo el
 * reconocedor se lee en `#enVivo`. Conectada, la barra para escribir nace plegada y la abre
 * el tirador `#btnEscribir` (motor/barra.ts).
 */
const ORBITAS: [string, string][] = [['sueno', 'SUEÑO'], ['energia', 'ENERGÍA'], ['cuerpo', 'CUERPO'], ['comida', 'COMIDA'], ['mente', 'MENTE']]

export function SalaMarcado({ trato, conectada = false, sinFormulario = false }: { trato: Trato; conectada?: boolean; sinFormulario?: boolean }) {
  const cuentame = trato === 'usted' ? 'Cuéntemelo con sus palabras' : 'Cuéntamelo con tus palabras'
  return (
    <div className="sala" id="sala" role="dialog" aria-modal="true" aria-label={conectada ? 'Conversación con Praxis' : 'Check-in con Praxis'} tabIndex={-1} hidden>
      <div className="sala-barra" id="salaBarra">
        <div className="sala-fila">
          <div className="sala-marca"><span className="kicker-plata">Praxis</span><span className="mono" id="salaFecha">{conectada ? '' : '29 SEP · EJEMPLO'}</span></div>
          <div className="sala-acciones">
            <button className="btn-barra" id="btnVoz" type="button" aria-pressed="false" title="Oír la voz sintética de Praxis (apagarla también la calla)">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8v4h3l4 3V5L6 8H3z" /><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" /></svg>
              <span className="sr" id="btnVozTxt">Voz de Praxis</span>
            </button>
            <button className="btn-barra" id="btnMas" type="button" aria-expanded="false" aria-controls="menuMas" aria-label={conectada ? 'Más opciones: respirar, formulario' : 'Más opciones: respirar, formulario, rápido'}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="4.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button className="btn-barra" id="btnCerrar" type="button" aria-label={conectada ? 'Cerrar' : 'Cerrar y guardar borrador'}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>
        </div>
        <p className="ia-linea" id="iaLinea">voz sintética · guía de hábitos, no terapia</p>
        <div className="menu-mas" id="menuMas" hidden>
          <button type="button" id="btnRespirarMenu">Respirar un minuto</button>
          <button type="button" id="btnForm" hidden={sinFormulario}>Formulario</button>
          <button type="button" id="btnRapido" aria-pressed="false" hidden={conectada}>Rápido</button>
        </div>
      </div>
      <div className="sala-cuerpo" id="salaCuerpo">
        <div className="sala-col" id="salaCol">
          <div className="onda-caja" id="ondaCaja">
            <canvas id="onda" aria-hidden="true" />
            <button className="agujero-hablar" id="agujeroHablar" type="button" aria-pressed="false" aria-label={trato === 'usted' ? 'Mantenga presionado para hablar con Praxis' : 'Mantén presionado para hablar con Praxis'} />
            <div className="onda-pie" id="ondaPie" />
            <span className="onda-rotulo" id="ondaRotulo" aria-hidden="true" />
            <div className="onda-acciones" id="filaRespira">
              <button className="enlace enlace-plata" id="btnRespirar" type="button">Respirar un minuto</button>
              <button className="enlace enlace-plata" id="btnCompletar" type="button" hidden>Completar la frase</button>
            </div>
          </div>
          <div className="sala-resto" id="salaResto">
            <div className="dicho" id="dicho" aria-live="polite">
              <p className="nota-primera" id="notaPrimera" />
              <p className="frase" id="frase" />
              <p className="persona en-vivo" id="enVivo" aria-live="off" />
              <p className="persona" id="dijo" />
              <p className="ayuda" id="ayuda" />
              <span className="sr" id="srPiensa" />
            </div>
            <div className="senal" id="senal" hidden />
            <div className="penta" id="penta" aria-label="Pentagrama del día">
              <div className="gracias" id="gracias" aria-hidden="true" />
              {ORBITAS.map(([id, rotulo]) => (
                <div className={`linea l-${id}`} key={id}>
                  <span className="linea-rot" id={`rot-${id}`}>{rotulo}</span>
                  <div className="pista" id={`pista-${id}`} role="list" aria-labelledby={`rot-${id}`} />
                </div>
              ))}
            </div>
            <div className="controles" id="editor" hidden />
            <div className="controles" id="controles" tabIndex={-1} />
            <div className="saltos" id="saltos" hidden>
              <span className="saltos-tit">Hoy Praxis se ajusta</span>
              <div id="saltosLista" />
            </div>
          </div>
        </div>
      </div>
      <button className="btn-escribir" id="btnEscribir" type="button" aria-expanded="false" aria-controls="muelle" aria-label="Escribirle a Praxis" hidden />
      <div className="muelle" id="muelle">
        <div className="muelle-col">
          <div className="sugerencias" id="sugerencias" />
          <form id="formTexto" autoComplete="off">
            <button className="mic" id="btnMic" type="button" aria-pressed="false" aria-label="Micrófono (simulación)" hidden={conectada}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2.5" width="6" height="10" rx="3" /><path d="M4.5 10a5.5 5.5 0 0 0 11 0M10 15.5V18" /></svg>
            </button>
            <label className="sr" htmlFor="entrada">{cuentame}</label>
            <input id="entrada" type="text" placeholder={cuentame} enterKeyHint="send" />
            <button className="enviar" id="btnEnviar" type="submit" aria-label="Enviar">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
