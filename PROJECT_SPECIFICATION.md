# CHINESE VOCABULARY LEARNER (VIETNAMESE EDITION)
## Architectural Blueprint & Scientific Implementation Specification

---

## 1. Project Overview & Core Mission

This project is a high-efficiency Chinese vocabulary learning application designed specifically for Vietnamese native speakers studying user-inputted vocabulary. 

### Core Differentiators
1. **Âm Hán Việt Advantage**: Over 60% to 70% of Vietnamese vocabulary shares etymological roots with Chinese. The system explicitly maps Sino-Vietnamese readings (Âm Hán Việt) and morphological root-compounds for every character and phrase.
2. **Strict Mastery Learning**: No partial passes. A deck is only certified as mastered when the learner achieves 100% accuracy under exam conditions.
3. **Flexible Session Slicing (10 to 30 words)**: Learners choose their active practice batch size, with in-session spacing and interleaving automatically recalibrating to match.
4. **Dual-Direction Keyboard Writing Mode**: Separate progression tracks for typing in Chinese (`writingZhStep`) and typing in Vietnamese (`writingViStep`), with intelligent synonym parsing and homonym disambiguation.
5. **Decay Prevention & Anti-Recency Engine**: Solves the "forgot the beginning by the time I reached the end" problem through cumulative 70/30 interleaving and living Ebbinghaus decay tracking.
6. **Customizable Deck Metadata**: Full control to rename decks, assign HSK levels (HSK 1 to HSK 6+), and define custom topics (e.g., Du lịch, Công sở, Ẩm thực).
7. **Borderless Light Minimalist Design**: Clean, light, flat canvas architecture with zero borders, tonal interactive fills, strict typographic hierarchy, no nested cards, and strictly zero emojis or unsolicited UI clutter.

---

## 2. Scientific Foundations & Cognitive Principles

Every metric, batch threshold, and review interval in this system is derived from peer-reviewed cognitive psychology and second-language acquisition research:

### A. Criterion-Referenced Mastery Learning (The 100% Rule)
* **Citation**: Bloom, B. S. (1968). *Learning for Mastery*. Evaluation Comment, 1(2), 1-12. Glaser, R. (1962). *Psychology and instructional technology*.
* **Principle**: In cumulative knowledge domains, conventional passing grades (70% or 80%) allow foundational deficits to compound exponentially into cognitive failure. Bloom demonstrated that enforcing 100% mastery of each unit before certification elevates over 90% of students to the performance bracket traditionally reached by only the top 10%.
* **System Metric**: Test Mode certification strictly requires $\text{Score} = 100\%$. Any error redirects failed items to quarantine for targeted remediation.

### B. Spaced Retrieval Practice (Flashcard Modality)
* **Citation**: Karpicke, J. D., & Roediger, H. L. (2008). *The critical importance of retrieval for learning*. Science, 319(5865), 966-968. Cepeda, N. J., et al. (2008). *Spacing effects in learning: A temporal ridgeline of optimal retention*. Psychological Science, 19(11), 1095-1102.
* **Principle**: Active memory retrieval produces substantially higher retention than passive re-reading. To optimize consolidation, retrievals must occur across expanding temporal intervals.
* **System Metric**: 3 unassisted clean retrievals separated by expanding trial intervals ($I_1 = 0$, $I_2 \ge 3 \text{ intervening cards}$, $I_3 \ge 10 \text{ intervening cards}$).

### C. Automaticity & Perceptual Latency (Matching Modality)
* **Citation**: Schneider, W., & Shiffrin, R. M. (1977). *Controlled and automatic human information processing: I. Detection, search, and attention*. Psychological Review, 84(1), 1-66.
* **Principle**: Distinguishes controlled processing (slow, deliberate) from automatic processing (instant reflex). Fluid vocabulary usage requires lexical access latency to drop below working memory contention thresholds ($\le 2.0\text{ seconds}$ per item).
* **System Metric**: Served in micro-boards of 4 to 5 pairs (8 to 10 tiles) per screen to eliminate visual search bottlenecks. A match is counted as a clean pass only if completed in $\le 2.0\text{ seconds}$ per pair with zero misclicks. 2 consecutive clean rounds complete the mode.

