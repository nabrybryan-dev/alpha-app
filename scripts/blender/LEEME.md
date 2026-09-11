# Exportar la sala del gimnasio desde Blender

Los tres archivos de aquí son los que convierten `Desktop\gimnasio-blender\gimnasio.blend`
en `public/piezas/sala-gimnasio.pieza` y sus texturas. Vivían en el scratchpad de la
sesión del 2026-09-05 y se copian al repo para que no desaparezcan con él.

- `hablar_con_blender.py` — el puente: manda `{"type", "params"}` por socket al
  complemento blender-mcp (puerto 9876) y devuelve la respuesta. `execute_code` corre
  Python dentro de Blender. No necesita el servidor MCP de Claude.
- `exportar_sala.py` — la sala entera con la luz HORNEADA por vértice (sin Cycles: lambert
  × caída × cono por foco, y rayos de sombra a los tres más fuertes), reacomodada para que
  la cámara orbite: sujeto al origen, pilares a las esquinas, nada a menos de 5,8 m, lo que
  estorba pegado a los muros largos. Funde vértices y aligera las letras. Escribe `.pieza`
  v2 (ver `src/features/entrenar/escena/piezas3d.ts`, que es la definición ejecutable).
- `exportar_pieza.py` — un conjunto suelto (un rack) a `.pieza` v1, sin luz. Quedó
  superado por el anterior; se guarda por si hace falta una pieza aparte.

Cómo se corre: con Blender abierto y el complemento conectado,

    python -c "import io; from hablar_con_blender import send; print(send('execute_code', {'code': io.open('exportar_sala.py', encoding='utf-8').read()}, timeout=3000)['result']['result'])"

Tarda ~80 s. Después, `npx vitest run src/features/entrenar/escena/piezas3d.test.ts`
comprueba la pieza real: nada dentro de la órbita, nada bajo el suelo, 16 × 11 × 3,8.
