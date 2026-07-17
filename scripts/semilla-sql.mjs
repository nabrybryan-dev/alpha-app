// Construcción pura del SQL de semilla (sin I/O) — testeada en src/test/semilla-sql.test.ts
// El SQL resultante se pega en el SQL Editor de Supabase: resuelve los UUID reales
// de las cuentas por correo y reemplaza los ids locales del seed (u-bryan, u-valentina).

const ID_COACH = 'u-bryan'
const ID_VALENTINA = 'u-valentina'
const IDS_CONOCIDOS = new Set([ID_COACH, ID_VALENTINA])

export function escaparTexto(valor) {
  if (valor === null || valor === undefined) return 'null'
  return `'${String(valor).replace(/'/g, "''")}'`
}

export function elegirEtiqueta(texto) {
  let etiqueta = '$semilla$'
  let n = 0
  while (texto.includes(etiqueta)) {
    n += 1
    etiqueta = `$semilla${n}$`
  }
  return etiqueta
}

// Literal jsonb con los ids locales sustituidos por los UUID (variables del bloque DO)
export function literalJsonb(objeto) {
  const json = JSON.stringify(objeto)
  const et = elegirEtiqueta(json)
  return `replace(replace(${et}${json}${et}, '${ID_COACH}', v_coach::text), '${ID_VALENTINA}', v_valentina::text)::jsonb`
}

function refUsuario(idLocal) {
  if (idLocal === ID_COACH) return 'v_coach'
  if (idLocal === ID_VALENTINA) return 'v_valentina'
  throw new Error(`Id de usuario sin cuenta en la nube: ${idLocal}`)
}

export function verificarIdsLocales(seed) {
  const json = JSON.stringify(seed)
  const desconocidos = new Set()
  for (const [token] of json.matchAll(/"u-[a-z0-9-]+"/g)) {
    const id = token.slice(1, -1)
    if (!IDS_CONOCIDOS.has(id)) desconocidos.add(id)
  }
  if (desconocidos.size > 0) {
    throw new Error(`El seed filtrado aún referencia usuarios sin cuenta: ${[...desconocidos].join(', ')}`)
  }
}

// Reduce el seed completo a lo que existe en la nube: el coach y la asesorada de prueba
export function filtrarSeed(seed) {
  const deValentina = (filas) => filas.filter((f) => f.usuarioId === ID_VALENTINA)
  return {
    perfiles: deValentina(seed.perfiles),
    microciclos: deValentina(seed.microciclos),
    checkins: deValentina(seed.checkins),
    planes: deValentina(seed.planes),
    adherencias: deValentina(seed.adherencias),
    mensajes: seed.mensajes.filter((m) => IDS_CONOCIDOS.has(m.deId) && IDS_CONOCIDOS.has(m.paraId)),
    cuestionarios: seed.cuestionarios.map((c) => ({ ...c, asignadoA: [ID_VALENTINA] })),
    respuestas: deValentina(seed.respuestas),
    contenidos: seed.contenidos,
    premiaciones: deValentina(seed.premiaciones),
  }
}

