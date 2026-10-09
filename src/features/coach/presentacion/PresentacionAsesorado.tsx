import { useMemo, useState } from 'react'
import { PantallaCompleta } from '../../../components/ui/PantallaCompleta'
import { conclusionesPorMicrociclo } from '../../../domain/presentacionAsesorado'
import { pautadoVsHechoPorMicrociclo } from '../../../domain/pautadoVsHecho'
import { resumenSemanalParaPresentar } from '../../../domain/resumenSemanalParaPresentar'
import type { Microciclo } from '../../../domain/types'
import type { DatosPersona } from '../consola/usePersona'
import { PresentacionSemanal } from '../PresentacionSemanal'
import { SeccionConclusiones } from './SeccionConclusiones'
import { SeccionDePresentacion } from './SeccionDePresentacion'
import { SeccionMapaDelPlan } from './SeccionMapaDelPlan'
import { SeccionPautadoVsHecho } from './SeccionPautadoVsHecho'
import { SeccionVelocidadTecnica } from './SeccionVelocidadTecnica'

interface Props {
  datos: DatosPersona
  /** Todos los microciclos que la persona tiene cargados (el historial de la consola). */
  historial: readonly Microciclo[]
}

/**
 * El botón «Presentar a <nombre>» y, al pulsarlo, la presentación a pantalla completa.
 *
 * Es lo que Manuela abre durante la llamada con un asesorado para MOSTRARLE cómo va (9-oct-2026,
 * pedido por Bryan: jerarquías visuales y movimiento, con datos que ya existen y sin que nadie
 * escriba nada). Solo LEE: ni este botón ni la presentación escriben en la base, y cerrada no
 * hace ninguna lectura.
 */
export function PresentarAlAsesorado({ datos, historial }: Props) {
  const [abierta, setAbierta] = useState(false)
  const nombre = datos.usuario?.nombre
  if (!nombre) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center justify-center rounded-boton bg-rojo px-5 text-sm font-bold text-white shadow-halo"
      >
        Presentar a {nombre}
      </button>
      {abierta && (
        <PantallaCompleta titulo={`Presentación de ${nombre}`} onCerrar={() => setAbierta(false)}>
          <ContenidoDeLaPresentacion datos={datos} historial={historial} nombre={nombre} />
        </PantallaCompleta>
      )}
    </>
  )
}

function ContenidoDeLaPresentacion({ datos, historial, nombre }: Props & { nombre: string }) {
  const { activo, checkins, adherencias, perfil, hoy, plan, corridas, usuario } = datos

  const resumen = useMemo(
    () => resumenSemanalParaPresentar(activo, checkins, adherencias, perfil?.medidas ?? [], hoy),
    [activo, checkins, adherencias, perfil?.medidas, hoy],
  )
  const filas = useMemo(() => pautadoVsHechoPorMicrociclo(historial), [historial])
  const ultimoCerrado = useMemo(
    () => historial.filter((m) => m.estado === 'cerrado').reduce<number | undefined>((max, m) => (max === undefined || m.numero > max ? m.numero : max), undefined),
    [historial],
  )
  const conclusiones = useMemo(
    () => (corridas.estado === 'listo' && usuario ? conclusionesPorMicrociclo(corridas.valor, usuario.id, historial) : []),
    [corridas, usuario, historial],
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <SeccionDePresentacion indice={0} titulo="Esta semana">
        <PresentacionSemanal resumen={resumen} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={1} titulo="El mapa de tu plan" subtitulo="Cada casilla es una semana del plan.">
        <SeccionMapaDelPlan plan={plan} numeroActual={activo?.numero} ultimoCerrado={ultimoCerrado} />
      </SeccionDePresentacion>

      <SeccionDePresentacion
        indice={2}
        titulo="Lo que te pedimos y lo que hiciste"
        subtitulo="Semana a semana: las series y el volumen que tocaban, contra los que registraste."
      >
        <SeccionPautadoVsHecho filas={filas} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={3} titulo="Conclusiones" subtitulo="Lo que el equipo dejó escrito de cada semana.">
        <SeccionConclusiones corridas={corridas} conclusiones={conclusiones} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={4} titulo="Velocidad y técnica">
        <SeccionVelocidadTecnica nombre={nombre} />
      </SeccionDePresentacion>
    </div>
  )
}
