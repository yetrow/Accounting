import os,pathlib,subprocess,time,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
server=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','3000'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try:urllib.request.urlopen('http://127.0.0.1:3000',timeout=1);break
        except Exception:time.sleep(.1)
    result=subprocess.run(['node','tests/mobile.cjs'],cwd=root)
finally:server.terminate()
raise SystemExit(result.returncode)
