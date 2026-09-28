"""Lector y escritor del formato .pieza v3 de alpha-app (espejo de src/features/entrenar/escena/piezas3d.ts).

Parte = {nombre, horneada, pos (n,3) f32, nrm (n,3), col (n,3) 0..1, uv (n,2) o None, idx (m,)}.
"""
import struct
import numpy as np

MAGIA = b'PIEZ'
B_HORNEADA, B_SIN_UV, B_IDX32 = 1, 2, 4


def _rell(n):
    return (4 - n % 4) % 4


def leer(ruta):
    b = open(ruta, 'rb').read()
    assert b[:4] == MAGIA, b[:4]
    ver, n_partes = struct.unpack_from('<HH', b, 4)
    assert ver == 3, ver
    pos = 8
    partes = []
    for _ in range(n_partes):
        (largo,) = struct.unpack_from('<H', b, pos)
        nombre = b[pos + 2:pos + 2 + largo].decode('utf8') if largo else None
        pos += 2 + largo + _rell(2 + largo)
        (band,) = struct.unpack_from('<I', b, pos); pos += 4
        nv, ni = struct.unpack_from('<II', b, pos); pos += 8
        base = np.frombuffer(b, '<f4', 3, pos); esc = np.frombuffer(b, '<f4', 3, pos + 12); pos += 24
        sin_uv = bool(band & B_SIN_UV)
        if not sin_uv:
            uvb = np.frombuffer(b, '<f4', 2, pos); uve = np.frombuffer(b, '<f4', 2, pos + 8); pos += 16

        def av(n):
            nonlocal pos
            pos += n; pos += _rell(pos)
        cp = np.frombuffer(b, '<u2', nv * 3, pos).reshape(-1, 3); av(nv * 6)
        p = base + cp / 65535.0 * esc
        nr = np.frombuffer(b, 'i1', nv * 3, pos).reshape(-1, 3) / 127.0; av(nv * 3)
        co = np.frombuffer(b, 'u1', nv * 3, pos).reshape(-1, 3) / 255.0; av(nv * 3)
        uv = None
        if not sin_uv:
            cu = np.frombuffer(b, '<u2', nv * 2, pos).reshape(-1, 2); av(nv * 4)
            uv = uvb + cu / 65535.0 * uve
        if band & B_IDX32:
            ix = np.frombuffer(b, '<u4', ni, pos).astype(np.uint32); av(ni * 4)
        else:
            ix = np.frombuffer(b, '<u2', ni, pos).astype(np.uint32); av(ni * 2)
        partes.append(dict(nombre=nombre, horneada=bool(band & B_HORNEADA), pos=p.astype(np.float32),
                           nrm=nr.astype(np.float32), col=co.astype(np.float32), uv=uv, idx=ix))
    assert pos == len(b), (pos, len(b))
    return partes


def escribir(partes, ruta):
    out = bytearray(MAGIA + struct.pack('<HH', 3, len(partes)))

    def alin():
        out.extend(b'\0' * _rell(len(out)))
    for q in partes:
        nb = (q['nombre'] or '').encode('utf8')
        out += struct.pack('<H', len(nb)) + nb + b'\0' * _rell(2 + len(nb))
        p = np.asarray(q['pos'], np.float64); nv = len(p)
        uv = q.get('uv')
        sin_uv = q['nombre'] is None or uv is None or not np.any(uv)
        idx32 = nv > 65535
        band = (B_HORNEADA if q.get('horneada') else 0) | (B_SIN_UV if sin_uv else 0) | (B_IDX32 if idx32 else 0)
        idx = np.asarray(q['idx'], np.uint32)
        out += struct.pack('<III', band, nv, len(idx))
        mn = p.min(0).astype(np.float32); es = np.maximum(p.max(0) - mn, 1e-9).astype(np.float32)
        out += mn.tobytes() + es.tobytes()
        if not sin_uv:
            u = np.asarray(uv, np.float64); umn = u.min(0).astype(np.float32); ues = np.maximum(u.max(0) - umn, 1e-9).astype(np.float32)
            out += umn.tobytes() + ues.tobytes()
        out += np.round((p - mn) / es * 65535).astype('<u2').tobytes(); alin()
        out += np.clip(np.round(np.asarray(q['nrm']) * 127), -127, 127).astype('i1').tobytes(); alin()
        out += np.clip(np.round(np.asarray(q['col']) * 255), 0, 255).astype('u1').tobytes(); alin()
        if not sin_uv:
            out += np.round((u - umn) / ues * 65535).astype('<u2').tobytes(); alin()
        out += idx.astype('<u4' if idx32 else '<u2').tobytes(); alin()
    open(ruta, 'wb').write(bytes(out))
    return len(out)
