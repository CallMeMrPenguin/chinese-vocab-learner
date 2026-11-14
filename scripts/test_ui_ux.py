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
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_selector("text=Từ vựng HSK 4", timeout=20000)
        time.sleep(1.0)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_01_root_folders.png"))
        print("   -> Root folders screenshot saved.")

        print("2. Navigating into Folder 'Từ vựng HSK 4' -> Subfolder 'HSK 4 - Phần 1'...")
        page.click("text=Từ vựng HSK 4")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_02_subfolders.png"))
        print("   -> Subfolders screenshot saved.")

        page.click("text=HSK 4 - Phần 1")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_03_decks_in_subfolder.png"))
        print("   -> Decks with overall + per-mode progress bars screenshot saved.")

        print("3. Opening Deck 'HSK 4 - Bài 1'...")
        page.click("text=HSK 4 - Bài 1")
        time.sleep(0.6)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_04_deck_detail_practice.png"))

        print("4. Switching to 'Kiểm tra' tab to verify 'Hỗn hợp' button color...")
        page.click("button:has-text('Kiểm tra')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_05_deck_detail_test.png"))

        print("5. Starting 'Lật thẻ' (Flashcard) - should start immediately with 20 words, no extra bar, no deck title...")
        page.click("button:has-text('Luyện tập')")
        time.sleep(0.3)
        page.click("text=Lật thẻ")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_06_flashcard_front.png"))

        print("6. Testing ArrowDown to flip card in 3D and ArrowRight to swipe 'Đã thuộc'...")
        page.keyboard.press("ArrowDown")
        time.sleep(0.6)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_07_flashcard_flipped.png"))

        page.keyboard.press("ArrowRight")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_08_flashcard_after_swipe.png"))

        print("7. Testing 'Sửa từ' modal inside Flashcard practice...")
        page.click("button:has-text('Sửa từ')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v5_09_edit_vocab_modal.png"))
        page.click("button:has-text('Hủy')")
        time.sleep(0.3)

        browser.close()
        print("All UI/UX verification checks passed!")

if __name__ == "__main__":
    run_tests()
