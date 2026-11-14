export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null for root folder; supports arbitrary nested subfolders
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  folderId?: string | null; // null for root level, or Folder.id
  title: string;
  topic?: string;
  hskLevel?: string;
  totalWords: number;
  masteredWords: number;
  flashcardDone?: number;
  matchingDone?: number;
  writingZhDone?: number;
  writingViDone?: number;
  healthPercent: number;
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
  flashcardStep: number;   // > 0 means completed in Flashcard mode
  matchingStep: number;    // > 0 means completed in Matching mode
  writingZhStep: number;   // > 0 means completed in Writing Chinese mode
  writingViStep: number;   // > 0 means completed in Writing Vietnamese mode

  // Memory & SRS state
  stability: number;       // S factor in days
  lastReviewedAt?: string; // ISO timestamp
  lapseCount: number;      // Cumulative error count
  isLeech: boolean;        // Flagged for Sổ tay từ hay sai
  isMastered: boolean;     // Verified through Test Mode

  // Sync metadata
  updatedAt: string;       // ISO timestamp
  unsynced?: boolean;      // Local dirty flag
}

export interface TestRecord {
  id: string;
  deckId: string;
  mode: 'matching' | 'writing-zh' | 'writing-vi' | 'mix';
  totalQuestions: number;
  correctCount: number;
  isPassed: boolean;
  failedVocabIds: string[];
  completedAt: string;
  unsynced?: boolean;
}

export type StudyMode = 'flashcard' | 'matching' | 'writing-zh' | 'writing-vi';
export type TestModeType = 'matching' | 'writing-zh' | 'writing-vi' | 'mix';
