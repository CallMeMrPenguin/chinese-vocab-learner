# CHINESE VOCABULARY LEARNER (VIETNAMESE EDITION)
## Architectural Blueprint & Scientific Implementation Specification

---

## 1. Project Overview & Core Mission

This project is a high-efficiency Chinese vocabulary learning application designed specifically for Vietnamese native speakers studying user-inputted vocabulary. 

### Core Differentiators
1. **Âm Hán Việt Advantage**: Over 60% to 70% of Vietnamese vocabulary shares etymological roots with Chinese. The system explicitly maps Sino-Vietnamese readings (Âm Hán Việt) and morphological root-compounds for every character and phrase.
2. **Strict Mastery Learning**: No partial passes. A deck is only certified as mastered when the learner achieves 100% accuracy under exam conditions.
3. **Decay Prevention & Anti-Recency Engine**: Solves the "forgot the beginning by the time I reached the end" problem through cumulative 70/30 interleaving and living Ebbinghaus decay tracking.
4. **Focused Modalities**: Streamlined to three high-yield practice modalities (Flashcard, Matching, Writing) plus a multi-faceted Test / Mix Mode.

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

### E. Micro-Batching & Working Memory Constraints
* **Citation**: Sweller, J. (1988). *Cognitive Load Theory*. Cowan, N. (2001). *The magical number 4 in short-term memory*. Behavioral and Brain Sciences, 24(1), 87-114.
* **Principle**: Working memory cannot sustain large queues of novel non-phonetic characters. Batches exceeding 15 words dilute intervening spaced repetitions.
* **System Metric**: Decks are automatically partitioned into micro-batches of strictly 10 words.

### F. Cumulative Interleaving & Anti-Recency Engine
* **Citation**: Rohrer, D., & Taylor, K. (2007). *The shuffling of mathematics problems improves learning*. Instructional Science, 35(6), 481-498. Ebbinghaus, H. (1885). *Memory: A Contribution to Experimental Psychology*.
* **Principle**: Blocked learning creates false short-term mastery. Interleaving older, decaying material into new batches maintains memory retrievability $R(t) = e^{-t/S}$ above the 90% threshold.
* **System Metric**: The 70/30 Rolling Snowball queue (70% new words, 30% decaying words from earlier batches).

---

## 3. System Architecture & Dual-Track Model

The application strictly separates learning into two operational tracks:

```
+-------------------------------------------------------------------+
|                        PRACTICE TRACK                             |
|  - Micro-Batch Size: 10 words                                     |
|  - Formative Learning with Hints Allowed                          |
|  - Modes: Flashcard | Matching | Writing                          |
|  - Progress: 3-Step Clean Streak Counter per mode                 |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                          TEST TRACK                               |
|  - Summative Evaluation: 100% Pass Threshold (Bloom Criterion)    |
|  - Modes: Single-Skill Test | Mix Mode | Full-Deck Certification  |
|  - Zero Hints, Strictly Timed                                     |
|  - Failed Words -> Sổ Tay Từ Hay Sai (Targeted Quarantine)        |
+-------------------------------------------------------------------+
```

---

## 4. Mode-Specific Specifications & Progression Rules

### 4.1 Practice Modes

#### A. Flashcard Mode (Lật Thẻ)
* **Screen Display**:
  * Front: Hanzi, Audio Playback trigger, Example sentence with blanked target word.
  * Back: Pinyin (tone color-coded), Âm Hán Việt, Vietnamese definition, Full example sentence with Vietnamese translation.
* **Scoring Rules**:
  * Tap "Nhớ" (No hint viewed): Step advances (+1).
  * Tap "Gợi ý" (Hint viewed): Step remains unchanged.
  * Tap "Quên" (Failed): Step resets to 0; card re-inserted 3 cards later in the active session.
* **Completion Target**: 3 clean retrievals.

#### B. Matching Mode (Ghép Thẻ Phản Xạ)
* **Screen Display**:
  * 2-column or 3-column card grid (Hanzi, Pinyin, Nghĩa tiếng Việt / Âm Hán Việt).
  * Live round timer and misclick tracker.
* **Scoring Rules**:
  * Clean Pass: All pairs matched with 0 misclicks and average response time $\le 2.0\text{ seconds}$ per pair.
  * Sub-optimal: 0 misclicks, but average time $> 2.0\text{ seconds}$ (no step gain; requires speed replay).
  * Misclick Penalty: Any erroneous card match immediately resets the streak to 0.
* **Completion Target**: 2 consecutive clean passes.

#### C. Writing Mode (Tự Viết Từ Vựng)
* **Screen Display**:
  * Prompt: Vietnamese meaning + optional audio cue.
  * Input Area: Interactive drawing canvas or character composition input.
  * Action controls: "Xem mẫu" (Show model), "Xóa" (Clear), "Xác nhận" (Submit).
* **Scoring Rules**:
  * Clean Pass: Accurate character production with zero hints.
  * Hint Used: Viewing model resets step counter to 0.
  * Incorrect Input: Step resets to 0; card recycled in the session.
* **Completion Target**: 2 consecutive unassisted generations.

---

### 4.2 Test Mode & Mix Mode

#### A. Single-Skill Test
* Evaluates all words in a selected deck on a single challenge format (e.g., Writing only or Flashcard recall only).
* Passing score: **Strictly 100%**.