### D. The Generation Effect & Bidirectional Production (Writing Modality)
* **Citation**: Slamecka, N. J., & Graf, P. (1978). *The Generation Effect: Delineation of a phenomenon*. Journal of Experimental Psychology: Human Learning and Memory, 4(6), 592-604.Webb, S. (2005). *Receptive and productive vocabulary learning*. Studies in Second Language Acquisition, 27(1), 33-52.
* **Principle**: Actively generating a target response via keyboard input from a cue produces significantly stronger memory traces than passive recognition. Productive recall (Meaning $\to$ Target Form) and receptive-productive translation (Target Form $\to$ Native Meaning) develop distinct lexical pathways and require independent tracking.
* **System Metric**: Two independent keyboard writing tracks—Chinese Input (`writingZhStep`) and Vietnamese Input (`writingViStep`). Each track requires 2 consecutive unassisted clean generations with 0 hints.

### E. Scaled Spacing & Variable Session Sizing (10 to 30 words)
* **Citation**: Sweller, J. (1988). *Cognitive Load Theory*. Cowan, N. (2001). *The magical number 4 in short-term memory*. Behavioral and Brain Sciences, 24(1), 87-114.
* **Principle**: Working memory load increases with batch size. When a learner expands their session from 10 to 30 words, the in-session recycling interval must scale to prevent premature re-exposure.
* **System Metric**: Dynamic in-session re-insertion spacing $S_{\text{gap}} = \max\left(3, \left\lfloor \frac{N}{4} \right\rfloor\right)$.

### F. Cumulative Interleaving & Anti-Recency Engine
* **Citation**: Rohrer, D., & Taylor, K. (2007). *The shuffling of mathematics problems improves learning*. Instructional Science, 35(6), 481-498. Ebbinghaus, H. (1885). *Memory: A Contribution to Experimental Psychology*.
* **Principle**: Blocked learning creates false short-term mastery. Interleaving older, decaying material into new batches maintains memory retrievability $R(t) = e^{-t/S}$ above the 90% threshold.
* **System Metric**: The 70/30 Rolling Snowball queue ($N_{\text{new}} = \lceil 0.70 \times N \rceil$, $N_{\text{review}} = N - N_{\text{new}}$).

---

## 3. Deck Management & Input Specifications

### 3.1 Deck Metadata & Customization
When creating or editing any deck, the learner has full control over:
* **Tên bộ từ (Title)**: Editable at any time.
* **Cấp độ (HSK Level)**: HSK 1, HSK 2, HSK 3, HSK 4, HSK 5, HSK 6, hoặc Tự do.
* **Chủ đề (Custom Topic)**: User-defined tag (e.g., Giao tiếp, Du lịch, Ẩm thực, Thương mại, Đời sống).

### 3.2 Nhập Từ Vựng (Vocabulary Entry)
* **Tab / Action Label**: Strictly labeled **Nhập**.
* **Phase 1 Method**: Direct manual entry and clean text list paste (e.g. `学习 - học tập`).
* **Feature Status (Smart Auto-Enrichment)**: Marked cleanly in the UI as **Nhập (Đang phát triển)** for future automated dictionary parsing.

---

## 4. Practice Sizing & Progression Logic

### 4.1 Variable Session Sizing (10 to 30 Words)

Learners select their active batch size $N \in [10, 30]$ via a minimal flat selector (10, 15, 20, 25, 30).

#### A. In-Session Spacing Calculation
When an error occurs during practice, the failed item is re-inserted after $S_{\text{gap}}$ intervening cards:

$$S_{\text{gap}} = \max\left(3, \left\lfloor \frac{N}{4} \right\rfloor\right)$$

