import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db, hoyIso } from '../../data/dbInstance'
import type { MedidaCorporal } from '../../domain/types'
import { CheckDibujado } from '../entrenar/CheckDibujado'

const PERIMETROS = ['Cintura', 'Cadera', 'Abdomen', 'Muslo', 'Brazo'] as const

interface MedidasCardProps {
  usuarioId: string
  /**
   * Si esta persona ve sus cifras de composición corporal.
   *
   * Viene de la decisión de la nutricionista (migración 0018). En `false` la
   * tarjeta pierde la báscula —el campo, el placeholder y el kilaje del
   * resumen— y se queda solo con los perímetros, que su plan sí le pide.
   *
   * Por defecto `true`: quien no pase la prop se comporta como siempre.
   */
  verPeso?: boolean
}

function numeroDe(texto: string): number | undefined {
  const valor = Number.parseFloat(texto.replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : undefined
}

function Delta({ actual, previa }: { actual: number; previa?: number }) {
  if (previa === undefined || previa === actual) return null
  const delta = Math.round((actual - previa) * 10) / 10
  return (
    <span className={`cifras ml-1 text-[10px] font-bold ${delta < 0 ? 'text-accion' : 'text-tenue'}`}>
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )
}

/**
 * Registro de medidas corporales por el propio asesorado (peso + perímetros).
 * Guarda en el perfil y sincroniza a la nube — el coach las ve en su panel.
 */
export function MedidasCard({ usuarioId, verPeso = true }: MedidasCardProps) {
  const [abierto, setAbierto] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [peso, setPeso] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})

  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = perfil?.medidas ?? []
  const ultima = medidas[medidas.length - 1] as MedidaCorporal | undefined
  const previa = medidas[medidas.length - 2] as MedidaCorporal | undefined

  const pesoNum = verPeso ? numeroDe(peso) : undefined

  const perimetrosEscritos = (): Record<string, number> => {
    const perimetros: Record<string, number> = {}
    for (const clave of PERIMETROS) {
      const v = numeroDe(valores[clave] ?? '')
      if (v !== undefined) perimetros[clave] = v
    }
    return perimetros
  }

  /**
   * Con báscula manda el peso; sin ella, al menos un perímetro.
   *
   * Sin esta segunda condición, quitar el peso dejaría guardar una medición
   * vacía: una fila con fecha y nada más, que ensucia el historial del coach y
   * no dice nada de nadie.
   */
  const puedeGuardar = verPeso
    ? pesoNum !== undefined
    : Object.keys(perimetrosEscritos()).length > 0

  const guardar = () => {
    if (!puedeGuardar) return
    db.perfiles.agregarMedida(usuarioId, {
      fecha: hoyIso(),
      // Ausente, no cero: a esta persona no se le pidió la báscula.
      ...(pesoNum !== undefined ? { pesoKg: pesoNum } : {}),
      alturaCm: ultima?.alturaCm ?? 0,
      perimetros: perimetrosEscritos(),
    })
    setAbierto(false)
    setGuardado(true)
    setPeso('')
    setValores({})
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-texto">📏 Mis medidas</p>
          <p className="mt-0.5 text-xs text-tenue">
            {/* El kilaje solo aparece si esta persona ve su composición Y esa
                medición traía peso. Enseñarlo aquí dejaría entrar por la puerta
                de atrás lo que el formulario ya dejó de pedir. */}
            {ultima
              ? verPeso && ultima.pesoKg !== undefined
                ? `Última: ${ultima.fecha} · ${ultima.pesoKg} kg`
                : `Última: ${ultima.fecha}`
              : 'Aún no hay mediciones registradas'}
          </p>
        </div>
        {!abierto && (
          <button
            type="button"
            onClick={() => {
              setAbierto(true)
              setGuardado(false)
            }}
            className="press shrink-0 rounded-full border border-hairline-fuerte px-4 py-2 font-display text-xs text-texto"
          >
            Registrar
          </button>
        )}
      </div>

      {ultima && Object.keys(ultima.perimetros).length > 0 && !abierto && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-hairline pt-2.5">
          {Object.entries(ultima.perimetros).map(([nombre, cm]) => (
            <span key={nombre} className="text-xs text-tenue">
              {nombre} <span className="cifras font-bold text-texto">{cm}</span>
              <Delta actual={cm} previa={previa?.perimetros[nombre]} />
            </span>
          ))}
        </div>
      )}

      {guardado && !abierto && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-texto">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-2.5 w-2.5" />
          </span>
          Medidas guardadas. El coach ya las ve.
        </p>
      )}

      {abierto && (
        <div className="entrada mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
          {verPeso && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-tenue">Peso (kg) *</span>
              <input
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder={ultima?.pesoKg !== undefined ? String(ultima.pesoKg) : 'kg'}
                className="w-24 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-right text-sm text-texto focus:border-rojo focus:outline-none"
              />
            </label>
          )}
          {PERIMETROS.map((nombre) => (
            <label key={nombre} className="flex items-center justify-between gap-3">
              <span className="text-xs text-tenue">{nombre} (cm)</span>
              <input
                inputMode="decimal"
                value={valores[nombre] ?? ''}
                onChange={(e) => setValores((prev) => ({ ...prev, [nombre]: e.target.value }))}
                placeholder={ultima?.perimetros[nombre] ? String(ultima.perimetros[nombre]) : '—'}
                className="w-24 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-right text-sm text-texto focus:border-rojo focus:outline-none"
              />
            </label>
          ))}
          <p className="text-[10px] text-tenue">
            {verPeso
              ? '* El peso es obligatorio; los perímetros que dejes vacíos no se guardan. '
              : 'Anota al menos un perímetro; los que dejes vacíos no se guardan. '}
            Mídete siempre en las mismas condiciones (en ayunas, misma hora).
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="press flex-1 rounded-full border border-hairline py-2.5 font-display text-xs text-tenue"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!puedeGuardar}
              className="press btn-cristal-rojo flex-1 rounded-full py-2.5 font-display text-xs disabled:opacity-40"
            >
              Guardar ✓
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
