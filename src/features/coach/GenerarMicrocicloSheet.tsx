import { Sheet } from '../../components/ui/Sheet'

interface GenerarMicrocicloSheetProps {
  abierto: boolean
  nombreAsesorado: string
  onCerrar: () => void
}

export function GenerarMicrocicloSheet({ abierto, nombreAsesorado, onCerrar }: GenerarMicrocicloSheetProps) {
  return (
    <Sheet abierto={abierto} titulo="Generar microciclo con IA" onCerrar={onCerrar}>
      <div className="flex flex-col gap-3 text-sm text-texto/90">
        <p>
          Este botón conectará con el <strong>Cerebro Alpha (motor Heracles)</strong> para generar la
          propuesta del siguiente microciclo de {nombreAsesorado}:
        </p>
        <ol className="list-decimal pl-5 leading-relaxed">
          <li>Lee lo pautado vs. lo realizado (cargas, reps, RIR real por serie).</li>
          <li>Cruza bienestar, readiness y adherencia nutricional de la semana.</li>
          <li>Sitúa cada grupo muscular en su landmark de volumen (MEV→MAV→MRV).</li>
          <li>Aplica la jerarquía: seguridad → adherencia → tensión mecánica → VBT → preferencias.</li>
          <li>Devuelve la prescripción lista para revisar, ejercicio por ejercicio.</li>
        </ol>
        <div className="rounded-xl border border-linea bg-surface-2 p-3 font-mono text-xs leading-relaxed">
          <p className="text-tenue">Ejemplo de salida:</p>
          <p className="mt-1 text-texto">
            HIP THRUST → 90KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M22. PAUSA ARRIBA
          </p>
        </div>
        <p className="rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-ambar">
          Disponible en la etapa 3. Hoy este flujo lo ejecuta Bryan con el Cerebro y carga la
          propuesta manualmente.
        </p>
      </div>
    </Sheet>
  )
}
