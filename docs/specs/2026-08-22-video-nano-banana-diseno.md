# Producción de vídeo con Nano Banana sin pagar API

2026-08-22

## La pregunta

«¿Cómo conecto Google AI Studio con Claude para que Claude haga todo el diseño de
los vídeos en Nano Banana **sin usar la API**, aprovechando la mensualidad de
Google que ya pago? ¿Con un MCP?»

## Lo que se comprobó antes de decidir

Tres cosas, verificadas el 2026-08-22 contra la documentación de Google y el estado
del ecosistema (no de memoria):

1. **La suscripción (Google AI Pro / Ultra) da cuota en la *interfaz*, no en la
   API.** Sube los límites del Playground de AI Studio y de las apps (Gemini,
   Flow, Whisk). Cuando esa cuota diaria se agota, la propia documentación de
   Google te dice que sigas «con una API key con facturación activada». Son dos
   bolsas separadas: la mensualidad **no** se traslada a la API.

2. **MCP no evita la API: MCP *es* la API con otro enchufe.** Todos los servidores
   MCP de Nano Banana que existen piden una `GEMINI_API_KEY` en su configuración.
   El protocolo transporta la llamada; no aporta credenciales ni cuota. Montar un
   MCP creyendo que rodea el coste es cambiar de cable, no de contador.

3. **El free tier de la API existe, pero deja fuera justo el modelo bueno.** Los
   modelos *Flash Image* tienen cuota diaria gratuita real. **Nano Banana Pro
   (`gemini-3-pro-image`) no tiene free tier**: es de pago desde la primera
   imagen (~0,13 $ la de 1K/2K, ~0,24 $ la de 4K).

Conclusión: **no hay ruta soportada** para que Claude genere imágenes «por debajo»
gastando la mensualidad. Lo que sí hay es un reparto de trabajo que aprovecha la
mensualidad al 100 % y cuesta 0 € extra.

## Las tres rutas, y por qué se elige la primera

| | Qué es | Coste extra | Nano Banana Pro | Veredicto |
|---|---|---|---|---|
| **A. Claude dirige, AI Studio filma** | Claude produce el paquete de producción completo (prompts exactos plano a plano); se pega en AI Studio / Flow | **0 €** | Sí, el de la suscripción | **Elegida** |
| **B. API con free tier** | Script propio contra la API de Gemini con una key gratuita | 0 € dentro de la cuota | **No** (solo Flash Image) | Complemento para volumen |
| **C. Automatizar el navegador** | Playwright sobre `aistudio.google.com` con la sesión iniciada | 0 € | Sí | **Descartada** |

La C se descarta y conviene que quede escrito por qué, para no volver a
proponerla: va contra los Términos de Servicio de Google (uso automatizado de la
interfaz), se rompe con cada rediseño de la UI, y el precio del fallo no es un
script roto sino **la cuenta suspendida** — la misma cuenta que sostiene la
mensualidad que se pretendía aprovechar. Es tirar el activo para ahorrar el
alquiler.

## Cómo funciona la ruta A

El cuello de botella real de generar un vídeo con Nano Banana no es apretar el
botón: es que **los planos casen entre sí**. Nano Banana no recuerda la imagen
anterior. Cada prompt parte de cero, así que la persona, la ropa, el gimnasio y la
paleta se reinventan en cada plano salvo que se los vuelvas a describir enteros. Eso
—escribir el bloque de consistencia, repetirlo sin variar una coma, encadenar la
continuidad, ordenar el guion y los tiempos— es texto, y el texto es exactamente lo
que Claude ya hace dentro de la mensualidad que pagas por Claude.

Así que:

- **Claude escribe el paquete de producción**: un Markdown con, para cada plano, el
  prompt de imagen completo (bloque de consistencia incluido), el prompt de
  continuidad por si la persona no casa, el prompt de animación para Veo, el rótulo,
  la locución y el nombre de archivo.
- **Tú pegas y generas** en AI Studio / Flow, con la cuota ya pagada.
- **Cero tokens de imagen, cero API, cero facturación nueva.**

### Piezas

- `scripts/produccion-video.mjs` — construcción pura del paquete (sin I/O).
- `scripts/generar-paquete-video.mjs` — CLI: `npm run video -- <brief.json>`.
- `docs/video/briefs/` — el brief de cada vídeo (qué se cuenta, plano a plano).
- `docs/video/paquetes/` — la salida, lista para trabajar pegando.
- `src/test/produccion-video.test.ts` — 24 tests.

Los tests protegen lo único que no se ve mirando el resultado: que el prompt salga
**completo**. Un prompt sin el bloque de consistencia no da error — da una imagen
bonita con otra paleta, y eso se descubre cuando ya has gastado cuota en cuatro
planos que no encajan.

### La marca vive en dos sitios

`MARCA` en `scripts/produccion-video.mjs` copia los tokens de `src/styles/tokens.css`.
Es una duplicación consciente (el script corre en Node, sin pasar por Vite) y por
tanto una trampa conocida: **si cambian los tokens de marca, cambiar también `MARCA`**.
Es el mismo patrón que la frase y los campos de la prescripción, y ya sabemos cómo
acaba cuando se olvida.

## La ruta B, cuando haga falta

Para iterar mucho sobre un plano (veinte variantes de un encuadre) la mensualidad se
agota antes que las ganas. Ahí sirve una API key gratuita de AI Studio contra
**Flash Image**, que sí tiene free tier: `scripts/generar-imagenes-gemini.mjs`,
que lee un paquete ya generado y produce los borradores.

Dos decisiones deliberadas:

- **No se instala ningún servidor MCP de terceros.** Los que hay son repositorios
  personales sin auditar a los que habría que entregarles una API key con
  facturación detrás. Cuarenta líneas de `fetch` contra el endpoint oficial hacen lo
  mismo y no añaden a nadie a la cadena de suministro.
- **La key va en el entorno, nunca en el repo.** `GEMINI_API_KEY` como variable de
  entorno; ni en un archivo, ni en un commit, ni en `.mcp.json`.

Flash Image es para **borrador y encuadre**. El plano que se publica se genera con
Nano Banana Pro en AI Studio, que es lo que la mensualidad ya paga.

## Lo que este diseño NO resuelve

- No convierte la mensualidad en cuota de API. Eso no existe hoy.
- No genera las imágenes solo. La generación sigue siendo manual, a propósito.
- No revisa lo generado: que los planos casen lo juzga un ojo humano, y el paquete
  lleva su checklist para eso.
