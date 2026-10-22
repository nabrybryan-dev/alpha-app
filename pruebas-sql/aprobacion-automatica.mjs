import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

// Prueba de la firma AUTOMÁTICA de la revisión semanal (decisión de Bryan, 21-oct: «Solos, sin
// freno»). PostgreSQL aislado en memoria, sin credenciales ni red: NO toca la base real.
//
// Lo que vigila, y cada punto es una forma de que la voz del coach llegue donde no debe:
//   · solo el proceso de servicio firma (ni la persona, ni anon, ni quien no tenga el rol);
//   · solo firma lo que el agente marcó (`p_usuarios`) y NUNCA una fila ya firmada, con
//     corrección pedida, sin guion, con ruta histórica o sin archivo;
//   · el interruptor: una orden `detener` vigente (la MÁS RECIENTE entre detener y reanudar)
//     impide firmar. La consola apunta `detener` a la semana que SE VA A CARGAR (el lunes
//     siguiente, ver AccionesRevision.tsx), así que se mira la semana de la revisión y la
//     siguiente;
//   · la firma automática queda distinguible de la del coach (`aprobacion`);
//   · las políticas RLS de la 0068 NO se tocan: la persona ve la fila solo cuando está firmada.
//
// El nombre del archivo de migración lleva `XXXX` hasta que Bryan elija el número.
//
// `MIGRACION_ALTERNA` existe para los MUTANTES: se apunta a una copia con un defecto sembrado y
// esta prueba tiene que ponerse roja (ver `pruebas-sql/mutar-aprobacion-automatica.mjs`).
const MIGRACION = process.env.MIGRACION_ALTERNA
  ? pathToFileURL(process.env.MIGRACION_ALTERNA)
  : new URL('../supabase/migrations/XXXX_aprobacion_automatica_revisiones.sql', import.meta.url)

const db = new PGlite()
const coach = '00000000-0000-4000-8000-000000000001'
const ana = '00000000-0000-4000-8000-000000000002'
const beto = '00000000-0000-4000-8000-000000000004'
const carla = '00000000-0000-4000-8000-000000000005'
const dani = '00000000-0000-4000-8000-000000000006'
const eva = '00000000-0000-4000-8000-000000000007'
const fede = '00000000-0000-4000-8000-000000000008'
const SEMANA = '2026-10-19'
const SIGUIENTE = '2026-10-26'
const rutaDe = (persona, semana = SEMANA, n = 3) =>
  `personas/${persona}/${semana}/00000000-0000-4000-8000-00000000000${n}.mp3`

const leer = async (ruta) => readFile(new URL(`../supabase/migrations/${ruta}`, import.meta.url), 'utf8')
const q = (sql, params) => db.query(sql, params)
const fila = async (persona) =>
  (await q('select * from videos_semanales where usuario_id = $1 and semana = $2', [persona, SEMANA])).rows[0]
const comoServicio = () => q("select set_config('request.jwt.claim.role', 'service_role', false)")
const sinRol = () => q("select set_config('request.jwt.claim.role', '', false)")
const huellaDe = (texto) => createHash('sha256').update(texto ?? '', 'utf8').digest('hex')
const llamar = (revisiones, semana = SEMANA) =>
  q('select firmar_revisiones_automaticas($1::date, $2::jsonb) as n', [semana, JSON.stringify(revisiones)])
