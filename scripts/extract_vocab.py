import os
import json
import re
import urllib.request
import fitz
import pdfplumber

# 1. Base Han-Viet character dictionaries
url1 = 'https://raw.githubusercontent.com/binhbuithithanh/hanzi-sino-vietnamese/main/data/characters.json'
req1 = urllib.request.Request(url1, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req1, timeout=10) as r:
        data1 = json.loads(r.read())
    hv_map = {item['hanzi']: item.get('sinoViet', '').capitalize() for item in data1 if item.get('sinoViet')}
except Exception as e:
    print('Failed to load online data1:', e)
    hv_map = {}

url2 = 'https://raw.githubusercontent.com/phucbm/xue-hanzi/main/public/data/dictionary.json'
req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req2, timeout=10) as r:
        data2 = json.loads(r.read())
    for item in data2:
        s = item.get('s', '')
        sv = item.get('sv', '').strip()
        if len(s) == 1 and sv and s not in hv_map:
            hv_map[s] = sv.capitalize()
except Exception as e:
    print('Failed to load online data2:', e)

# 2. Add manual mapping for remaining characters
EXTRA_HV = {
    '乒': 'Binh', '乓': 'Bàng', '乡': 'Hương', '亚': 'Á', '仅': 'Cẩn', '伙': 'Hỏa',
    '估': 'Cổ', '俩': 'Lưỡng', '值': 'Trị', '允': 'Doãn', '剩': 'Thặng', '匙': 'Thi',
    '厚': 'Hậu', '咸': 'Hàm', '喊': 'Hảm', '嗯': 'Ân', '嗽': 'Thấu', '圾': 'Cấp',
    '塑': 'Tố', '够': 'Cấu', '奖': 'Tưởng', '套': 'Sáo', '尤': 'Vưu', '幽': 'U',
    '弃': 'Khí', '懒': 'Lãn', '戴': 'Đái', '抬': 'Đài', '挺': 'Đĩnh', '操': 'Thao',
    '既': 'Ký', '暑': 'Thử', '材': 'Tài', '梦': 'Mộng', '汗': 'Hãn', '泼': 'Bát',
    '济': 'Tế', '浪': 'Lãng', '烟': 'Yên', '申': 'Thân', '疑': 'Nghi', '盐': 'Diêm',
    '码': 'Mã', '秒': 'Miểu', '稍': 'Sảo', '竞': 'Cạnh', '笨': 'Bộn', '篇': 'Thiên',
    '籍': 'Tịch', '线': 'Tuyến', '翻': 'Phiên', '耐': 'Nại', '肚': 'Đỗ', '肤': 'Phu',
    '膊': 'Bác', '萄': 'Đào', '葡': 'Bồ', '袜': 'Mạt', '误': 'Ngộ', '谊': 'Nghị',
    '貌': 'Mạo', '账': 'Trướng', '购': 'Cấu', '资': 'Tư', '赚': 'Thoán', '赢': 'Doanh',
    '赶': 'Cản', '趟': 'Thảng', '逛': 'Cuống', '遍': 'Biến', '邀': 'Yêu', '郊': 'Giao',
    '酸': 'Toan', '钥': 'Thược', '键': 'Kiện', '阅': 'Duyệt', '际': 'Tế', '陪': 'Bồi',
    '页': 'Diệp', '频': 'Tần', '食': 'Thực', '馒': 'Màn', '鼓': 'Cổ', '龄': 'Linh',
    '保': 'Bảo', '准': 'Chuẩn', '地': 'Địa', '得': 'Đắc', '着': 'Trước', '过': 'Quá'
}
hv_map.update(EXTRA_HV)

def get_hanviet(hanzi_str):
    parts = []
    for c in hanzi_str:
        if c in hv_map:
            parts.append(hv_map[c])
        elif '\u4e00' <= c <= '\u9fff':
            parts.append(c)
    return ' '.join(parts)

CARON_MAP = {
    'aˇ': 'ǎ', 'ˇa': 'ǎ',
    'eˇ': 'ě', 'ˇe': 'ě',
    'oˇ': 'ǒ', 'ˇo': 'ǒ',
    'uˇ': 'ǔ', 'ˇu': 'ǔ',
    'iˇ': 'ǐ', 'ˇi': 'ǐ', 'ˇı': 'ǐ', 'ıˇ': 'ǐ',
    'üˇ': 'ǚ', 'ˇü': 'ǚ', 'vˇ': 'ǚ', 'ˇv': 'ǚ'
}

