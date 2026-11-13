'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, BookOpen, ChevronRight, Award, RotateCcw, Sparkles } from 'lucide-react';
import { db, seedInitialDecks, refreshDeckStats } from '@/lib/db';
import { Deck, VocabItem, StudyMode, TestModeType } from '@/lib/types';
import { DeckDetail } from '@/components/DeckDetail';
import { PracticeArena } from '@/components/PracticeArena';
import { TestArena } from '@/components/TestArena';
import { MistakeNotebook } from '@/components/MistakeNotebook';

export default function Home() {
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'deck' | 'practice' | 'test' | 'leech'>('home');
  const [practiceMode, setPracticeMode] = useState<StudyMode>('flashcard');
  const [testMode, setTestMode] = useState<TestModeType>('mix');

  // Modal to create new deck
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHsk, setNewHsk] = useState('Tự do');
  const [newTopic, setNewTopic] = useState('');

  // Live queries from IndexedDB
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
    () => (activeDeckId ? db.vocab.where('deckId').equals(activeDeckId).filter(w => !!w.isLeech || (w.lapseCount || 0) >= 2).toArray() : []),
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

  // Handle Create Deck
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDeckId = `deck_${Date.now()}`;
    const newDeck: Deck = {
      id: newDeckId,
      title: newTitle.trim(),
      topic: newTopic.trim() || undefined,
      hskLevel: newHsk,
      totalWords: 0,
      masteredWords: 0,
      healthPercent: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.decks.add(newDeck);
    setNewTitle('');
    setNewTopic('');
    setNewHsk('Tự do');
    setShowCreateModal(false);
    setActiveDeckId(newDeckId);
    setView('deck');
  };

  // ── ROUTER / VIEW SWITCHER ────────────────────────────────────────────

  // 1. Practice Arena View
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

  // 2. Test Arena View
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

  // 3. Mistake Notebook View
  if (view === 'leech' && allLeechWords) {
    return (
      <MistakeNotebook
        leechWords={allLeechWords}
        onBack={() => setView('deck')}
        onStartDrill={() => {
          setPracticeMode('flashcard');
          setView('practice');
        }}
      />
    );
  }

  // 4. Deck Detail View
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

  // 5. Home Deck List View
  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-10">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Học Từ Vựng Tiếng Trung
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-normal">
            Hệ thống học tập tối ưu hóa theo quy chuẩn khoa học và ưu thế âm Hán Việt.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          <span>Tạo bộ từ mới</span>
        </button>
      </div>

      {/* ── Decks Grid ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Danh sách bộ từ ({decks?.length || 0})
        </div>

        {(!decks || decks.length === 0) ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-slate-50/50 rounded-3xl">
            Đang khởi tạo dữ liệu từ vựng HSK 3 và HSK 4...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => {
              const masteredPercent =
                deck.totalWords > 0
                  ? Math.round((deck.masteredWords / deck.totalWords) * 100)
                  : 0;

              return (
                <div
                  key={deck.id}
                  onClick={() => {
                    setActiveDeckId(deck.id);
                    setView('deck');
                  }}
                  className="p-5 bg-slate-50/70 hover:bg-slate-50 rounded-3xl transition-all cursor-pointer group flex flex-col justify-between min-h-[170px]"
                >
                  <div>
                    {/* Tags */}
                    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                      {deck.hskLevel && (
                        <span className="py-0.5 px-2 bg-white text-slate-700 text-[11px] font-semibold rounded-full shadow-2xs">
                          {deck.hskLevel}
                        </span>
                      )}
                      {deck.topic && (
                        <span className="py-0.5 px-2 bg-white text-slate-500 text-[11px] font-medium rounded-full shadow-2xs">
                          {deck.topic}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {deck.title}
                    </h2>
                  </div>

                  {/* Progress Metadata */}
                  <div className="pt-4 border-t border-slate-200/50 flex items-center justify-between text-xs font-medium text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-900">{deck.totalWords}</span> từ vựng
                      {deck.masteredWords > 0 && (
                        <span className="text-emerald-600 ml-2">
                          | {deck.masteredWords} tinh thông
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-900 transition-colors">
                      <span>Mở</span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Create Deck ───────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Tạo bộ từ mới
            </h2>

            <form onSubmit={handleCreateDeck} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tên bộ từ *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ví dụ: Từ vựng giao tiếp văn phòng"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cấp độ</label>
                  <select
                    value={newHsk}
                    onChange={(e) => setNewHsk(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="Tự do">Tự do</option>
                    <option value="HSK 1">HSK 1</option>
                    <option value="HSK 2">HSK 2</option>
                    <option value="HSK 3">HSK 3</option>
                    <option value="HSK 4">HSK 4</option>
                    <option value="HSK 5">HSK 5</option>
                    <option value="HSK 6">HSK 6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Chủ đề</label>
                  <input
                    type="text"
                    placeholder="Du lịch, Công sở..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="py-2 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  Tạo bộ từ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
