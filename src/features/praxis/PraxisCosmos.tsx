import { memo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTema } from '../../app/ThemeProvider'
import type { ConexionPraxis } from './motor/conexion'
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
 * gobierna: los dos lienzos, la conversación y la coreografía.
 *
 * CON `conexion` (así la monta `PraxisPage`, siempre) es la pantalla CONECTADA: enseña los
 * check-ins reales de la persona con sesión, contesta del plan con lo que deja pasar la
 * lista blanca, manda lo que se escribe al registrador y guarda solo lo confirmado.
 *
 * SIN `conexion` es la escena de EJEMPLO de la maqueta, con sus sellos «Datos de ejemplo» a
 * la vista. La ruta ya no la monta así: queda para las pruebas del check-in guiado, que
 * volverá cuando el check-in se pueda guardar por partes (prerrequisito P2 del registrador).
 */
interface Props {
  trato: Trato
  /** A dónde lleva «Salir»: la portada de quien la abrió. */
  salida?: string
  /** Los datos y el cerebro reales. Tiene que ser ESTABLE entre renders: si cambia, la escena se remonta. */
  conexion?: ConexionPraxis | null
}

const Escena = memo(function Escena({ trato, salida = '/', conexion = null }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const motor = useRef<PraxisMontada | null>(null)
  const { tema } = useTema()
  const conectada = conexion !== null
  const sinFormulario = conectada && !conexion.irAlFormulario

  useEffect(() => {
    if (!raiz.current) return
    const montada = montarPraxis(raiz.current, { trato, conexion })
    motor.current = montada
    return () => {
      motor.current = null
      montada.desmontar()
    }
  }, [trato, conexion])

  // El tema de la app cambia: los lienzos releen sus colores de los tokens.
  useEffect(() => {
    motor.current?.alCambiarTema()
  }, [tema])

  return (
    <div className="praxis" ref={raiz} data-conectada={conectada ? '' : undefined}>
      <nav className="demo" id="demo" aria-label={conectada ? 'Praxis' : 'Estado de la demostración'}>
        <Link className="demo-salir" to={salida}>Salir</Link>
        {!conectada && <label className="demo-tit" htmlFor="demoSel">DEMO</label>}
        {!conectada && <select id="demoSel" />}
        <label className="demo-tit" htmlFor="temaSel">TEMA</label>
        <select id="temaSel" className="demo-tema" defaultValue="">
          <option value="">Sistema</option>
          <option value="dark">Oscuro</option>
          <option value="light">Claro</option>
        </select>
        {!conectada && <button type="button" className="demo-off" id="demoOff">ocultar</button>}
      </nav>
      <canvas id="cosmos" aria-hidden="true" />

      <div className="app" id="app">
        <Portada trato={trato} conectada={conectada} sinFormulario={sinFormulario} />
        <Privacidad trato={trato} conectada={conectada} />
        {conectada ? (
          <p className="pie">
            PRAXIS · SOLO EL EQUIPO<br />
            {trato === 'usted' ? 'Lo que ve es suyo: su plan aprobado y sus check-ins.' : 'Lo que ves es tuyo: tu plan aprobado y tus check-ins.'} Los asesorados todavía no ven esta pantalla.
          </p>
        ) : (
          <p className="pie">
            PROTOTIPO · PRAXIS · COSMOS<br />Todas las personas, fechas y cifras son de ejemplo.
          </p>
        )}
      </div>

      <SalaMarcado trato={trato} conectada={conectada} sinFormulario={sinFormulario} />
      <div className="aviso" id="aviso" role="status" hidden />
    </div>
  )
})

/** Cambiar de trato (o de fuente) remonta la escena: el motor escribió sobre el marcado y React no debe reconciliarlo. */
export function PraxisCosmos({ trato, salida, conexion }: Props) {
  return <Escena key={`${trato}-${conexion ? 'conectada' : 'ejemplo'}`} trato={trato} salida={salida} conexion={conexion} />
}
