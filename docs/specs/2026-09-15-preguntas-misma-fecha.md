# Pregunta y respuesta con la misma marca de tiempo

La suite integrada falló dos veces en la pregunta del coach que debe desaparecer al contestar. Los dos envíos locales pueden compartir milisegundo; el orden descendente estable conserva primero la pregunta, aunque la respuesta venga después en el hilo.

Cambio mínimo: ordenar por fecha descendente y desempatar por posición descendente en el hilo recibido. Las fechas diferentes siguen mandando; cuando no hay precisión temporal adicional se respeta el orden de incorporación del hilo. No se inventan milisegundos ni se cambia lo guardado.

Plan: añadir regresiones para ambos órdenes de incorporación con fecha idéntica, observar el fallo, cambiar solo el desempate y repetir pruebas de dominio, pantalla y suite. Este desempate no reconstruye una secuencia que ya venga perdida del servidor.
