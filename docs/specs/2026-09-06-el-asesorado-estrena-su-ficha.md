# El asesorado estrena su ficha: su medida la mete el servidor (2026-09-06)

## Qué fallaba, y cómo se midió

Bryan preguntó «qué necesitas» y una de las respuestas salió de comprobar contra la base
real (solo lectura) una sospecha que un agente había dejado escrita: que el candado del
perfil podía estar rechazando las medidas de los asesorados.

El candado es `proteger_perfil` (migración 0008; la 0056 lo conserva): al asesorado le deja
tocar solo `medidas`, y en un INSERT exige que el blob no lleve **nada más** que `medidas`.
La app, cuando alguien sin ficha registra su primera medida, fabrica la ficha entera con
valores por defecto (`objetivos: ''`, `edad: 0`…) y la sube completa con `usuarioId` dentro.
Resultado: **ningún asesorado ha podido crear jamás su propia fila.** La cola lo reintenta
tres veces y lo aparta en silencio (`descartadas`, en el `localStorage` del móvil): la medida
se ve en su teléfono, no existe en la nube y el servidor no guarda rastro (los logs de
Postgres duran 24 h).

Medido el 2026-09-06 en el proyecto real: 24 asesorados, 22 fichas, **3 sin ficha y los 3 con
microciclo activo** (altas entre el 18-jul y el 24-ago). Quien SÍ tiene ficha pasa el UPDATE,
porque el blob que sube es el mismo que bajó (`perfilesDe` no normaliza nada y
`agregarMedida` solo toca `medidas`); se rechazaría solo si su copia estuviera vieja, que es
una carrera con el coach, no un fallo sistemático.

## Qué se hizo

**Servidor (migración `0057_el_asesorado_estrena_su_ficha.sql`, va ANTES que el código):**

1. Función `registrar_medida(p_medida jsonb)`, `security invoker` (la RLS de `perfiles`
   sigue mandando: cada cual su fila, 0007). A quién se escribe sale de `auth.uid()`, no de
   un parámetro. Crea la ficha si no existe —solo `usuarioId` y `medidas`— y si existe
   sustituye la medida de la misma fecha y deja las medidas ordenadas por fecha. Sin
   `EXECUTE` para `public`/`anon`; solo `authenticated` (misma regla que la 0037).
2. `proteger_perfil` admite ese estreno: en un INSERT el blob puede llevar `usuarioId`
   además de `medidas`, siempre que sea el suyo. El resto sigue igual (el UPDATE solo toca
   `medidas`; el sexo lo indica el coach, 0056).
3. Señal `0057 - el asesorado estrena su ficha` en `comprobar-migraciones.sql`, y casos
   11–14 en `supabase/test/10-escrituras-del-asesorado.sql` (estreno, sustitución y orden,
   aislamiento entre A y B, y que el camino viejo siga cerrado). El CI del PR los corre
   contra Postgres; aquí no hay `psql`.

**App:**

- `sync.ts`: `agregarMedida` ya no sube la ficha entera; encola una llamada
  `registrar_medida` con `p_medida` (y `claveRpc` por día: dos registros del mismo día se
  funden y manda el último, como en local). El coach sigue subiendo la ficha completa con
  su columna `sexo`.
- `cola.ts`: campo `fila` en la operación pendiente, porque una RPC no puede llevar la fila
  en el `payload` (PostgREST elige la función por el conjunto exacto de claves).
- `fusion.ts`: la medida pendiente se funde sobre la ficha descargada igual que la pondrá
  el servidor, y si la ficha no existe la estrena con `perfilVacio` (nuevo, en dominio;
  también lo usa `mockDb`). Sin esto, registrar con la descarga en vuelo la borraba de la
  pantalla hasta la siguiente hidratación.
- `perfilEnNube.ts` pierde la fila del asesorado; las pruebas que vigilaban el envío
  (`perfilEnNube.test`, `sexo-en-la-ficha-sync.test`, `contrato-payloads`) cambian de
  afirmación: una fila del coach con `sexo`, y una llamada `registrar_medida` con solo
  `p_medida`, que además tiene que existir en alguna migración.

## Lo que queda de Bryan

- Aplicar la 0056 y la 0057, en ese orden, antes de que este código llegue a producción.
- Avisar a los tres: lo que registraron hasta hoy está solo en su móvil. Con la 0057
  aplicada y la app nueva, su siguiente medida estrena la ficha; las anteriores se
  reencolan solo si la app las rescata de `descartadas` al volver a entrar.
