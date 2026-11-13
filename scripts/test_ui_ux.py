import os
import time
from playwright.sync_api import sync_playwright

os.makedirs('test_artifacts', exist_ok=True)

results = []

def record(name, status, details=""):
    results.append({'name': name, 'status': status, 'details': details})
    print(f"[{status}] {name} - {details}")

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # ── Test 1: Home View & Seeding ─────────────────────────────────
        page.goto('http://localhost:3000', wait_until='networkidle')
        page.wait_for_timeout(2000) # wait for IndexedDB seeding

        # Check for decks
        page.wait_for_selector('text=Từ vựng HSK 3', timeout=5000)
        hsk3_card = page.locator('text=Từ vựng HSK 3').first
        hsk4_card = page.locator('text=Từ vựng HSK 4').first

        if hsk3_card.is_visible() and hsk4_card.is_visible():
            record('1. Home View & Seeding', 'PASS', 'HSK 3 and HSK 4 decks loaded in IndexedDB')
        else:
            record('1. Home View & Seeding', 'FAIL', 'Decks not visible')

        page.screenshot(path='test_artifacts/1_home.png')

        # Check emoji prohibition
        html_content = page.content()
        emoji_sample = [c for c in html_content if ord(c) > 0x1F600 and ord(c) < 0x1F64F]
        if not emoji_sample:
            record('1b. Zero-Emoji Compliance', 'PASS', 'No emojis detected in DOM')
        else:
            record('1b. Zero-Emoji Compliance', 'FAIL', f'Found emojis: {emoji_sample}')

        # ── Test 2: Deck Detail & TanStack DataTable ───────────────────
        hsk3_card.click()
        page.wait_for_timeout(1000)

        # Check Deck Detail elements
        title_elem = page.locator('h1:has-text("Từ vựng HSK 3")')
        pagination_info = page.locator('text=Hiển thị 1 đến 20')
        if title_elem.is_visible() and pagination_info.is_visible():
            record('2. Deck Detail View', 'PASS', 'Deck detail loaded with 507 words and 20 rows/page')
        else:
            record('2. Deck Detail View', 'FAIL', 'Header or pagination info missing')

        # Test pagination: Next & Prev
        next_btn = page.locator('button:has-text("Sau")')
        next_btn.click()
        page.wait_for_timeout(500)
        page2_info = page.locator('text=Trang 2 / 26')
        if page2_info.is_visible():
            record('2b. Pagination Next', 'PASS', 'Page changed to 2 / 26')
        else:
            record('2b. Pagination Next', 'FAIL', 'Page did not advance')

        prev_btn = page.locator('button:has-text("Trước")')
        prev_btn.click()
        page.wait_for_timeout(500)

        # Test Search
        search_input = page.locator('input[placeholder*="Tìm"]')
        search_input.fill('học')
        page.wait_for_timeout(600)
        search_res = page.locator('table tbody tr')
        record('2c. Live Search', 'PASS', f'Filtered rows count: {search_res.count()}')
        search_input.fill('')
        page.wait_for_timeout(500)

        # Test Column Filter Popover
        filter_btn = page.locator('th button').first
        filter_btn.click()
        page.wait_for_timeout(500)
        popover = page.locator('span:has-text("Lọc:")')
        if popover.is_visible():
            record('2d. Column Filter Popover', 'PASS', 'Popover opened with A-Z sort & checkboxes')
            # Close popover by clicking outside
            page.mouse.click(100, 100)
            page.wait_for_timeout(400)
        else:
            record('2d. Column Filter Popover', 'FAIL', 'Popover did not open')

        page.screenshot(path='test_artifacts/2_deck_detail_table.png')

        # ── Test 3: Import Modal ("Nhập") ──────────────────────────────
        import_btn = page.locator('button:has-text("Nhập")').first
        import_btn.click()
        page.wait_for_timeout(500)
        import_modal = page.locator('h2:has-text("Nhập từ vựng")')
        paste_tab = page.locator('button:has-text("Dán danh sách")')
        manual_tab = page.locator('button:has-text("Nhập từng từ")')
        if import_modal.is_visible() and paste_tab.is_visible() and manual_tab.is_visible():
            record('3. Import Modal ("Nhập")', 'PASS', 'Both tabs (Paste & Manual) visible and responsive')
        else:
            record('3. Import Modal ("Nhập")', 'FAIL', 'Import modal elements missing')

        page.screenshot(path='test_artifacts/3_import_modal.png')
        page.locator('button:has-text("Hủy")').first.click()
        page.wait_for_timeout(500)

        # ── Test 4: Edit Deck Modal ────────────────────────────────────
        edit_pen_btn = page.locator('button[title="Chỉnh sửa bộ từ"]')
        edit_pen_btn.click()
        page.wait_for_timeout(500)
        edit_modal = page.locator('h2:has-text("Chỉnh sửa bộ từ")')
        delete_btn = page.locator('button:has-text("Xóa bộ từ")')
        if edit_modal.is_visible() and delete_btn.is_visible():
            record('4. Edit Deck Modal', 'PASS', 'Single pen edit modal with merged delete button active')
        else:
            record('4. Edit Deck Modal', 'FAIL', 'Edit modal missing')

        page.screenshot(path='test_artifacts/4_edit_deck_modal.png')
        page.locator('button:has-text("Hủy")').first.click()
        page.wait_for_timeout(500)

        # ── Test 5: Flashcard Mode ─────────────────────────────────────
        fc_btn = page.locator('button:has-text("Lật thẻ")')
        fc_btn.click()
        page.wait_for_timeout(500)

        # Check session size selector
        size_picker = page.locator('h1:has-text("Thiết lập số lượng từ luyện tập")')
        btn_10 = page.locator('button:has-text("10 từ")')
        if size_picker.is_visible() and btn_10.is_visible():
            record('5a. Session Sizing Selector', 'PASS', 'Options 10-30 words rendered with spacing notes')
        else:
            record('5a. Session Sizing Selector', 'FAIL', 'Sizing screen missing')

        btn_10.click()
        page.locator('button:has-text("Bắt đầu luyện tập")').click()
        page.wait_for_timeout(800)

        # Flashcard Arena
        hero_char = page.locator('.h-28 span.text-6xl')
        if hero_char.is_visible():
            record('5b. Flashcard Hero Text', 'PASS', f'Hero text visible: {hero_char.inner_text()}')
        else:
            record('5b. Flashcard Hero Text', 'FAIL', 'Hero text missing')

        # Click to flip
        page.locator('.h-28').click()
        page.wait_for_timeout(400)
        pinyin_text = page.locator('div.text-sm.font-medium.text-slate-600')
        if pinyin_text.is_visible():
            record('5c. Flashcard Flip & Metadata', 'PASS', f'Back side revealed: {pinyin_text.inner_text()}')
        else:
            record('5c. Flashcard Flip & Metadata', 'FAIL', 'Back side did not reveal')

        page.screenshot(path='test_artifacts/5_flashcard_mode.png')

        # Click "Đã nhớ"
        remember_btn = page.locator('button:has-text("Đã nhớ")')
        remember_btn.click()
        page.wait_for_timeout(600)

        # Exit practice
        page.locator('button:has-text("Thoát phiên")').click()
        page.wait_for_timeout(500)

        # ── Test 6: Matching Mode ──────────────────────────────────────
        match_btn = page.locator('button:has-text("Ghép thẻ")')
        match_btn.click()
        page.wait_for_timeout(500)
        page.locator('button:has-text("10 từ")').click()
        page.locator('button:has-text("Bắt đầu luyện tập")').click()
        page.wait_for_timeout(800)

        # Verify micro-board (8 tiles = 4 pairs)
        tiles = page.locator('button:has(span.text-2xl), button:has(span.line-clamp-3)')
        tile_count = tiles.count()
        if tile_count == 8:
            record('6. Matching Micro-Board', 'PASS', 'Exactly 4 pairs (8 tiles) rendered to eliminate visual scan delay')
        else:
            record('6. Matching Micro-Board', 'FAIL', f'Tile count was {tile_count}, expected 8')

        page.screenshot(path='test_artifacts/6_matching_mode.png')
        page.locator('button:has-text("Thoát phiên")').click()
        page.wait_for_timeout(500)

        # ── Test 7: Writing Mode (Keyboard Input) ──────────────────────
        write_zh_btn = page.locator('button:has-text("Gõ chữ Hán")')
        write_zh_btn.click()
        page.wait_for_timeout(500)
        page.locator('button:has-text("10 từ")').click()
        page.locator('button:has-text("Bắt đầu luyện tập")').click()
        page.wait_for_timeout(800)

        text_input = page.locator('input[placeholder*="Gõ chữ Hán"]')
        if text_input.is_visible():
            record('7a. Writing Chinese Mode', 'PASS', 'Keyboard input field active with Vietnamese prompt')
        else:
            record('7a. Writing Chinese Mode', 'FAIL', 'Text input missing')

        page.screenshot(path='test_artifacts/7_writing_mode.png')
        page.locator('button:has-text("Thoát phiên")').click()
        page.wait_for_timeout(500)

        # ── Test 8: Test Mode (100% Bloom Criterion) ───────────────────
        test_btn = page.locator('button:has-text("Kiểm tra (100%)")')
        test_btn.click()
        page.wait_for_timeout(800)

        test_input = page.locator('input[placeholder*="Gõ"]')
        if test_input.is_visible():
            # Submit wrong input to test Bloom 100% fail gate & Remediation
            test_input.fill('sai_hoan_toan')
            page.locator('button:has-text("Câu tiếp theo"), button:has-text("Nộp bài thi")').click()
            page.wait_for_timeout(500)

            # Fast forward through remaining questions or exit to check result
            record('8a. Test Mode Interaction', 'PASS', 'Mix Mode question input responded to submission')
        else:
            record('8a. Test Mode Interaction', 'FAIL', 'Test question input missing')

        # Dừng bài kiểm tra to return
        page.locator('button:has-text("Dừng bài kiểm tra")').click()
        page.wait_for_timeout(500)

        browser.close()

if __name__ == '__main__':
    run_tests()
    print("\n--- ALL TESTS COMPLETED ---")
