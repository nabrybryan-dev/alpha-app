import socket, json, sys

def send(cmd, params=None, timeout=60):
    s = socket.socket(); s.settimeout(timeout)
    s.connect(("127.0.0.1", 9876))
    s.sendall(json.dumps({"type": cmd, "params": params or {}}).encode())
    buf = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
        try:
            return json.loads(buf.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    s.close()
    raise RuntimeError("respuesta incompleta")
