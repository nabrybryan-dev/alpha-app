import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db, hoyIso } from '../../data/dbInstance'
import type { MedidaCorporal } from '../../domain/types'

const PERIMETROS = ['Cintura', 'Cadera', 'Abdomen', 'Muslo', 'Brazo'] as const

interface MedidasCardProps {
  usuarioId: string
}

function numeroDe(texto: string): number | undefined {
  const valor = Number.parseFloat(texto.replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : undefined
}

function Delta({ actual, previa }: { actual: number; previa?: number }) {
  if (previa === undefined || previa === actual) return null
  const delta = Math.round((actual - previa) * 10) / 10
  return (
    <span className={`cifras ml-1 text-[10px] font-bold ${delta < 0 ? 'text-verde' : 'text-ambar'}`}>
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )
}

/**
 * Registro de medidas corporales por el propio asesorado (peso + perímetros).
 * Guarda en el perfil y sincroniza a la nube — el coach las ve en su panel.
 */
export function MedidasCard({ usuarioId }: MedidasCardProps) {
  const [abierto, setAbierto] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [peso, setPeso] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})

  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = perfil?.medidas ?? []
  const ultima = medidas[medidas.length - 1] as MedidaCorporal | undefined
  const previa = medidas[medidas.length - 2] as MedidaCorporal | undefined

  const pesoNum = numeroDe(peso)
  const guardar = () => {
    if (pesoNum === undefined) return
    const perimetros: Record<string, number> = {}
    for (const clave of PERIMETROS) {
      const v = numeroDe(valores[clave] ?? '')
      if (v !== undefined) perimetros[clave] = v
    }
    db.perfiles.agregarMedida(usuarioId, {
      fecha: hoyIso(),
      pesoKg: pesoNum,
      alturaCm: ultima?.alturaCm ?? 0,
      perimetros,
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
            {ultima
              ? `Última: ${ultima.fecha} · ${ultima.pesoKg} kg`
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
        <p className="mt-2 text-xs font-bold text-verde">Medidas guardadas ✓ El coach ya las ve.</p>
      )}

      {abierto && (
        <div className="entrada mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-tenue">Peso (kg) *</span>
            <input
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder={ultima ? String(ultima.pesoKg) : 'kg'}
              className="w-24 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-right text-sm text-texto focus:border-rojo focus:outline-none"
            />
          </label>
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
            * El peso es obligatorio; los perímetros que dejes vacíos no se guardan. Mídete siempre
            en las mismas condiciones (en ayunas, misma hora).
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
              disabled={pesoNum === undefined}
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