* At $N = 10 \implies S_{\text{gap}} = 3$ cards apart.
* At $N = 20 \implies S_{\text{gap}} = 5$ cards apart.
* At $N = 30 \implies S_{\text{gap}} = 7$ cards apart.

#### B. The 70/30 Rolling Snowball
For decks with multiple batches, subsequent sessions automatically draw:
* $N_{\text{new}} = \lceil 0.70 \times N \rceil$ (new words from the unlearned queue).
* $N_{\text{review}} = N - N_{\text{new}}$ (words with lowest retrievability $R(t)$ from previously practiced batches).

#### C. Session Completion Gate & Atomic Session Resume
* A session of $N$ words terminates only when **every single word has reached the clean pass target**. If errors occur, the session extends dynamically until all $N$ words are verified clean.
* **Atomic Session Resume**: Every card interaction immediately persists the active queue state. Closing or refreshing the browser mid-session (e.g. at card 27/30) resumes directly at card 27/30 upon return.

---

### 4.2 Practice Modality Specifications

#### A. Flashcard Mode (Lật Thẻ)
* **Screen Display**:
  * Front: Hanzi (Hero Text).
  * Back: Pinyin, Âm Hán Việt, Vietnamese definition (Small Text).
* **UX Safeguard**: Tapping the center stage flips the card; grading buttons (`Quên` | `Gợi ý` | `Đã nhớ`) occupy a fixed bottom zone with a 150ms debounce lock after flipping to prevent accidental double-clicks.
* **Scoring Rules**:
  * Tap "Nhớ" (No hint viewed): Step advances (+1).
  * Tap "Gợi ý" (Hint viewed): Step remains unchanged.
  * Tap "Quên" (Failed): Step resets to 0; card re-inserted $S_{\text{gap}}$ cards later.
* **Completion Target**: 3 clean retrievals (`flashcardStep === 3`).

#### B. Matching Mode (Ghép Thẻ Phản Xạ)
* **Screen Display**:
  * **Micro-Board Slicing**: Regardless of session size $N$ (10 to 30), tiles are served in micro-boards of **4 to 5 pairs (8 to 10 tiles) per screen** at a time so visual scanning time never distorts cognitive recall latency.
  * Active timer and error counter.
* **Scoring Rules**:
  * Clean Pass: All pairs matched with 0 misclicks and average response time $\le 2.0\text{ seconds}$ per pair.
  * Sub-optimal: 0 misclicks, but average time $> 2.0\text{ seconds}$ (no step gain; requires speed replay).
  * Misclick Penalty: Any error immediately resets the streak to 0.
* **Completion Target**: 2 consecutive clean passes (`matchingStep === 2`).

#### C. Writing Mode (Gõ Từ Vựng - Bàn Phím)
* **Input Method**: Strictly keyboard text input (`<input type="text">`, no drawing canvas).
* **Two Independent Tracks (Learner Chooses Direction)**:
  1. **Viết Tiếng Trung (`writingZhStep`: 0 to 2)**:
     * Prompt: Vietnamese meaning (Hero Text).
     * **Homonym Disambiguation**: If two or more words in the deck share the same Vietnamese meaning (e.g. `但是` and `可是` both meaning `"Nhưng"`), the prompt automatically appends the `Âm Hán Việt` in Small Text (`Nhưng | Đãn thị` vs. `Nhưng | Khả thị`) to eliminate ambiguity.
     * Input: Learner types the exact Chinese characters (`学习`).
  2. **Viết Tiếng Việt (`writingViStep`: 0 to 2)**:
     * Prompt: Hanzi (Hero Text).
     * Input: Learner types the Vietnamese meaning.
     * **Smart Synonym Parsing**: Meanings separated by commas, semicolons, or slashes (e.g. `"Chuẩn bị, sẵn sàng / dự bị"`) are tokenized. Typing *any* valid individual meaning (case-insensitive, whitespace-trimmed, e.g. `"chuẩn bị"`) is graded as 100% correct.
