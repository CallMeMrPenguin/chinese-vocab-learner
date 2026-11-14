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

# 2. Pure Sino-Vietnamese (Hán Việt) mapping for all remaining HSK 3 & 4 characters
EXTRA_HV = {
    '与': 'Dữ', '丢': 'Điu', '之': 'Chi', '乒': 'Binh', '乓': 'Bàng', '乡': 'Hương',
    '乱': 'Loạn', '争': 'Tranh', '云': 'Vân', '互': 'Hỗ', '亚': 'Á', '交': 'Giao',
    '京': 'Kinh', '亲': 'Thân', '仅': 'Cẩn', '仍': 'Nhưng', '仔': 'Tử', '付': 'Phó',
    '价': 'Giá', '份': 'Phần', '众': 'Chúng', '伙': 'Hỏa', '伤': 'Thương', '估': 'Cổ',
    '低': 'Đê', '例': 'Lệ', '保': 'Bảo', '俩': 'Lưỡng', '倍': 'Bội', '倒': 'Đảo',
    '值': 'Trị', '停': 'Đình', '偶': 'Ngẫu', '傅': 'Phó', '傲': 'Ngạo', '允': 'Doãn',
    '兄': 'Huynh', '光': 'Quang', '克': 'Khắc', '入': 'Nhập', '具': 'Cụ', '内': 'Nội',
    '农': 'Nông', '凉': 'Lương', '凌': 'Lăng', '减': 'Giảm', '刀': 'Đao', '列': 'Liệt',
    '则': 'Tắc', '判': 'Phán', '剧': 'Kịch', '剩': 'Thặng', '励': 'Lệ', '勇': 'Dũng',
    '勺': 'Chước', '匙': 'Thi', '区': 'Khu', '卖': 'Mại', '博': 'Bác', '卫': 'Vệ',
    '印': 'Ấn', '危': 'Nguy', '厂': 'Xưởng', '厉': 'Lệ', '压': 'Áp', '厕': 'Xí',
    '厚': 'Hậu', '及': 'Cập', '取': 'Thủ', '受': 'Thụ', '另': 'Lánh', '台': 'Đài',
    '叶': 'Diệp', '吸': 'Hấp', '吹': 'Xuy', '味': 'Vị', '呼': 'Hô', '命': 'Mệnh',
    '咳': 'Khái', '咸': 'Hàm', '品': 'Phẩm', '喊': 'Hảm', '嗯': 'Ân', '嗽': 'Thấu',
    '围': 'Vi', '土': 'Thổ', '圾': 'Cấp', '址': 'Chỉ', '垃': 'Lạp', '基': 'Cơ',
    '堂': 'Đường', '塑': 'Tố', '填': 'Điền', '士': 'Sĩ', '夜': 'Dạ', '够': 'Cấu',
    '奖': 'Tưởng', '套': 'Sáo', '姑': 'Cô', '娘': 'Nương', '存': 'Tồn', '孙': 'Tôn',
    '密': 'Mật', '寒': 'Hàn', '察': 'Sát', '封': 'Phong', '将': 'Tướng', '尊': 'Tôn',
    '尔': 'Nhĩ', '尤': 'Vưu', '展': 'Triển', '巧': 'Xảo', '巴': 'Ba', '幅': 'Phúc',
    '并': 'Tịnh', '幸': 'Hạnh', '幽': 'U', '序': 'Tự', '底': 'Để', '座': 'Tọa',
    '庭': 'Đình', '弃': 'Khí', '弄': 'Lộng', '引': 'Dẫn', '弹': 'Đạn', '强': 'Cường',
    '彩': 'Thải', '待': 'Đãi', '律': 'Luật', '微': 'Vi', '忆': 'Ức', '志': 'Chí',
    '忽': 'Hốt', '怀': 'Hoài', '态': 'Thái', '性': 'Tính', '恐': 'Khủng', '恼': 'Não',
    '悉': 'Tất', '惊': 'Kinh', '惜': 'Tích', '懒': 'Lãn', '戚': 'Thích', '戴': 'Đái',
    '扔': 'Nhưng', '扬': 'Dương', '扰': 'Nhiễu', '技': 'Kỹ', '折': 'Chiết', '抬': 'Đài',
    '拉': 'Lạp', '拍': 'Phách', '拒': 'Cự', '招': 'Chiêu', '挂': 'Quải', '指': 'Chỉ',
    '按': 'Án', '挺': 'Đĩnh', '掉': 'Điệu', '推': 'Thôi', '摄': 'Nhiếp', '播': 'Bá',
    '操': 'Thao', '擦': 'Sát', '支': 'Chi', '效': 'Hiệu', '敲': 'Xao', '整': 'Chỉnh',
    '断': 'Đoạn', '族': 'Tộc', '既': 'Ký', '晨': 'Thần', '普': 'Phổ', '景': 'Cảnh',
    '暂': 'Tạm', '暑': 'Thử', '术': 'Thuật', '材': 'Tài', '村': 'Thôn', '林': 'Lâm',
    '染': 'Nhiễm', '柿': 'Thị', '标': 'Tiêu', '格': 'Cách', '案': 'Án', '桥': 'Kiều',
    '桶': 'Thống', '梦': 'Mộng', '棒': 'Bổng', '森': 'Sâm', '棵': 'Khoa', '植': 'Thực',
    '此': 'Thử', '死': 'Tử', '母': 'Mẫu', '毛': 'Mao', '氏': 'Thị', '民': 'Dân',
    '永': 'Vĩnh', '汁': 'Trấp', '汗': 'Hãn', '江': 'Giang', '污': 'Ô', '汤': 'Thang',
    '沙': 'Sa', '油': 'Du', '泉': 'Tuyền', '泼': 'Bát', '洋': 'Dương', '洲': 'Châu',
    '济': 'Tế', '浪': 'Lãng', '海': 'Hải', '消': 'Tiêu', '深': 'Thâm', '漫': 'Mạn',
    '激': 'Kích', '烟': 'Yên', '烤': 'Khảo', '父': 'Phụ', '牌': 'Bài', '琴': 'Cầm',
    '甚': 'Thậm', '由': 'Do', '申': 'Thân', '疑': 'Nghi', '痛': 'Thống', '登': 'Đăng',
    '盐': 'Diêm', '盒': 'Hạp', '省': 'Tỉnh', '矿': 'Khoáng', '码': 'Mã', '研': 'Nghiên',
    '破': 'Phá', '础': 'Sở', '硕': 'Thạc', '示': 'Thị', '社': 'Xã', '祝': 'Chúc',
    '科': 'Khoa', '秒': 'Miểu', '积': 'Tích', '稍': 'Sảo', '究': 'Cứu', '竞': 'Cạnh',
    '章': 'Chương', '童': 'Đồng', '符': 'Phù', '笨': 'Bộn', '签': 'Thiêm', '篇': 'Thiên',
    '籍': 'Tịch', '粗': 'Thô', '精': 'Tinh', '糖': 'Đường', '线': 'Tuyến', '组': 'Tổ',
    '细': 'Tế', '绝': 'Tuyệt', '羽': 'Vũ', '翻': 'Phiên', '耐': 'Nại', '职': 'Chức',
    '联': 'Liên', '聘': 'Sính', '肚': 'Đỗ', '肤': 'Phu', '肯': 'Khẳng', '背': 'Bối',
    '胳': 'Cách', '脏': 'Tạng', '脱': 'Thoát', '脾': 'Tỳ', '膊': 'Bác', '膏': 'Cao',
    '至': 'Chí', '航': 'Hàng', '艺': 'Nghệ', '苦': 'Khổ', '萄': 'Đào', '著': 'Trứ',
    '葡': 'Bồ', '虎': 'Hổ', '虑': 'Lự', '血': 'Huyết', '袋': 'Đại', '袜': 'Mạt',
    '装': 'Trang', '规': 'Quy', '角': 'Giác', '言': 'Ngôn', '警': 'Cảnh', '订': 'Đính',
    '许': 'Hứa', '论': 'Luận', '证': 'Chứng', '译': 'Dịch', '诚': 'Thành', '详': 'Tường',
    '误': 'Ngộ', '谅': 'Lượng', '谊': 'Nghị', '象': 'Tượng', '貌': 'Mạo', '负': 'Phụ',
    '责': 'Trách', '账': 'Trướng', '质': 'Chất', '购': 'Cấu', '费': 'Phí', '贺': 'Hạ',
    '资': 'Tư', '赚': 'Thoán', '赢': 'Doanh', '赶': 'Cản', '趟': 'Thảng', '距': 'Cự',
    '躺': 'Thảng', '转': 'Chuyển', '输': 'Thâu', '辛': 'Tân', '连': 'Liên', '迷': 'Mê',
    '适': 'Thích', '递': 'Đệ', '逛': 'Cuống', '遍': 'Biến', '邀': 'Yêu', '郊': 'Giao',
    '部': 'Bộ', '酸': 'Toan', '醒': 'Tỉnh', '释': 'Thích', '金': 'Kim', '针': 'Châm',
    '钢': 'Cương', '钥': 'Thược', '键': 'Kiện', '阅': 'Duyệt', '队': 'Đội', '际': 'Tế',
    '险': 'Hiểm', '陪': 'Bồi', '青': 'Thanh', '页': 'Diệp', '项': 'Hạng', '频': 'Tần',
    '食': 'Thực', '饼': 'Bính', '馒': 'Màn', '首': 'Thủ', '骄': 'Kiêu', '默': 'Mặc',
    '鼓': 'Cổ', '龄': 'Linh', '地': 'Địa', '得': 'Đắc', '着': 'Trước', '过': 'Quá'
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
                    clean_hz = re.sub(r'\d+', '', raw_hz).strip()
                    raw_py = row[2].strip() if len(row) > 2 and row[2] else ''
                    pinyin = clean_pinyin(raw_py)
                    pos = ' '.join(row[3].split()) if len(row) > 3 and row[3] else ''
                    if not pos:
                        pos = 'Từ vựng'
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

# 4. Extract HSK 4 using exact column X-coordinates and STT row Y-midpoints
hsk4_words = []
doc4 = fitz.open('tu_vung_hsk_4_prep_3c740feed1.pdf')

for page in doc4:
    spans = []
    for b in page.get_text('dict')['blocks']:
        if 'lines' not in b:
            continue
        for l in b['lines']:
            for s in l['spans']:
                txt = s['text'].strip()
                if not txt:
                    continue
                x0, y0, x1, y1 = s['bbox']
                yc = (y0 + y1) / 2.0
                spans.append({'x0': x0, 'y0': y0, 'y1': y1, 'yc': yc, 'text': txt})

    # Find all STT row anchors on this page (x0 < 58 and digits)
    stt_anchors = []
    for sp in spans:
        if sp['x0'] < 58 and sp['text'].isdigit():
            stt_anchors.append({'stt': int(sp['text']), 'yc': sp['yc']})
        elif sp['x0'] < 58:
            # Sometimes "340 家庭" is in one span starting at x0=36.0
            m = re.match(r'^(\d{1,4})\s+(.+)$', sp['text'])
            if m:
                stt_anchors.append({'stt': int(m.group(1)), 'yc': sp['yc']})

    stt_anchors.sort(key=lambda a: a['yc'])
    if not stt_anchors:
        continue

    # Find the table header 'STT' yc on this page so nothing above the table header is ever included
    header_yc = 52.0
    for sp in spans:
        if sp['text'] in ('STT', 'Chữ Hán', 'Nghĩa tiếng Việt'):
            header_yc = max(header_yc, sp['y1'] + 2.0)

    # Compute row vertical boundaries (midpoints between consecutive STT anchors)
    row_Data = []
    for idx, anc in enumerate(stt_anchors):
        y_min = max(header_yc, anc['yc'] - 28.0) if idx == 0 else (stt_anchors[idx - 1]['yc'] + anc['yc']) / 2.0
        y_max = anc['yc'] + 28.0 if idx == len(stt_anchors) - 1 else (anc['yc'] + stt_anchors[idx + 1]['yc']) / 2.0
        row_Data.append({
            'stt': anc['stt'],
            'y_min': y_min,
            'y_max': y_max,
            'hz': [],
            'py': [],
            'pos': [],
            'meaning': []
        })

    # Assign every span on the page to its row and column
    for sp in spans:
        if sp['yc'] < header_yc:
            continue
        txt = sp['text']
        if txt in ('STT', 'Chữ Hán', 'Pinyin', 'Từ loại', 'Nghĩa tiếng Việt'):
            continue

        # Find matching row by yc
        target_row = None
        for r in row_Data:
            if r['y_min'] <= sp['yc'] < r['y_max']:
                target_row = r
                break
        if not target_row:
            continue

        x0 = sp['x0']
        if x0 < 58:
            m = re.match(r'^(\d{1,4})\s+(.+)$', txt)
            if m:
                target_row['hz'].append((round(sp['yc'] / 8), sp['x0'], m.group(2).strip()))
        elif x0 < 125:
            target_row['hz'].append((round(sp['yc'] / 8), sp['x0'], txt))
        elif x0 < 210:
            target_row['py'].append((round(sp['yc'] / 8), sp['x0'], txt))
        elif x0 < 280:
            target_row['pos'].append((round(sp['yc'] / 8), sp['x0'], txt))
        else:
            target_row['meaning'].append((round(sp['yc'] / 8), sp['x0'], txt))

    for r in row_Data:
        r['hz'].sort(key=lambda x: (x[0], x[1]))
        r['py'].sort(key=lambda x: (x[0], x[1]))
        r['pos'].sort(key=lambda x: (x[0], x[1]))
        r['meaning'].sort(key=lambda x: (x[0], x[1]))

        raw_hz = ''.join(x[2] for x in r['hz']).strip()
        clean_hz = re.sub(r'\d+', '', raw_hz).strip()
        pinyin = clean_pinyin(''.join(x[2] for x in r['py']))
        pos = ' '.join(x[2] for x in r['pos']).strip()
        pos = re.sub(r'/\s+', '/', pos)
        if not pos:
            pos = 'Từ vựng'
        meaning = ' '.join(x[2] for x in r['meaning']).strip()
        am_han_viet = get_hanviet(clean_hz)

        hsk4_words.append({
            'id': f'hsk4_{r["stt"]}',
            'stt': r['stt'],
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

