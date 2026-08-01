import { useState } from 'react'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { Sheet } from '../../components/ui/Sheet'
import { Stepper } from '../../components/ui/Stepper'
import {
  avanceDeCalibracion,
  errorPct,
  queDebePesar,
  DIAS_MINIMOS,
  PRUEBAS_MINIMAS,
  SESGO_MAXIMO,
  type Prueba,
} from '../../domain/nutricion/calibracion'
import { SheetBuscarAlimento } from './SheetBuscarAlimento'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'

/**
 * Entrenar el ojo para poder soltar la báscula.
 *
 * POR QUÉ EXISTE. Todo el método es «fase 1: pesar → fase 2: estimar», y la
 * segunda fase no llegaba nunca: la app sabía que un registro calibrado vale
 * ±15 %, pero nadie podía alcanzar ese estado porque no había forma de medir el
 * ojo de nadie. El asesorado pesaba para siempre.
 *
 * SE ESTIMA PRIMERO Y SE PESA DESPUÉS, y ese orden es la prueba entera. Al
 * revés no se mide el ojo: se copia la báscula.
 *
 * LO QUE SE MIDE ES EL SESGO. Fallar mucho alternando arriba y abajo se cancela
 * en la semana; quedarse corto SIEMPRE un 15 % no se cancela nunca — son unas
 * 250 kcal diarias que no existen en el registro.
 */

interface PanelCalibracionProps {
  pruebas: Prueba[]
  diasPesando: number
  onRegistrar: (prueba: { alimentoId: string; estimados: number; reales: number }) => void
}