* **Scoring Rules (Both Tracks)**:
  * Clean Pass: Accurate keyboard input with zero hints (+1 step).
  * Hint Used ("Xem gợi ý"): Step resets to 0.
  * Incorrect Input: Step resets to 0; card recycled $S_{\text{gap}}$ cards later.
* **Completion Target**: 2 consecutive unassisted generations per track (`writingZhStep === 2` and `writingViStep === 2`).

---

### 4.3 Test Mode & Mix Mode

#### A. Single-Skill Test
* Evaluates words on a single challenge format (Flashcard, Matching, Writing Chinese, or Writing Vietnamese).
* Passing threshold: **Strictly 100%**.

#### B. Mix Mode (Chế Độ Hỗn Hợp)
* Shuffles words across four question archetypes:
  1. **Recognition**: Hanzi prompt $\to$ Select correct Vietnamese / Âm Hán Việt within 5 seconds.
  2. **Speed Match**: 4 pairs timed match micro-board within 8 seconds.
  3. **Production Writing (Chinese)**: Vietnamese prompt (+ Âm Hán Việt if homonym) $\to$ Type Hanzi via keyboard.
  4. **Production Writing (Vietnamese)**: Hanzi prompt $\to$ Type Vietnamese meaning via keyboard.

#### C. Full-Deck Certification Test
* The capstone evaluation covering **100% of the deck's words**.
* All words are randomized in Mix Mode to completely destroy serial position and recency bias.
* Achieving 100% grants the permanent **Deck Mastered** badge.

---

### 4.4 Sổ Tay Từ Hay Sai (Mistake Quarantine & Remediation)

* **Trigger**: Any word failed $\ge 2$ times during practice, or missed during any Test Mode attempt.
* **Quarantine**: The word is flagged with `isLeech = true` and displays a high-priority "Cần ôn tập" tag.
* **Vòng Cứu Hộ (Targeted Remediation)**:
  * In a failed test (e.g. 97/100, 3 errors), the learner immediately launches a focused quiz on **only the 3 missed words**.
  * Clearing those 3 words with 100% accuracy completes the certification without re-testing the 97 verified words.

---

### 4.5 Living Mastery & Ebbinghaus Decay

Dynamic retrievability formula:

$$R(t) = e^{-\frac{t}{S}}$$

* Where $t$ is the elapsed time in days and $S$ is memory stability.
* If $R(t) < 0.90$, the word automatically enters the **Phục hồi trí nhớ** queue.
* The deck score dynamically updates (e.g., `Độ bền trí nhớ: 95% (5 từ cần ôn lại)`).

---

## 5. UI/UX Specification: Borderless Light Minimalist Standard

The entire user interface strictly follows a **borderless, light, flat canvas architecture**:

### 5.1 Color Palette & Tonal Affordance
* **Page Canvas Background**: Pure white `#ffffff` or clean off-white `#fafafa`.
* **Interactive Surface Tones (Buttons, Tiles, Input Boxes)**: Distinct flat neutral fill `#f1f5f9` with hover/focus state `#e2e8f0` so interactive click and typing targets are immediately recognizable without borders.
* **Primary Typography**: Crisp high-contrast slate `#0f172a`.
* **Secondary Typography & Metadata**: Muted slate `#64748b`.
* **Active Tone**: Deep cobalt `#2563eb` or monochrome slate `#0f172a`.
* **Success Tone**: Subdued emerald `#059669`.
* **Error Tone**: Subdued rose `#e11d48`.

### 5.2 Zero-Border Standard (No Borders)
* **Strict Rule**: No `border`, `border-gray-*`, or `divide-*` lines may be used anywhere.
* **Separation Mechanism**: Visual structure is created purely using:
  1. Generous negative space (padding: `p-6`, `p-8`, margins: `mb-6`, `gap-6`).
  2. Flat tonal contrast (`#f1f5f9` interactive surfaces against `#ffffff` canvas).
  3. Clear typographic scale.

