# Praxis conectada: lo que te toca a ti

Rama `feat/praxis-conexion` (1-oct-2026). El PR está **sin fusionar** y nada de esto está
aplicado ni desplegado: ni la migración, ni la función, ni el secreto.

Piensa en una caja registradora nueva: el mostrador ya está puesto y cableado (la
pantalla), pero la caja todavía no tiene corriente (la función), ni llave (el secreto), ni
el buzón de sugerencias atornillado a la pared (la tabla de preguntas). Los pasos de abajo
son enchufar cada cosa, en orden, y comprobar que encendió antes de pasar a la siguiente.

## Qué pasa si no haces nada

Si solo fusionas el PR, la pantalla `/praxis` sigue siendo **solo para el equipo** y:

- enseña tus datos reales (tu plan aprobado, tus check-ins de 14 días) en vez de los de ejemplo;
- contesta preguntas de tu plan sin modelo («¿qué me toca hoy?»);
- se detiene ante una frase de riesgo y enseña la Quieta con el 123, el 106, el 155 y el 141;
- cuando le escribes algo para anotar, dice **«mi registrador todavía no está encendido»**;
- cuando aceptas «¿Se lo pregunto a tu coach?», dice **«no la mandé»**.

No finge nada. Para los asesorados no cambia nada: no ven la pantalla.

## Los pasos, en orden

### 1. Aplicar la migración 0105 (la bandeja de «pregunta en espera»)

- **Archivo:** `supabase/migrations/0105_praxis_preguntas_en_espera.sql`.
- **Antes:** corre `supabase/comprobar-migraciones.sql` en el SQL Editor. Las cinco filas que
  empiezan por `0105 - …` tienen que decir **NO**. Si alguna dice SI, para y avísame.
- **Aplicar:** pega el archivo entero en Supabase → SQL Editor → Run. Compara la última
  línea del editor con la última del archivo (`commit;`): un pegado cortado no da error.
- **Después:** vuelve a correr `comprobar-migraciones.sql`. Las cinco filas `0105 - …` tienen
  que decir **SI**.
- **Ojo con el número:** hay otras ramas sin fusionar con las migraciones 0090 a 0104. La
  0105 no depende de ninguna (solo usa `usuarios_app`, `es_coach()` y `es_nutricionista()`,
  que ya están en producción). Si antes de aplicarla otra rama coge el 0105, se renumera
  esta **antes** de aplicar.
- **No crea datos de nadie** y no toca ninguna tabla existente.

### 2. Decidir si pagas la API (PD-11 E3) y poner el secreto

La función llama a Claude Haiku para entender lo que se escribe. Eso se paga por uso a
Anthropic (el diseño estima unos 0,0026 USD por mensaje). Dejaste abierta la decisión
PD-11 E3 («entender primero por qué se paga por API»): **este paso es esa decisión.**

- **Secreto:** `ANTHROPIC_API_KEY`. El valor lo pones tú; yo no lo tengo ni lo leo.
- **Cómo:** en tu terminal, `supabase secrets set ANTHROPIC_API_KEY=<el valor>`
  (o en el panel: Edge Functions → Secrets).
- **Comprobar:** `supabase secrets list` muestra el nombre `ANTHROPIC_API_KEY`. No muestra
  el valor, y está bien.
- `SUPABASE_URL` y `SUPABASE_ANON_KEY` ya los pone Supabase solo en cada función. La función
  **no usa** la clave de servicio, y hay una prueba que falla si alguien la mete.

### 3. Desplegar la Edge Function `praxis-registro`

- **Desde dónde:** el código está en esta rama. En tu terminal:
  `cd F:/wt/praxis-conexion` y luego `supabase functions deploy praxis-registro`.
- **Con la CLI, no pegando el archivo en el panel:** la función importa el dominio con rutas
  relativas (`../../../src/domain/praxis/registro/index.ts`) y el panel no las resuelve.
- **Verify JWT:** déjalo **encendido** (es el valor por defecto). La función además valida
  el token ella misma y saca de ahí quién es la persona.
- **Riesgo que no pude descartar:** nadie ha probado todavía que la CLI empaquete esa ruta
  relativa. Si el despliegue falla diciendo que no encuentra el módulo, no lo fuerces:
  avísame y lo arreglo.
- **Comprobar que quedó desplegada** (sin sesión, desde tu terminal):
  `curl -i -X POST https://<tu-proyecto>.supabase.co/functions/v1/praxis-registro -H "content-type: application/json" -d "{}"`
  - responde **401** → está desplegada (te pide sesión, que es lo correcto);
  - responde **404** → no está desplegada.

### 4. Fusionar el PR

Fusionar a `main` publica en producción (Vercel). Antes, mira que el CI del PR esté en
verde, incluido el trabajo `base-de-datos`: ahí la 0105 se aplica sobre un Postgres de
verdad y corre `supabase/test/105-praxis-preguntas-en-espera.sql`.

### 5. Probar en `/praxis` con tu sesión

En el panel del coach, enlace **«Praxis (solo equipo)»**. Acepta la bienvenida y escribe:

| Escribe | Tiene que pasar |
|---|---|
| `¿qué me toca hoy?` | Contesta de tu plan, o dice «Aún no tengo ese dato: no veo un plan activo tuyo». Si tu cuenta de coach no tiene plan ni check-ins propios, verás todo vacío: para ver datos, pruébalo con la sesión de Manuela. |
| `seguí el plan hoy` | Debería salir una tarjeta «Lo que entendí» con **Guardar** y **Descartar**. Nada se guarda hasta que tocas Guardar. (No lo he visto contra la función real: no está desplegada. Es la primera prueba de verdad.) |
| toca **Guardar** | Dice «Listo, guardado» y una línea por registro. Compruébalo en la base: Table Editor → `adherencias`, tu fila de hoy. En la app no aparece hasta recargar. |
| `dormí seis horas` y Guardar | Dice que el check-in **todavía no se puede guardar desde Praxis**. Es correcto (ver «Qué no quedó conectado»). |
| `¿por qué esta semana es tan dura?` | «…no lo tengo escrito. ¿Se lo pregunto a tu coach? Te aviso cuando responda.» Con «Sí», dice que dejó la pregunta. Compruébalo: Table Editor → `praxis_preguntas_en_espera` tiene una fila `abierta`. |
| `me duele la rodilla` | No anota nada ni llama al modelo. Dice que es de salud y da el 123. |
| `no aguanto más` | Pregunta «¿Estás pensando en hacerte daño?». Con «Sí», la Quieta. |

**No pruebes una frase de riesgo de verdad con la sesión de Manuela sin avisarle:** la Quieta
deja Praxis detenida hasta el día siguiente (hay un botón «Reabrir Praxis (solo el equipo)»
en la portada).

Si después del paso 3 una frase normal responde **«No te entendí bien»**, la función está
desplegada pero no pudo llamar a Haiku: revisa el secreto del paso 2.

### 6. Cómo responder una pregunta en espera (hoy, a mano)

La bandeja en la consola no está construida. Mientras tanto, en el SQL Editor:

```sql
update public.praxis_preguntas_en_espera
   set estado = 'respondida',
       respuesta = 'Tu respuesta aquí',
       respondida_por = '<tu id en usuarios_app>',
       respondida_en = now()
 where id = '<id de la pregunta>';
```

Las cuatro columnas van juntas: la tabla rechaza una respuesta a medias. La persona la ve
la próxima vez que abre la sala de Praxis («Respondió tu coach»).

## Lo que tienes que firmar antes de abrirla a asesorados

El interruptor (`PRAXIS_ABIERTA_A_ASESORADOS` en `src/domain/praxis/acceso.ts`) sigue en
`false` y este PR no lo toca. Antes de encenderlo falta, y nada de esto lo puedo decidir yo:

1. **El filtro de riesgo es solo el diccionario.** Firmaste diccionario + modelo en cada
   mensaje. El diccionario solo alcanzó 47 % en las frases reservadas del 29-sep.
2. **Ante un riesgo, hoy nadie recibe aviso.** La pantalla lo dice tal cual («desde aquí
   todavía no se le avisa a nadie»). Hay que decidir por dónde llega el aviso y a quién
   (G4: a Manuela si el señalado es del equipo).
3. **Profesional de salud mental:** revisa los textos de la Quieta y las 48 fichas. Mientras
   tanto solo se usa la Quieta que ya existía; las fichas no se usan.
4. **Abogado (P8):** lo que se escribe para anotar viaja a Anthropic; hace falta el
   consentimiento y la revisión de la Ley 1581.
5. **Quitar el botón «Reabrir Praxis (solo el equipo)»**: existe solo para que el equipo
   pueda seguir probando después de una Quieta.
6. **La regla P-2 (máximo 3 PR esperando tu revisión):** este es el PR número 12 abierto.
   Lo abrí porque lo pediste el 1-oct; si prefieres, lo paso a borrador o cierro otros.

## Qué no quedó conectado (y por qué)

| Qué | Por qué | Qué lo desbloquea |
|---|---|---|
| El check-in guiado de cuatro turnos (pentagrama, firma del día, eco, idea) | El registrador no puede escribir un check-in a medias: una fila parcial cierra el formulario y da XP | Prerrequisito P2 del diseño del registrador |
| Guardar agua, comida, cardio y preparación desde Praxis | Faltan el libro de tarjetas (P5), el catálogo curado (P6) y la sincronización del cardio (P7) | P5, P6, P7 |
| El «porqué» de cada cambio del plan | La hoja del porqué (D2) no existe: la cadena no la escribe todavía | Cambio en el paso ③ de la cadena |
| El plan estratégico, los mensajes del coach, la revisión semanal y las fichas | No están en el almacén del teléfono de la persona; habría que leerlos aparte | Una lectura nueva con su JWT |
| La bandeja de preguntas en la consola y el aviso al llegar la respuesta | No se construyó; hoy se responde a mano (paso 6) | Trabajo aparte en la consola |
| La voz por micrófono | La maqueta la simulaba; aquí se quitó | El piloto de voz |
| El aviso al coach ante un riesgo | No existe ningún canal para eso | Tu decisión del punto 2 de arriba |
