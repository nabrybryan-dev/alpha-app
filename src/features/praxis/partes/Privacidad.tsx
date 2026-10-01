import type { Trato } from '../motor/entorno'

/**
 * «Privacidad y ayuda»: quién es Praxis, qué se guarda, cómo pedir ayuda y los permisos.
 * Marcado quieto, como el resto de la escena: el motor cuelga los oyentes por id.
 *
 * LOS NÚMEROS DE AYUDA son los de la maqueta aprobada, menos la opción 4 del 192: la base
 * de respuestas de seguridad no pudo verificarla (la página de MinSalud da 404) y la línea
 * nacional verificada es el 106. Antes de abrir Praxis a asesorados los revisa un profesional.
 */
const LINEAS: [string, string, string?][] = [
  ['123', 'Línea 123 · emergencias, en todo el país.'],
  ['106', 'Línea 106 · salud mental, Ministerio de Salud, 24 horas, en todo el país.'],
  ['155', 'Línea 155 · violencia contra la mujer o de pareja.'],
  ['141', 'Línea 141 · ICBF, si un niño o una niña está en riesgo.'],
]

export function Privacidad({ trato }: { trato: Trato }) {
  const u = trato === 'usted'
  return (
    <section className="seccion" aria-labelledby="privTit">
      <div className="seccion-cab"><h2 id="privTit">Privacidad y ayuda</h2></div>
      <div className="priv">
        <details>
          <summary>¿Quién es Praxis?</summary>
          <div className="cuerpo">
            <p className="cita-fija">«Soy Praxis, la voz sintética de Alpha: una inteligencia artificial, no una persona. No hago terapia. Bryan y Manuela leen los resúmenes, pero no en el momento.»</p>
            {u ? (
              <p>La voz que puede oír es <strong>sintética</strong>: solo suena si su teléfono tiene una voz propia en español, que funciona sin enviar nada. Si su navegador solo tiene voces en línea, Praxis sigue en texto para no enviar lo que cuenta. No es la voz de nadie y no hay nadie hablando en vivo.</p>
            ) : (
              <p>La voz que puedes oír es <strong>sintética</strong>: solo suena si tu teléfono tiene una voz propia en español, que funciona sin enviar nada. Si tu navegador solo tiene voces en línea, Praxis sigue en texto para no enviar lo que cuentas. No es la voz de nadie y no hay nadie hablando en vivo.</p>
            )}
            <p>
              Praxis no diagnostica ni hace terapia, y no habla de medicamentos, suplementos, pareja ni crianza.{' '}
              {u ? 'Su entreno y su dieta solo los cita de lo que ya decidió su coach.' : 'Tu entreno y tu dieta solo los cita de lo que ya decidió tu coach.'}
            </p>
          </div>
        </details>
        <details>
          <summary>Qué se guarda</summary>
          <div className="cuerpo">
            {u ? (
              <p><strong>Solo lo que toca, escribe o confirma</strong>, y solo cuando toca LISTO. Se guarda en la misma fila de su check-in de hoy, con la fuente de cada dato (toque, texto o voz) y, si lo dijo con sus palabras, la frase literal de donde salió.</p>
            ) : (
              <p><strong>Solo lo que tocas, escribes o confirmas</strong>, y solo cuando tocas LISTO. Se guarda en la misma fila de tu check-in de hoy, con la fuente de cada dato (toque, texto o voz) y, si lo dijiste con tus palabras, la frase literal de donde salió.</p>
            )}
            <p>{u ? 'Un dato que no dio queda en blanco.' : 'Un dato que no diste queda en blanco.'} Nunca se rellena un 7 de sueño ni un peso que nadie midió.</p>
            <p>La firma no se guarda: se vuelve a calcular con {u ? 'sus' : 'tus'} respuestas. El audio nunca se guarda. En este prototipo no hay micrófono: la escucha es una simulación.</p>
            <p>{u ? 'Si cierra a medias' : 'Si cierras a medias'}, el borrador queda solo en este teléfono y se borra al cambiar de día. Lo terminado también se queda aquí hasta el día siguiente.</p>
            <button className="btn-claro" id="btnBorrarBorrador" type="button">Borrar el borrador</button>
          </div>
        </details>
        <details>
          <summary>Cómo pedir ayuda</summary>
          <div className="cuerpo">
            <p>{u ? 'Si está pensando en hacerse daño, llame ya.' : 'Si estás pensando en hacerte daño, llama ya.'} Atienden las 24 horas.</p>
            {LINEAS.map(([numero, que, queUsted]) => (
              <div className="ayuda-fila" key={numero}>
                <span className="num">{numero}</span>
                <span className="que">{u && queUsted ? queUsted : que}</span>
                <button className="btn-claro" type="button" data-copiar={numero}>Copiar</button>
              </div>
            ))}
            {u ? (
              <p>Cuando Praxis nota una señal de riesgo, se queda quieta: sin animaciones, sin sonido y sin consejos, con estos números. Bryan recibe su frase, pero <strong>Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo espere: llame al 123.</strong></p>
            ) : (
              <p>Cuando Praxis nota una señal de riesgo, se queda quieta: sin animaciones, sin sonido y sin consejos, con estos números. Bryan recibe tu frase, pero <strong>Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo esperes: llama al 123.</strong></p>
            )}
            <div className="acciones-claro">
              <button className="btn-claro fuerte" id="btnDemoQuieta" type="button">Ver cómo se ve (demostración)</button>
            </div>
          </div>
        </details>
        <details>
          <summary>{u ? 'Sus permisos' : 'Tus permisos'}</summary>
          <div className="cuerpo">
            <p id="consentFecha" />
            <label className="check"><input type="checkbox" id="cConversacion" /><span>Hacer mi check-in conversando<small>{u ? 'Sin esto, usa el formulario de siempre.' : 'Sin esto, usas el formulario de siempre.'}</small></span></label>
            <label className="check"><input type="checkbox" id="cVoz" disabled /><span>Usar mi voz · Próximamente<small>El audio se transcribirá y se descartará al instante.</small></span></label>
            <label className="check"><input type="checkbox" id="cRiesgo" /><span>Aviso por riesgo<small>{u ? 'Si algo que cuenta es una señal de riesgo, Bryan recibe un aviso con su frase.' : 'Si algo que cuentas es una señal de riesgo, Bryan recibe un aviso con tu frase.'} Sin este permiso Praxis no se activa.</small></span></label>
            <label className="check"><input type="checkbox" id="cSonido" /><span>Sonido del eco<small>Apagado por defecto. {u ? 'Si lo enciende, su día suena al terminar.' : 'Si lo enciendes, tu día suena al terminar.'}</small></span></label>
            <label className="check"><input type="checkbox" id="cMovSuave" /><span>Movimiento suave<small>Praxis se mueve menos: el agujero queda quieto y solo cambia de brillo. {u ? 'Hace lo mismo que el ajuste de reducir movimiento de su teléfono, aunque no lo tenga activado.' : 'Hace lo mismo que el ajuste de reducir movimiento de tu teléfono, aunque no lo tengas activado.'}</small></span></label>
          </div>
        </details>
        <details>
          <summary>Apple Salud</summary>
          <div className="cuerpo">
            <p><strong>Todavía no se conecta.</strong> Alpha es una app web y el iPhone no deja leer Salud desde la web.</p>
            {u ? (
              <p>El camino propuesto es un Atajo de iOS que, una vez al día, envía solo lo que autorice, <strong>un permiso por dato</strong>: pasos, sueño y, solo si su plan lo pide, peso. El acceso del Atajo es suyo, sirve únicamente para escribir esas medidas y lo puede revocar desde «Sus permisos». Salud no sabe de su estrés, su hambre, su dolor ni su ánimo: eso sigue siendo suyo.</p>
            ) : (
              <p>El camino propuesto es un Atajo de iOS que, una vez al día, envía solo lo que autorices, <strong>un permiso por dato</strong>: pasos, sueño y, solo si tu plan lo pide, peso. El acceso del Atajo es tuyo, sirve únicamente para escribir esas medidas y lo puedes revocar desde «Tus permisos». Salud no sabe de tu estrés, tu hambre, tu dolor ni tu ánimo: eso sigue siendo tuyo.</p>
            )}
            <label className="check"><input type="checkbox" disabled /><span>Pasos desde Salud · Próximamente</span></label>
            <label className="check"><input type="checkbox" disabled /><span>Sueño desde Salud · Próximamente</span></label>
            <label className="check"><input type="checkbox" disabled id="cSaludPeso" /><span>Peso desde Salud · Próximamente<small id="saludPesoNota">{u ? 'Solo si su plan pide el peso.' : 'Solo si tu plan pide el peso.'}</small></span></label>
            <div className="salud-demo">
              <span className="marca-ejemplo tenue">Así se vería · ejemplo</span>
              <span>
                {u
                  ? '«Su iPhone dice que durmió 6 horas y 10 minutos, de 12:05 a 6:15. ¿Así lo sintió?» Lo que llega de Salud entra punteado y solo se guarda si lo confirma.'
                  : '«Tu iPhone dice que dormiste 6 horas y 10 minutos, de 12:05 a 6:15. ¿Así lo sentiste?» Lo que llega de Salud entra punteado y solo se guarda si lo confirmas.'}
              </span>
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
