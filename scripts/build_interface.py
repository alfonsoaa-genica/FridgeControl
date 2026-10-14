from pathlib import Path
from shutil import copytree, rmtree, copyfileobj
from subprocess import check_output, Popen, PIPE, STDOUT, CalledProcessError
import os
import gzip

Import("env")

def gzipFile(file):
    with open(file, 'rb') as f_in:
        with gzip.open(file + '.gz', 'wb') as f_out:
            copyfileobj(f_in, f_out)
    os.remove(file)

def flagExists(flag):
    buildFlags = env.ParseFlags(env["BUILD_FLAGS"])
    for define in buildFlags.get("CPPDEFINES"):
        if (define == flag or (isinstance(define, list) and define[0] == flag)):
            return True

def buildWeb():
    skip_npm = os.environ.get("SMC_SKIP_UI") == "1"
    buildPath = Path("interface/build")
    wwwPath = Path("data/www")
    
    if not skip_npm and not buildPath.exists():
        os.chdir("interface")
        print("Building interface with npm")
        try:
            if not Path("node_modules").exists():
                env.Execute("npm install")
            env.Execute("npm run build")
        finally:
            os.chdir("..")
    
    if buildPath.exists() and buildPath.is_dir():
        if wwwPath.exists() and wwwPath.is_dir():
            rmtree(wwwPath)        
        print("Copying interface to data directory")
        copytree(buildPath, wwwPath)
        for currentpath, folders, files in os.walk(wwwPath):
            for file in files:
                gzipFile(os.path.join(currentpath, file))
    else:
        print("Warning: interface/build directory not found. Skipping copying interface.")

targets = set(BUILD_TARGETS)
if (len(targets) == 0 or targets.intersection({"upload", "buildfs", "uploadfs"})):
    buildWeb()
else:
    print("Skipping build interface step for target(s): " + ", ".join(BUILD_TARGETS))
