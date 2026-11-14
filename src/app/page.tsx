'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  RotateCcw,
  Edit3,
  ArrowLeft,
  AlertTriangle,
  User,
} from 'lucide-react';
import { db, seedInitialDecks, refreshDeckStats, resetDeckProgress } from '@/lib/db';
import { Deck, Folder, StudyMode, TestModeType } from '@/lib/types';
import { ActiveSession, getActiveSession } from '@/lib/auth';
import { DeckDetail } from '@/components/DeckDetail';
import { PracticeArena } from '@/components/PracticeArena';
import { TestArena } from '@/components/TestArena';
import { MistakeNotebook } from '@/components/MistakeNotebook';
import { ProfileAuthModal } from '@/components/ProfileAuthModal';
import { AuthPage } from '@/components/AuthPage';

function trunc1Dec(val: number): string {
  const truncated = Math.floor(val * 10) / 10;
  return Number.isInteger(truncated) ? `${truncated}` : truncated.toFixed(1);
}

export default function Home() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'deck' | 'practice' | 'test' | 'leech'>('home');
  const [practiceMode, setPracticeMode] = useState<StudyMode>('flashcard');
  const [testMode, setTestMode] = useState<TestModeType>('mix');

  // Modal to create new deck
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHsk, setNewHsk] = useState('Tự do');
  const [newTopic, setNewTopic] = useState('');

  // Modal to create or edit folder
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);

  // Profile & Auth Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setActiveSession(getActiveSession());
    setAuthReady(true);
    const onAuthChange = () => setActiveSession(getActiveSession());
    window.addEventListener('cvl-auth-changed', onAuthChange);
    return () => window.removeEventListener('cvl-auth-changed', onAuthChange);
  }, []);

  // Live queries from IndexedDB
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const decks = useLiveQuery(() => db.decks.toArray(), []);
  const activeDeck = useLiveQuery(
    () => (activeDeckId ? db.decks.get(activeDeckId) : undefined),
    [activeDeckId]
  );
  const activeDeckVocab = useLiveQuery(
    () => (activeDeckId ? db.vocab.where('deckId').equals(activeDeckId).toArray() : []),
    [activeDeckId]
  );
  const allLeechWords = useLiveQuery(
    () =>
      activeDeckId
        ? db.vocab
            .where('deckId')
            .equals(activeDeckId)
            .filter((w) => !!w.isLeech || (w.lapseCount || 0) >= 1)
            .toArray()
        : [],
    [activeDeckId]
  );

  // Seed on initial mount
  useEffect(() => {
    seedInitialDecks();
  }, []);

  // Refresh stats when active deck vocab changes
  useEffect(() => {
    if (activeDeckId) {
      refreshDeckStats(activeDeckId);
    }
  }, [activeDeckId, activeDeckVocab]);

  // Compute breadcrumb trail for currentFolderId
  const breadcrumbTrail = useMemo(() => {
    if (!folders || !currentFolderId) return [];
    const trail: Folder[] = [];
    let pointer: string | null = currentFolderId;
    const visited = new Set<string>();
    while (pointer && !visited.has(pointer)) {
      visited.add(pointer);
      const found = folders.find((f) => f.id === pointer);
      if (found) {
        trail.unshift(found);
        pointer = found.parentId ?? null;
      } else {
        break;
      }
    }
    return trail;
  }, [folders, currentFolderId]);

  // Helper to get all descendant folder IDs (including self)
  const getDescendantFolderIds = useMemo(() => {
    return (rootId: string): string[] => {
      if (!folders) return [rootId];
      const result: string[] = [rootId];
      const queue: string[] = [rootId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const children = folders.filter((f) => (f.parentId ?? null) === curr);
        for (const ch of children) {
          if (!result.includes(ch.id)) {
            result.push(ch.id);
            queue.push(ch.id);
          }
        }
      }
      return result;
    };
  }, [folders]);

  // Compute aggregate stats for any folder (including subfolders and decks)
  const folderStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        subfolderCount: number;
        deckCount: number;
        totalWords: number;
        masteredWords: number;
        overallPct: number;
        deckIds: string[];
      }
    >();
    if (!folders || !decks) return map;

    for (const f of folders) {
      const allFolderIds = getDescendantFolderIds(f.id);
      const directSubfolders = folders.filter((sub) => (sub.parentId ?? null) === f.id);
      const childDecks = decks.filter((d) => allFolderIds.includes(d.folderId || ''));

      let totalWords = 0;
      let masteredWords = 0;
      let completedModeSteps = 0;

      for (const d of childDecks) {
        totalWords += d.totalWords || 0;
        masteredWords += d.masteredWords || 0;
        completedModeSteps +=
          (d.flashcardDone || 0) +
          (d.matchingDone || 0) +
          (d.writingZhDone || 0) +
          (d.writingViDone || 0);
      }

      const maxSteps = totalWords * 4;
      const overallPct = maxSteps > 0 ? (completedModeSteps / maxSteps) * 100 : 0;

      map.set(f.id, {
        subfolderCount: directSubfolders.length,
        deckCount: childDecks.length,
        totalWords,
        masteredWords,
        overallPct,
        deckIds: childDecks.map((d) => d.id),
      });
    }
    return map;
  }, [folders, decks, getDescendantFolderIds]);

  const currentSubfolders = useMemo(() => {
    if (!folders) return [];
    return folders.filter((f) => (f.parentId ?? null) === currentFolderId);
  }, [folders, currentFolderId]);

  const currentDecks = useMemo(() => {
    if (!decks) return [];
    return decks.filter((d) => (d.folderId ?? null) === currentFolderId);
  }, [decks, currentFolderId]);

  // Handle Create Deck
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDeckId = `deck_${Date.now()}`;
    const newDeck: Deck = {
      id: newDeckId,
      folderId: currentFolderId,
      title: newTitle.trim(),
      topic: newTopic.trim() || undefined,
      hskLevel: newHsk,
      totalWords: 0,
      masteredWords: 0,
      flashcardDone: 0,
      matchingDone: 0,
      writingZhDone: 0,
      writingViDone: 0,
      healthPercent: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.decks.add(newDeck);
    setNewTitle('');
    setNewTopic('');
    setNewHsk('Tự do');
    setShowCreateDeckModal(false);
    setActiveDeckId(newDeckId);
    setView('deck');
  };

  // Handle Save Folder (Create or Edit)
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    const now = new Date().toISOString();

    if (editingFolder) {
      await db.folders.update(editingFolder.id, {
        name: folderName.trim(),
        parentId: folderParentId === editingFolder.id ? editingFolder.parentId : folderParentId,
        updatedAt: now,
      });
    } else {
      const newFolder: Folder = {
        id: `folder_${Date.now()}`,
        name: folderName.trim(),
        parentId: folderParentId,
        createdAt: now,
        updatedAt: now,
      };
      await db.folders.add(newFolder);
    }

    setShowFolderModal(false);
    setEditingFolder(null);
    setFolderName('');
  };

  // Handle Delete Folder (moves child subfolders/decks to parent folder so nothing is lost, or deletes empty folder)
  const handleDeleteFolder = async () => {
    if (!editingFolder) return;
    const parentTarget = editingFolder.parentId ?? null;

    // Re-parent direct subfolders and decks to parentTarget
    const childFolders = (folders || []).filter((f) => f.parentId === editingFolder.id);
    for (const cf of childFolders) {
      await db.folders.update(cf.id, { parentId: parentTarget });
    }
    const childDecks = (decks || []).filter((d) => d.folderId === editingFolder.id);
    for (const cd of childDecks) {
      await db.decks.update(cd.id, { folderId: parentTarget });
    }

    await db.folders.delete(editingFolder.id);
    if (currentFolderId === editingFolder.id) {
      setCurrentFolderId(parentTarget);
    }
    setShowDeleteFolderConfirm(false);
    setShowFolderModal(false);
    setEditingFolder(null);
  };

  // Handle Reset Folder Progress
  const handleResetFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const stat = folderStatsMap.get(folderId);
    if (!stat) return;
    for (const dId of stat.deckIds) {
      await resetDeckProgress(dId, 'all');
    }
  };

  // ── ROUTER / VIEW SWITCHER ────────────────────────────────────────────

  if (!authReady) {
    return null;
  }

  if (!activeSession) {
    return <AuthPage onAuthenticated={(s) => setActiveSession(s)} />;
  }

  if (view === 'practice' && activeDeck && activeDeckVocab) {
    return (
      <PracticeArena
        deckId={activeDeck.id}
        deckTitle={activeDeck.title}
        allWords={activeDeckVocab}
        mode={practiceMode}
        onExit={() => setView('deck')}
        onComplete={() => {
          refreshDeckStats(activeDeck.id);
          setView('deck');
        }}
      />
    );
  }

  if (view === 'test' && activeDeck && activeDeckVocab) {
    return (
      <TestArena
        deckId={activeDeck.id}
        deckTitle={activeDeck.title}
        allWords={activeDeckVocab}
        testMode={testMode}
        onExit={() => setView('deck')}
        onSuccess={() => {
          refreshDeckStats(activeDeck.id);
          setView('deck');
        }}
      />
    );
  }

  if (view === 'leech' && allLeechWords) {
    return (
      <MistakeNotebook
        leechWords={allLeechWords}
        onBack={() => setView('deck')}
        onStartDrill={() => {
          setPracticeMode('flashcard');
          setView('practice');
        }}
        onUpdated={() => {
          if (activeDeckId) refreshDeckStats(activeDeckId);
        }}
      />
    );
  }

  if (view === 'deck' && activeDeck && activeDeckVocab) {
    return (
      <DeckDetail
        deck={activeDeck}
        vocabList={activeDeckVocab}
        onBack={() => {
          setActiveDeckId(null);
          setView('home');
        }}
        onStartPractice={(mode) => {
          setPracticeMode(mode);
          setView('practice');
        }}
        onStartTest={(tMode) => {
          setTestMode(tMode);
          setView('test');
        }}
        onOpenLeech={() => setView('leech')}
        onDeckUpdated={() => refreshDeckStats(activeDeck.id)}
      />
    );
  }

  // 5. Home Folder & Deck Explorer View
  const isLoading = !decks || !folders || (decks.length === 0 && folders.length === 0);

  return (
    <div className="w-full max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* ── Header & Breadcrumbs ────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentFolderId && (
              <button
                type="button"
                onClick={() => {
                  const curr = folders?.find((f) => f.id === currentFolderId);
                  setCurrentFolderId(curr?.parentId ?? null);
                }}
                className="p-2 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 shadow-xs transition-colors cursor-pointer"
                title="Quay lại thư mục trước"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {breadcrumbTrail.length > 0
                ? breadcrumbTrail[breadcrumbTrail.length - 1].name
                : 'Bộ từ vựng'}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <User size={15} />
              <span>{activeSession ? activeSession.displayName : 'Đăng nhập / Hồ sơ'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingFolder(null);
                setFolderName('');
                setFolderParentId(currentFolderId);
                setShowDeleteFolderConfirm(false);
                setShowFolderModal(true);
              }}
              className="py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FolderPlus size={15} />
              <span>Tạo thư mục</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateDeckModal(true)}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>Tạo bộ từ</span>
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        {breadcrumbTrail.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className="py-1 px-2.5 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 shadow-2xs transition-colors cursor-pointer"
            >
              Tất cả
            </button>
            {breadcrumbTrail.map((crumb, idx) => {
              const isLast = idx === breadcrumbTrail.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={13} className="text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                      isLast
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white hover:bg-blue-50 hover:text-blue-600 shadow-2xs'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs font-medium text-slate-500 bg-white rounded-3xl shadow-xs">
          Đang tải dữ liệu...
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Subfolders Section ──────────────────────────────────── */}
          {currentSubfolders.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Thư mục ({currentSubfolders.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentSubfolders.map((folder) => {
                  const stat = folderStatsMap.get(folder.id) || {
                    subfolderCount: 0,
                    deckCount: 0,
                    totalWords: 0,
                    masteredWords: 0,
                    overallPct: 0,
                    deckIds: [],
                  };

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="p-5 bg-white hover:shadow-md rounded-2xl shadow-xs transition-all cursor-pointer group flex flex-col justify-between gap-4 border border-transparent hover:border-blue-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FolderIcon size={20} />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                              {folder.name}
                            </h2>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">
                              {stat.subfolderCount > 0 && (
                                <span>{stat.subfolderCount} thư mục con | </span>
                              )}
                              <span>{stat.deckCount} bộ từ</span>
                              <span> | {stat.totalWords} từ</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {stat.overallPct > 0 || stat.masteredWords > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => handleResetFolder(folder.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Đặt lại tiến độ thư mục này"
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                              setFolderName(folder.name);
                              setFolderParentId(folder.parentId ?? null);
                              setShowDeleteFolderConfirm(false);
                              setShowFolderModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Chỉnh sửa thư mục"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Aggregate Folder Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600">Tiến độ tổng</span>
                          <span className="text-blue-600 font-bold">
                            {trunc1Dec(stat.overallPct)}% | Đã thuộc {stat.masteredWords}/{stat.totalWords}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, stat.overallPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Decks Section ───────────────────────────────────────── */}
          {currentDecks.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Bộ từ vựng ({currentDecks.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentDecks.map((deck) => {
                  const total = deck.totalWords || 0;
                  const fDone = deck.flashcardDone || 0;
                  const mDone = deck.matchingDone || 0;
                  const zhDone = deck.writingZhDone || 0;
                  const viDone = deck.writingViDone || 0;
                  const testDone = deck.masteredWords || 0;

                  const totalPossible = total * 4;
                  const doneSteps = fDone + mDone + zhDone + viDone;
                  const overallPct = totalPossible > 0 ? (doneSteps / totalPossible) * 100 : 0;
                  const hasProgress = doneSteps > 0 || testDone > 0;

                  const modeBars: Array<{
                    key: StudyMode | 'test';
                    label: string;
                    done: number;
                  }> = [
                    { key: 'flashcard', label: 'Lật thẻ', done: fDone },
                    { key: 'matching', label: 'Ghép thẻ', done: mDone },
                    { key: 'writing-zh', label: 'Gõ chữ Hán', done: zhDone },
                    { key: 'writing-vi', label: 'Gõ tiếng Việt', done: viDone },
                    { key: 'test', label: 'Kiểm tra', done: testDone },
                  ];

                  return (
                    <div
                      key={deck.id}
                      onClick={() => {
                        setActiveDeckId(deck.id);
                        setView('deck');
                      }}
                      className="p-5 bg-white hover:shadow-md rounded-2xl shadow-xs transition-all cursor-pointer group flex flex-col justify-between gap-4 border border-transparent hover:border-blue-200"
                    >
                      {/* Top Header */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {deck.hskLevel && (
                              <span className="py-0.5 px-2.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg">
                                {deck.hskLevel}
                              </span>
                            )}
                            {deck.topic && (
                              <span className="py-0.5 px-2.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded-lg">
                                {deck.topic}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={!hasProgress}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await resetDeckProgress(deck.id, 'all');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 transition-colors cursor-pointer"
                            title="Đặt lại toàn bộ tiến độ bộ từ này"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>

                        <h2 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {deck.title}
                        </h2>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">
                          {total} từ
                        </div>
                      </div>

                      {/* Overall Deck Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700">Tiến độ tổng</span>
                          <span className="text-blue-600">{trunc1Dec(overallPct)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, overallPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Per-Mode Progress Bars */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {modeBars.map((m) => {
                          const pct = total > 0 ? (m.done / total) * 100 : 0;
                          return (
                            <div key={m.key} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                                <span>{m.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-500">
                                    {m.done}/{total} ({trunc1Dec(pct)}%)
                                  </span>
                                  {m.done > 0 && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await resetDeckProgress(deck.id, m.key);
                                      }}
                                      className="p-0.5 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title={`Đặt lại ${m.label}`}
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    m.key === 'test' ? 'bg-emerald-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentSubfolders.length === 0 && currentDecks.length === 0 && (
            <div className="py-16 text-center text-xs font-semibold text-slate-500 bg-white rounded-3xl shadow-xs">
              Thư mục này đang trống. Hãy tạo thư mục con hoặc bộ từ mới.
            </div>
          )}
        </div>
      )}

      {/* ── Modal Create/Edit Folder ────────────────────────────────── */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-800 pb-3">
              {editingFolder ? 'Chỉnh sửa thư mục' : 'Tạo thư mục mới'}
            </h2>

            <form onSubmit={handleSaveFolder} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tên thư mục
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ví dụ: Từ vựng HSK 4 - Phần 1..."
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Thư mục cha
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => setFolderParentId(null)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      folderParentId === null
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ngoài cùng (Gốc)
                  </button>
                  {(folders || [])
                    .filter((f) => !editingFolder || f.id !== editingFolder.id)
                    .map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFolderParentId(f.id)}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          folderParentId === f.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3">
                {editingFolder ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteFolderConfirm(true)}
                    className="py-2 px-3.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Xóa thư mục
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFolderModal(false);
                      setEditingFolder(null);
                    }}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!folderName.trim()}
                    className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </form>

            {showDeleteFolderConfirm && editingFolder && (
              <div className="absolute inset-0 bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                <AlertTriangle size={32} className="text-rose-600 mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-5">
                  Xóa thư mục &ldquo;{editingFolder.name}&rdquo;?
                </h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteFolderConfirm(false)}
                    className="py-2.5 px-5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteFolder}
                    className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Create Deck ───────────────────────────────────────── */}
      {showCreateDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-800 pb-3">
              Tạo bộ từ mới
            </h2>

            <form onSubmit={handleCreateDeck} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tên bộ từ</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Từ vựng giao tiếp..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cấp độ</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Tự do', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setNewHsk(lvl)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        newHsk === lvl
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chủ đề</label>
                <input
                  type="text"
                  placeholder="Du lịch, Công sở..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateDeckModal(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  Tạo bộ từ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProfileAuthModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onAuthChange={(sess) => setActiveSession(sess)}
      />
    </div>
  );
}
