export interface Deck {
  id: string;
  title: string;
  topic?: string;          // User-defined topic/category (e.g. "Du lịch", "Công sở", "Từ vựng HSK 3")
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
  stt?: number;
  hanzi: string;
  pinyin: string;
  amHanViet: string;
  meaningVi: string;       // Supports comma/slash separated synonyms
  pos?: string;            // Từ loại (Danh từ, Động từ, etc.)
  hskLevel?: string;       // Individual word HSK level tag
  topic?: string;
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
  updatedAt: string;       // ISO timestamp
  unsynced?: boolean;      // Local dirty flag
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

export type StudyMode = 'flashcard' | 'matching' | 'writing-zh' | 'writing-vi';
export type TestModeType = 'flashcard' | 'matching' | 'writing-zh' | 'writing-vi' | 'mix';

export interface ActiveSessionWord {
  item: VocabItem;
  cleanPasses: number;     // passes in current session
  sessionFails: number;
}
