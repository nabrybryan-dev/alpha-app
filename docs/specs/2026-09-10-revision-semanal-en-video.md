# La revisión semanal en vídeo (2026-09-10)

Diseñada con Bryan el **7 de septiembre** por la tarde y cerrada el **10**. Hasta hoy no
existía en ningún archivo: vivía sólo dentro de una conversación, que es el sitio más
frágil donde puede vivir un diseño. **El primer encargo ya está construido** (PR #236); los
otros nueve son papel.

Cómo funciona, en una frase: **nada más abrir la app va un vídeo fijo que no cambia
nunca, y debajo una tarjeta que sí cambia cada semana**. El vídeo pone la cara, la voz y
el tono; la tarjeta pone el nombre y los números de esa persona.

## Las cuatro filas de la tarjeta las dictó Bryan

No hubo que inventarlas. En los primeros cuarenta segundos de su vídeo nombra cuatro
cosas, y ésas son las filas:

1. **qué estás haciendo** — sesiones hechas contra pautadas, adherencia, cargas que se movieron;
2. **qué hay que recordar** — lo que se le está olvidando de su propio plan;
3. **a qué te estás acercando** — la fila de su plan estratégico y cuánto queda;
4. **qué vamos a cambiar** — el ajuste de la semana que viene, y a qué darle respuesta.

## Las doce decisiones

Las ocho primeras son del 7-sep. **Cuatro de ellas se corrigieron esa misma tarde**, al
oír el vídeo que mandó Bryan; un resumen que se quede en la foto de las 15:20 reconstruye
un diseño que ya no es el vigente. Las cuatro últimas son del 10-sep.

| # | Quedó así | Nota |
|---|---|---|
| 1 | El vídeo es una **cabecera**: se graba **una sola vez** y sirve todas las semanas | Corrige «se graba cada domingo». El vídeo no dice ni un número, ni un nombre, ni una fecha: la semana la pone la tarjeta |
| 2 | La **cara la genera la máquina** | 10-sep. Obliga al aviso de más abajo |
| 3 | El vídeo vive en un **cajón privado**, y la app lo abre con un enlace que **caduca a la hora** | 10-sep. Corrige «YouTube oculto», que se eligió cuando la cara iba a ser la real |
| 4 | Debajo del reproductor, **una tarjeta por persona**, redactada por un modelo abierto sobre números ya calculados | |
| 5 | Las tarjetas **pasan por la bandeja del coach**; la salida automática se abre tras **cuatro domingos seguidos sin que corrija ni una** | Corrige «unas 40 tarjetas»: cada domingo salen 23, así que 40 eran dos domingos y no exigían constancia |
| 6 | **Manuela firma con su propia bandeja** y su propio hilo | Ya dijo que sí; deja de ser una suposición |
| 7 | Techo de **seis recados al día**, con una red que le baja el cupo a quien deje de contestar | El contador se pone desde el primer recado: contar es gratis, y puesto después hay que esperar otra vez a que se llene |
| 8 | **Silencio por defecto según la zona horaria** de cada persona, configurable encima; el mensaje de la noche sale **justo antes** de la franja, no dentro | Corrige «apagado hasta que cada uno lo ponga», que dejaba a alguien recibiendo avisos a las tres de la mañana |
| 9 | **Dos preguntas de sueño** en el check-in: a qué hora te acostaste, a qué hora te levantaste | |
| 10 | El **molde de la voz** sale de **WhatsApp** | Corrige «de lo escrito dentro de la app» |
| 11 | Se arranca por **la pantalla + las horas de sueño**; el permiso de avisos va de propina | 10-sep |
| 12 | El vídeo vive **en Hoy, nada más abrir la app**, y debajo el cuadro para escribirle al coach o a la nutricionista | 10-sep. Corrige «arriba de la pantalla del chat»: **no se puede pedir que entren al chat para ver el vídeo**. La tarjeta va con él, y en el chat no queda ningún reproductor |

## Lo que ya existe y no hay que construir

Chat con adjuntos entre coach y asesorado, y bandeja con los hilos ordenados por lo no
leído. Reproducción de vídeo por dos caminos ya en producción (la biblioteca de contenidos
y el vídeo dentro de la burbuja del chat). Manuela como persona con rol propio, y la base
ya le deja escribirle a un asesorado. Y el **Centro de Respuestas**, con una aclaración que
importa: **no escribe**. Compara el mensaje entrante contra fichas escritas de antemano y
rellena huecos con el dato de la persona; si ninguna encaja, se lo pasa al coach. Lleva
además detector de crisis y de temas de salud.

## Los diez encargos

⚠ **Los números de migración caducan.** El 10-sep están tomados hasta el **0058**, y el
0058 lo reclaman **dos ramas a la vez**. Los de esta tabla arrancan en el 0059 y **hay que
volver a mirarlos el día que se escriba cada una**: el número no es parte del contrato.

| Encargo | ENTREGABLE | FORMATO | ACEPTACIÓN | PROHIBIDO |
|---|---|---|---|---|
| `bandeja-dos-remitentes` (HECHO, PR #236) | `src/features/chat/ChatPage.tsx`, `Conversacion.tsx`, `SelectorRemitente.tsx`, `remitentes.ts`, `CabeceraSemanal.tsx` (montada en `features/hoy/HoyPage.tsx`), `enlaceDeCabecera.ts` y sus pruebas | `ChatPage` deja de fijar `idCoach()` y lista los usuarios con rol `coach` o `nutricionista`. `CabeceraSemanal` = reproductor propio alimentado por el enlace firmado del cajón, más el hueco de la tarjeta | `grep -c "idCoach()" ChatPage.tsx` → 0 · `npm test -- ChatPage.dos-remitentes` pasa, y ese test (mensaje de la nutricionista visible para el asesorado) **se ha visto fallar** contra el `ChatPage` de hoy · **no se crearon rutas nuevas**: con el selector dentro de la misma pantalla no hacen falta, y una ruta que nadie abre es mantenimiento regalado · **cambiar el vídeo no obliga a tocar ni una línea de la pantalla**, probado con tres orígenes · `npm run build` → 0 | `src/domain/**`, `supabase/functions/**`, `src/features/aprobacion/**` |
| `cajon-del-video` | `supabase/migrations/0059_cajon_de_medios.sql`, `supabase/functions/enlace-de-cabecera/index.ts` + `.test.ts` | Cajón privado, una carpeta por destino. La función devuelve un enlace firmado de una hora al vídeo vigente | **señuelo**: con la sesión de un asesorado cualquiera, pedir el archivo por su ruta directa da 403, y se ha visto dar 200 antes de la política · el enlace caduca: pasada la hora, 403 en un test que adelanta el reloj · la función responde 200 con enlace no vacío | `src/features/**`, `src/domain/**` |
| `cabecera-generada` | `medios/cabecera.md`, el vídeo en el cajón, `medios/aviso-cara-generada.md` | El `.md` lleva la transcripción literal, el servicio usado, el coste por minuto real, la fecha y la huella del archivo. El aviso es el texto que Bryan manda **una vez** a sus asesorados | `ffprobe` da 9:16 y duración ≤ 40,5 s (el original sirve hasta el segundo 40: ahí empieza el gesto de coger el teléfono) · volumen normalizado a valor de móvil y sin saturación · la cara cae fuera de la zona que tapa la interfaz · el fotograma de portada **no es el cero** y no sale parpadeando · `medios/aviso-cara-generada.md` existe, escrito por Bryan, **antes** de que el vídeo se publique | Todo el código |
| `metrica-semanal` | `src/domain/resumenSemanal/calcular.ts` + `.test.ts`, `src/domain/sueno/regularidad.ts` + `.test.ts`, `src/domain/resumenSemanal/contrato.md` | Función pura. Devuelve cifras **y etiquetas ya decididas**: adherencia alta/media/baja, tendencia subió/igual/bajó, regularidad mejorando/estable/empeorando/sin-datos | `npm test -- resumenSemanal regularidad` pasa · caso con menos de 7 noches devuelve «sin datos» y **no** un cero, **visto fallar** devolviendo 0 · `grep -rn "fetch\|supabase\|openai\|anthropic"` en esas carpetas → vacío · `contrato.md` con sus secciones completas | `src/features/**`, `src/domain/redaccion/**`, `supabase/**` |
| `voz-y-redaccion` | `voz/corpus-bryan.md`, `voz/molde.md`, `voz/prueba-ciega/ronda-1.json` + `respuestas.json` + `veredicto.md`, `supabase/functions/redactar-resumen/index.ts`, `src/domain/redaccion/plantilla.test.ts` | 30 textos, 15 de Bryan **sacados al azar** del corpus y 15 del modelo, **con todo lo identificable tachado** (nombres, fechas, cifras, ejercicios) y **4 repetidos** escondidos para medir al juez. Dos preguntas por texto: ¿es mío? y **¿lo mandarías tal cual?** | `jq` confirma 30 entradas, 15 marcadas y los 4 repetidos · si el juez se contradice en los repetidos, el veredicto no vale · `veredicto.md` dice PASA (≤19 aciertos) o NO PASA, y el número de «lo mandaría» · **el modelo no coloca números: los devuelve aparte y la plantilla los pone en el hueco** · test: se le da una semana **mala** y la tarjeta **no felicita**, visto fallar · tope: **dos vueltas**; a la tercera los textos salen firmados como automáticos | `src/domain/resumenSemanal/**` (sólo lectura), todas las pantallas |
| `checkin-sueno` | `src/domain/types.ts`, `src/features/bienestar/CheckinForm.tsx`, `CheckinForm.sueno.test.tsx`, `supabase/migrations/0060_horas_de_sueno.sql` | Dos horas opcionales, guardadas dentro del `datos jsonb` del check-in | `npm test -- CheckinForm.sueno` pasa y **se ha visto fallar** sin los campos · las dos horas sobreviven ida y vuelta a la nube · `npm run build` → 0 | Todo `src/features/` salvo el formulario; todo `src/domain/` salvo `types.ts` |
| `permiso-de-avisos` | `src/features/avisos/PedirPermiso.tsx`, `suscripcion.ts` + `.test.ts`, `supabase/migrations/0061_suscripciones_push.sql`, `informes/permiso-avisos-<fecha>.md` | **Pantalla propia explicando para qué es, y el permiso del navegador sólo se le pide a quien dijo que sí ahí** (el permiso del navegador es de una sola bala: rechazado, en algunos móviles no se vuelve a pedir). El informe trae **tres** números: cuántos vieron la petición, cuántos dijeron sí, y cuántos **siguen vivos a los siete días** | `npm test -- suscripcion` pasa, incluido navegador sin soporte · **el contador se ha visto moverse**: se mete una suscripción falsa, sube, y se quita · **señuelo**: con la sesión de otro usuario el recuento da 0, visto dar 1 antes de la política · **la línea está escrita antes de ver el número**: menos de 12 de 23 al séptimo día → la fontanería del empuje se aparca | `supabase/functions/**`, `src/features/chat/**`, `src/domain/**` |
| `empuje-y-disparador` | `supabase/functions/empujar/index.ts` + `.test.ts`, `supabase/migrations/0062_disparador.sql`, `decisiones/disparador.md`, `informes/recado-diario-<fecha>.md` | `decisiones/disparador.md` compara tres opciones por qué pasa si el ASUS está apagado, qué cuesta y quién lo mantiene, y cierra con `ELEGIDO: X porque Y`. **El móvil escribe de vuelta**: al recibir el aviso, una fila con la hora y el aparato | `grep -c "^ELEGIDO:"` → 1 y las tres opciones aparecen · disparo programado a 2 min deja su fila · **silencio**: persona en Bogotá con envío a las 3:00 → no se envía, **visto fallar** enviándolo · el aviso real deja **su propia fila** con las dos horas puestas por el mismo reloj — sin capturas y sin que Bryan haga nada · los fracasos (suscripción caducada, aviso demasiado grande, permiso revocado) se prueban con destinos falsos | Todo `src/**` |
| `mapa-de-vida` | `src/features/mapa/EncuestaMapa.tsx`, `src/domain/mapaDeVida/preguntas.ts` + `.test.ts`, `supabase/migrations/0063_mapa_de_vida.sql` | Cada pregunta obliga a llevar escrito **qué mensaje dispara y a qué hora**. La que no lo lleve, se cae de la encuesta | test rojo si alguna pregunta tiene el mensaje vacío, **visto fallar** · el build falla si se borra el campo del tipo, comprobado borrándolo · la encuesta se responde entera en un test y llega a la base | `src/features/bienestar/**`, `src/features/chat/**` |
| `aprobacion-y-puerta` | `src/features/aprobacion/BandejaAprobacion.tsx`, `puerta.ts` + `.test.ts`, `supabase/migrations/0064_borradores.sql` | El origen del mensaje pasa de 2 a 4 valores: humano, alpha, borrador-coach, borrador-nutri. `puedeSalirSola(historial)` | 3 domingos limpios → false, 4 → true, 4 con una corrección en medio → false; **visto fallar** · un origen inventado lo rechaza la base, visto pasar antes de la restricción · **señuelo**: Manuela editando un borrador del coach afecta 0 filas, visto afectar 1 antes de la política | `src/features/coach/**`, `src/features/chat/**` |

## La primera tarjeta no enseña el índice: enseña la promesa

El índice de regularidad del sueño necesita siete noches, y las dos preguntas acaban de
nacer. La salida no es una tarjeta coja ni un vídeo que espera: **el primer domingo la
tarjeta va con lo que sí existe** —sesiones, adherencia, cargas— y en el hueco del sueño
dice, con todas sus letras, «llevas tres de siete noches registradas; el domingo que viene
esto ya es un número». Una barra que se llena tira más que un número que aparece de la nada.

## Lo que depende de Bryan

- **Un minuto de vídeo suyo de cara**, mirando al frente, del que sale el avatar.
- **La cuenta con tarjeta** en el servicio que genera el vídeo.
- **El aviso a los asesorados**, una sola vez, diciendo que la cara está generada. Lo
  escribe él, no la máquina, y sale **antes** de que el vídeo se publique.
- El día que quiera **clonar la voz**, hay que grabar aparte: teléfono cerca, sala sin
  eco y **el archivo original**. El de WhatsApp no vale — va unos 40 dB por debajo del
  tope y sale comprimido a menos de la décima parte; lo que se pierde ahí no vuelve.

## Cosas ya medidas, para no volver a tropezar

- **El vídeo maestro** (el que mandó por WhatsApp el 7-sep, 7.659.208 bytes) estaba sólo
  en `Downloads`, que ya se ha vaciado una vez para ganar disco. Copiado el 10-sep a
  `C:\Users\ASUS\dev\medios-alpha\cabecera-maestra-2026-09-07.mp4` (sha1 `4c2db4fa8607267a…`).
- **Sirve hasta el segundo 40.** A partir de ahí se le ve estirándose a coger el teléfono.
- **Tener la app en la pantalla de inicio y aceptar los avisos son dos permisos distintos.**
  El segundo no se lo ha pedido nadie todavía, así que hoy **no se sabe a cuánta gente se
  llega**. Por eso el permiso va primero y solo.
- **Un guardián que nace verde no vale.** Cada criterio de esta tabla dice «visto fallar» o
  «visto moverse» porque un contador roto y un contador a cero se ven exactamente igual.

## Qué NO entra en esta obra

Los seis recados del día (dependen del mapa, del disparador y de los avisos), la red que
baja el cupo (necesita semanas de recados corriendo), la segunda mitad del mapa de vida y
el clon de voz. Y el orden: **pantalla y sueño primero**, la fontanería después, el mapa
al final.