#### B. Mix Mode (Chế Độ Hỗn Hợp)
* Shuffles all deck words across three question archetypes:
  1. **Recognition**: Audio/Hanzi prompt $\to$ Select correct Vietnamese / Âm Hán Việt within 5 seconds.
  2. **Speed Match**: 4 pairs timed match within 12 seconds.
  3. **Production Writing**: Vietnamese prompt $\to$ Write Hanzi from memory with zero assistance.

#### C. Full-Deck Certification Test
* Prerequisite: Learner has completed practice for all micro-batches in the deck.
* Executes a randomized test across all 100 words (or full deck count) to eliminate serial position and recency bias.
* Achieving 100% unlocks the permanent **Deck Mastered** badge.

---

### 4.3 Sổ Tay Từ Hay Sai (Mistake Quarantine & Remediation)

* **Trigger**: Any word failed $\ge 2$ times during practice, or missed during a Test Mode run.
* **Quarantine State**: The word is flagged with `isLeech = true` and displays a high-priority "Cần ôn tập" badge.
* **Vòng Cứu Hộ (Targeted Remediation)**:
  * When a test is completed with errors (e.g., 96/100, 4 errors), the user is offered an immediate remediation run on **only the 4 failed words**.
  * Clearing all 4 failed words with 100% accuracy completes the certification without re-testing the 96 preserved words.

---

### 4.4 Living Mastery & Ebbinghaus Decay

To prevent memory loss over time, each mastered word calculates dynamic retrievability:

$$R(t) = e^{-\frac{t}{S}}$$

* Where $t$ is the elapsed time in days since the last successful retrieval, and $S$ is the estimated memory stability factor.
* If $R(t) < 0.90$ (retention drops below 90%), the word enters the **"Phục hồi trí nhớ" (Refresh Queue)**.
* Deck health reflects dynamic retrievability: a 100-word deck where 5 words have decayed displays `Độ bền trí nhớ: 95% (5 từ cần ôn lại)`.

---

## 5. Data Models & Schema Design

```typescript
// Deck entity
export interface Deck {
  id: string;
  title: string;
  description?: string;
  totalWords: number;
  masteredWords: number;
  healthPercent: number; // Dynamic Ebbinghaus health (0 - 100)
  createdAt: string;
  updatedAt: string;
}

// Vocabulary item entity
export interface VocabItem {
  id: string;
  deckId: string;
  hanzi: string;            // e.g. "学习"
  pinyin: string;           // e.g. "xuéxí"
  amHanViet: string;        // e.g. "Học tập"
  meaningVi: string;        // e.g. "Học, nghiên cứu, học tập"
  exampleSentenceZh?: string;
  exampleSentenceVi?: string;
  audioUrl?: string;
  charCount: number;        // Length in characters
  
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

// Test session record
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

## 6. UI & Technical Standards Compliance

All screens and components in this application must strictly adhere to the following project standards:

1. **Dark Theme Color Palette**: Solid high-contrast dark indigo surfaces (`#0c0f1d`, `#121626`, `#0d1018`, border `#212c4b`, highlight `#5c36f5`).
2. **Zero-Blur Performance Standard**: Strictly **no** CSS `backdrop-blur-*` or `blur-*` classes. Modal overlays use solid `bg-black/85`.
3. **TanStack Table Standard (`<DataTable />`)**: 
   * All vocabulary lists, dictionary tables, and leech lists must use the project's `<DataTable />` wrapper.
   * Strict 20 rows per page pagination.
   * Per-column heading filters with multi-select checkboxes.
   * Global search and Excel/PDF export enabled.
4. **Custom Dark Controls**: No native `<select>` or native `<input type="date">`. Use `<CustomSelect />` and `<CustomDatePicker />`.
5. **Strictly No Emojis**: Emojis are strictly forbidden in UI elements, buttons, badges, tables, and notifications.
6. **Single Decimal Truncation**: All retention scores and accuracy percentages are truncated to strictly 1 decimal place (`format1Dec`) without rounding up or down (e.g. `96.87%` $\to$ `96.8%`).

---

## 7. Recommended Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (React 19) + TypeScript |
| **Styling** | Tailwind CSS (Dark Indigo theme tokens) |
| **Data Table** | TanStack Table v8 (`@tanstack/react-table`) |
| **Local Persistence** | SQLite / Dexie.js (IndexedDB) for offline-first support |
| **Audio Pronunciation** | Web Speech API / Edge TTS (zh-CN native neural voices) |
| **Handwriting Canvas** | HTML5 Canvas with smooth Bézier curve interpolation |

---

## 8. Development Roadmap

* **Phase 1: Project Initialization & Data Layer**
  * Initialize repository, Next.js, Tailwind, and dark theme variables.
  * Implement `VocabItem` schema, database storage, and input auto-enrichment (Pinyin & Âm Hán Việt lookup).
  * Build the Vocabulary Management view using `<DataTable />`.

* **Phase 2: Practice Track Implementation**
  * Implement 10-word micro-batch chunking engine.
  * Build Flashcard Mode with 3-step expanding retrieval.
  * Build Matching Mode with 2.0s latency validation.
  * Build Writing Canvas Mode with unassisted generation logic.

* **Phase 3: Test Track & Sổ Tay Từ Hay Sai**
  * Implement 100% Criterion Test Engine.
  * Build Mix Mode generator (interleaving recognition, matching, writing).
  * Implement Sổ tay từ hay sai and Vòng Cứu Hộ (Targeted Remediation).

* **Phase 4: Living Mastery & Anti-Recency Engine**
  * Implement the 70/30 Rolling Snowball queue.
  * Implement dynamic Ebbinghaus decay calculator ($R(t)$).
  * Implement Full-Deck Certification Test.
