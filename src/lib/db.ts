import Dexie, { type Table } from 'dexie';
import { Folder, Deck, VocabItem, TestRecord, StudyMode } from './types';
import { getActiveUserId } from './auth';

let isSeeding = false;
let seedingPromise: Promise<void> | null = null;
const CURRENT_SEED_KEY = 'vocab_seed_v6_folders';

export class VocabDatabase extends Dexie {
  folders!: Table<Folder, string>;
  decks!: Table<Deck, string>;
  vocab!: Table<VocabItem, string>;
  testRecords!: Table<TestRecord, string>;

  constructor() {
    super('ChineseVocabLearnerDB');
    this.version(1).stores({
      decks: 'id, title, hskLevel, topic, updatedAt',
      vocab:
        'id, deckId, stt, hanzi, pinyin, amHanViet, hskLevel, isLeech, isMastered, flashcardStep, matchingStep, writingZhStep, writingViStep, lapseCount, updatedAt',
      testRecords: 'id, deckId, mode, isPassed, completedAt',
    });
    this.version(2).stores({
      folders: 'id, name, parentId, updatedAt',
      decks: 'id, folderId, title, hskLevel, topic, updatedAt',
      vocab:
        'id, deckId, stt, hanzi, pinyin, amHanViet, hskLevel, isLeech, isMastered, flashcardStep, matchingStep, writingZhStep, writingViStep, lapseCount, updatedAt',
      testRecords: 'id, deckId, mode, isPassed, completedAt',
    });

    // Step 1 Hook: Every local IndexedDB write marks dirty and pre-builds the beacon snapshot
    const onLocalWrite = () => {
      if (!isSeeding) {
        markDirtyAndPrepareBeacon();
      }
    };
    this.vocab.hook('updating', onLocalWrite);
    this.vocab.hook('deleting', onLocalWrite);
    this.decks.hook('updating', onLocalWrite);
    this.decks.hook('deleting', onLocalWrite);
    this.folders.hook('creating', onLocalWrite);
    this.folders.hook('updating', onLocalWrite);
    this.folders.hook('deleting', onLocalWrite);
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

export async function seedInitialDecks(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      ensureUnloadBeaconListeners();

      const seedVer = typeof window !== 'undefined' ? localStorage.getItem(CURRENT_SEED_KEY) : '1';
      const folderCount = await db.folders.count();
      const vocabCount = await db.vocab.count();

      if (seedVer !== '1' || folderCount < 2 || vocabCount < 1500) {
        isSeeding = true;
        const now = new Date().toISOString();

        // Remove old monolithic deck_hsk3 / deck_hsk4 if migrating to folder structure
        await db.decks.where('id').anyOf(['deck_hsk3', 'deck_hsk4']).delete();

        // Create root folders & subfolders for HSK 3 and HSK 4
        const initialFolders: Folder[] = [
          { id: 'folder_hsk3', name: 'Từ vựng HSK 3', parentId: null, createdAt: now, updatedAt: now },
          {
            id: 'folder_hsk3_1',
            name: 'HSK 3 - Phần 1 (Từ 1 - 250)',
            parentId: 'folder_hsk3',
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'folder_hsk3_2',
            name: 'HSK 3 - Phần 2 (Từ 251 - 507)',
            parentId: 'folder_hsk3',
            createdAt: now,
            updatedAt: now,
          },
          { id: 'folder_hsk4', name: 'Từ vựng HSK 4', parentId: null, createdAt: now, updatedAt: now },
          {
            id: 'folder_hsk4_1',
            name: 'HSK 4 - Phần 1 (Từ 1 - 500)',
            parentId: 'folder_hsk4',
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'folder_hsk4_2',
            name: 'HSK 4 - Phần 2 (Từ 501 - 1000)',
            parentId: 'folder_hsk4',
            createdAt: now,
            updatedAt: now,
          },
        ];
        await db.folders.bulkPut(initialFolders);

        // 1. Seed HSK 3 into 6 decks inside HSK 3 subfolders
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
        isSeeding = false;
      }

      // Reconcile with Cloudflare D1 on startup
      await reconcileWithCloudOnStartup();
    } catch (err) {
      isSeeding = false;
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
    queueCloudSync();
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

  // Step 2: Normal Session / Edit Batch Sync to Cloudflare D1
  queueCloudSync();
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

// ── 3-Step / 4-Layer Automatic Sync Engine (IndexedDB <-> Cloudflare D1) ──
let latestSyncPayloadJson: string | null = null;
let beaconPrepTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let unloadListenerAttached = false;

async function buildSyncSnapshot(): Promise<string> {
  const [folders, decks, vocab] = await Promise.all([
    db.folders.toArray(),
    db.decks.toArray(),
    db.vocab.toArray(),
  ]);
  const updatedAt = new Date().toISOString();
  const userId = getActiveUserId();
  const payload = JSON.stringify({ userId, updatedAt, folders, decks, vocab });
  latestSyncPayloadJson = payload;
  if (typeof window !== 'undefined') {
    localStorage.setItem('local_snapshot_updated_at', updatedAt);
    window.dispatchEvent(new Event('cvl-sync-updated'));
  }
  return payload;
}

// Step 1 helper: Called automatically on every IndexedDB write (card flip, match, typing)
function markDirtyAndPrepareBeacon(): void {
  if (typeof window === 'undefined' || isSeeding) return;
  ensureUnloadBeaconListeners();
  localStorage.setItem('sync_dirty', '1');
  localStorage.setItem('last_step1_local_write_at', new Date().toISOString());

  if (beaconPrepTimer) clearTimeout(beaconPrepTimer);
  beaconPrepTimer = setTimeout(() => {
    buildSyncSnapshot().catch(() => {});
  }, 50);
}

// Step 3 helper: Sudden Tab Close / Phone Lock via navigator.sendBeacon
function ensureUnloadBeaconListeners(): void {
  if (typeof window === 'undefined' || unloadListenerAttached) return;
  unloadListenerAttached = true;

  const flushOnClose = () => {
    if (!latestSyncPayloadJson) return;
    if (navigator.sendBeacon) {
      const userId = getActiveUserId();
      const blob = new Blob([latestSyncPayloadJson], { type: 'application/json' });
      const sent = navigator.sendBeacon(`/api/sync?user=${encodeURIComponent(userId)}`, blob);
      if (sent) {
        localStorage.setItem('sync_dirty', '0');
        localStorage.setItem('last_beacon_sync_at', new Date().toISOString());
      }
    }
  };

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnClose();
  });
  window.addEventListener('pagehide', flushOnClose);
}

// Step 2: Normal Session End / Deck Edit Batch Sync
export function queueCloudSync(): void {
  if (typeof window === 'undefined') return;
  ensureUnloadBeaconListeners();
  localStorage.setItem('sync_dirty', '1');

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await triggerManualStep2Sync();
  }, 500);
}

