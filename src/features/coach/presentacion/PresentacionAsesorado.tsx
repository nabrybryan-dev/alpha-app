import { tresSemanasDeLaPersona } from '../../../domain/tresSemanas'
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
import { SeccionTresSemanas } from './SeccionTresSemanas'
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

  // LA SEMANA DE AHORA SE DECIDE POR FECHA, NO POR `estado`. `activo` es el microciclo marcado
  // `activo`, y eso no siempre es el que cubre hoy: cuando la semana siguiente ya está cargada, la
  // de ahora queda `cerrado` y `activo` es la que empieza el lunes (pasó el 9-oct-2026 con dos
  // personas). Con `activo` a secas, «Esta semana» enseñaba una semana sin empezar, en ceros, y el
  // mapa marcaba como «la de ahora» una casilla del futuro. Es la misma regla de la sección de
  // las tres semanas, para que las tres secciones hablen de la misma semana.
  const enCurso = useMemo(() => tresSemanasDeLaPersona(historial, hoy).esta?.microciclo ?? activo, [historial, hoy, activo])

  const resumen = useMemo(
    () => resumenSemanalParaPresentar(enCurso, checkins, adherencias, perfil?.medidas ?? [], hoy),
    [enCurso, checkins, adherencias, perfil?.medidas, hoy],
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

      <SeccionDePresentacion
        indice={1}
        titulo="Tu semana pasada, esta y la que viene"
        subtitulo="Lo que te pedimos y lo que hiciste, para que veas el antes, el ahora y lo que sigue."
      >
        <SeccionTresSemanas historial={historial} hoy={hoy} plan={plan} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={2} titulo="El mapa de tu plan" subtitulo="Cada casilla es una semana del plan.">
        <SeccionMapaDelPlan plan={plan} numeroActual={enCurso?.numero} ultimoCerrado={ultimoCerrado} />
      </SeccionDePresentacion>

      <SeccionDePresentacion
        indice={3}
        titulo="Lo que te pedimos y lo que hiciste"
        subtitulo="Semana a semana: las series y el volumen que tocaban, contra los que registraste."
      >
        <SeccionPautadoVsHecho filas={filas} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={4} titulo="Conclusiones" subtitulo="Lo que el equipo dejó escrito de cada semana.">
        <SeccionConclusiones corridas={corridas} conclusiones={conclusiones} />
      </SeccionDePresentacion>

      <SeccionDePresentacion indice={5} titulo="Velocidad y técnica">
        <SeccionVelocidadTecnica nombre={nombre} />
      </SeccionDePresentacion>
    </div>
  )
}
