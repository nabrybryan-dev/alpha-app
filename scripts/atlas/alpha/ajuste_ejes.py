import bpy, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pieza
P = {p['nombre']: p for p in pieza.leer(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'origen', 'atlas-musculos-zanatomy.pieza'))}
res = []
for nombre in ('Gluteus maximus muscle.l', 'Rectus femoris muscle.r', 'Sartorius muscle.l', 'Tibialis anterior muscle.r'):
    o = bpy.data.objects.get(nombre)
    if not o or nombre not in P: continue
    me = o.data; n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world); w = co @ mw[:3, :3].T + mw[:3, 3]
    b = np.stack([w[:, 0], w[:, 2], -w[:, 1]], 1)  # Blender Z-arriba -> Y-arriba
    q = P[nombre]['pos'].astype(np.float64)
    if len(q) != n: res.append((nombre, 'distinto n', n, len(q))); continue
    A = np.hstack([b, np.ones((n, 1))]); sol, *_ = np.linalg.lstsq(A, q, rcond=None)
    err = np.abs(A @ sol - q).max()
    res.append((nombre, np.round(sol, 5).tolist(), float(err)))
for r in res: print('AJUSTE', r)