export async function triggerManualStep2Sync(): Promise<{
  ok: boolean;
  cloudEnabled: boolean;
  updatedAt: string;
}> {
  const now = new Date().toISOString();
  try {
    const json = await buildSyncSnapshot();
    const userId = getActiveUserId();
    const resp = await fetch(`/api/sync?user=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    });
    localStorage.setItem('last_step2_batch_sync_at', now);
    if (resp.ok) {
      const resData = await resp.json();
      const cloudEnabled = Boolean(resData?.enabled);
      localStorage.setItem('cloud_d1_enabled', cloudEnabled ? '1' : '0');
      if (cloudEnabled) {
        localStorage.setItem('sync_dirty', '0');
        localStorage.setItem('last_cloud_sync_at', resData.updatedAt || now);
      }
      window.dispatchEvent(new Event('cvl-sync-updated'));
      return { ok: true, cloudEnabled, updatedAt: resData.updatedAt || now };
    }
  } catch {
    // Offline or local dev without D1
  }
  localStorage.setItem('last_step2_batch_sync_at', now);
  window.dispatchEvent(new Event('cvl-sync-updated'));
  return { ok: true, cloudEnabled: false, updatedAt: now };
}

export async function triggerSimulateStep3Beacon(): Promise<{
  sent: boolean;
  timestamp: string;
  bytes: number;
}> {
  const json = await buildSyncSnapshot();
  const now = new Date().toISOString();
  const userId = getActiveUserId();
  const blob = new Blob([json], { type: 'application/json' });
  const sent =
    typeof navigator !== 'undefined' && navigator.sendBeacon
      ? navigator.sendBeacon(`/api/sync?user=${encodeURIComponent(userId)}`, blob)
      : false;
  localStorage.setItem('last_beacon_sync_at', now);
  localStorage.setItem('sync_dirty', '0');
  window.dispatchEvent(new Event('cvl-sync-updated'));
  return { sent, timestamp: now, bytes: blob.size };
}

export interface SyncDiagnostics {
  userId: string;
  foldersCount: number;
  decksCount: number;
  vocabCount: number;
  practicedCount: number;
  masteredCount: number;
  snapshotSizeBytes: number;
  step1LastWriteAt: string | null;
  step2LastBatchAt: string | null;
  step3LastBeaconAt: string | null;
  cloudD1Enabled: boolean;
  cloudLastSyncAt: string | null;
}

export async function getSyncDiagnostics(): Promise<SyncDiagnostics> {
  const [folders, decks, vocab] = await Promise.all([
    db.folders.toArray(),
    db.decks.toArray(),
    db.vocab.toArray(),
  ]);
  const practicedCount = vocab.filter(
    (w) =>
      (w.flashcardStep || 0) > 0 ||
      (w.matchingStep || 0) > 0 ||
      (w.writingZhStep || 0) > 0 ||
      (w.writingViStep || 0) > 0
  ).length;
  const masteredCount = vocab.filter((w) => !!w.isMastered).length;

  let cloudD1Enabled =
    typeof window !== 'undefined' && localStorage.getItem('cloud_d1_enabled') === '1';
  try {
    const userId = getActiveUserId();
    const resp = await fetch(`/api/sync?user=${encodeURIComponent(userId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (resp.ok) {
      const data = await resp.json();
      cloudD1Enabled = Boolean(data?.enabled);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cloud_d1_enabled', cloudD1Enabled ? '1' : '0');
      }
    }
  } catch {
    // ignore
  }

  return {
    userId: getActiveUserId(),
    foldersCount: folders.length,
    decksCount: decks.length,
    vocabCount: vocab.length,
    practicedCount,
    masteredCount,
    snapshotSizeBytes: latestSyncPayloadJson ? new Blob([latestSyncPayloadJson]).size : 0,
    step1LastWriteAt:
      typeof window !== 'undefined'
        ? localStorage.getItem('last_step1_local_write_at') ||
          localStorage.getItem('local_snapshot_updated_at')
        : null,
    step2LastBatchAt:
      typeof window !== 'undefined' ? localStorage.getItem('last_step2_batch_sync_at') : null,
    step3LastBeaconAt:
      typeof window !== 'undefined' ? localStorage.getItem('last_beacon_sync_at') : null,
    cloudD1Enabled,
    cloudLastSyncAt:
      typeof window !== 'undefined' ? localStorage.getItem('last_cloud_sync_at') : null,
  };
}

// Step 4: Startup Reconciliation with Cloudflare D1
export async function reconcileWithCloudOnStartup(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // Pre-build snapshot so sendBeacon is ready immediately
    await buildSyncSnapshot();

    // If previous session had unsynced offline changes, push them first
    if (localStorage.getItem('sync_dirty') === '1') {
      await triggerManualStep2Sync();
      return;
    }

    const userId = getActiveUserId();
    const resp = await fetch(`/api/sync?user=${encodeURIComponent(userId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!resp.ok) return;
    const remote = await resp.json();
    localStorage.setItem('cloud_d1_enabled', remote?.enabled ? '1' : '0');
    if (!remote?.enabled || !remote?.data) return;

    const localUpdated = localStorage.getItem('last_cloud_sync_at') || '';
    if (remote.updatedAt && remote.updatedAt > localUpdated) {
      isSeeding = true;
      const { folders, decks, vocab } = remote.data;
      if (Array.isArray(folders) && folders.length > 0) await db.folders.bulkPut(folders);
      if (Array.isArray(decks) && decks.length > 0) await db.decks.bulkPut(decks);
      if (Array.isArray(vocab) && vocab.length > 0) await db.vocab.bulkPut(vocab);
      localStorage.setItem('last_cloud_sync_at', remote.updatedAt);
      isSeeding = false;
      await buildSyncSnapshot();
    }
  } catch {
    isSeeding = false;
  }
}
