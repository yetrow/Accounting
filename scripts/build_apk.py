#!/usr/bin/env python3
"""Build offline Android APK with Android SDK 35 / Build Tools 35.0.0 + JDK17.
Optional ECJ_JAR environment variable allows compilation with a JRE and Eclipse compiler.
Run from any directory: python scripts/build_apk.py --sdk /path/to/android-sdk
"""
import argparse, os, pathlib, shutil, subprocess, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT'));p.add_argument('--build-tools',default='35.0.0');p.add_argument('--platform',default='android-35');p.add_argument('--skip-web',action='store_true');args=p.parse_args()
def run(command,cwd=ROOT):
    print('Running',pathlib.Path(str(command[0])).name,flush=True);subprocess.run([str(x) for x in command],cwd=cwd,check=True)
if not args.sdk:sys.exit('Set ANDROID_HOME or pass --sdk (Android SDK 35 required)')
sdk=pathlib.Path(args.sdk).resolve();bt=sdk/'build-tools'/args.build_tools;jar=sdk/'platforms'/args.platform/'android.jar'
if not jar.exists():sys.exit(f'Missing {jar}')
def tool(name):return bt/(name+('.bat' if name in ('d8','apksigner') else '.exe') if os.name=='nt' else name)
if not args.skip_web:run(['npm.cmd' if os.name=='nt' else 'npm','run','build'])
build=ROOT/'android'/'build-manual';shutil.rmtree(build,ignore_errors=True)
for path in ['classes','generated','assets/web','dex']: (build/path).mkdir(parents=True,exist_ok=True)
shutil.copytree(ROOT/'dist',build/'assets/web',dirs_exist_ok=True)
main=ROOT/'android/app/src/main';unsigned=build/'unsigned.apk'
run([tool('aapt'),'package','-f','-m','-M',main/'AndroidManifest.xml','-S',main/'res','-A',build/'assets','-I',jar,'-J',build/'generated','-F',unsigned])
sources=list((main/'java').rglob('*.java'))+list((build/'generated').rglob('*.java'))
compiler=['java','-jar',os.environ['ECJ_JAR']] if os.environ.get('ECJ_JAR') else ['javac']
run(compiler+['-encoding','UTF-8','-source','8','-target','8','-classpath',jar,'-d',build/'classes']+sources)
run([tool('d8'),'--min-api','24','--lib',jar,'--output',build/'dex']+list((build/'classes').rglob('*.class')))
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as apk:
    for dex in (build/'dex').glob('*.dex'):apk.write(dex,dex.name)
aligned=build/'aligned.apk';run([tool('zipalign'),'-f','4',unsigned,aligned])
key=ROOT/'signing'/'ledger-release.jks';password=ROOT/'signing'/'password.txt'
if not key.exists() or not password.exists():sys.exit('Restore private signing files into signing/ first; see README.md')
output=ROOT/'release';output.mkdir(exist_ok=True)
apk=output/'Ledger-2.0.3.apk'
run([tool('apksigner'),'sign','--ks',key,'--ks-key-alias','ledger','--ks-pass','file:'+str(password),'--out',apk,aligned])
run([tool('apksigner'),'verify','--verbose','--print-certs',apk])
print(apk)