def clean_pinyin(p):
    p = p.strip()
    # Normalize dotless i with caron
    p = p.replace('ˇı', 'ǐ').replace('ıˇ', 'ǐ').replace('ˇi', 'ǐ').replace('iˇ', 'ǐ')
    p = p.replace('ˇa', 'ǎ').replace('aˇ', 'ǎ')
    p = p.replace('ˇe', 'ě').replace('eˇ', 'ě')
    p = p.replace('ˇo', 'ǒ').replace('oˇ', 'ǒ')
    p = p.replace('ˇu', 'ǔ').replace('uˇ', 'ǔ')
    p = p.replace('ˇü', 'ǚ').replace('üˇ', 'ǚ')
    # If any space remains like 'aˇ i' -> 'ǎi'
    p = re.sub(r'([aeiouü])\s*ˇ\s*([aeiouü]?)', lambda m: CARON_MAP.get(m.group(1)+'ˇ', m.group(1)) + m.group(2), p)
    p = re.sub(r'ˇ\s*([aeiouüı])', lambda m: CARON_MAP.get('ˇ'+m.group(1), m.group(1)), p)
    p = p.replace('ı', 'i')
    p = p.replace('ˇ', '')
    p = re.sub(r'\s+', ' ', p)
    return p

# 3. Extract HSK 3
hsk3_words = []
with pdfplumber.open('tu_vung_hsk_3_prep_ade7435e3d.pdf') as pdf:
    for page in pdf.pages[1:]:
        table = page.extract_table()
        if table:
            for row in table:
                if row and row[0] and row[0].strip().isdigit():
                    stt = int(row[0].strip())
                    raw_hz = row[1].strip() if len(row) > 1 and row[1] else ''
                    clean_hz = re.sub(r'\d+$', '', raw_hz).strip()
                    raw_py = row[2].strip() if len(row) > 2 and row[2] else ''
                    pinyin = clean_pinyin(raw_py)
                    pos = row[3].strip() if len(row) > 3 and row[3] else ''
                    raw_meaning = row[-1].strip() if row[-1] else ''
                    # normalize multiline meaning
                    meaning = ' '.join([l.strip() for l in raw_meaning.split('\n') if l.strip()])
                    am_han_viet = get_hanviet(clean_hz)
                    hsk3_words.append({
                        'id': f'hsk3_{stt}',
                        'stt': stt,
                        'hanzi': clean_hz,
                        'pinyin': pinyin,
                        'amHanViet': am_han_viet,
                        'pos': pos,
                        'meaningVi': meaning,
                        'hskLevel': 'HSK 3',
                        'topic': 'Từ vựng HSK 3',
                        'charCount': len(clean_hz),
                        'flashcardStep': 0,
                        'matchingStep': 0,
                        'writingZhStep': 0,
                        'writingViStep': 0,
                        'stability': 1.0,
                        'lapseCount': 0,
                        'isLeech': False,
                        'isMastered': False,
                        'updatedAt': '2026-11-13T15:00:00Z'
                    })

print(f'Extracted HSK 3: {len(hsk3_words)} words')

# 4. Extract HSK 4
hsk4_words = []
doc4 = fitz.open('tu_vung_hsk_4_prep_3c740feed1.pdf')
for page in doc4:
    blocks = page.get_text('blocks')
    for b in blocks:
        text = b[4].strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if not lines: continue
        m = re.match(r'^(\d{1,4})\s*(.*)', lines[0])
        if m:
            stt = int(m.group(1))
            raw_hz = m.group(2).strip()
            rest = lines[1:]
            if not raw_hz and rest:
                raw_hz = rest[0]
                rest = rest[1:]
            clean_hz = re.sub(r'\d+$', '', raw_hz).strip()
            pinyin = clean_pinyin(rest[0] if len(rest) > 0 else '')
            pos = rest[1] if len(rest) > 1 else ''
            meaning = ' '.join(rest[2:]) if len(rest) > 2 else ''
            am_han_viet = get_hanviet(clean_hz)
            hsk4_words.append({
                'id': f'hsk4_{stt}',
                'stt': stt,
                'hanzi': clean_hz,
                'pinyin': pinyin,
                'amHanViet': am_han_viet,
                'pos': pos,
                'meaningVi': meaning,
                'hskLevel': 'HSK 4',
                'topic': 'Từ vựng HSK 4',
                'charCount': len(clean_hz),
                'flashcardStep': 0,
                'matchingStep': 0,
                'writingZhStep': 0,
                'writingViStep': 0,
                'stability': 1.0,
                'lapseCount': 0,
                'isLeech': False,
                'isMastered': False,
                'updatedAt': '2026-11-13T15:00:00Z'
            })

# Sort by stt
hsk4_words.sort(key=lambda x: x['stt'])
print(f'Extracted HSK 4: {len(hsk4_words)} words')

# Save outputs
os.makedirs('public/data', exist_ok=True)
with open('public/data/hsk3.json', 'w', encoding='utf-8') as f:
    json.dump(hsk3_words, f, ensure_ascii=False, indent=2)

with open('public/data/hsk4.json', 'w', encoding='utf-8') as f:
    json.dump(hsk4_words, f, ensure_ascii=False, indent=2)

all_vocab = hsk3_words + hsk4_words
with open('public/data/all_vocab.json', 'w', encoding='utf-8') as f:
    json.dump(all_vocab, f, ensure_ascii=False, indent=2)

print('Successfully written public/data/hsk3.json and public/data/hsk4.json!')

