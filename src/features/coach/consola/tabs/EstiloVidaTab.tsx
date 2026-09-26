import { adherenciaNutricionalPorSemana, fechaCorta, serieDeCheckins } from '../../../../domain/consolaCoach/perfilCompleto'
import { SeccionAlimentacion } from '../ficha/SeccionPerfil'
import { GraficaBarras, GraficaLinea } from '../graficas'
import { PendienteDeCadena } from '../PendienteDeCadena'
import { Falta, Tarjeta } from '../piezas'
import { usePersona } from '../usePersona'

/**
 * Módulo 6: lo que hoy existe de estilo de vida — adherencia nutricional por semana y día
 * a día, pasos y hambre de los check-ins, y el perfil alimentario con el plan. La
 * prescripción del agente de estilo de vida y sus mensajes son de la fase 2 (vacío
 * honesto, nunca inventado).
 */
export function EstiloVidaTab({ usuarioId }: { usuarioId: string }) {
  const datos = usePersona(usuarioId)
  const semanas = adherenciaNutricionalPorSemana(datos.adherencias).slice(-10)
  const recientes = [...datos.adherencias].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 21)
  const pasos = serieDeCheckins(datos.checkins, 'pasos')
  const hambre = serieDeCheckins(datos.checkins, 'hambreEscala')

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <Tarjeta titulo="Adherencia nutricional por semana" i={0} className="xl:col-span-7">
        {semanas.length === 0 ? (
          <Falta
            que="Sin registros de adherencia todavía."
            como="Los marca la persona en Nutrición («¿Cumpliste el plan hoy?»): sí, parcial o no."
          />
        ) : (
          <>
            <GraficaBarras
              barras={semanas.map((s) => ({
                clave: s.semana,
                etiqueta: fechaCorta(s.semana),
                segmentos: [
                  { valor: s.si, tono: 'bg-verde', etiqueta: 'sí' },
                  { valor: s.parcial, tono: 'bg-ambar', etiqueta: 'parcial' },
                  { valor: s.no, tono: 'bg-rojo', etiqueta: 'no' },
                ],
                titulo: `Semana del ${s.semana}: ${s.si} sí · ${s.parcial} parcial · ${s.no} no`,
              }))}
              maximo={7}
              descripcion={`Adherencia nutricional de ${semanas.length} semanas, días marcados por semana.`}
            />
            <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-tenue">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-verde" />sí</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ambar" />parcial</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-rojo" />no</span>
              <span>· altura = días marcados de 7</span>
            </p>
          </>
        )}
        {recientes.length > 0 && (
          <div className="mt-3 border-t border-linea pt-2.5">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Día a día (últimos {recientes.length})</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[...recientes].reverse().map((a, n) => (
                <span
                  key={a.id}
                  title={`${a.fecha} · ${a.estado}${a.comentario ? ` — ${a.comentario}` : ''}`}
                  className={`consola-tarjeta h-6 w-6 rounded ${a.estado === 'si' ? 'bg-verde' : a.estado === 'parcial' ? 'bg-ambar' : 'bg-rojo'}`}
                  style={{ ['--i' as string]: n }}
                />
              ))}
            </div>
          </div>
        )}
      </Tarjeta>

      <SeccionAlimentacion datos={datos} i={1} className="xl:col-span-5" />

      <Tarjeta titulo="Pasos (check-in)" i={2} className="xl:col-span-6">
        {pasos.length === 0 ? (
          <Falta que="Ningún check-in trae pasos." como="Se registran en el check-in diario (campo pasos)." />
        ) : (
          <GraficaLinea series={[{ nombre: 'Pasos', puntos: pasos }]} unidad="pasos" alto={170} descripcion={`Pasos diarios: ${pasos.length} días.`} />
        )}
        {datos.perfil?.pasosObjetivo !== undefined && (
          <p className="mt-1 text-[11px] text-tenue">
            Objetivo del bloque: <span className="cifras font-bold text-texto">{datos.perfil.pasosObjetivo.toLocaleString('es-CO')}</span> pasos.
          </p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Hambre (1-10, check-in)" i={3} className="xl:col-span-6">
        {hambre.length === 0 ? (
          <Falta que="Ningún check-in trae hambre en escala." como="La escala 1-10 se pregunta desde septiembre; las respuestas viejas (poco/regular/mucho) no se convierten." />
        ) : (
          <GraficaLinea series={[{ nombre: 'Hambre', puntos: hambre }]} unidad="/10" alto={170} descripcion={`Hambre: ${hambre.length} registros.`} />
        )}
      </Tarjeta>

      <div className="xl:col-span-12">
        <PendienteDeCadena
          titulo="Prescripción de estilo de vida, mensajes automáticos y ondulación flexible"
          detalle="El agente de estilo de vida (fuentes citadas, nunca quita entrenamiento) y sus mensajes automáticos son de la fase 2. Llega cuando la cadena sincronice."
        />
      </div>
    </div>
  )
}
