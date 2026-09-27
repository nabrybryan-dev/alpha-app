import { adherenciaNutricionalPorSemana, fechaCorta, serieDeCheckins } from '../../../../domain/consolaCoach/perfilCompleto'
import { PREGUNTA_VIDA_POR_ID, esIdPreguntaVida } from '../../../../domain/tarjetaVida'
import { SeccionAlimentacion } from '../ficha/SeccionPerfil'
import { GraficaBarras, GraficaLinea } from '../graficas'
import { PendienteDeCadena } from '../PendienteDeCadena'
import { Esqueleto, Falta, Tarjeta } from '../piezas'
import { usePersona } from '../usePersona'

/**
 * Módulo 6: lo que hoy existe de estilo de vida — adherencia nutricional por semana y día
 * a día, la tarjeta semanal de 7 preguntas (V1..V7, `tarjetas_vida`, migración 0088),
 * pasos y hambre de los check-ins, y el perfil alimentario con el plan. La prescripción
 * DEL AGENTE (qué acción recomendarle a partir de las respuestas) y sus mensajes
 * automáticos siguen siendo de la fase 2 (vacío honesto, nunca inventado): esta pestaña
 * enseña la RESPUESTA de la persona, no el análisis que la cadena hace de ella.
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

      <Tarjeta titulo="Tarjeta semanal de estilo de vida" i={2} className="xl:col-span-6">
        {datos.tarjetaVida.estado === 'cargando' ? (
          <Esqueleto lineas={4} />
        ) : datos.tarjetaVida.estado === 'fallo' || !datos.tarjetaVida.valor ? (
          <Falta
            que="Sin tarjeta semanal respondida todavía."
            como="Se ofrece en Bienestar el domingo (o después, si no se contestó esa semana): 7 preguntas de sueño, pantallas, estrés, recompensa, movimiento y rendimiento."
          />
        ) : (
          <>
            <p className="text-[11px] text-tenue">
              Semana del {fechaCorta(datos.tarjetaVida.valor.semanaInicio)} · respondida el{' '}
              {fechaCorta(datos.tarjetaVida.valor.creadoEn.slice(0, 10))}
            </p>
            <dl className="mt-2 flex flex-col gap-1.5 text-[13px]">
              {Object.entries(datos.tarjetaVida.valor.respuestas)
                .filter(([id]) => esIdPreguntaVida(id))
                .map(([id, valor]) => {
                  const pregunta = PREGUNTA_VIDA_POR_ID[id as keyof typeof PREGUNTA_VIDA_POR_ID]
                  return (
                    <div key={id} className="flex justify-between gap-3 border-t border-linea/60 pt-1.5 first:border-0 first:pt-0">
                      <dt className="text-tenue">{pregunta.texto}</dt>
                      <dd className="cifras shrink-0 font-bold text-texto">
                        {pregunta.escala.etiquetas?.[valor as number] ?? valor}
                      </dd>
                    </div>
                  )
                })}
            </dl>
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo="Pasos (check-in)" i={3} className="xl:col-span-6">
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

      <Tarjeta titulo="Hambre (1-10, check-in)" i={4} className="xl:col-span-6">
        {hambre.length === 0 ? (
          <Falta que="Ningún check-in trae hambre en escala." como="La escala 1-10 se pregunta desde septiembre; las respuestas viejas (poco/regular/mucho) no se convierten." />
        ) : (
          <GraficaLinea series={[{ nombre: 'Hambre', puntos: hambre }]} unidad="/10" alto={170} descripcion={`Hambre: ${hambre.length} registros.`} />
        )}
      </Tarjeta>

      <div className="xl:col-span-12">
        <PendienteDeCadena
          titulo="Prescripción del agente de estilo de vida y ondulación flexible"
          detalle="La tarjeta semanal (arriba) y la bandeja de mensajes (Bienestar, migración 0088) ya están. Lo que falta es el ANÁLISIS: qué pilar prioriza el agente a partir de las respuestas, con su fuente citada. Llega cuando la cadena sincronice."
        />
      </div>
    </div>
  )
}
