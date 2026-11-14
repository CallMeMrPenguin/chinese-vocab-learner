import subprocess
import sys
import os
import re
import json

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WRANGLER_TOML = os.path.join(ROOT_DIR, "wrangler.toml")
DB_NAME = "chinese-vocab-db"


def run_cmd(cmd, capture=False):
    print(f"\n> {cmd}")
    if capture:
        res = subprocess.run(
            cmd,
            cwd=ROOT_DIR,
            shell=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return res.returncode, res.stdout or ""
    else:
        res = subprocess.run(cmd, cwd=ROOT_DIR, shell=True)
        return res.returncode, ""


def ensure_d1_in_wrangler():
    with open(WRANGLER_TOML, "r", encoding="utf-8") as f:
        content = f.read()

    if "[[d1_databases]]" in content and "database_id" in content:
        print("[OK] wrangler.toml đã có cấu hình [[d1_databases]].")
        return

    print("[1/3] Kiểm tra hoặc tạo Cloudflare D1 Database...")
    code, out = run_cmd("npx --yes wrangler@latest d1 list --json", capture=True)
    db_id = None

    if code == 0:
        try:
            match = re.search(r"\[.*\]", out, re.DOTALL)
            if match:
                dbs = json.loads(match.group(0))
                for item in dbs:
                    if item.get("name") == DB_NAME:
                        db_id = item.get("uuid")
                        break
        except Exception:
            pass

    if not db_id:
        code, out = run_cmd(f"npx --yes wrangler@latest d1 create {DB_NAME}", capture=True)
        print(out)
        m = re.search(r'database_id\s*[:=]\s*"([a-f0-9-]+)"', out, re.IGNORECASE)
        if not m:
            m = re.search(r'"uuid"\s*:\s*"([a-f0-9-]+)"', out, re.IGNORECASE)
        if m:
            db_id = m.group(1)

    if db_id:
        print(f"[OK] Đã lấy được D1 database_id: {db_id}")
        d1_block = (
            f"\n[[d1_databases]]\n"
            f'binding = "DB"\n'
            f'database_name = "{DB_NAME}"\n'
            f'database_id = "{db_id}"\n'
        )
        with open(WRANGLER_TOML, "w", encoding="utf-8") as f:
            f.write(content.strip() + "\n" + d1_block)
        print("[OK] Đã tự động gắn [[d1_databases]] vào wrangler.toml!")
    else:
        print("[!] Không tự động lấy được database_id (vui lòng kiểm tra đăng nhập wrangler).")


def main():
    print("======================================================")
    print("  TRIỂN KHAI LÊN CLOUDFLARE (WORKER + ASSETS + D1)    ")
    print("======================================================")

    code, out = run_cmd("npx --yes wrangler@latest whoami", capture=True)
    if code != 0 or "not authenticated" in out.lower():
        print("[!] Vui lòng bấm Allow đăng nhập Cloudflare trên trình duyệt vừa mở...")
        run_cmd("npx --yes wrangler@latest login")

    ensure_d1_in_wrangler()

    print("\n[2/3] Đang build và đẩy (deploy) trực tiếp lên Cloudflare...")
    code, _ = run_cmd("npx --yes wrangler@latest deploy")
    if code != 0:
        print("[LỖI] Quá trình deploy gặp lỗi.")
        sys.exit(1)

    print("\n[3/3] Đồng bộ cấu hình lên GitHub...")
    run_cmd('git add . && git commit -m "chore: bind D1 database in wrangler.toml" && git push origin main')

    print("\n[HOÀN TẤT] Đã cập nhật Worker + Giao diện mới + D1 Database (5GB) lên Cloudflare!")


if __name__ == "__main__":
    main()