// Lo que hace el puente: LEE la fila (versión y guion) y firma ESA versión, con la huella de ESE guion.
const revisionDe = async (persona, semana = SEMANA) => {
  const f = (await q('select version, guion from videos_semanales where usuario_id = $1 and semana = $2', [persona, semana])).rows[0]
  return { usuario_id: persona, version: f?.version ?? 1, guion_sha256: huellaDe(f?.guion) }
}
const firmar = async (usuarios, semana = SEMANA) => llamar(await Promise.all(usuarios.map((u) => revisionDe(u, semana))), semana)
const publicar = async (persona, extra = {}) => {
  const ruta = extra.path ?? rutaDe(persona)
  await q(
    `insert into videos_semanales(usuario_id, semana, path, guion, tipo)
     values ($1,$2,$3,$4,'audio')
     on conflict (usuario_id, semana) do update set path = excluded.path, guion = excluded.guion, publicado_en = now()`,
    [persona, SEMANA, ruta, extra.guion ?? 'Guion ficticio'],
  )
  if (extra.sinArchivo !== true) await q('insert into storage.objects values ($1,$2)', ['medios-app', ruta])
}
// La clave de idempotencia con la MISMA forma que src/data/consola/ordenes.ts: detener y reanudar
// llevan la hora (desde la revisión 06, H1); reportar_riesgo no. Una `clave` explícita reproduce la
// forma vieja de detener (sin hora) para comprobar que ESA colisionaba.
const claveDe = (tipo, persona, semana, creada) =>
  tipo === 'reportar_riesgo' ? `${tipo}|${persona}|${semana}|actor` : `${tipo}|${persona}|${semana}|actor|${creada}`
