import type { ReactNode } from 'react'
import { Cifra3D } from '../../components/ui/Cifra3D'
import { nombreDelMicrociclo } from '../../domain/palabrasLlanas'
import type { ResumenSemanalParaPresentar } from '../../domain/resumenSemanalParaPresentar'

interface Props {
  resumen: ResumenSemanalParaPresentar | undefined
}

/**
 * La primera sección de la presentación: cómo le fue a la persona ESTA semana (8-oct-2026,
 * pedido por Bryan: «algo gráfico, con jerarquías visuales, para presentar»).
 *
 * Empezó siendo una hoja (`Sheet`) propia; hoy es el contenido de la primera sección de
 * `PresentacionAsesorado`, que pone el título, la pantalla completa y el orden. El estilo —
 * números grandes con relieve que respiran, las tarjetas entrando una tras otra— sale de la
 * maqueta «Espacios de Alpha» que Bryan aprobó el 28-sep, y ya vive en `Cifra3D`
 * (`.cifra-3d`) y en `.pres-entra`: aquí no se escribe un segundo lenguaje visual.
 *
 * Cada número sale de `resumenSemanalParaPresentar`, que no inventa nada: lo que no hay, no
 * se pinta. Una presentación con un hueco es honesta; una con un número relleno no lo es.
 */
export function PresentacionSemanal({ resumen }: Props) {
  if (!resumen) {
    return <p className="text-sm text-tenue">Sin microciclo activo: no hay semana que presentar todavía.</p>
  }

  const { sesiones } = resumen
  return (
    <div className="flex flex-col gap-3">
      <p className="kicker !text-[12px]">{nombreDelMicrociclo(resumen.microcicloNumero, true)}</p>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta demora="0s" etiqueta="sesiones hechas">
          <Cifra3D
            valor={sesiones.registradas}
            sufijo={`/${sesiones.totales}`}
            rojo={sesiones.registradas < sesiones.totales}
            tamano={32}
            etiqueta={`${sesiones.registradas} de ${sesiones.totales} sesiones`}
          />
        </Tarjeta>
        {resumen.horasSuenoPromedio !== undefined && (
          <Tarjeta demora=".08s" etiqueta="h de sueño por noche">
            <Cifra3D
              valor={resumen.horasSuenoPromedio}
              decimales={1}
              tamano={32}
              etiqueta={`${fmt1(resumen.horasSuenoPromedio)} horas de sueño por noche`}
            />
          </Tarjeta>
        )}
        {resumen.adherenciaNutricionPct !== undefined && (
          <Tarjeta demora=".16s" etiqueta="de tu alimentación cumplida">
            <Cifra3D
              valor={resumen.adherenciaNutricionPct}
              sufijo="%"
              rojo={resumen.adherenciaNutricionPct < 70}
              tamano={32}
              etiqueta={`${resumen.adherenciaNutricionPct} % de tu alimentación cumplida`}
            />
          </Tarjeta>
        )}
        {resumen.pesoKg !== undefined && (
          <Tarjeta
            demora=".24s"
            etiqueta={
              resumen.pesoDelta
                ? `kg · ${resumen.pesoDelta.kg > 0 ? '+' : ''}${fmt1(resumen.pesoDelta.kg)} en ${resumen.pesoDelta.dias} días`
                : 'kg'
            }
          >
            <Cifra3D valor={resumen.pesoKg} decimales={1} tamano={32} etiqueta={`${fmt1(resumen.pesoKg)} kilos`} />
          </Tarjeta>
        )}
      </div>

      {sesiones.registradas === 0 && sesiones.totales === 0 && (
        <p className="text-xs text-tenue">Esta semana no trae sesiones pautadas.</p>
      )}
    </div>
  )
}

function fmt1(n: number): string {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function Tarjeta({ etiqueta, demora, children }: { etiqueta: string; demora: string; children: ReactNode }) {
  return (
    <div
      className="pres-entra flex flex-col gap-1 rounded-2xl border border-linea bg-surface-2 p-4"
      style={{ animationDelay: demora }}
    >
      {children}
      <span className="text-xs text-tenue">{etiqueta}</span>
    </div>
  )
}
