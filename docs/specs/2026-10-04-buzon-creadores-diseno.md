# Buzón de creadores: un enlace privado de subida por creador (4-oct-2026)

**Estado:** diseño. Sin código, sin migración y sin función desplegada. El plan de pasos está en
`docs/plans/2026-10-04-buzon-creadores.md`.
**Decisión de la que sale:** «Buzón = enlace privado de subida por creador; PR en borrador» (Bryan,
4-oct-2026; esquema operativo de la bola de nieve, §3.7).

## Para qué

Los creadores del piloto (bola de nieve) tienen que mandarle material a Alpha: sus reels para la
revisión de la etapa 2, guiones y capturas de las métricas de su propia cuenta. Hoy no hay un canal:
llegaría por WhatsApp o por correo, sin rastro y mezclado con lo demás. El buzón es una puerta
**de un solo sentido**: el creador sube y Alpha lee. El creador no ve lo que subieron otros, ni
siquiera lo suyo de antes.

**Los creadores no tienen cuenta en la app** (`ACUERDO-CREADOR`: solo Bryan los contacta). Por eso
la puerta es un enlace con un código, igual que el atajo de salud (0093), y no un inicio de sesión.

## Qué puede entrar (la frontera)

- **Sí:** contenido propio del creador (videos e imágenes de sus publicaciones, guiones) y capturas
  de las estadísticas de **su** cuenta.
- **No:** nada de terceros. Ni datos de clientes de Alpha, ni conversaciones, ni datos de salud de
  nadie. La página lo dice antes del botón de subir, y la adenda del acuerdo lo repite.
- Formatos: `video/mp4`, `video/quicktime`, `image/jpeg`, `image/png` y `application/pdf`. Lo
  impone el bucket (`allowed_mime_types`), no solo la página.
- Tamaño: hasta 200 MB por archivo (`file_size_limit` del bucket) y hasta 20 archivos por enlace.
  Son valores amarillos: se pueden cambiar sin tocar el diseño.

## Cómo funciona

```
Bryan (consola) ─ «Generar enlace» ─▶ buzon_generar_enlace(candidato)  → muestra el enlace UNA vez
                                                                         (en la base, solo el hash)
Creador ─ abre https://<app>/buzon#bz_<40 hex>      (el código va en el FRAGMENTO: no llega a ningún servidor)
        ─ elige un archivo
        ─ POST /functions/v1/buzon-creador  (cabecera x-alpha-buzon, nombre, tipo, tamaño)
              └─ la función valida el código (hash, vigencia, cupo) y devuelve una URL FIRMADA de
                 subida, válida 2 horas, a una ruta que elige el SERVIDOR:
                 creadores-buzon/<candidato_id>/<enlace_id>/<uuid>.<ext>
        ─ PUT del archivo a esa URL (directo a Storage; la función no toca el archivo)
        ─ POST /functions/v1/buzon-creador/confirmar → la función comprueba que el objeto existe
              y anota la fila en creadores_buzon_archivos
Staff con revisar_creadores ─ consola de creadores ─ ve los archivos del creador, URL firmada de lectura
```

### Piezas

| Pieza | Qué es | Regla |
|---|---|---|
| `creadores_buzon_enlaces` | Un enlace por creador y vuelta: `candidato_id`, `token_hash` (sha-256), `creado_por`, `creado_en`, `caduca_en` (por defecto, 14 días), `revocado_en`, `max_archivos`, `archivos_recibidos` | RLS. Leen el coach y quien tiene `revisar_creadores` (`puede_ver_creadores()`), **sin la columna del hash** (grant por columna, como en `salud_atajo_tokens`). Nadie con sesión escribe directo. Un solo enlace activo por creador (índice único parcial). |
| `creadores_buzon_archivos` | Lo recibido: `enlace_id`, `ruta`, `tipo`, `bytes`, `subido_en`, `estado` (`recibido`/`revisado`/`descartado`) | Igual: lectura por `puede_ver_creadores()`; escriben la función y el staff con capacidad, vía función. |
| Bucket `creadores-buzon` | Privado, con `file_size_limit` y `allowed_mime_types` | Sin política para `anon`: ni leer ni listar. Lee `puede_ver_creadores()`. Las subidas entran solo por URL firmada. |
| `buzon_generar_enlace(candidato)` / `buzon_revocar_enlace(candidato)` | `security definer`, `search_path` fijo, `revoke … from public, anon` | Solo el coach. Generar revoca el anterior y devuelve el código en claro **una sola vez**. |
| `buzon_autorizar(hash)` / `buzon_registrar(...)` | Para la Edge Function | Solo `service_role`. |
| Edge Function `buzon-creador` | `verify_jwt` apagado (el creador no tiene sesión); valida el código **antes** de leer el cuerpo | Mismo patrón que `salud-atajo`: no escribe en sus registros el código, su hash ni los nombres de los archivos; tope de 20 peticiones por hora y enlace. |
| Página `/buzon` | Pública, sin datos de nadie | Muestra «N de M archivos recibidos» y la frontera. Nunca lista archivos. |

## Riesgos y cómo se cubren

- **Un enlace filtrado** sirve para SUBIR, nunca para LEER: no hay política de lectura para `anon`
  y la URL firmada es solo de subida, a una ruta que eligió el servidor. Lo peor que puede pasar es
  que alguien suba basura: el cupo de 20 archivos, la caducidad de 14 días y la revocación lo acotan.
- **El código en los registros.** Va en el fragmento de la URL (`#`), que el navegador no manda.
  En la llamada viaja como cabecera, nunca en la URL.
- **Un archivo con datos de terceros** (la frontera se rompe): el staff lo marca `descartado` y lo
  borra; si son datos de salud o de clientes, aplica `legal/PROTOCOLO-INCIDENTES.md`.
- **Hojas de revisión hacia fuera:** las hojas de cuadros que salen de estos videos no van a
  proveedores externos sin autorización escrita del creador (RV-01). El buzón no cambia esa regla.

## Conservación

`FALTA` (decisión de Bryan con el abogado): cuánto se guarda lo subido. **Por defecto, mientras no
se decida:** hasta 90 días después de cerrar la etapa 2 del creador. Después se borra, igual que
las hojas de cuadros. Es amarillo y reversible: se fija en la adenda.

## Qué queda fuera

- Que el creador vea lo que subió (lista) o lo borre: no hace falta para el piloto, y abriría la
  lectura.
- Subidas por WhatsApp o por correo: siguen siendo posibles, pero no cuentan como recibidas en el
  tablero.
- Antivirus o revisión automática de contenido: los archivos solo los abre el staff, desde la consola.

## Cómo se sabe que funciona

- Prueba SQL (CI): `anon` no lee ni lista el bucket ni las tablas; `authenticated` sin capacidad
  tampoco; nadie lee el hash; el coach genera y revoca; un enlace caducado, revocado o sin cupo no
  autoriza.
- Pruebas de la función (vitest, con un doble del almacén, como `saludAtajoFuncion.test.ts`):
  código ausente o inválido → 401; tipo o tamaño fuera de la lista → 422; la ruta la decide el
  servidor aunque el cliente mande otra; nada de esto aparece en los registros.
- Señales en `comprobar-migraciones.sql` para la migración nueva.