const orden = (tipo, persona, semana, creada, clave = claveDe(tipo, persona, semana, creada)) =>
  q('insert into public.ordenes(tipo, objetivo, creada_en, idempotency_key) values ($1, $2::jsonb, $3, $4)', [
    tipo,
    JSON.stringify({ usuario_id: persona, semana_inicio: semana, motivo: 'prueba' }),
    creada,
    clave,
  ])

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    -- Supabase concede EXECUTE a anon/authenticated/service_role sobre toda función nueva de
    -- \`public\`. Sin esto la prueba no vería el REVOKE de la migración hacer nada.
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${coach}'), ('${ana}'), ('${beto}'), ('${carla}'), ('${dani}'), ('${eva}'), ('${fede}');
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('prueba.usuario', true), '')::uuid $$;
    create function public.es_coach() returns boolean language sql as
      $$ select auth.uid() = '${coach}'::uuid $$;
    create table storage.objects(bucket_id text, name text);
    create table public.medios_app(path text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1] $$;
    create table public.videos_semanales(usuario_id uuid, semana date, path text, guion text,
      tipo text default 'video', publicado_en timestamptz default now(), aprobado_en timestamptz,
      primary key(usuario_id,semana));
    -- Las columnas de la 0083 (ordenes) y 0084 (tipo 'reanudar'), CON el unique(idempotency_key):
    -- sin él esta prueba no veía que un segundo detener del mismo actor colisiona (revisión 06, H1).
    create table public.ordenes(id uuid primary key default gen_random_uuid(),
      tipo text not null check (tipo in ('detener','reportar_riesgo','pedir_correccion','responder','reanudar','preparar_firma')),
      objetivo jsonb not null, creada_en timestamptz not null default now(),
      idempotency_key text not null unique);
  `)
  await db.exec(await leer('0065_el_video_es_de_cada_quien.sql'))
  await db.exec(await leer('0068_el_video_no_sale_sin_firma.sql'))
  await db.exec('grant usage on schema auth, storage to authenticated; grant select on videos_semanales, medios_app, storage.objects to authenticated;')
  await db.exec(await leer('0081_firma_revision_por_version.sql'))

  // ── Estado ANTERIOR a la migración: una firma antigua, hecha a mano, sin firmante ──
  await publicar(ana)
  await q("update videos_semanales set aprobado_en = now() where usuario_id = $1", [ana])
  assert.notEqual((await fila(ana)).aprobado_en, null, 'la firma antigua existe antes de migrar')

  // ── La migración ──
  await db.exec(await readFile(MIGRACION, 'utf8'))
  // IDEMPOTENTE (revisión 06, A4): las migraciones se pegan a mano y alguien puede pegarla dos veces.
  await db.exec(await readFile(MIGRACION, 'utf8'))

  // 1. Las firmas antiguas pasan a «coach»; lo no firmado se queda sin marca.
  assert.equal((await fila(ana)).aprobacion, 'coach', 'las firmas antiguas quedan como firma del coach')
  await publicar(beto)
  assert.equal((await fila(beto)).aprobacion, null, 'sin firma no hay marca de aprobación')
  await assert.rejects(
    q("update videos_semanales set aprobacion = 'otra' where usuario_id = $1", [ana]),
    /aprobacion_check|violates check/,
    'la marca solo admite coach o automatica',
  )

  // 2. Una marca sin firma se borra sola; una firma sin marca la hace el trigger «coach».
  await q("update videos_semanales set aprobacion = 'automatica' where usuario_id = $1", [beto])
  assert.equal((await fila(beto)).aprobacion, null, 'aprobacion sin aprobado_en no se sostiene')

  // 3. La firma del coach por la bandeja de siempre (decidir_revision_semanal) dice «coach».
  await q("select set_config('prueba.usuario', $1, false)", [coach])
  const versionBeto = (await fila(beto)).version
  await q('select decidir_revision_semanal($1,$2,$3,true,null)', [beto, SEMANA, versionBeto])
  assert.equal((await fila(beto)).aprobacion, 'coach')
  assert.equal((await fila(beto)).aprobado_por, coach)

  // 4. Cambiar el guion retira la firma Y la marca (otra versión, otra firma).
  await q("update videos_semanales set guion = 'Otro guion' where usuario_id = $1", [beto])
  assert.equal((await fila(beto)).aprobado_en, null)
  assert.equal((await fila(beto)).aprobacion, null, 'al retirar la firma se retira la marca')

  // ── Permisos ──
  await sinRol()
  await publicar(carla)
  await assert.rejects(firmar([carla]), /Solo el proceso de servicio/, 'sin rol de servicio, ni siendo el dueño de la función')
  const permisos = (
    await q(`select has_function_privilege('anon', 'firmar_revisiones_automaticas(date,jsonb)', 'execute') as anon,
                    has_function_privilege('authenticated', 'firmar_revisiones_automaticas(date,jsonb)', 'execute') as autenticado,
                    has_function_privilege('service_role', 'firmar_revisiones_automaticas(date,jsonb)', 'execute') as servicio`)
  ).rows[0]
  assert.deepEqual(permisos, { anon: false, autenticado: false, servicio: true })
  await db.exec('set role authenticated')
  await assert.rejects(firmar([carla]), /permission denied/, 'la persona autenticada no puede ejecutarla')
  await db.exec('reset role')
  assert.equal((await fila(carla)).aprobado_en, null, 'nada se firmó en los intentos rechazados')

  // ── La firma automática, con el rol de servicio ──
  await comoServicio()
  // Solo firma a quien el agente marcó: beto está publicado y sin firma, pero no va en la lista.
  assert.equal((await firmar([carla])).rows[0].n, 1)
  const firmada = await fila(carla)
  assert.equal(firmada.aprobacion, 'automatica', 'la firma automática se distingue de la del coach')
  assert.notEqual(firmada.aprobado_en, null)
  assert.equal(firmada.aprobado_por, null, 'no hay firmante humano')
  assert.equal(firmada.version, 1, 'firmar no sube la versión (el trigger deja la firma en su sitio)')
  assert.equal((await fila(beto)).aprobado_en, null, 'beto no iba en la lista y se queda sin firmar')

  // Nunca pisa lo ya firmado: ni por el coach ni por ella misma.
  assert.equal((await firmar([carla, ana])).rows[0].n, 0)
  assert.equal((await fila(ana)).aprobacion, 'coach', 'la firma del coach no se reetiqueta')

  // La corrección pedida, el guion vacío, la ruta histórica y el archivo ausente frenan la firma.
  const frenos = [
    ['corrección pedida', "update videos_semanales set correccion_solicitada = 'Corregir' where usuario_id = $1 and semana = '2026-10-19'", beto],
    ['guion en blanco', "update videos_semanales set guion = '   ' where usuario_id = $1 and semana = '2026-10-19'", beto],
    ['ruta histórica', "update videos_semanales set path = 'personas/historico.mp3' where usuario_id = $1 and semana = '2026-10-19'", beto],
  ]
  // El archivo histórico SÍ está en el almacén: así solo la forma de la ruta puede frenarlo.
  await q('insert into storage.objects values ($1,$2)', ['medios-app', 'personas/historico.mp3'])
  for (const [nombre, sql, persona] of frenos) {
    await q("update videos_semanales set correccion_solicitada = null, guion = 'Guion ficticio', path = $2 where usuario_id = $1", [persona, rutaDe(persona)])
    await q(sql, [persona])
    assert.equal((await firmar([persona])).rows[0].n, 0, `no firma con ${nombre}`)
  }
  await q("update videos_semanales set correccion_solicitada = null, guion = 'Guion ficticio', path = $2 where usuario_id = $1", [beto, rutaDe(beto)])
  await q("delete from storage.objects where name = $1", [rutaDe(beto)])
  assert.equal((await firmar([beto])).rows[0].n, 0, 'no firma si el archivo no está en el almacén')
  await q('insert into storage.objects values ($1,$2)', ['medios-app', rutaDe(beto)])

  // ── El interruptor: detener ──
  // a) una orden de OTRA persona, u otra semana lejana, no frena.
  await orden('detener', carla, SEMANA, '2026-10-20T10:00:00Z')
  await orden('detener', beto, '2026-11-09', '2026-10-20T10:00:00Z')
  assert.equal((await firmar([beto])).rows[0].n, 1, 'una orden ajena no frena')
  await q("update videos_semanales set aprobado_en = null where usuario_id = $1", [beto])
  assert.equal((await fila(beto)).aprobacion, null)
  // b) detener a esa persona para la semana de la revisión frena.
  await orden('detener', beto, SEMANA, '2026-10-21T10:00:00Z')
  assert.equal((await firmar([beto])).rows[0].n, 0, 'detener (semana de la revisión) frena la firma')
  assert.equal((await fila(beto)).aprobado_en, null)
  // c) una reanudación POSTERIOR apaga la detención; una anterior no.
  await orden('reanudar', beto, SEMANA, '2026-10-21T09:00:00Z')
  assert.equal((await firmar([beto])).rows[0].n, 0, 'una reanudación anterior a la orden no la apaga')
  await orden('reanudar', beto, SEMANA, '2026-10-21T11:00:00Z')
  assert.equal((await firmar([beto])).rows[0].n, 1, 'la reanudación más reciente apaga la detención')
  // d) detener la semana que SE VA A CARGAR (el lunes siguiente) frena también la revisión de esta.
  await q("update videos_semanales set aprobado_en = null where usuario_id = $1", [beto])
  await orden('detener', beto, SIGUIENTE, '2026-10-22T10:00:00Z')
  assert.equal((await firmar([beto])).rows[0].n, 0, 'detener la semana siguiente también frena')
  assert.equal((await fila(beto)).aprobado_en, null)

  // e) A1 (revisión 06): manda la orden más reciente POR SEMANA, no por persona. Un detener de la
  //    semana que se va a cargar NO lo apaga un reanudar posterior de la semana de la revisión.
  await publicar(eva)
  await orden('detener', eva, SIGUIENTE, '2026-10-22T10:00:00Z')
  await orden('reanudar', eva, SEMANA, '2026-10-22T12:00:00Z')
  assert.equal((await firmar([eva])).rows[0].n, 0, 'un reanudar de OTRA semana no apaga el detener de la siguiente')
  assert.equal((await fila(eva)).aprobado_en, null)

  // f) H1 (revisión 06): detener → reanudar → detener del mismo actor. La consola armaba la clave de
  //    detener SIN hora: el segundo detener chocaba con unique(idempotency_key) (23505), se tomaba por
  //    «ya estaba detenida» y la orden más reciente quedaba en reanudar. Primero, el fallo reproducido:
  const claveVieja = `detener|${dani}|${SEMANA}|actor`
  await publicar(dani)
  await orden('detener', dani, SEMANA, '2026-10-21T08:00:00Z', claveVieja)
  await orden('reanudar', dani, SEMANA, '2026-10-21T09:00:00Z')
  await assert.rejects(
    orden('detener', dani, SEMANA, '2026-10-21T10:00:00Z', claveVieja),
    /unique|duplicate/i,
    'la clave sin hora colisiona: ESE era el agujero',
  )
  assert.equal((await firmar([dani])).rows[0].n, 1, 'con el segundo detener perdido, la firma pasaba (la consecuencia del agujero)')
  //    Y ahora con la clave de ahora (lleva la hora): las tres órdenes se guardan y NO se firma.
  await publicar(fede)
  await orden('detener', fede, SEMANA, '2026-10-21T08:00:00Z')
  await orden('reanudar', fede, SEMANA, '2026-10-21T09:00:00Z')
  await orden('detener', fede, SEMANA, '2026-10-21T10:00:00Z')
  assert.equal((await firmar([fede])).rows[0].n, 0, 'detener → reanudar → detener: la última orden manda y es un detener')
  assert.equal((await fila(fede)).aprobado_en, null)

  // g) «Reportar riesgo» de la consola frena SOLO a esa persona (decisión de Bryan, 22-oct). Mismas
  //    semanas que detener (la de la revisión y la siguiente); un reanudar NO lo apaga (reanudar es de
  //    detener); el riesgo de otra persona o de otra semana lejana no frena.
  const persona = (n) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`
  const [r1, r2, r3, r4, r5] = [11, 12, 13, 14, 15].map(persona)
  for (const p of [r1, r2, r3, r4, r5]) await publicar(p)
  await orden('reportar_riesgo', r1, SEMANA, '2026-10-21T10:00:00Z')
  await orden('reportar_riesgo', r2, SIGUIENTE, '2026-10-21T10:00:00Z')
  await orden('reportar_riesgo', r3, '2026-11-02', '2026-10-21T10:00:00Z')
  await orden('reportar_riesgo', r5, SEMANA, '2026-10-21T10:00:00Z')
  await orden('reanudar', r5, SEMANA, '2026-10-21T11:00:00Z')
  assert.equal((await firmar([r1])).rows[0].n, 0, 'riesgo reportado esa semana frena a esa persona')
  assert.equal((await firmar([r2])).rows[0].n, 0, 'riesgo reportado para la semana siguiente también frena')
  assert.equal((await firmar([r5])).rows[0].n, 0, 'un reanudar no apaga un riesgo reportado')
  assert.equal((await firmar([r3, r4])).rows[0].n, 2, 'un riesgo de otra semana lejana, o de otra persona, no frena a los demás')
  for (const p of [r1, r2, r5]) assert.equal((await fila(p)).aprobado_en, null)

  // h) H4: se firma la versión y el guion que el puente COMPROBÓ, no lo que haya cuando llegue la llamada.
  const h = persona(21)
  await publicar(h)
  const comprobada = await revisionDe(h)
  assert.equal((await llamar([{ ...comprobada, version: comprobada.version + 1 }])).rows[0].n, 0, 'otra versión: no firma')
  assert.equal((await llamar([{ ...comprobada, guion_sha256: huellaDe('otro guion') }])).rows[0].n, 0, 'otra huella: no firma')
  assert.equal((await llamar([{ ...comprobada, guion_sha256: '' }])).rows[0].n, 0, 'sin huella: no firma')
  assert.equal((await llamar([{ usuario_id: h, version: comprobada.version }])).rows[0].n, 0, 'sin campo de huella: no firma')
  //    Otra corrida republica ENTRE la lectura y la firma: la lectura vieja ya no vale.
  await q("update videos_semanales set guion = 'Guion republicado' where usuario_id = $1", [h])
  assert.equal((await llamar([comprobada])).rows[0].n, 0, 'si la fila cambió entre la lectura y la firma, no firma')
  assert.equal((await fila(h)).aprobado_en, null)
  assert.equal((await firmar([h])).rows[0].n, 1, 'releída, la versión nueva sí se firma')
  assert.equal((await llamar('esto no es una lista')).rows[0].n, 0, 'una entrada que no es una lista no firma nada y no revienta')

  // i) A3 (revisión 06): un INSERT nunca nace firmado (la hebilla de la 0081 sigue donde estaba).
  const nacida = persona(31)
  await q(
    `insert into videos_semanales(usuario_id, semana, path, guion, tipo, aprobado_en, aprobado_por, aprobacion)
     values ($1,$2,$3,'Guion ficticio','audio', now(), $4, 'coach')`,
    [nacida, SEMANA, rutaDe(nacida), coach],
  )
  const recienNacida = await fila(nacida)
  assert.equal(recienNacida.aprobado_en, null, 'un INSERT con aprobado_en nace SIN firma')
  assert.equal(recienNacida.aprobacion, null)
  assert.equal(recienNacida.aprobado_por, null)

  // j) A5 (revisión 06): la SEGUNDA puerta del rol. El dueño de la función (que no pasa por el REVOKE)
  //    la llama diciendo ser otro rol: authenticated, anon o ninguno de los dos.
  await publicar(persona(41))
  for (const rolFalso of ['authenticated', 'anon', 'postgres', 'service_role_falso']) {
    await db.exec(`select set_config('request.jwt.claim.role', '${rolFalso}', false)`)
    await assert.rejects(firmar([persona(41)]), /Solo el proceso de servicio/, `el rol «${rolFalso}» no firma`)
  }
  await db.exec(`select set_config('request.jwt.claim.role', '', false); select set_config('request.jwt.claims', '{"role":"authenticated"}', false)`)
  await assert.rejects(firmar([persona(41)]), /Solo el proceso de servicio/, 'tampoco por request.jwt.claims')
  await db.exec("select set_config('request.jwt.claims', '', false)")
  await comoServicio()
  assert.equal((await fila(persona(41))).aprobado_en, null, 'nada se firmó en esos intentos')

  // ── La forma moderna del rol (request.jwt.claims en JSON) también vale ──
  await db.exec("select set_config('request.jwt.claim.role', '', false); select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)")
  await q("update videos_semanales set aprobado_en = null where usuario_id = $1", [carla])
  await q("delete from public.ordenes where objetivo->>'usuario_id' = $1", [carla])
  assert.equal((await firmar([carla])).rows[0].n, 1, 'acepta el rol en request.jwt.claims')
  await db.exec("select set_config('request.jwt.claims', '', false)")

  // ── La puerta de la persona no cambia: ve la fila SOLO si está firmada ──
  await q("select set_config('prueba.usuario', $1, false)", [carla])
  await db.exec('set role authenticated')
  assert.deepEqual((await q('select usuario_id, aprobacion from videos_semanales')).rows, [{ usuario_id: carla, aprobacion: 'automatica' }])
  await q("select set_config('prueba.usuario', $1, false)", [beto])
  assert.equal((await q('select * from videos_semanales')).rows.length, 0, 'beto no ve la suya: sigue sin firmar')
  await db.exec('reset role')
  console.log('SQL: firma automática (solo servicio, solo lo marcado, interruptor detener/reanudar, marca coach/automatica) comprobada.')
} catch (error) {
  console.error(error.stack ?? error.message)
  process.exitCode = 1
} finally {
  await db.close()
}
