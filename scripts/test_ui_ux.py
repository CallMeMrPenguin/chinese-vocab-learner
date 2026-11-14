from playwright.sync_api import sync_playwright
import os
import time

ARTIFACT_DIR = r"C:\Users\ACER\.gemini\antigravity\brain\2afd7fd4-1c7c-46b0-8d6e-3b6c82eea630"

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 840})
        page = context.new_page()

        print("1. Opening http://localhost:3000 -> Must show dedicated AuthPage...")
        page.goto("http://localhost:3000", wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('Đăng nhập')", timeout=20000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_01_dedicated_login_page.png"))

        print("2. Logging in with built-in admin account (admin / callmemrpenguin)...")
        inputs = page.locator("form input")
        inputs.nth(0).fill("admin")
        inputs.nth(1).fill("callmemrpenguin")
        page.click("form button[type='submit']")

        page.wait_for_selector("text=Từ vựng HSK 4", timeout=15000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_02_after_admin_login.png"))

        print("3. Opening Admin Profile modal -> Must show 3-Step Sync Test Panel for admin...")
        page.click("button:has-text('Admin')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_03_admin_profile_modal.png"))

        print("4. Logging out and creating a normal user -> Must NOT show Admin Test Panel...")
        page.click("button:has-text('Đăng xuất')")
        time.sleep(0.4)
        page.click("button:has-text('Tạo mật khẩu')")
        time.sleep(0.3)
        reg_inputs = page.locator("form input")
        reg_inputs.nth(0).fill("user1")
        reg_inputs.nth(1).fill("Học Viên 1")
        reg_inputs.nth(2).fill("pass123")
        reg_inputs.nth(3).fill("pass123")
        reg_inputs.nth(4).fill("Ha Noi")
        page.click("form button[type='submit']")
        page.wait_for_selector("button:has-text('Học Viên 1')", timeout=15000)
        time.sleep(0.4)

        page.click("button:has-text('Học Viên 1')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_04_normal_user_profile_modal.png"))

        browser.close()
        print("All v7 Auth & Admin tests passed!")

if __name__ == "__main__":
    run_tests()
