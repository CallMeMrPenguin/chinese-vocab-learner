import Dexie, { type Table } from 'dexie';
import { Folder, Deck, VocabItem, TestRecord, StudyMode } from './types';

export class VocabDatabase extends Dexie {
  folders!: Table<Folder, string>;
  decks!: Table<Deck, string>;
  vocab!: Table<VocabItem, string>;
  testRecords!: Table<TestRecord, string>;

  constructor() {
    super('ChineseVocabLearnerDB');
    this.version(1).stores({
      decks: 'id, title, hskLevel, topic, updatedAt',
      vocab: 'id, deckId, stt, hanzi, pinyin, amHanViet, hskLevel, isLeech, isMastered, flashcardStep, matchingStep, writingZhStep, writingViStep, lapseCount, updatedAt',
      testRecords: 'id, deckId, mode, isPassed, completedAt',
    });
    this.version(2).stores({
      folders: 'id, name, parentId, updatedAt',
      decks: 'id, folderId, title, hskLevel, topic, updatedAt',
      vocab: 'id, deckId, stt, hanzi, pinyin, amHanViet, hskLevel, isLeech, isMastered, flashcardStep, matchingStep, writingZhStep, writingViStep, lapseCount, updatedAt',
      testRecords: 'id, deckId, mode, isPassed, completedAt',
    });
  }
}

export const db = new VocabDatabase();