export function construirSemillaSql(seedCompleto, fechaGeneracion) {
  const s = filtrarSeed(seedCompleto)
  verificarIdsLocales(s)
  if (JSON.stringify(s).includes('$bloque$')) {
    throw new Error('Los datos contienen la etiqueta $bloque$ y romperían el bloque DO')
  }

  const lineas = []
  const insertar = (sql) => lineas.push(`  ${sql}`)

  lineas.push(`-- App Alpha Athletics · Semilla de datos de prueba (generada ${fechaGeneracion})`)
  lineas.push('-- 1. EDITA los dos correos de la sección CONFIGURA (deben ser los de las cuentas')
  lineas.push('--    que creaste en Authentication → Users).')
  lineas.push('-- 2. Pega TODO en Supabase → SQL Editor → New query → Run.')
  lineas.push('-- Es seguro correrla varias veces: borra y recarga los datos de prueba.')
  lineas.push('')
  lineas.push('do $bloque$')
  lineas.push('declare')
  lineas.push("  -- ══════════ CONFIGURA: tus dos correos ══════════")
  lineas.push("  correo_coach     constant text := 'TU-CORREO@AQUI.com';")
  lineas.push("  correo_valentina constant text := 'CORREO-DE-PRUEBA@AQUI.com';")
  lineas.push('  -- ═══════════════════════════════════════════════')
  lineas.push('  v_coach uuid;')
  lineas.push('  v_valentina uuid;')
  lineas.push('begin')
  lineas.push('  select id into v_coach from auth.users where email = correo_coach;')
  lineas.push('  select id into v_valentina from auth.users where email = correo_valentina;')
  lineas.push("  if v_coach is null then raise exception 'No existe una cuenta con el correo del coach: %', correo_coach; end if;")
  lineas.push("  if v_valentina is null then raise exception 'No existe una cuenta con el correo de prueba: %', correo_valentina; end if;")
  lineas.push('')
  lineas.push('  -- Nombres y roles')
  lineas.push("  update public.usuarios_app set rol = 'coach', nombre = 'Bryan', avatar_iniciales = 'B' where id = v_coach;")
  lineas.push("  update public.usuarios_app set nombre = 'Valentina Cruz', avatar_iniciales = 'VC' where id = v_valentina;")
  lineas.push('')
  lineas.push('  -- Limpieza de datos de prueba previos (solo de estas dos cuentas)')
  for (const tabla of ['perfiles', 'microciclos', 'checkins', 'adherencias', 'planes_nutricionales', 'respuestas', 'premiaciones']) {
    insertar(`delete from public.${tabla} where usuario_id in (v_coach, v_valentina);`)
  }
  insertar('delete from public.mensajes where de_id in (v_coach, v_valentina) and para_id in (v_coach, v_valentina);')
  lineas.push('')

  lineas.push('  -- Perfil')
  for (const p of s.perfiles) {
    insertar(`insert into public.perfiles (usuario_id, datos) values (${refUsuario(p.usuarioId)}, ${literalJsonb(p)});`)
  }

  lineas.push('')
  lineas.push('  -- Microciclos')
  for (const m of s.microciclos) {
    insertar(
      `insert into public.microciclos (id, usuario_id, numero, estado, datos) values (${escaparTexto(m.id)}, ${refUsuario(m.usuarioId)}, ${m.numero}, ${escaparTexto(m.estado)}, ${literalJsonb(m)});`,
    )
  }

  lineas.push('')
  lineas.push('  -- Check-ins de bienestar')
  for (const c of s.checkins) {
    insertar(
      `insert into public.checkins (id, usuario_id, fecha, datos) values (${escaparTexto(c.id)}, ${refUsuario(c.usuarioId)}, ${escaparTexto(c.fecha)}, ${literalJsonb(c)});`,
    )
  }

  lineas.push('')
  lineas.push('  -- Plan nutricional y adherencia')
  for (const p of s.planes) {
    insertar(
      `insert into public.planes_nutricionales (id, usuario_id, datos) values (${escaparTexto(p.id)}, ${refUsuario(p.usuarioId)}, ${literalJsonb(p)});`,
    )
  }
  for (const a of s.adherencias) {
    insertar(
      `insert into public.adherencias (id, usuario_id, fecha, estado, comentario) values (${escaparTexto(a.id)}, ${refUsuario(a.usuarioId)}, ${escaparTexto(a.fecha)}, ${escaparTexto(a.estado)}, ${escaparTexto(a.comentario ?? null)});`,
    )
  }

  lineas.push('')
  lineas.push('  -- Chat coach ↔ asesorada')
  for (const m of s.mensajes) {
    insertar(
      `insert into public.mensajes (id, de_id, para_id, fecha_iso, texto, adjunto_url, leido) values (${escaparTexto(m.id)}, ${refUsuario(m.deId)}, ${refUsuario(m.paraId)}, ${escaparTexto(m.fechaIso)}, ${escaparTexto(m.texto)}, ${escaparTexto(m.adjuntoUrl ?? null)}, ${m.leido ? 'true' : 'false'});`,
    )
  }

  lineas.push('')
  lineas.push('  -- Cuestionarios, respuestas, contenidos y premiaciones')
  for (const c of s.cuestionarios) {
    insertar(
      `insert into public.cuestionarios (id, datos, asignado_a) values (${escaparTexto(c.id)}, ${literalJsonb(c)}, array[v_valentina]) on conflict (id) do update set datos = excluded.datos, asignado_a = excluded.asignado_a;`,
    )
  }
  for (const r of s.respuestas) {
    insertar(
      `insert into public.respuestas (id, cuestionario_id, usuario_id, fecha_iso, valores) values (${escaparTexto(r.id)}, ${escaparTexto(r.cuestionarioId)}, ${refUsuario(r.usuarioId)}, ${escaparTexto(r.fechaIso)}, ${literalJsonb(r.valores)});`,
    )
  }
  for (const c of s.contenidos) {
    insertar(
      `insert into public.contenidos (id, datos) values (${escaparTexto(c.id)}, ${literalJsonb(c)}) on conflict (id) do update set datos = excluded.datos;`,
    )
  }
  for (const p of s.premiaciones) {
    insertar(
      `insert into public.premiaciones (id, usuario_id, titulo, fecha, nota) values (${escaparTexto(p.id)}, ${refUsuario(p.usuarioId)}, ${escaparTexto(p.titulo)}, ${escaparTexto(p.fecha)}, ${escaparTexto(p.nota ?? null)});`,
    )
  }

  lineas.push('')
  lineas.push("  raise notice 'Semilla cargada: perfil, % microciclos, % check-ins, % mensajes.', " + `${s.microciclos.length}, ${s.checkins.length}, ${s.mensajes.length};`)
  lineas.push('end')
  lineas.push('$bloque$;')
  lineas.push('')
  return lineas.join('\n')
}
