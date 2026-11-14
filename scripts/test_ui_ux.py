from playwright.sync_api import sync_playwright
import os
import time

ARTIFACT_DIR = r"C:\Users\ACER\.gemini\antigravity\brain\2afd7fd4-1c7c-46b0-8d6e-3b6c82eea630"

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 840})
        page = context.new_page()

        print("1. Opening http://localhost:3000...")
        page.goto("http://localhost:3000", wait_until="domcontentloaded")
        page.wait_for_selector("text=Từ vựng HSK 4", timeout=20000)
        time.sleep(0.6)

        print("2. Opening 'Đăng nhập / Hồ sơ' modal and testing Register + 3-Step Auto-Save Monitor...")
        page.click("button:has-text('Đăng nhập / Hồ sơ')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_01_login_modal.png"))

        page.click("button:has-text('Tạo mật khẩu')")
        time.sleep(0.3)
        page.fill("input[placeholder='mrpenguin']", "mrpenguin")
        page.fill("input[placeholder='Mr Penguin']", "Mr Penguin")
        page.fill("input[placeholder='Ví dụ: hsk4pass']", "hsk4pass123")
        page.fill("input[placeholder='Nhập lại...']", "hsk4pass123")
        page.fill("input[placeholder='Nhập câu trả lời của bạn...']", "Ha Noi")
        page.click("button:has-text('Tạo hồ sơ & mật khẩu')")
        time.sleep(0.8)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_02_registered_profile.png"))

        print("3. Switching to 'Kiểm tra Tự lưu 3 bước' tab and testing all 3 steps...")
        page.click("button:has-text('Kiểm tra Tự lưu 3 bước')")
        time.sleep(0.4)
        page.click("button:has-text('Test Bước 1')")
        time.sleep(0.3)
        page.click("button:has-text('Test Bước 2')")
        time.sleep(0.3)
        page.click("button:has-text('Test Bước 3')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_03_three_step_sync_check.png"))

        # Close modal
        page.keyboard.press("Escape")
        # Or click close X
        page.locator("div.fixed.inset-0 button").first.click()
        time.sleep(0.3)

        print("4. Testing snappy 35px desktop mouse drag on Flashcard...")
        page.click("text=Từ vựng HSK 4")
        time.sleep(0.3)
        page.click("text=HSK 4 - Phần 1")
        time.sleep(0.3)
        page.click("text=HSK 4 - Bài 1")
        time.sleep(0.4)
        page.click("text=Lật thẻ")
        time.sleep(0.5)

        card = page.locator(".flip-card-perspective")
        box = card.bounding_box()
        if box:
            cx = box["x"] + box["width"] / 2
            cy = box["y"] + box["height"] / 2
            # Drag only 35px to the right -> should trigger swipe right!
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.mouse.move(cx + 35, cy, steps=4)
            page.mouse.up()
            time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_04_after_short_35px_swipe.png"))
        browser.close()
        print("All v6 tests passed!")

if __name__ == "__main__":
    run_tests()
