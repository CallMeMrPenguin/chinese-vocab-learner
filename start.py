import os
import sys
import time
import subprocess
import webbrowser
import urllib.request
import signal

PORT = 3000
URL = f"http://localhost:{PORT}"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

def check_dependencies():
    """Kiem tra Node.js, npm va thu muc node_modules."""
    print("[INFO] Kiem tra moi truong Node.js...")
    try:
        subprocess.run(["node", "-v"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, shell=True)
        subprocess.run(["npm", "-v"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, shell=True)
    except Exception:
        print("[ERROR] Khong tim thay Node.js hoac npm tren he thong. Vui long cai dat Node.js truoc.")
        sys.exit(1)

    node_modules_dir = os.path.join(ROOT_DIR, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("[INFO] Thu muc node_modules chua ton tai. Dang cai dat thu vien (npm install)...")
        subprocess.run(["npm", "install"], cwd=ROOT_DIR, check=True, shell=True)

def free_port(port):
    """Giai phong port neu co tien trinh cu dang chiem dung."""
    try:
        # Tim PID cua tien trinh dang nghe tren port
        cmd = f'netstat -ano | findstr :{port} | findstr LISTENING'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        lines = [line.strip() for line in res.stdout.strip().split("\n") if line.strip()]
        pids = set()
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                pid = parts[-1]
                if pid.isdigit() and int(pid) > 0:
                    pids.add(pid)
        for pid in pids:
            print(f"[INFO] Giai phong port {port} (PID: {pid})...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def wait_for_server(url, timeout=40):
    """Cho den khi may chu phan hoi HTTP."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status in (200, 304):
                    return True
        except Exception:
            time.sleep(0.8)
    return False

def main():
    os.chdir(ROOT_DIR)
    print("=" * 60)
    print("  KHOI DONG UNG DUNG: CHINESE VOCAB LEARNER")
    print(f"  Thu muc: {ROOT_DIR}")
    print(f"  Dia chi: {URL}")
    print("=" * 60)

    check_dependencies()
    free_port(PORT)

    print(f"[INFO] Dang khoi dong Next.js dev server tren port {PORT}...")
    
    # Khoi chay npm run dev
    dev_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=ROOT_DIR,
        shell=True
    )

    def cleanup(signum=None, frame=None):
        print("\n[INFO] Dang tat ung dung...")
        try:
            dev_process.terminate()
            subprocess.run(f"taskkill /F /T /PID {dev_process.pid}", shell=True, capture_output=True)
        except Exception:
            pass
        free_port(PORT)
        print("[INFO] Da tat ung dung thanh cong.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print(f"[INFO] Dang doi server san sang tai {URL}...")
    if wait_for_server(URL, timeout=45):
        print(f"[SUCCESS] Server da san sang! Dang mo trinh duyet tai {URL}...")
        webbrowser.open(URL)
    else:
        print(f"[WARNING] Server khoi dong lau hon du kien. Vui long mo thu cong: {URL}")

    print("\n[INFO] Nhan Ctrl + C trong cua so nay de dung server.\n")

    try:
        dev_process.wait()
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
