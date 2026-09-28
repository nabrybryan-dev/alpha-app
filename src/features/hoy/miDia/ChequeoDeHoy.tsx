import { Link } from 'react-router-dom'
import { db } from '../../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../../data/visibilidadDelAsesorado'
import { UMBRAL_DOLOR_QUE_AVISA } from '../../../domain/senales/dolor'
import { CheckinForm } from '../../bienestar/CheckinForm'
import { CheckDibujado } from '../../entrenar/CheckDibujado'

interface ChequeoDeHoyProps {
  usuarioId: string
  hoy: string
}

function Casilla({ valor, etiqueta, rojo = false }: { valor: string; etiqueta: string; rojo?: boolean }) {
  return (
    <div
      className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center ${
        rojo ? 'border-rojo bg-rojo/10' : 'border-linea bg-surface-2'
      }`}
    >
      <span className="font-display text-xl leading-none text-texto">{valor}</span>
      <span className="text-[11px] text-tenue">{etiqueta}</span>
    </div>
  )
}

/**
 * «Chequeo de hoy», DENTRO de Mi día (maqueta «Espacios de Alpha»): el staff ya no tiene la
 * pestaña Bienestar en la barra, así que el check-in se hace aquí mismo con el MISMO
 * formulario —`CheckinForm`, con la misma regla de peso que Bienestar— y, hecho, se queda
 * en un resumen de tres casillas. El historial y las medidas siguen en /bienestar.
 */
export function ChequeoDeHoy({ usuarioId, hoy }: ChequeoDeHoyProps) {
  const checkins = db.bienestar.byUsuario(usuarioId)
  const deHoy = checkins.find((c) => c.fecha === hoy)
  const verPeso = visibilidadDelAsesorado(usuarioId).verComposicion
  const pesoInicial = [...checkins].reverse().find((c) => c.pesoKg !== undefined)?.pesoKg
  const pasosInicial = [...checkins].reverse().find((c) => c.pasos !== undefined)?.pasos

  return (
    <section
      aria-label="Chequeo de hoy"
      className="entrada entrada-4 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Chequeo de hoy</p>
        {deHoy ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-logrado text-ink-900">
              <CheckDibujado className="h-3 w-3" />
            </span>
            Registrado
          </span>
        ) : (
          <span className="text-xs text-tenue">1 min</span>
        )}
      </div>

      {deHoy ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Casilla valor={deHoy.horasSueno !== undefined ? `${deHoy.horasSueno} h` : '—'} etiqueta="sueño" />
            <Casilla valor={deHoy.estres ?? '—'} etiqueta="estrés" rojo={deHoy.estres === 'MUCHO'} />
            <Casilla
              valor={deHoy.dolor !== undefined ? `${deHoy.dolor}/10` : '—'}
              etiqueta="dolor"
              rojo={deHoy.dolor !== undefined && deHoy.dolor >= UMBRAL_DOLOR_QUE_AVISA}
            />
          </div>
          <Link
            to="/bienestar"
            className="press inline-flex min-h-[44px] items-center self-start text-xs font-semibold text-texto underline underline-offset-2"
          >
            Ver mis últimos 7 días
          </Link>
        </>
      ) : (
        <CheckinForm
          usuarioId={usuarioId}
          fecha={hoy}
          pesoInicial={pesoInicial}
          pasosInicial={pasosInicial}
          pedirPeso={verPeso}
          onGuardar={(c) => db.bienestar.guardar(c)}
        />
      )}
    </section>
  )
}
