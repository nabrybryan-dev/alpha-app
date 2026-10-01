import { memo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTema } from '../../app/ThemeProvider'
import { montarPraxis, type PraxisMontada } from './motor/montaje'
import type { Trato } from './motor/entorno'
import { Portada } from './partes/Portada'
import { Privacidad } from './partes/Privacidad'
import { SalaMarcado } from './partes/SalaMarcado'

/**
 * La pantalla de Praxis, diseño COSMOS (aprobado por Bryan el 28-sep-2026).
 *
 * Un cielo en lienzo, un agujero negro cuyo disco son las ondas de voz, las respuestas
 * como estrellas en órbitas. React pinta el marcado UNA vez y el motor (`motor/`) lo
 * gobierna: los dos lienzos, la conversación de ejemplo y la coreografía.
 *
 * TODO LO QUE ENSEÑA ES DE EJEMPLO. No lee ni escribe nada de la base y el cerebro de
 * Praxis no está desplegado, así que solo la monta `PraxisPage`, detrás de la guarda de
 * staff. El sello «Datos de ejemplo» y «29 SEP · EJEMPLO» van a la vista a propósito.
 */
interface Props {
  trato: Trato
  /** A dónde lleva «Salir»: la portada de quien la abrió. */
  salida?: string
}

const Escena = memo(function Escena({ trato, salida = '/' }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const motor = useRef<PraxisMontada | null>(null)
  const { tema } = useTema()

  useEffect(() => {
    if (!raiz.current) return
    const montada = montarPraxis(raiz.current, { trato })
    motor.current = montada
    return () => {
      motor.current = null
      montada.desmontar()
    }
  }, [trato])

  // El tema de la app cambia: los lienzos releen sus colores de los tokens.
  useEffect(() => {
    motor.current?.alCambiarTema()
  }, [tema])

  return (
    <div className="praxis" ref={raiz}>
      <nav className="demo" id="demo" aria-label="Estado de la demostración">
        <Link className="demo-salir" to={salida}>Salir</Link>
        <label className="demo-tit" htmlFor="demoSel">DEMO</label>
        <select id="demoSel" />
        <label className="demo-tit" htmlFor="temaSel">TEMA</label>
        <select id="temaSel" className="demo-tema" defaultValue="">
          <option value="">Sistema</option>
          <option value="dark">Oscuro</option>
          <option value="light">Claro</option>
        </select>
        <button type="button" className="demo-off" id="demoOff">ocultar</button>
      </nav>
      <canvas id="cosmos" aria-hidden="true" />

      <div className="app" id="app">
        <Portada trato={trato} />
        <Privacidad trato={trato} />
        <p className="pie">
          PROTOTIPO · PRAXIS · COSMOS<br />Todas las personas, fechas y cifras son de ejemplo.
        </p>
      </div>

      <SalaMarcado trato={trato} />
      <div className="aviso" id="aviso" role="status" hidden />
    </div>
  )
})

/** Cambiar de trato remonta la escena: el motor escribió sobre el marcado y React no debe reconciliarlo. */
export function PraxisCosmos({ trato, salida }: Props) {
  return <Escena key={trato} trato={trato} salida={salida} />
}