### 5.3 Flat Hierarchy (Strictly No "Card-in-Card")
* **Strict Rule**: Nested card layouts (a card inside another card container) are strictly forbidden.
* Every interactive surface sits directly on the flat page canvas without nested borders or multi-layered container boxes.
* The study arena is an open, breathable workspace with the target word as the direct focal point.

### 5.4 Typography Hierarchy: Hero Text vs. Small Text
* **Hero Text (Primary Focus)**:
  * Size: 64px to 80px (`text-6xl` to `text-7xl`), bold (`font-bold`), deep charcoal (`#0f172a`).
  * Fixed Container: Centered in a fixed-height container (`h-32 flex items-center justify-center`) to eliminate layout shift across different word lengths.
* **Small Text (Metadata & Prompts)**:
  * Size: Strictly 14px (`text-sm`), medium weight (`font-medium`), muted slate (`#64748b`).
  * Separators: Multi-item metadata must be separated strictly by clean vertical pipes (`|`), never bullet dots or symbols.
  * Alignment: Strictly aligned beneath the hero text with fixed margin offset.

### 5.5 Zero Unsolicited Information (No Clutter)
* Strictly **no** random tips, motivational quotes, "Did you know?" boxes, or unsolicited notes anywhere in the UI.
* Information is revealed **only upon deliberate user action** (e.g., tapping "Gợi ý").

### 5.6 Strictly Prohibit Emojis
* **Strict Rule**: Emojis are strictly prohibited across all headers, buttons, badges, status meters, and dialogues.
* Interface feedback uses clean typography (e.g., "Chính xác", "Chưa đạt", "Gợi ý", "Hoàn thành") and simple vector wireframe glyphs where appropriate.

---

## 6. Data Schema

```typescript
export interface Deck {
  id: string;
  title: string;
  topic?: string;          // User-defined topic/category (e.g. "Du lịch", "Công sở")
  hskLevel?: string;       // HSK level tag (e.g. "HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "Tự do")
  totalWords: number;
  masteredWords: number;
  healthPercent: number;   // Dynamic Ebbinghaus health (0 - 100)
  createdAt: string;
  updatedAt: string;
}

export interface VocabItem {
  id: string;
  deckId: string;
  hanzi: string;
  pinyin: string;
  amHanViet: string;
  meaningVi: string;       // Supports comma/slash separated synonyms
  hskLevel?: string;       // Individual word HSK level tag
  charCount: number;
  
  // Progression fields
  flashcardStep: number;   // 0 to 3
  matchingStep: number;    // 0 to 2
  writingZhStep: number;   // 0 to 2 (Prompt: Vietnamese -> Type: Chinese)
  writingViStep: number;   // 0 to 2 (Prompt: Chinese -> Type: Vietnamese)
  
  // Memory & SRS state
  stability: number;       // S factor in days
  lastReviewedAt?: string; // ISO timestamp
  lapseCount: number;      // Cumulative error count
  isLeech: boolean;        // Flagged for Sổ tay từ hay sai
  isMastered: boolean;     // Verified through 100% Test Mode
  
  // Sync metadata
  updatedAt: string;       // ISO timestamp for last modification
  unsynced?: boolean;      // Local dirty flag for Cloudflare D1 background sync
}

export interface TestRecord {
  id: string;
  deckId: string;
  mode: 'flashcard' | 'matching' | 'writing-zh' | 'writing-vi' | 'mix';
  totalQuestions: number;
  correctCount: number;
  isPassed: boolean;       // true strictly if correctCount === totalQuestions
  failedVocabIds: string[];
  completedAt: string;
  unsynced?: boolean;
}
```

---

## 7. Development Roadmap

* **Phase 1: Project Initialization & Data Layer**
  * Initialize Next.js 15, Tailwind CSS, and borderless light theme layout.
  * Implement Deck creation and editing (Title, HSK Level, Custom Topic).
  * Implement "Nhập" view for direct manual and delimited vocabulary input.
  * Implement IndexedDB (`Dexie.js`) local persistence + Cloudflare D1 3-layer auto-sync.
  * Build Vocab Management view using `<DataTable />` with light styling and zero borders.

