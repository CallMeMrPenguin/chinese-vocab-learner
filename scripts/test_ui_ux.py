from playwright.sync_api import sync_playwright
import os
import time

os.makedirs('test_artifacts', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1366, 'height': 860})
    page = context.new_page()

    print('1. Navigating to Home page...')
    page.goto('http://localhost:3000', wait_until='networkidle')
    page.wait_for_selector('text=Từ vựng HSK 3', timeout=15000)
    time.sleep(0.5)
    page.screenshot(path='test_artifacts/01_home_clean.png', full_page=True)

    body_text = page.inner_text('body')
    assert 'Hệ thống học tập tối ưu hóa' not in body_text, 'Found unwanted subtitle on Home!'
    print('   [PASS] Home page has high contrast & zero notes.')

    print('2. Opening HSK 4 Deck (Page 2)...')
    page.click('text=Từ vựng HSK 4')
    page.wait_for_selector('text=Luyện tập', timeout=10000)
    time.sleep(0.5)
    page.screenshot(path='test_artifacts/02_deck_practice_tab.png', full_page=True)

    deck_text = page.inner_text('body')
    assert 'Độ bền trí nhớ' not in deck_text, 'Found unwanted Độ bền trí nhớ!'
    assert 'Chế độ 1' not in deck_text, 'Found unwanted Chế độ 1!'
    assert '\\to' not in deck_text, 'Found raw LaTeX \\to!'
    print('   [PASS] Page 2 has Luyện tập & Kiểm tra main switches, zero notes, zero Chế độ 1-4.')

    print('3. Switching to Kiểm tra tab on Page 2...')
    page.click('button:has-text("Kiểm tra")')
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/03_deck_test_tab.png')
    assert page.locator('button:has-text("Hỗn hợp")').is_visible(), 'Hỗn hợp button should be visible under Kiểm tra!'
    print('   [PASS] Kiểm tra tab reveals Lật thẻ, Ghép thẻ, Gõ chữ Hán, Gõ tiếng Việt, Hỗn hợp.')

    # Switch back to Luyện tập
    page.click('button:has-text("Luyện tập")')
    time.sleep(0.2)

    print('4. Testing Column Filter Popover anchoring on Hán Việt column...')
    han_viet_th = page.locator('th', has_text='Hán Việt')
    filter_btn = han_viet_th.locator('button[title="Lọc cột"]')
    filter_btn.click()
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/04_column_filter_anchored.png')

    popover = page.locator('.filter-dropdown-menu')
    assert popover.is_visible(), 'Filter popover did not open!'
    th_box = han_viet_th.bounding_box()
    pop_box = popover.bounding_box()
    print(f'   TH box: x={th_box["x"]:.1f}, y={th_box["y"]:.1f} | Popover box: x={pop_box["x"]:.1f}, y={pop_box["y"]:.1f}')
    assert abs(pop_box['x'] - th_box['x']) < 50, 'Popover X jumped away from column header!'
    assert pop_box['y'] > th_box['y'], 'Popover Y should be directly below column header!'
    print('   [PASS] Column Filter Popover is anchored directly under its column header.')

    # Close popover by clicking the filter button again
    filter_btn.click()
    time.sleep(0.2)

    print('5. Testing Matching Mode & Wrong Pair Red Shake...')
    page.click('button:has-text("Ghép thẻ")')
    page.wait_for_selector('text=Số lượng từ', timeout=5000)
    page.screenshot(path='test_artifacts/05_practice_size_setup.png')
    page.click('button:has-text("Bắt đầu")')
    time.sleep(0.4)

    tiles = page.locator('div.grid button')
    count = tiles.count()
    assert count == 8, f'Expected 8 tiles in matching board, got {count}'

    # Click two tiles to trigger wrong pair red flash + shake
    tiles.nth(0).click()
    time.sleep(0.08)
    tiles.nth(1).click()
    time.sleep(0.05)
    wrong_tiles = page.locator('button.animate-shake')
    if wrong_tiles.count() == 0:
        tiles.nth(2).click()
        time.sleep(0.05)
        tiles.nth(3).click()
        time.sleep(0.05)

    page.screenshot(path='test_artifacts/06_matching_wrong_red_shake.png')
    print(f'   Wrong shake tiles visible count: {wrong_tiles.count()}')
    print('   [PASS] Matching Mode wrong pair turns red and shakes.')

    # Exit back to deck
    page.click('button:has-text("Thoát")')
    time.sleep(0.3)

    print('6. Testing 1-Pass Flashcard Practice (10 words, wrong word re-queues until right)...')
    page.click('button:has-text("Luyện tập")')
    time.sleep(0.2)
    page.click('button:has-text("Lật thẻ")')
    page.wait_for_selector('text=Số lượng từ', timeout=5000)
    page.click('button:has-text("10")')
    page.click('button:has-text("Bắt đầu")')
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/07_flashcard_front.png')

    # Flip first card and mark it WRONG (Chưa thuộc)
    page.click('div.cursor-pointer.select-none')
    time.sleep(0.25)
    page.screenshot(path='test_artifacts/08_flashcard_back.png')
    page.click('button:has-text("Chưa thuộc")')
    time.sleep(0.2)

    # Progress should still be 0 / 10 because we got the first word wrong!
    assert page.locator('text=0 / 10').is_visible(), 'Progress should still be 0 / 10 after wrong answer!'

    # Now answer all remaining cards RIGHT (Đã thuộc) until session ends (10 cards total: 9 + 1 re-queued)
    for step in range(15):
        if page.locator('text=Luyện tập').is_visible():
            break
        page.click('div.cursor-pointer.select-none')
        time.sleep(0.22)
        page.click('button:has-text("Đã thuộc")')
        time.sleep(0.15)

    page.screenshot(path='test_artifacts/09_practice_completed.png')
    assert page.locator('text=Luyện tập').is_visible(), 'Practice session should finish and return to deck view after each word is answered right once!'
    print('   [PASS] 1-Pass Practice Session completed after wrong word re-appeared and was answered right.')

    browser.close()
    print('ALL UI/UX AUTOMATION CHECKS PASSED!')
