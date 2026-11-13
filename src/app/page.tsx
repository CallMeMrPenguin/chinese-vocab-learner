'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, ChevronRight } from 'lucide-react';
import { db, seedInitialDecks, refreshDeckStats } from '@/lib/db';
import { Deck, StudyMode, TestModeType } from '@/lib/types';
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

  // 5. Home Deck List View
  return (
    <div className="w-full max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Bộ từ vựng
        </h1>

        <button
          onClick={() => setShowCreateModal(true)}
          className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5"
        >
          <Plus size={15} />
          <span>Tạo bộ từ</span>
        </button>
      </div>

      {/* ── Decks Grid ─────────────────────────────────────────────── */}
      {!decks || decks.length === 0 ? (
        <div className="py-16 text-center text-xs font-medium text-slate-500 bg-white rounded-3xl shadow-xs">
          Đang tải dữ liệu...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <div
              key={deck.id}
              onClick={() => {
                setActiveDeckId(deck.id);
                setView('deck');
              }}
              className="p-6 bg-white hover:shadow-md rounded-2xl shadow-xs transition-all cursor-pointer group flex flex-col justify-between min-h-[156px]"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {deck.hskLevel && (
                    <span className="py-1 px-2.5 bg-slate-900 text-white text-[11px] font-semibold rounded-lg">
                      {deck.hskLevel}
                    </span>
                  )}
                  {deck.topic && (
                    <span className="py-1 px-2.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg">
                      {deck.topic}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {deck.title}
                </h2>
              </div>

              <div className="pt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
                <div>
                  <span className="text-slate-900 font-bold">{deck.totalWords}</span> từ
                  {deck.masteredWords > 0 && (
                    <span className="text-emerald-600 ml-2">
                      | {deck.masteredWords} đã thuộc
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-slate-500 group-hover:text-blue-600 transition-colors">
                  <span>Mở</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Create Deck ───────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-900 pb-3">
              Tạo bộ từ mới
            </h2>

            <form onSubmit={handleCreateDeck} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên bộ từ</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Từ vựng giao tiếp..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cấp độ</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Tự do', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setNewHsk(lvl)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                        newHsk === lvl
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề</label>
                <input
                  type="text"
                  placeholder="Du lịch, Công sở..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
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
