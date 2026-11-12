# CHINESE VOCABULARY LEARNER (VIETNAMESE EDITION)
## Architectural Blueprint & Scientific Implementation Specification

---

## 1. Project Overview & Core Mission

This project is a high-efficiency Chinese vocabulary learning application designed specifically for Vietnamese native speakers studying user-inputted vocabulary. 

### Core Differentiators
1. **Âm Hán Việt Advantage**: Over 60% to 70% of Vietnamese vocabulary shares etymological roots with Chinese. The system explicitly maps Sino-Vietnamese readings (Âm Hán Việt) and morphological root-compounds for every character and phrase.
2. **Strict Mastery Learning**: No partial passes. A deck is only certified as mastered when the learner achieves 100% accuracy under exam conditions.
3. **Flexible Session Slicing (10 to 30 words)**: Learners choose their active practice batch size, with in-session spacing and interleaving automatically recalibrating to match.
4. **Decay Prevention & Anti-Recency Engine**: Solves the "forgot the beginning by the time I reached the end" problem through cumulative 70/30 interleaving and living Ebbinghaus decay tracking.
5. **Smart Auto-Enrichment Input**: User pastes Chinese words; the system automatically maps Pinyin, Âm Hán Việt, and definitions via a bundled offline dictionary dataset with zero API calls.
6. **Automatic Persistence**: Progress, deck health, and review state save automatically to local storage after every single interaction with zero manual export steps required.
7. **Borderless Light Minimalist Design**: Clean, light, flat canvas architecture with zero borders, strict typographic hierarchy, no nested cards, and strictly zero emojis or unsolicited UI clutter.

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
* **System Metric**: A match is counted as a clean pass only if completed in $\le 2.0\text{ seconds}$ with zero misclicks. 2 consecutive clean rounds complete the mode.