* **Phase 2: Practice Track (Variable 10 to 30 Words)**
  * Implement dynamic batch selector (10, 15, 20, 25, 30).
  * Build Flashcard Mode with scaled spacing and 150ms flip debounce.
  * Build Matching Mode with 4-5 pair micro-boards and 2.0s latency validation.
  * Build Keyboard Writing Mode with separate Chinese (`writingZhStep`) and Vietnamese (`writingViStep`) tracks, synonym parsing, and homonym disambiguation.

* **Phase 3: Test Track & Sổ Tay Từ Hay Sai**
  * Build 100% Criterion Test Engine.
  * Build Mix Mode generator.
  * Implement Sổ tay từ hay sai and Vòng Cứu Hộ targeted remediation.

* **Phase 4: Living Mastery & Anti-Recency Engine**
  * Implement 70/30 Rolling Snowball queue.
  * Implement dynamic Ebbinghaus decay calculator ($R(t)$).
  * Implement Full-Deck Comprehensive Certification Test.

---

## 8. Deployment, Storage & 3-Layer Sync Architecture (Cloudflare 100% Free Tier)

### 8.1 Hosting & Database Limits ($0.00 / Month Forever)
* **Frontend & Edge API**: Cloudflare Pages + Pages Functions (Git CI/CD auto-deploy on `git push origin main`).
  * Bandwidth & Static Requests: Unlimited.
  * Build Limit: 500 builds/month.
* **Cloud Database**: **Cloudflare D1 (Serverless SQLite at the Edge — Free Tier)**:
  * Storage: **5 GB total** (up to 10 databases at 500 MB each; ~2,000,000+ vocabulary records per DB).
  * Free Reads: **5,000,000 rows read / day**.
  * Free Writes: **100,000 rows written / day**.

### 8.2 Zero-Server-Overload Compute Model
* During active practice and testing, **100% of calculations** (Ebbinghaus decay, FSRS stability, 70/30 rolling snowball, timers, and answer grading) execute on the **user's device CPU** against local **IndexedDB**.
* Server requests during active card-by-card study: **Strictly 0 requests**.

### 8.3 The 4-Layer Automatic Sync Engine
To ensure zero data loss across tab closes, phone locks, or Wi-Fi drops without requiring a manual "Save" button:

1. **Layer 1 — Instant Local Commit (0.1ms)**:
   * Every card flip, match, or typed answer immediately writes to local `IndexedDB` (`Dexie.js`), updates `updatedAt`, and sets `unsynced = true`.
   * Active session state is also stored locally so refreshing the browser at card 27/30 resumes directly at card 27/30.
2. **Layer 2 — Normal Session / Edit Batch Sync**:
   * Whenever a practice session completes, a test concludes, or a deck is created/edited, the client sends **1 single batched `POST /api/sync` request** to Cloudflare D1 and clears `unsynced = false`.
3. **Layer 3 — Sudden Tab Close / Phone Lock (`navigator.sendBeacon`)**:
   * Listeners on `document.onvisibilitychange` (`visibilityState === 'hidden'`) and `window.onpagehide` detect when the user suddenly closes the browser tab (`X`), switches apps, or locks their phone mid-session.
   * The browser immediately dispatches all `unsynced = true` records via `navigator.sendBeacon('/api/sync', payload)` (and `fetch` with `keepalive: true`), which the OS network stack guarantees to deliver in the background even after the tab is closed.
4. **Layer 4 — Offline / Power-Loss Startup Reconciliation**:
   * If the user's Wi-Fi was disconnected or battery died mid-session, the `unsynced = true` records remain safely in local `IndexedDB`.
   * On the next app launch with internet connectivity, the startup hook automatically pushes pending `unsynced` records to Cloudflare D1 and pulls any newer remote changes by comparing `updatedAt` timestamps.
