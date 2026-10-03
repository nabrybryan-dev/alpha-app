import type { PerfilAntropometrico } from './personalizacion'

export interface ResultadoBiomecanico {
  patronId: string
  segmentos: { fijoCm: number; movilCm: number }
  brazoMomentoExternoCm: number
  vectorCarga: { x: number; y: number; z: number }
  distribucionCarga: { anterior: number; posterior: number }
  centroDeMasas: { x: number; y: number; z: number }
}

const redondear = (valor: number) => Number(valor.toFixed(4))

export function calcularPalancas(
  perfil: PerfilAntropometrico,
  patronId: string,
): ResultadoBiomecanico {
  const longitudPierna = perfil.femurCm + perfil.tibiaCm
  const anterior = Math.min(0.8, Math.max(0.2, perfil.pieCm / longitudPierna))
  const posterior = 1 - anterior

  return {
    patronId,
    segmentos: { fijoCm: perfil.tibiaCm, movilCm: perfil.femurCm },
    brazoMomentoExternoCm: redondear(
      (perfil.femurCm * perfil.torsoCm) / perfil.estaturaCm,
    ),
    vectorCarga: {
      x: redondear(perfil.pieCm / perfil.estaturaCm),
      y: redondear(-perfil.masaKg * 9.80665),
      z: redondear(perfil.antebrazoCm / perfil.estaturaCm),
    },
    distribucionCarga: {
      anterior: redondear(anterior),
      posterior: redondear(posterior),
    },
    centroDeMasas: {
      x: redondear(perfil.pieCm * anterior),
      y: redondear((perfil.tibiaCm + perfil.femurCm + perfil.torsoCm * 0.55) / 100),
      z: redondear((perfil.brazoCm + perfil.antebrazoCm) / 200),
    },
  }
}