### D. The Orthographic Motor Generation Effect (Writing Modality)
* **Citation**: Tan, L. H., Spinks, J. A., Eden, G. F., Perfetti, C. A., & Siok, W. T. (2005). *Reading depends on writing, in Chinese*. Proceedings of the National Academy of Sciences (PNAS), 102(24), 8781-8785. Slamecka, N. J., & Graf, P. (1978). *The Generation Effect*. Journal of Experimental Psychology: Human Learning and Memory, 4(6), 592-604.
* **Principle**: Chinese logographic characters rely heavily on neuromuscular motor programs stored in the left middle frontal gyrus (Exner's area). Writing the character from scratch produces deeper memory consolidation than passive recognition.
* **System Metric**: Blank-canvas production from Vietnamese cue. 2 consecutive unassisted generations with 0 hints required.

### E. Scaled Spacing & Variable Session Sizing (10 to 30 words)
* **Citation**: Sweller, J. (1988). *Cognitive Load Theory*. Cowan, N. (2001). *The magical number 4 in short-term memory*. Behavioral and Brain Sciences, 24(1), 87-114.
* **Principle**: Working memory load increases with batch size. When a learner expands their session from 10 to 30 words, the in-session recycling interval must scale to prevent premature re-exposure.
* **System Metric**: Dynamic in-session re-insertion spacing $S_{\text{gap}} = \max\left(3, \left\lfloor \frac{N}{4} \right\rfloor\right)$.

### F. Cumulative Interleaving & Anti-Recency Engine
* **Citation**: Rohrer, D., & Taylor, K. (2007). *The shuffling of mathematics problems improves learning*. Instructional Science, 35(6), 481-498. Ebbinghaus, H. (1885). *Memory: A Contribution to Experimental Psychology*.
* **Principle**: Blocked learning creates false short-term mastery. Interleaving older, decaying material into new batches maintains memory retrievability $R(t) = e^{-t/S}$ above the 90% threshold.
* **System Metric**: The 70/30 Rolling Snowball queue ($N_{\text{new}} = \lceil 0.70 \times N \rceil$, $N_{\text{review}} = N - N_{\text{new}}$).

---

## 3. Smart Input & Auto-Enrichment Pipeline

Because all vocabulary is user-provided, the application utilizes a bundled, offline dictionary mapping index (CC-CEDICT + Sino-Vietnamese tables) to eliminate manual data entry friction:

```
[ User Input Area ]
- Paste raw Hanzi list: 学习 \n 准备 \n 工作
  OR
- Paste delimited list: 学习 - học tập \n 准备 - chuẩn bị
                         |
                         v
[ Local Offline Auto-Enrichment (Zero APIs) ]
- Extracts Hanzi characters
- Resolves Pinyin with tone marks: xuéxí, zhǔnbèi, gōngzuò
- Resolves Âm Hán Việt: Học tập, Chuẩn bị, Công tác
- Resolves standard Vietnamese definition if omitted
                         |
                         v
[ Flat Preview Table ]
- User verifies or edits custom meanings
- Taps "Xác nhận tạo bộ từ" -> Instantly active
```

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

#### C. Session Completion Gate
A session of $N$ words terminates only when **every single word has reached the clean pass target**. If errors occur, the session extends dynamically until all $N$ words are verified clean.

---

### 4.2 Practice Modality Specifications

#### A. Flashcard Mode (Lật Thẻ)
* **Screen Display**:
  * Front: Hanzi (Hero Text), audio trigger.
  * Back: Pinyin, Âm Hán Việt, Vietnamese definition (Small Text).
* **Scoring Rules**:
  * Tap "Nhớ" (No hint viewed): Step advances (+1).
  * Tap "Gợi ý" (Hint viewed): Step remains unchanged.
  * Tap "Quên" (Failed): Step resets to 0; card re-inserted $S_{\text{gap}}$ cards later.
* **Completion Target**: 3 clean retrievals.

#### B. Matching Mode (Ghép Thẻ Phản Xạ)
* **Screen Display**:
  * Clean flat grid of tiles (Hanzi, Pinyin, Nghĩa tiếng Việt / Âm Hán Việt).
  * Active timer and error counter.
* **Scoring Rules**:
  * Clean Pass: All pairs matched with 0 misclicks and average response time $\le 2.0\text{ seconds}$ per pair.
  * Sub-optimal: 0 misclicks, but average time $> 2.0\text{ seconds}$ (no step gain; requires speed replay).
  * Misclick Penalty: Any error immediately resets the streak to 0.
* **Completion Target**: 2 consecutive clean passes.

#### C. Writing Mode (Tự Viết Từ Vựng)
* **Screen Display**:
  * Prompt: Vietnamese meaning + audio cue.
  * Input Area: Interactive flat drawing canvas.
  * Action controls: "Xem mẫu", "Xóa", "Xác nhận".
* **Scoring Rules**:
  * Clean Pass: Accurate character production with zero hints.
  * Hint Used: Viewing model resets step counter to 0.
  * Incorrect Input: Step resets to 0; card recycled $S_{\text{gap}}$ cards later.
* **Completion Target**: 2 consecutive unassisted generations.

---

### 4.3 Test Mode & Mix Mode

#### A. Single-Skill Test
* Evaluates words on a single challenge format (Flashcard, Matching, or Writing).
* Passing threshold: **Strictly 100%**.

#### B. Mix Mode (Chế Độ Hỗn Hợp)
* Shuffles words across three question archetypes:
  1. **Recognition**: Audio/Hanzi prompt $\to$ Select correct Vietnamese / Âm Hán Việt within 5 seconds.
  2. **Speed Match**: 4 pairs timed match within 12 seconds.
  3. **Production Writing**: Vietnamese prompt $\to$ Write Hanzi from memory with zero assistance.

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

### 5.1 Color Palette
* **Page Canvas Background**: Pure white `#ffffff` or clean off-white `#fafafa`.
* **Surface Tones (Flat Blocks)**: Light warm neutral `#f4f4f5` or `#f1f5f9`.
* **Primary Typography**: Crisp high-contrast slate `#0f172a`.
* **Secondary Typography & Metadata**: Muted slate `#64748b`.
* **Active Tone**: Deep cobalt `#2563eb` or monochrome slate `#0f172a`.
* **Success Tone**: Subdued emerald `#059669`.
* **Error Tone**: Subdued rose `#e11d48`.

### 5.2 Zero-Border Standard (No Borders)
* **Strict Rule**: No `border`, `border-gray-*`, or `divide-*` lines may be used anywhere.
* **Separation Mechanism**: Visual structure is created purely using:
  1. Generous negative space (padding: `p-6`, `p-8`, margins: `mb-6`, `gap-6`).
  2. Flat tonal contrast (subtle `#f4f4f5` background fills against pure `#ffffff` canvas).
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

## 6. Persistence & Audio Architecture

1. **Automatic Persistence**:
   * Uses local **IndexedDB** storage.
   * Review state, word counters, and test histories save automatically after every single card interaction or test completion.
   * No manual export or save button required.
2. **Local Audio Pronunciation**:
   * Utilizes pre-downloaded, bundled local audio files or local browser synthesis.
   * Zero third-party cloud API dependencies, zero network latency, 100% offline functionality.

---

## 7. Data Schema

```typescript
export interface Deck {
  id: string;
  title: string;
  totalWords: number;
  masteredWords: number;
  healthPercent: number; // Dynamic Ebbinghaus health (0 - 100)
  createdAt: string;
  updatedAt: string;
}

export interface VocabItem {
  id: string;
  deckId: string;
  hanzi: string;
  pinyin: string;
  amHanViet: string;
  meaningVi: string;
  audioUrl?: string;
  charCount: number;
  
  // Progression fields
  flashcardStep: number;    // 0 to 3
  matchingStep: number;     // 0 to 2
  writingStep: number;      // 0 to 2
  
  // Memory & SRS state
  stability: number;        // S factor in days
  lastReviewedAt?: string;  // ISO timestamp
  lapseCount: number;       // Cumulative error count
  isLeech: boolean;         // Flagged for Sổ tay từ hay sai
  isMastered: boolean;      // Verified through 100% Test Mode
}

export interface TestRecord {
  id: string;
  deckId: string;
  mode: 'flashcard' | 'matching' | 'writing' | 'mix';
  totalQuestions: number;
  correctCount: number;
  isPassed: boolean;        // true strictly if correctCount === totalQuestions
  failedVocabIds: string[];
  completedAt: string;
}
```

---

## 8. Development Roadmap

* **Phase 1: Project Initialization & Data Layer**
  * Initialize Next.js 15, Tailwind CSS, and borderless light theme layout.
  * Implement offline dictionary dataset lookup for Pinyin and Âm Hán Việt auto-enrichment.
  * Implement IndexedDB auto-persistence layer.
  * Build Vocab Management view using `<DataTable />` with light styling and zero borders.

* **Phase 2: Practice Track (Variable 10 to 30 Words)**
  * Implement dynamic batch selector (10, 15, 20, 25, 30).
  * Build Flashcard Mode with scaled spacing.
  * Build Matching Mode with 2.0s latency validation.
  * Build Flat Writing Canvas Mode.

* **Phase 3: Test Track & Sổ Tay Từ Hay Sai**
  * Build 100% Criterion Test Engine.
  * Build Mix Mode generator.
  * Implement Sổ tay từ hay sai and Vòng Cứu Hộ targeted remediation.

* **Phase 4: Living Mastery & Anti-Recency Engine**
  * Implement 70/30 Rolling Snowball queue.
  * Implement dynamic Ebbinghaus decay calculator ($R(t)$).
  * Implement Full-Deck Comprehensive Certification Test.
