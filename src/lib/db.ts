import Dexie, { type Table } from 'dexie';
import { Deck, VocabItem, TestRecord } from './types';

export class VocabDatabase extends Dexie {
  decks!: Table<Deck, string>;
  vocab!: Table<VocabItem, string>;
  testRecords!: Table<TestRecord, string>;

  constructor() {
    super('ChineseVocabLearnerDB');
    this.version(1).stores({
      decks: 'id, title, hskLevel, topic, updatedAt',
      vocab: 'id, deckId, stt, hanzi, pinyin, amHanViet, hskLevel, isLeech, isMastered, flashcardStep, matchingStep, writingZhStep, writingViStep, lapseCount, updatedAt',
      testRecords: 'id, deckId, mode, isPassed, completedAt'
    });
  }
}

export const db = new VocabDatabase();

// Calculate Ebbinghaus retention: R(t) = e^(-t/S)
export function calculateRetention(lastReviewedAt?: string, stability: number = 1.0): number {
  if (!lastReviewedAt) return 1.0;
  const daysPassed = (Date.now() - new Date(lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysPassed <= 0) return 1.0;
  const s = Math.max(0.5, stability || 1.0);
  const r = Math.exp(-daysPassed / s);
  return Math.max(0.1, Math.min(1.0, r));
}

let seedingPromise: Promise<void> | null = null;

// Seed HSK 3 and HSK 4 safely with concurrency lock and idempotent bulkPut
export async function seedInitialDecks(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const deckCount = await db.decks.count();
      const vocabCount = await db.vocab.count();
      const seedVer = typeof window !== 'undefined' ? localStorage.getItem('vocab_seed_v3') : '1';

      if (deckCount >= 2 && vocabCount >= 1500 && seedVer === '1') {
        return;
      }

      // 1. Seed HSK 3
      const resp3 = await fetch('/data/hsk3.json');
      if (resp3.ok) {
        const hsk3Words: VocabItem[] = await resp3.json();
        const existingDeck3 = await db.decks.get('deck_hsk3');
        if (!existingDeck3) {
          await db.decks.put({
            id: 'deck_hsk3',
            title: 'Từ vựng HSK 3',
            topic: 'Đề cương HSK 3.0',
            hskLevel: 'HSK 3',
            totalWords: hsk3Words.length,
            masteredWords: 0,
            healthPercent: 100,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        const itemsWithDeck3 = hsk3Words.map((w) => ({ ...w, deckId: 'deck_hsk3' }));
        await db.vocab.bulkPut(itemsWithDeck3);
      }

      // 2. Seed HSK 4
      const resp4 = await fetch('/data/hsk4.json');
      if (resp4.ok) {
        const hsk4Words: VocabItem[] = await resp4.json();
        const existingDeck4 = await db.decks.get('deck_hsk4');
        if (!existingDeck4) {
          await db.decks.put({
            id: 'deck_hsk4',
            title: 'Từ vựng HSK 4',
            topic: 'Đề cương HSK 3.0',
            hskLevel: 'HSK 4',
            totalWords: hsk4Words.length,
            masteredWords: 0,
            healthPercent: 100,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        const itemsWithDeck4 = hsk4Words.map((w) => ({ ...w, deckId: 'deck_hsk4' }));
        await db.vocab.bulkPut(itemsWithDeck4);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('vocab_seed_v3', '1');
      }
    } catch (err) {
      console.error('Error seeding initial decks:', err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

// Update deck stats
export async function refreshDeckStats(deckId: string): Promise<void> {
  const words = await db.vocab.where('deckId').equals(deckId).toArray();
  if (words.length === 0) return;

  let totalR = 0;
  let mastered = 0;
  for (const w of words) {
    const r = calculateRetention(w.lastReviewedAt, w.stability);
    totalR += r;
    if (w.isMastered) mastered++;
  }

  const avgHealth = Math.round((totalR / words.length) * 100);
  await db.decks.update(deckId, {
    totalWords: words.length,
    masteredWords: mastered,
    healthPercent: avgHealth,
    updatedAt: new Date().toISOString()
  });
}
