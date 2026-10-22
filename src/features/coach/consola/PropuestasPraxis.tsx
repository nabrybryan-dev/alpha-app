import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import type { Decision, PropuestaGuardada, Resultado } from '../../../data/praxis/propuestasCoach'
import { horaDelAviso } from '../../../domain/praxis/aviso'
import { estaVencida, recalcularEnConsola, MOTIVOS_RECHAZO, type MotivoRechazo } from '../../../domain/praxis/propuestaCoach'
import { Tarjeta } from './piezas'

/**
 * La bandeja del coach para el canal «proponer al coach» (diseño del 21-oct-2026; decisiones de Bryan).
 * Es un componente de PRESENTACIÓN: recibe las filas y las acciones por props. Todavía no se monta en la
 * consola ni lee de la base: espera a que Bryan numere y aplique la tabla (borrador en supabase/borradores/).
 *
 *   - El coach ve «Cargas propuestas» y «Pendientes de escribir»; la nutricionista SOLO la segunda, y si le
 *     llegaran filas de carga las descarta aquí también (la base ya no se las da).
 *   - La regla del RIR por cansancio sigue sin firmar: se dice en cada carga.
 *   - La consola recalcula el número y avisa «no coincide con el cálculo» si el guardado difiere.
 *   - Pasadas 12 h la fila queda «vencida» en rojo suave. Praxis no contesta sola.
 *   - Sin texto libre: el rechazo es por botones; lo único que se escribe son los kilos.
 *   - «Aplicar al plan» solo se ofrece sobre lo decidido y sin aplicar; si la escritura no confirma, lo dice.
 */
const TEMA: Record<string, string> = { animo: 'Ánimo', alimentacion: 'Alimentación', otro: 'Otro' }
const ORIGEN: Record<string, string> = { ficha: 'Desde una ficha', filtro_clinico: 'Desde el filtro de salud' }
const RAZON: Record<string, string> = { fuera_de_tabla: 'fuera de la tabla', no_baja: 'no baja' }
const MOTIVO: Record<MotivoRechazo, string> = {
  no_corresponde: 'No corresponde',
  ya_ajustado: 'Ya está ajustado',
  lo_hablo_con_la_persona: 'Lo hablo con la persona',
  otro: 'Otro',
}
const COLOR_BORDE = 'border-linea'
const BORDE_VENCIDA = 'border-rojo/40 bg-rojo/5'

interface Props {
  rol: 'coach' | 'nutricionista'
  propuestas: readonly PropuestaGuardada[]
  ahora: Date
  nombreDe: (usuarioId: string) => string
  onDecidir: (id: string, decision: Decision) => Promise<Resultado>
  onAplicar: (id: string) => Promise<Resultado>
}

