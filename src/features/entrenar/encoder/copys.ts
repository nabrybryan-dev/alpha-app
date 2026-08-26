/* Los textos del encoder, tal como los cerró el diseño.
 *
 * Salen literalmente de `copys_finales` del entregable, y viven en un solo sitio
 * por la razón que da la doctrina d5: **el vocabulario de motivos es cerrado**.
 * Se cuentan para poder arreglar el protocolo de grabación, y eso solo funciona
 * si el mismo fallo se llama siempre igual. Reescribir uno aquí rompe ese recuento
 * sin que nada avise.
 *
 * ⚠ LO ÚNICO QUE SE CAMBIÓ, y por qué. El JSON del diseño llegó **sin una sola
 * tilde ni eñe** en los 62 textos: «Aqui no hay numero que ensenar», «Disco
 * pequeno», «se senala». Se restauraron palabra por palabra, sin tocar ninguna
 * palabra ni el orden de ninguna frase.
 *
 * No es reescribir el copy: es que la interfaz es es-CO y «ensenar» no es una
 * decisión de estilo, es una eñe perdida por el camino. Lo que sí exigió criterio
 * fueron los casos que dependen del contexto y no de la palabra suelta —«esta
 * máquina» lleva demostrativo sin tilde y «ya está colocada» lleva verbo con
 * ella—, y están resueltos uno a uno.
 */
export const COPY = {
  "calidad_buena": "Buena",
  "calidad_dudosa": "Dudosa",
  "calidad_descartada": "Descartada",
  "calidad_buena_sub": "Sin fallos. Este número decide carga.",
  "calidad_dudosa_sub": "Sirve, pero no manda.",
  "calidad_descartada_sub": "Aquí no hay número que enseñar.",
  "pocos_fps": "Pocos fps",
  "pocos_fps_largo": "La cámara grabó a menos de 50 fps. A 30 fps la pérdida de velocidad se va 5 puntos, y es la que decide la dosis.",
  "pocos_fps_hacer": "Más luz. En iPhone no hay palanca de exposición: la solución es luz.",
  "marcador_perdido": "Referencia perdida",
  "marcador_perdido_hacer": "Que nada tape el disco durante la serie.",
  "angulo": "Diana torcida",
  "angulo_hacer": "Endereza la tira o el disco.",
  "pocas_reps": "Pocas repeticiones",
  "sin_escala": "Sin escala",
  "sin_escala_hacer": "Encuadra el disco o la tira de referencia.",
  "inclinacion_no_medible": "Inclinación a ciegas",
  "inclinacion_no_medible_hacer": "Usa la diana de cuatro marcas.",
  "referencia_torcida": "Referencia escorzada",
  "referencia_torcida_hacer": "Pega la referencia plana y de frente a la cámara.",
  "contorno_parcial": "Disco a medias",
  "contorno_parcial_hacer": "Que el disco se vea entero.",
  "sin_segmentar": "Sin repeticiones",
  "no_es_lateral": "No es lateral",
  "disco_pequeno": "Disco pequeño",
  "camara_baja": "Cámara baja",
  "no_cabe": "No cabe",
  "salto_imposible": "Salto imposible",
  "sin_persona": "Sin persona",
  "sin_consenso": "Los dos no coinciden",
  "encuadre_buena": "Desde aquí sale una medida en la que se puede confiar.",
  "encuadre_dudosa": "Sirve, pero con un pero.",
  "encuadre_descartada": "Desde aquí no.",
  "encuadre_nota": "Es trigonometría, no una promesa: sirve para descartar colocaciones, no para garantizar precisión. No modela la lente ni la compresión del vídeo.",
  "encuadre_cta": "Ya está colocada",
  "hoja_senalar": "Toca al atleta para señalarlo",
  "hoja_cta": "Grabar la serie",
  "resultado_sin_medicion": "No salió medición. No se reconoció ninguna repetición: el atleta salió de cuadro a mitad de la serie.",
  "resultado_sin_medicion_util": "La cámara grabó bien (57,9 fps). Lo que falló fue el encuadre.",
  "resultado_repetir": "Repetir la toma",
  "resultado_ie_nota": "Predice la fatiga mejor que la velocidad o la pérdida por separado. Necesita escala: sin ella no existe.",
  "resultado_ie_ausente": "Índice de esfuerzo: no se puede dar. Usa la velocidad en m/s y aquí no hubo escala. El %PV sí sobrevive, porque es un cociente.",
  "resultado_pv_negativo": "La última repetición salió más rápida que la primera: la serie no llegó a fatigar.",
  "palancas_negativas_titulo": "Lo que no se puede prometer",
  "palancas_no_medible": "No lo sé",
  "palancas_no_medible_sub": "4 de 96 fotogramas medibles. No hay número, y no lo va a haber por mucho que repitas con esta máquina.",
  "palancas_no_aplica": "Este ejercicio no entra en el modelo",
  "palancas_no_aplica_sub": "Con polea, la vertical de la carga no es la línea de acción: la marca el cable. No es un fallo de la toma ni del detector, y repetir la grabacion no lo arregla.",
  "palancas_escala_dudosa": "La escala de este vídeo dispersa un 21 %: los milímetros son orientativos, no medidas.",
  "palancas_cruce_cero": "La rodilla cruza el cero: la carga pasó al otro lado del eje.",
  "palancas_lumbar": "El lumbar no se ve en el vídeo, se estima sobre la línea cadera-hombro.",
  "historial_no_comparable_titulo": "Estas dos no se comparan",
  "historial_no_comparable": "Una toma es de mañana y la otra de tarde (10 h de diferencia). La fuerza sube de la mañana a la tarde por sí sola: una parte de lo que cambie entre estas dos medidas es la hora, no el entrenamiento.",
  "historial_no_comparable_cierre": "Las dos medidas son buenas. Lo que no se sostiene es ponerlas una al lado de la otra.",
  "historial_aviso_suave": "4 h de diferencia entre las dos tomas. Conviene medir siempre a la misma hora.",
  "historial_que_entra": "Solo tomas buenas. Una dudosa contamina la tendencia sin avisar, así que si aparece va marcada en hueco y no cuenta para la línea.",
  "historial_vacio": "Todavía no hay dos tomas buenas de este ejercicio. Con una sola no hay tendencia que enseñar.",
  "laboratorio_aviso": "Números provisionales. La prueba de gravedad todavia no ha aprobado.",
  "laboratorio_guardar": "Guardar en la tanda",
  "tanda_fantasma": "Contar repeticiones que no existen es el modo de fallo dominante de las apps de cámara. Por eso se teclea lo que la persona conto.",
  "tanda_vacia": "Tanda vacía. Los umbrales ya están escritos: se juzgan contra ellos, no contra lo que salga.",
  "tanda_exportar": "Exportar CSV"
} as const

export type ClaveCopy = keyof typeof COPY
