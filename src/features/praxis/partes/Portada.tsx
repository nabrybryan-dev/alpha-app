import type { Trato } from '../motor/entorno'

/**
 * La portada de ejemplo de Praxis: la tarjeta, el escenario de la demostración, la semana
 * en órbita y el mes como galaxia.
 *
 * Es marcado QUIETO: React lo pinta una vez y a partir de ahí lo gobierna el motor
 * (`motor/bienestar.ts`), que busca cada pieza por su id. Por eso no lleva estado ni
 * manejadores: si React volviera a pintarlo, pisaría lo que el motor escribió.
 */
const ESCENARIO: { id: string; rotulo: string; clave: string; opciones: [string, string][] }[] = [
  { id: 'escFranja', rotulo: 'Hora del check-in', clave: 'franja', opciones: [['manana', '7:10 a. m.'], ['noche', '8:40 p. m.']] },
  { id: 'escIdea', rotulo: '¿Hay idea de ayer?', clave: 'idea', opciones: [['si', 'Sí'], ['no', 'No']] },
  { id: 'escDolor', rotulo: 'Dolor de ayer', clave: 'dolorAyer', opciones: [['no', 'Ninguno'], ['si', '6 en la rodilla']] },
  { id: 'escEstres', rotulo: 'Estrés de ayer', clave: 'estresAyer', opciones: [['mucho', 'Mucho'], ['normal', 'Normal']] },
  { id: 'escPeso', rotulo: 'Pedir peso (lo decide la nutricionista)', clave: 'peso', opciones: [['si', 'Activo'], ['no', 'Apagado']] },
]

export function Portada({ trato }: { trato: Trato }) {
  const usted = trato === 'usted'
  return (
    <>
      <header className="bien-top">
        <div>
          <span className="fecha">MARTES 29 SEP · 7:10 A. M.</span>
          <h1>Bienestar</h1>
        </div>
        <span className="sello-ejemplo" title="Todo lo que ves son datos inventados para el prototipo">Datos de ejemplo</span>
      </header>

      <section className="portada" aria-labelledby="tarjetaTit">
        <div className="portada-cab">
          <span className="kicker-plata">Praxis</span>
          <span className="mono" id="miniRotulo" />
        </div>
        <div className="portada-astro">
          <svg className="mini-firma" id="miniFirma" viewBox="0 0 120 120" role="img" aria-label="Firma de ayer" />
          <p className="bryan-vio" id="bryanVio">
            <b>{usted ? 'Bryan vio su lunes' : 'Bryan vio tu lunes'}</b> ·{' '}
            {usted ? '«La pierna salió bien aunque estaba cansada. Hoy vamos con calma.»' : '«La pierna salió bien aunque estabas cansada. Hoy vamos con calma.»'}{' '}
            <span className="sr">(ejemplo)</span>
          </p>
        </div>
        <h2 className="tarjeta-tit" id="tarjetaTit">{usted ? '¿Cómo amaneció?' : '¿Cómo amaneciste?'}</h2>
        <div className="tarjeta-preg" id="tarjetaPreg" />
        <p className="tarjeta-txt" id="tarjetaTxt" />
        <p className="tarjeta-idea" id="tarjetaIdea" hidden />
        <div className="tarjeta-pie">
          <button className="pildora press" id="btnAbrir" type="button">Hablar con Praxis</button>
          <span className="contador" id="contador" />
        </div>
        <button className="enlace enlace-plata" id="btnRepetir" type="button" hidden>Repetir el ejemplo</button>
        <button className="enlace" id="btnPrefieroForm" type="button" aria-expanded="false" aria-controls="formPlegado">Prefiero el formulario</button>
        <div className="plegado" id="formPlegado" hidden>
          <strong>El formulario de siempre</strong>
          <span>
            Aquí se abre el formulario de siempre, completo y sin cambios: peso y pasos, entreno, {usted ? 'cómo le fue' : 'cómo te fue'}, ganas,
            hambre del 1 al 10, cansancio, estrés, dolor, horas y horario de sueño, calidad, comida y comentarios. (En este ejemplo no se muestra.)
          </span>
          <button className="btn-claro" id="btnVolverPraxis" type="button">Volver a Praxis</button>
        </div>
      </section>

      <section className="seccion" aria-labelledby="escTit">
        <div className="seccion-cab">
          <h2 id="escTit">Escenario del ejemplo</h2>
        </div>
        <p className="sub">
          {usted ? 'Cambie el día de ejemplo y abra la sala' : 'Cambia el día de ejemplo y abre la sala'}: Praxis solo pregunta lo que hace falta hoy.
        </p>
        <div className="escenario" id="escenario">
          {ESCENARIO.map((g) => (
            <div className="esc-grupo" key={g.id}>
              <span className="esc-rot" id={g.id}>{g.rotulo}</span>
              <div className="fila-claro" role="group" aria-labelledby={g.id}>
                {g.opciones.map(([v, txt]) => (
                  <button className="chip-claro" type="button" data-esc={g.clave} data-v={v} key={v}>{txt}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="seccion" aria-labelledby="semTit">
        <div className="seccion-cab">
          <h2 id="semTit">{usted ? 'Su semana' : 'Tu semana'}</h2>
          <span className="mono pie-nota">23 – 29 SEP</span>
        </div>
        <div className="cielo partitura">
          <div className="semana" id="partitura" role="group" aria-label={usted ? 'Su semana en órbita: siete astros, uno por día' : 'Tu semana en órbita: siete astros, uno por día'} />
          <div className="detalle" id="compasDetalle" aria-live="polite" />
        </div>
        <p className="pie-nota">Un día sin registro es un hueco oscuro en la órbita. También es parte del cielo.</p>
      </section>

      <section className="seccion" aria-labelledby="mesTit">
        <div className="seccion-cab">
          <h2 id="mesTit">{usted ? 'Su mes' : 'Tu mes'}</h2>
          <span className="mono pie-nota" id="contadorMes" />
        </div>
        <div className="cielo galaxia">
          <svg id="cordillera" viewBox="0 0 358 236" role="img" aria-label="Galaxia del mes: cada firma es un astro en el brazo; la más reciente, en el borde. La lista con cada día está debajo." />
          <ul className="sr" id="galaxiaLista" />
        </div>
        <p className="pie-nota">La más reciente brilla en el borde; en rojo, hoy. Los días sin registro quedan como huecos oscuros.</p>
      </section>
    </>
  )
}