export function calculateRetention(lastReviewedAt?: string, stability: number = 1.0): number {
  if (!lastReviewedAt) return 1.0;
  const daysPassed = (Date.now() - new Date(lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysPassed <= 0) return 1.0;
  const s = Math.max(0.5, stability || 1.0);
  const r = Math.exp(-daysPassed / s);
  return Math.max(0.1, Math.min(1.0, r));
}

let seedingPromise: Promise<void> | null = null;
const CURRENT_SEED_KEY = 'vocab_seed_v6_folders';

export async function seedInitialDecks(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const seedVer = typeof window !== 'undefined' ? localStorage.getItem(CURRENT_SEED_KEY) : '1';
      const folderCount = await db.folders.count();
      const vocabCount = await db.vocab.count();

      if (seedVer === '1' && folderCount >= 2 && vocabCount >= 1500) {
        return;
      }

      const now = new Date().toISOString();

      // Remove old monolithic deck_hsk3 / deck_hsk4 if migrating to folder structure
      await db.decks.where('id').anyOf(['deck_hsk3', 'deck_hsk4']).delete();

      // Create root folders & subfolders for HSK 3 and HSK 4
      const initialFolders: Folder[] = [
        { id: 'folder_hsk3', name: 'Từ vựng HSK 3', parentId: null, createdAt: now, updatedAt: now },
        { id: 'folder_hsk3_1', name: 'HSK 3 - Phần 1 (Từ 1 - 250)', parentId: 'folder_hsk3', createdAt: now, updatedAt: now },
        { id: 'folder_hsk3_2', name: 'HSK 3 - Phần 2 (Từ 251 - 507)', parentId: 'folder_hsk3', createdAt: now, updatedAt: now },
        { id: 'folder_hsk4', name: 'Từ vựng HSK 4', parentId: null, createdAt: now, updatedAt: now },
        { id: 'folder_hsk4_1', name: 'HSK 4 - Phần 1 (Từ 1 - 500)', parentId: 'folder_hsk4', createdAt: now, updatedAt: now },
        { id: 'folder_hsk4_2', name: 'HSK 4 - Phần 2 (Từ 501 - 1000)', parentId: 'folder_hsk4', createdAt: now, updatedAt: now },
      ];
      await db.folders.bulkPut(initialFolders);

      // 1. Seed HSK 3 into 6 decks (approx 85-100 words each) inside HSK 3 subfolders
      const resp3 = await fetch('/data/hsk3.json');
      if (resp3.ok) {
        const hsk3Words: VocabItem[] = await resp3.json();
        const slices3 = [
          { id: 'deck_hsk3_1', folderId: 'folder_hsk3_1', title: 'HSK 3 - Bài 1 (1 - 100)', start: 0, end: 100 },
          { id: 'deck_hsk3_2', folderId: 'folder_hsk3_1', title: 'HSK 3 - Bài 2 (101 - 200)', start: 100, end: 200 },
          { id: 'deck_hsk3_3', folderId: 'folder_hsk3_1', title: 'HSK 3 - Bài 3 (201 - 250)', start: 200, end: 250 },
          { id: 'deck_hsk3_4', folderId: 'folder_hsk3_2', title: 'HSK 3 - Bài 4 (251 - 350)', start: 250, end: 350 },
          { id: 'deck_hsk3_5', folderId: 'folder_hsk3_2', title: 'HSK 3 - Bài 5 (351 - 450)', start: 350, end: 450 },
          { id: 'deck_hsk3_6', folderId: 'folder_hsk3_2', title: 'HSK 3 - Bài 6 (451 - 507)', start: 450, end: 507 },
        ];

        const decksToPut: Deck[] = [];
        const vocabToPut: VocabItem[] = [];

        for (const s of slices3) {
          const chunk = hsk3Words.slice(s.start, s.end);
          const existingDeck = await db.decks.get(s.id);
          decksToPut.push({
            id: s.id,
            folderId: s.folderId,
            title: s.title,
            topic: 'Đề cương HSK 3.0',
            hskLevel: 'HSK 3',
            totalWords: chunk.length,
            masteredWords: existingDeck?.masteredWords || 0,
            flashcardDone: existingDeck?.flashcardDone || 0,
            matchingDone: existingDeck?.matchingDone || 0,
            writingZhDone: existingDeck?.writingZhDone || 0,
            writingViDone: existingDeck?.writingViDone || 0,
            healthPercent: 100,
            createdAt: existingDeck?.createdAt || now,
            updatedAt: now,
          });
          for (const w of chunk) {
            vocabToPut.push({
              ...w,
              deckId: s.id,
            });
          }
        }
        await db.decks.bulkPut(decksToPut);
        await db.vocab.bulkPut(vocabToPut);
      }

      // 2. Seed HSK 4 into 10 decks (100 words each) inside HSK 4 subfolders
      const resp4 = await fetch('/data/hsk4.json');
      if (resp4.ok) {
        const hsk4Words: VocabItem[] = await resp4.json();
        const decksToPut: Deck[] = [];
        const vocabToPut: VocabItem[] = [];

        for (let i = 0; i < 10; i++) {
          const start = i * 100;
          const end = Math.min((i + 1) * 100, hsk4Words.length);
          const chunk = hsk4Words.slice(start, end);
          const deckId = `deck_hsk4_${i + 1}`;
          const folderId = i < 5 ? 'folder_hsk4_1' : 'folder_hsk4_2';
          const existingDeck = await db.decks.get(deckId);

          decksToPut.push({
            id: deckId,
            folderId,
            title: `HSK 4 - Bài ${i + 1} (${start + 1} - ${end})`,
            topic: 'Đề cương HSK 3.0',
            hskLevel: 'HSK 4',
            totalWords: chunk.length,
            masteredWords: existingDeck?.masteredWords || 0,
            flashcardDone: existingDeck?.flashcardDone || 0,
            matchingDone: existingDeck?.matchingDone || 0,
            writingZhDone: existingDeck?.writingZhDone || 0,
            writingViDone: existingDeck?.writingViDone || 0,
            healthPercent: 100,
            createdAt: existingDeck?.createdAt || now,
            updatedAt: now,
          });

          for (const w of chunk) {
            vocabToPut.push({
              ...w,
              deckId,
            });
          }
        }
        await db.decks.bulkPut(decksToPut);
        await db.vocab.bulkPut(vocabToPut);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENT_SEED_KEY, '1');
      }
    } catch (err) {
      console.error('Error seeding initial decks:', err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

// Refresh deck progress statistics across all modes
export async function refreshDeckStats(deckId: string): Promise<void> {
  const words = await db.vocab.where('deckId').equals(deckId).toArray();
  const now = new Date().toISOString();

  if (words.length === 0) {
    await db.decks.update(deckId, {
      totalWords: 0,
      masteredWords: 0,
      flashcardDone: 0,
      matchingDone: 0,
      writingZhDone: 0,
      writingViDone: 0,
      healthPercent: 100,
      updatedAt: now,
    });
    return;
  }

  let totalR = 0;
  let mastered = 0;
  let flashcardDone = 0;
  let matchingDone = 0;
  let writingZhDone = 0;
  let writingViDone = 0;

  for (const w of words) {
    const r = calculateRetention(w.lastReviewedAt, w.stability);
    totalR += r;
    if (w.isMastered) mastered++;
    if ((w.flashcardStep || 0) > 0) flashcardDone++;
    if ((w.matchingStep || 0) > 0) matchingDone++;
    if ((w.writingZhStep || 0) > 0) writingZhDone++;
    if ((w.writingViStep || 0) > 0) writingViDone++;
  }

  const avgHealth = Math.round((totalR / words.length) * 100);
  await db.decks.update(deckId, {
    totalWords: words.length,
    masteredWords: mastered,
    flashcardDone,
    matchingDone,
    writingZhDone,
    writingViDone,
    healthPercent: avgHealth,
    updatedAt: now,
  });
}

// Reset progress for a single mode or entire deck
export async function resetDeckProgress(
  deckId: string,
  target: StudyMode | 'test' | 'all' = 'all'
): Promise<void> {
  const words = await db.vocab.where('deckId').equals(deckId).toArray();
  const now = new Date().toISOString();

  const updated = words.map((w) => {
    if (target === 'flashcard') {
      return { ...w, flashcardStep: 0, updatedAt: now };
    }
    if (target === 'matching') {
      return { ...w, matchingStep: 0, updatedAt: now };
    }
    if (target === 'writing-zh') {
      return { ...w, writingZhStep: 0, updatedAt: now };
    }
    if (target === 'writing-vi') {
      return { ...w, writingViStep: 0, updatedAt: now };
    }
    if (target === 'test') {
      return { ...w, isMastered: false, updatedAt: now };
    }
    return {
      ...w,
      flashcardStep: 0,
      matchingStep: 0,
      writingZhStep: 0,
      writingViStep: 0,
      isMastered: false,
      isLeech: false,
      lapseCount: 0,
      updatedAt: now,
    };
  });

  if (updated.length > 0) {
    await db.vocab.bulkPut(updated);
  }
  await refreshDeckStats(deckId);
}