export function PanelCalibracion({ pruebas, diasPesando, onRegistrar }: PanelCalibracionProps) {
  const [buscando, setBuscando] = useState(false)
  const [alimento, setAlimento] = useState<AlimentoIndice | null>(null)

  const avance = avanceDeCalibracion(pruebas, diasPesando)
  const debePesar = queDebePesar(pruebas, diasPesando)

  return (
    <section className="rounded-3xl border border-linea bg-surface-1 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm text-texto">Tu ojo</h3>
        <span className="cifras text-[11px] text-tenue">
          {avance.pruebas} / {PRUEBAS_MINIMAS} pruebas
        </span>
      </div>

      {avance.calibrado ? (
        <p className="mt-2 text-sm leading-snug text-texto">
          <b>Ya puedes dejar la báscula.</b> Estimas con un margen de{' '}
          {Math.abs(avance.sesgoPct ?? 0).toFixed(0)} %, dentro de lo que necesitamos. Sigue
          registrando a ojo y de vez en cuando comprueba.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-snug text-tenue">
            {/* Se dice qué falta y en qué orden, no un porcentaje de progreso:
                «te faltan 4 pruebas» se puede accionar hoy; «vas al 73 %» no. */}
            {avance.pruebasQueFaltan > 0 && (
              <>
                Te faltan <b className="text-texto">{avance.pruebasQueFaltan}</b>{' '}
                {avance.pruebasQueFaltan === 1 ? 'prueba' : 'pruebas'}
              </>
            )}
            {avance.pruebasQueFaltan > 0 && avance.diasQueFaltan > 0 && ' y '}
            {avance.diasQueFaltan > 0 && (
              <>
                <b className="text-texto">{avance.diasQueFaltan}</b>{' '}
                {avance.diasQueFaltan === 1 ? 'día' : 'días'}
              </>
            )}
            {avance.pruebasQueFaltan === 0 && avance.diasQueFaltan === 0 ? (
              <>
                Ya tienes suficientes pruebas, pero todavía te desvías{' '}
                <b className="text-texto">{Math.abs(avance.sesgoPct ?? 0).toFixed(0)} %</b> siempre
                en la misma dirección. Sigue practicando: el margen es de ±{SESGO_MAXIMO} %.
              </>
            ) : (
              ' para saber si ya estimas bien.'
            )}
          </p>

          {avance.sesgoPct !== null && avance.pruebas >= 3 && (
            <p className="mt-1.5 text-[11px] leading-snug text-tenue">
              Por ahora{' '}
              <b className="text-texto">
                {avance.sesgoPct > 0 ? 'te pasas' : 'te quedas corto'} un{' '}
                {Math.abs(avance.sesgoPct).toFixed(0)} %
              </b>{' '}
              de media.
            </p>
          )}

          {typeof debePesar === 'object' && (
            // Pasadas cuatro semanas no se le deja pesando todo: castigarle con
            // la báscula entera es como se pierde la adherencia.
            <p className="mt-2 rounded-2xl border border-ambar/40 bg-ambar/10 p-3 text-[11px] leading-snug text-texto">
              Llevas un mes practicando. De ahora en adelante <b>pesa solo esto</b>, que es lo que
              peor calculas:{' '}
              {debePesar.peores
                .map((id) => catalogoRepo.porId(id)?.nombre.split(',')[0] ?? id)
                .join(' · ')}
            </p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setBuscando(true)}
        className="press mt-3 w-full rounded-2xl border border-dashed border-accion/50 bg-accion/5 py-3 text-sm font-semibold text-accion"
      >
        Hacer una prueba
      </button>

      <p className="mt-2 text-[10px] leading-snug text-tenue">
        Adivina primero cuánto pesa, y después lo pesas. En ese orden — al revés no mides tu ojo,
        copias la báscula.
      </p>

      <SheetBuscarAlimento
        abierto={buscando && alimento === null}
        onCerrar={() => setBuscando(false)}
        onElegir={setAlimento}
      />

      {alimento && (
        <SheetPrueba
          alimento={alimento}
          onCerrar={() => {
            setAlimento(null)
            setBuscando(false)
          }}
          onGuardar={(estimados, reales) => {
            onRegistrar({ alimentoId: alimento.id, estimados, reales })
            setAlimento(null)
            setBuscando(false)
          }}
        />
      )}
    </section>
  )
}

/**
 * Los dos pasos de una prueba, y no se pueden ver a la vez.
 *
 * El segundo campo no aparece hasta que el primero está confirmado: si los dos
 * estuvieran en pantalla, la tentación de ajustar la estimación después de ver
 * la báscula es demasiado grande, y la prueba dejaría de medir nada.
 */
function SheetPrueba({
  alimento,
  onCerrar,
  onGuardar,
}: {
  alimento: AlimentoIndice
  onCerrar: () => void
  onGuardar: (estimados: number, reales: number) => void
}) {
  const [estimados, setEstimados] = useState(100)
  const [confirmado, setConfirmado] = useState(false)
  const [reales, setReales] = useState(100)

  const error = confirmado ? errorPct(estimados, reales) : null

  return (
    <Sheet abierto titulo={alimento.nombre} onCerrar={onCerrar}>
      <div className={confirmado ? 'opacity-50' : ''}>
        <Stepper
          etiqueta="¿Cuánto crees que pesa?"
          valor={estimados}
          paso={5}
          minimo={0}
          maximo={5000}
          sufijo="g"
          grande
          onCambiar={setEstimados}
        />
      </div>

      {!confirmado ? (
        <button
          type="button"
          onClick={() => {
            setConfirmado(true)
            setReales(estimados)
          }}
          className="press mt-4 w-full rounded-2xl bg-accion py-4 font-display text-sm uppercase tracking-wide text-white"
        >
          Ya lo adiviné · ahora lo peso
        </button>
      ) : (
        <>
          <div className="mt-5">
            <Stepper
              etiqueta="¿Cuánto pesó de verdad?"
              valor={reales}
              paso={5}
              minimo={0}
              maximo={5000}
              sufijo="g"
              grande
              onCambiar={setReales}
            />
          </div>

          {error !== null && (
            <p className="mt-3 text-center text-sm text-tenue">
              {Math.abs(error) < 5 ? (
                <b className="text-texto">Muy cerca.</b>
              ) : (
                <>
                  Te {error > 0 ? 'pasaste' : 'quedaste corto'} un{' '}
                  <b className="text-texto">{Math.abs(error).toFixed(0)} %</b>
                </>
              )}
            </p>
          )}

          <button
            type="button"
            onClick={() => onGuardar(estimados, reales)}
            className="press mt-4 w-full rounded-2xl bg-accion py-4 font-display text-sm uppercase tracking-wide text-white"
          >
            Guardar la prueba
          </button>
        </>
      )}

      <p className="mt-3 text-[11px] leading-snug text-tenue">
        Hacen falta {PRUEBAS_MINIMAS} pruebas repartidas en al menos {DIAS_MINIMOS} días. Con
        menos, la diferencia entre estimar bien y acertar por suerte no se distingue.
      </p>
    </Sheet>
  )
}