export function PropuestasPraxis({ rol, propuestas, ahora, nombreDe, onDecidir, onAplicar }: Props) {
  const cargas = rol === 'coach' ? propuestas.filter((p) => p.tipo === 'bajar_carga') : []
  const contactos = propuestas.filter((p) => p.tipo === 'voy_a_escribirte')

  if (cargas.length === 0 && contactos.length === 0) {
    return <p className="mb-4 rounded-lg border border-dashed border-linea px-3 py-1.5 text-[12.5px] text-tenue">Sin propuestas de Praxis</p>
  }
  return (
    <div className="mb-4 flex flex-col gap-3">
      {rol === 'coach' && cargas.length > 0 && (
        <Tarjeta titulo="Cargas propuestas" destacada>
          <ul className="flex flex-col gap-2">
            {cargas.map((p) => (
              <FilaCarga key={p.id} p={p} ahora={ahora} nombre={nombreDe(p.usuarioId)} onDecidir={onDecidir} onAplicar={onAplicar} />
            ))}
          </ul>
        </Tarjeta>
      )}
      {contactos.length > 0 && (
        <Tarjeta titulo="Pendientes de escribir" destacada>
          <ul className="flex flex-col gap-2">
            {contactos.map((p) => (
              <FilaContacto key={p.id} p={p} ahora={ahora} nombre={nombreDe(p.usuarioId)} onDecidir={onDecidir} />
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}

interface FilaProps {
  p: PropuestaGuardada
  ahora: Date
  nombre: string
  onDecidir: Props['onDecidir']
  onAplicar?: Props['onAplicar']
}

function FilaCarga({ p, ahora, nombre, onDecidir, onAplicar }: FilaProps) {
  const [error, setError] = useState<string | null>(null)
  const [kilos, setKilos] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [ocupada, setOcupada] = useState(false)
  if (p.tipo !== 'bajar_carga') return null
  const vencida = estaVencida(p, ahora)
  const pendiente = p.estado === 'pendiente'
  const recalculo = recalcularEnConsola(p, [])

  const ejecutar = async (accion: () => Promise<Resultado>) => {
    setOcupada(true)
    setError(null)
    try {
      const r = await accion()
      if (!r.ok) setError(r.motivo.replace(/_/g, ' '))
    } catch {
      setError('la llamada falló, vuelve a intentarlo')
    } finally {
      setOcupada(false)
    }
  }

  return (
    <li data-testid={`fila-${p.id}`} data-vencida={vencida} className={`rounded-tarjeta border p-3 ${vencida ? BORDE_VENCIDA : COLOR_BORDE}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm font-bold text-texto">{nombre}</span>
        <span className="text-[12.5px] text-tenue">{p.ejercicioId}</span>
        {vencida && <Badge tono="rojo">Vencida</Badge>}
        <span className="cifras ml-auto text-[12px] font-bold text-tenue">{horaDelAviso(p.creadoEn, ahora.getTime())}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] text-texto">
        Última serie: {p.serieCargaKg} kg × {p.serieReps} @RIR {p.serieRir} · cansancio {p.cansancio} · motivo {p.motivo}
      </p>
      <p className="mt-1 text-[12.5px] text-texto">
        {p.cargaPropuestaKg !== null ? `Propuesta: ${p.cargaPropuestaKg} kg` : `Sin cálculo: ${RAZON[p.razonSinCalculo ?? ''] ?? 'sin razón'}`}
      </p>
      {recalculo.resultado === 'no_coincide' && (
        <p role="status" className="mt-1 text-[12.5px] font-bold text-ambar">
          No coincide con el cálculo de la consola{recalculo.recalculadaKg !== null ? ` (sale ${recalculo.recalculadaKg} kg)` : ''}
        </p>
      )}
      <p className="mt-1 text-[12px] text-tenue">Regla sin firmar: punto de partida, no decisión</p>

      {pendiente && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {p.cargaPropuestaKg !== null && (
            <button type="button" disabled={ocupada} className="tecla-3d rounded-lg border border-verde/50 bg-verde/15 px-3 py-1.5 text-xs font-bold text-verde" onClick={() => ejecutar(() => onDecidir(p.id, { accion: 'aceptar' }))}>
              Aceptar
            </button>
          )}
          <input
            type="number" inputMode="decimal" step="0.5" min="0" aria-label="Kilos a aplicar" value={kilos}
            onChange={(e) => setKilos(e.target.value)} className="w-24 rounded-lg border border-linea bg-surface-2 px-2 py-1.5 text-xs"
          />
          <button
            type="button" disabled={ocupada || !(Number(kilos) > 0)}
            className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:opacity-40"
            onClick={() => ejecutar(() => onDecidir(p.id, { accion: 'ajustar', cargaKg: Number(kilos) }))}
          >
            Ajustar
          </button>
          <button type="button" aria-expanded={rechazando} className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto" onClick={() => setRechazando((v) => !v)}>
            Rechazar
          </button>
        </div>
      )}
      {pendiente && rechazando && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Motivo del rechazo">
          {MOTIVOS_RECHAZO.map((m) => (
            <button key={m} type="button" disabled={ocupada} className="tecla-3d rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-texto" onClick={() => ejecutar(() => onDecidir(p.id, { accion: 'rechazar', motivo: m }))}>
              {MOTIVO[m]}
            </button>
          ))}
        </div>
      )}

      {(p.estado === 'aceptada' || p.estado === 'ajustada') && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="font-bold text-texto">{p.estado === 'aceptada' ? 'Aceptada' : 'Ajustada'}: {p.cargaDecididaKg} kg</span>
          {p.aplicadaEn ? (
            <>
              <Badge tono="verde">Aplicada</Badge>
              <span className="cifras text-tenue">{horaDelAviso(p.aplicadaEn, ahora.getTime())}</span>
            </>
          ) : (
            <>
              <span className="text-ambar">Decidida, sin aplicar</span>
              {onAplicar && (
                <button type="button" disabled={ocupada} className="tecla-3d rounded-lg border border-verde/50 bg-verde/15 px-3 py-1.5 text-xs font-bold text-verde" onClick={() => ejecutar(() => onAplicar(p.id))}>
                  Aplicar al plan
                </button>
              )}
            </>
          )}
        </div>
      )}
      {p.estado === 'rechazada' && <p className="mt-2 text-[12.5px] text-tenue">Rechazada{p.motivoRechazo ? `: ${MOTIVO[p.motivoRechazo]}` : ''}</p>}
      {error && <p role="alert" className="mt-1.5 text-[12px] text-rojo">No se pudo: {error}</p>}
    </li>
  )
}

function FilaContacto({ p, ahora, nombre, onDecidir }: FilaProps) {
  const [error, setError] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState(false)
  if (p.tipo !== 'voy_a_escribirte') return null
  const vencida = estaVencida(p, ahora)

  const atender = async () => {
    setOcupada(true)
    setError(null)
    try {
      const r = await onDecidir(p.id, { accion: 'atender' })
      if (!r.ok) setError(r.motivo.replace(/_/g, ' '))
    } catch {
      setError('la llamada falló, vuelve a intentarlo')
    } finally {
      setOcupada(false)
    }
  }

  return (
    <li data-testid={`fila-${p.id}`} data-vencida={vencida} className={`rounded-tarjeta border p-3 ${vencida ? BORDE_VENCIDA : COLOR_BORDE}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm font-bold text-texto">{nombre}</span>
        <span className="text-[12.5px] font-bold text-texto">{TEMA[p.tema] ?? 'Otro'}</span>
        {vencida && <Badge tono="rojo">Vencida</Badge>}
        <span className="cifras ml-auto text-[12px] font-bold text-tenue">{horaDelAviso(p.creadoEn, ahora.getTime())}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-tenue">{ORIGEN[p.origenContacto] ?? p.origenContacto}</p>
      {p.estado === 'pendiente' ? (
        <div className="mt-2">
          <button type="button" disabled={ocupada} className="tecla-3d rounded-lg border border-verde/50 bg-verde/15 px-3 py-1.5 text-xs font-bold text-verde" onClick={atender}>
            Ya le escribí
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-tenue">Atendida</p>
      )}
      {error && <p role="alert" className="mt-1.5 text-[12px] text-rojo">No se pudo: {error}</p>}
    </li>
  )
}
