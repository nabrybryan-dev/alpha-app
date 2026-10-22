# Mensajes semanales con la voz clonada: solos, sin freno, todo en el PC

Fecha: 2026-10-22. Origen: informe `05-VOZ-ESTADO.md` (REDISENO-APP-20261021) y dos decisiones de Bryan.

## Decisiones de Bryan que mandan

- **21-oct, «Solos, sin freno»:** los mensajes semanales con su voz clonada salen sin que él los apruebe, con el
  riesgo explicado. La voz es la que ya existe en alpha-estudio (`estudio.voz`, molde `config.MOLDE_OFICIAL`).
- **22-oct, «Todo en el PC»:** el mensaje semanal no manda contexto (sesiones, adherencia, sueño, tasa contra el
  plan, objetivos) a ningún modelo externo.

## Qué cambia en la cadena del viernes (`scripts/revision-semanal-viernes.ps1`)

| Paso | Antes | Ahora |
|---|---|---|
| 1 guiones | plantilla `guion.ts` | igual |
| 1.5 revisión larga | `revision-larga.mjs` llamaba a la CLI del modelo externo con la ficha de la tasa | **retirado** (y con él `redactar-revision.mjs` y `lib/redactar-una-revision.mjs`) |
| 1.6 mensajes | no existía | `mensaje-semanal.mjs` corre el agente local `cerebro-alpha-agentes/agentes/mensaje_semanal.py`; si no está o no responde queda la plantilla y no se firma nada |
| 2 voz | `dev/prueba-voz/generar_revisiones.py` (molde de 12 s, ajustes del 13-sep, un proceso para todos) | `generar-voces.mjs`: `estudio.voz` de alpha-estudio, **un proceso por persona, un reintento**, 120 ms de silencio previo |
| 3 publicar | terminaba siempre con 0 (el 16-oct: 0 de 13 y «LISTO») | código **3** si la tanda no quedó completa; aviso en `notificaciones.log` |
| 4 firma | no existía (la firma era solo del coach) | `revision-semanal --paso firmar`, **apagado por defecto** |

`$Cerebro` apuntaba a `dev\cerebro-alpha-tasa` (no existe) y por eso la tasa nunca se calculaba: ahora
`dev\cerebro-alpha-agentes`.

## Cómo se enciende la firma automática

1. Aplicar a mano la migración `supabase/migrations/<NNNN>_aprobacion_automatica_revisiones.sql` (hoy sin número;
   ver el PR). Correr antes y después las señales nuevas de `supabase/comprobar-migraciones.sql`.
2. Que el agente de mensajes esté en `cerebro-alpha-agentes` (PR aparte) y que exista `%USERPROFILE%\.alpha\roster.json`
   (`{"personas":[{"usuario_id":"…","slug":"…"}]}`) si se quiere que los mensajes lleven el objetivo del plan.
3. Crear el archivo `%USERPROFILE%\.alpha\firma-automatica.activa` (o lanzar el `.ps1` con `-FirmaAutomatica`).
   Borrarlo la apaga. Las tareas programadas no llevan parámetros: el archivo es la bandera.
4. Antes del primer audio sin revisión, el aviso a los asesorados de que la voz es generada (pendiente desde el
   10-sep; lo escribe Bryan).

Qué se firma: solo a quien el agente marcó `publicar` y cuya fila en la base dice lo mismo que el manifiesto.
La base (`firmar_revisiones_automaticas`) además se niega si el que llama no es `service_role`, si la fila ya
estaba firmada, tiene corrección pedida, no tiene guion, tiene ruta histórica o no tiene archivo, o si hay una
orden `detener` vigente para esa persona en la semana de la revisión o en la siguiente (la consola apunta
`detener` a la semana que se va a cargar). Las políticas RLS de la `0068` no se tocan.

## Lo medido al probar con la voz real (durante la construcción de esto, en este PC)

`generar-voces.mjs` se corrió dos veces contra `estudio.voz` real con una frase de 80 caracteres. Las dos
fallaron, y por una razón que no es de este código: el PC estaba al límite de memoria virtual.

- 1.ª corrida: intento 1 `código 1: El archivo de paginación es demasiado pequeño (os error 1455)`; intento 2, igual.
- 2.ª corrida: intento 1 `os error 1455`; intento 2 `código 3221225477` = **0xC0000005**, el mismo código con el que
  murió la tanda del 15-oct. Ya van dos veces vistas con la misma causa aparente (memoria), aunque sigue sin probarse
  que sea la causa de aquella caída.
- Medido en ese momento: memoria virtual total 62,5 GB, libre 6,5 GB; RAM física libre entre 0,3 y 2,6 GB, con decenas
  de procesos de Claude/Chrome/Python abiertos.

Qué prueba esto: que el proceso se lanza bien (`python -B -m estudio.voz` desde alpha-estudio, el modelo se baja de la
caché sin descargar nada), que el motivo real de cada fallo llega al registro (el código y el texto de `FALLO.json`,
no «alguna voz salió corta»), que el reintento y el código de salida 1 funcionan contra el proceso de verdad. Qué NO
prueba: el camino feliz con el modelo real (audio terminado + 120 ms de silencio + testigo). Ese camino está probado con
un proceso simulado, y el silencio previo con `ffmpeg` sobre una muestra real (+0,12 s exactos, silencio de 0 a 0,12 s).

Consecuencia práctica: **antes de la tarea de las 21:00, cerrar sesiones** (o ampliar el archivo de paginación) o la voz
volverá a caerse, ahora persona por persona y con aviso, no en bloque y en silencio. El reintento espera 60 s.

## Qué NO hace esta entrega

- No aplica la migración, no toca las tareas programadas, no firma nada.
- No calcula las banderas de ánimo, dolor o alerta clínica: el agente las acepta en la entrada, el puente aún no las
  alimenta. Con «sin freno» no frenarían el mensaje de todos modos; sirven para el tono y para el aviso.
- No hace el chequeo automático del audio por transcripción (whisper.cpp local) que pide el informe §3.1d.
- `guion.ts` (la plantilla que queda de piso) sigue diciendo «Tu plan sigue en pie» sin mirar el plan: por eso la
  plantilla **nunca** se firma sola.
