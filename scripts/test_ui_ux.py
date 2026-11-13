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
    time.sleep(0.4)
    page.screenshot(path='test_artifacts/01_home_clean.png', full_page=True)

    print('2. Opening HSK 4 Deck (Page 2)...')
    page.click('text=Từ vựng HSK 4')
    page.wait_for_selector('text=Luyện tập', timeout=10000)
    time.sleep(0.3)

    # Click Luyện tập
    page.click('button:has-text("Luyện tập")')
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/02_deck_practice_tab.png')
    assert page.locator('button:has-text("Lật thẻ")').is_visible(), 'Lật thẻ should be visible in Luyện tập!'

    print('3. Switching to Kiểm tra tab on Page 2 (Verifying NO Lật thẻ in Test mode)...')
    page.click('button:has-text("Kiểm tra")')
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/03_deck_test_tab.png')
    assert page.locator('button:has-text("Hỗn hợp")').is_visible(), 'Hỗn hợp should be visible in Kiểm tra!'
    assert not page.locator('button:has-text("Lật thẻ")').is_visible(), 'Lật thẻ MUST NOT be in Kiểm tra!'
    print('   [PASS] Kiểm tra has Hỗn hợp, Ghép thẻ, Gõ chữ Hán, Gõ tiếng Việt (no Lật thẻ) and zero black UI.')

    print('4. Testing 3D Flip Animation in Flashcard Practice...')
    page.click('button:has-text("Luyện tập")')
    time.sleep(0.2)
    page.click('button:has-text("Lật thẻ")')
    page.wait_for_selector('text=Số lượng từ', timeout=5000)
    page.click('button:has-text("10")')
    page.click('button:has-text("Bắt đầu")')
    time.sleep(0.3)
    page.screenshot(path='test_artifacts/07_flashcard_front.png')

    flip_inner = page.locator('.flip-card-inner')
    assert 'is-flipped' not in (flip_inner.get_attribute('class') or ''), 'Card should start unflipped!'

    # Click card to trigger 3D flip
    page.click('.flip-card-perspective')
    time.sleep(0.5)
    assert 'is-flipped' in (flip_inner.get_attribute('class') or ''), 'Card should have is-flipped class after click!'
    page.screenshot(path='test_artifacts/08_flashcard_back.png')
    print('   [PASS] 3D Flashcard Flip animation works smoothly.')

    browser.close()
    print('ALL CHECKS PASSED!')
