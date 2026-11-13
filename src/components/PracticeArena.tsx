'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { VocabItem, StudyMode } from '@/lib/types';
import { db } from '@/lib/db';

interface PracticeArenaProps {
  deckId: string;
  deckTitle: string;
  allWords: VocabItem[];
  mode: StudyMode;
  onExit: () => void;
  onComplete: () => void;
}

export function PracticeArena({
  deckId,
  deckTitle,
  allWords,
  mode,
  onExit,
  onComplete,
}: PracticeArenaProps) {
  const [sessionSize, setSessionSize] = useState<number>(() => {
    const saved = localStorage.getItem(`session_size_${deckId}`);
    return saved ? parseInt(saved, 10) : Math.min(20, Math.max(10, allWords.length));
  });
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Active session queue of words remaining to be answered right
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [totalSessionTarget, setTotalSessionTarget] = useState<number>(0);
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());

  // Flashcard state
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [canClickActions, setCanClickActions] = useState<boolean>(false);

  // Writing state
  const [typedInput, setTypedInput] = useState<string>('');
  const [writeFeedback, setWriteFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hintShown, setHintShown] = useState<boolean>(false);

  // Matching state (micro-boards of 4 pairs = 8 tiles)
  const [matchingTiles, setMatchingTiles] = useState<
    Array<{ id: string; text: string; wordId: string; type: 'hz' | 'vi'; isMatched: boolean }>
  >([]);
  const [selectedTile, setSelectedTile] = useState<{ id: string; wordId: string; type: string } | null>(null);
  const [wrongTileIds, setWrongTileIds] = useState<string[]>([]);
  const [failedInBoardIds, setFailedInBoardIds] = useState<Set<string>>(new Set());

  const sGap = useMemo(() => Math.max(3, Math.floor(sessionSize / 4)), [sessionSize]);

  // ── Initialize Session Queue (Mix New + Chance of Wrong & Old Words) ──
  const initializeQueue = () => {
    const getStep = (w: VocabItem) => {
      if (mode === 'flashcard') return w.flashcardStep || 0;
      if (mode === 'matching') return w.matchingStep || 0;
      if (mode === 'writing-zh') return w.writingZhStep || 0;
      return w.writingViStep || 0;
    };

    // 1. Previously wrong words (Leech or lapseCount > 0)
    const wrongPool = allWords
      .filter((w) => w.isLeech || (w.lapseCount || 0) > 0)
      .sort(() => Math.random() - 0.5);

    // 2. Old previously practiced words
    const oldPool = allWords
      .filter((w) => !w.isLeech && (w.lapseCount || 0) === 0 && getStep(w) > 0)
      .sort(() => Math.random() - 0.5);

    // 3. Unpracticed new words
    const newPool = allWords
      .filter((w) => !w.isLeech && (w.lapseCount || 0) === 0 && getStep(w) === 0)
      .sort(() => Math.random() - 0.5);

    // Take a chance-based mix of wrong words + old words (up to ~30% of sessionSize)
    const reviewQuota = Math.floor(sessionSize * 0.35);
    const chosenReview: VocabItem[] = [];

    for (const w of wrongPool) {
      if (chosenReview.length < reviewQuota && Math.random() < 0.8) {
        chosenReview.push(w);
      }
    }
    for (const w of oldPool) {
      if (chosenReview.length < reviewQuota && Math.random() < 0.5) {
        chosenReview.push(w);
      }
    }

    const neededNew = sessionSize - chosenReview.length;
    const chosenNew = newPool.slice(0, neededNew);

    const combined = [...chosenReview, ...chosenNew];
    if (combined.length < sessionSize) {
      const usedIds = new Set(combined.map((x) => x.id));
      const leftover = allWords
        .filter((w) => !usedIds.has(w.id))
        .sort(() => Math.random() - 0.5);
      combined.push(...leftover.slice(0, sessionSize - combined.length));
    }

    const finalQueue = combined.sort(() => Math.random() - 0.5);
    setQueue(finalQueue);
    setTotalSessionTarget(finalQueue.length);
    setCompletedWordIds(new Set());
    setHasStarted(true);
    localStorage.setItem(`session_size_${deckId}`, sessionSize.toString());

    if (mode === 'matching') {
      setupMatchingMicroBoard(finalQueue.slice(0, 4));
    }
  };

  // ── Setup 4-Pair Micro-Board for Matching ─────────────────────────────
  const setupMatchingMicroBoard = (cards: VocabItem[]) => {
    if (cards.length === 0) return;
    const tiles: Array<{ id: string; text: string; wordId: string; type: 'hz' | 'vi'; isMatched: boolean }> = [];
    cards.forEach((item) => {
      tiles.push({
        id: `hz_${item.id}`,
        text: item.hanzi,
        wordId: item.id,
        type: 'hz',
        isMatched: false,
      });
      tiles.push({
        id: `vi_${item.id}`,
        text: item.meaningVi.replace(/^\([^)]+\)\s*/g, '').split(/[,;]/)[0].trim(),
        wordId: item.id,
        type: 'vi',
        isMatched: false,
      });
    });
    setMatchingTiles(tiles.sort(() => Math.random() - 0.5));
    setSelectedTile(null);
    setWrongTileIds([]);
    setFailedInBoardIds(new Set());
  };

  const currentItem = queue[0];

  useEffect(() => {
    if (isFlipped) {
      setCanClickActions(false);
      const timer = setTimeout(() => setCanClickActions(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isFlipped]);

  useEffect(() => {
    setIsFlipped(false);
    setHintShown(false);
    setTypedInput('');
    setWriteFeedback('idle');
  }, [currentItem?.id, queue.length]);

  // ── Flashcard: Right (Done in this run) vs Wrong (Shows up later) ─────
  const handleFlashcardRight = async () => {
    if (!currentItem) return;
    const nextStep = (currentItem.flashcardStep || 0) + 1;
    await db.vocab.update(currentItem.id, {
      flashcardStep: nextStep,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const nextCompleted = new Set(completedWordIds);
    nextCompleted.add(currentItem.id);
    setCompletedWordIds(nextCompleted);

    const nextQueue = queue.slice(1);
    if (nextQueue.length === 0) {
      onComplete();
      return;
    }
    setQueue(nextQueue);
  };

  const handleFlashcardWrong = async () => {
    if (!currentItem) return;
    const nextLapse = (currentItem.lapseCount || 0) + 1;
    const isLeech = nextLapse >= 2;
    await db.vocab.update(currentItem.id, {
      lapseCount: nextLapse,
      isLeech,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updatedItem: VocabItem = {
      ...currentItem,
      lapseCount: nextLapse,
      isLeech,
    };

    const remaining = queue.slice(1);
    const insertIdx = Math.min(remaining.length, Math.max(2, sGap));
    const nextQueue = [
      ...remaining.slice(0, insertIdx),
      updatedItem,
      ...remaining.slice(insertIdx),
    ];
    setQueue(nextQueue);
  };

  // ── Writing Mode: Right (Done in this run) vs Wrong (Shows up later) ──
  const handleVerifyWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !typedInput.trim() || writeFeedback !== 'idle') return;

    const userText = typedInput.trim().toLowerCase();
    let isCorrect = false;

    if (mode === 'writing-zh') {
      isCorrect = userText === currentItem.hanzi.toLowerCase();
    } else {
      const synonyms = currentItem.meaningVi
        .split(/[,;\/]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      isCorrect = synonyms.some((syn) => syn === userText || userText.includes(syn));
    }

    const stepField = mode === 'writing-zh' ? 'writingZhStep' : 'writingViStep';

    if (isCorrect && !hintShown) {
      setWriteFeedback('correct');
      const currentStep = (currentItem as any)[stepField] || 0;
      await db.vocab.update(currentItem.id, {
        [stepField]: currentStep + 1,
        lastReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        const nextCompleted = new Set(completedWordIds);
        nextCompleted.add(currentItem.id);
        setCompletedWordIds(nextCompleted);

        const nextQueue = queue.slice(1);
        if (nextQueue.length === 0) {
          onComplete();
          return;
        }
        setQueue(nextQueue);
      }, 350);
    } else {
      setWriteFeedback('wrong');
      const nextLapse = (currentItem.lapseCount || 0) + 1;
      const isLeech = nextLapse >= 2;

      await db.vocab.update(currentItem.id, {
        lapseCount: nextLapse,
        isLeech,
        lastReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        const updatedItem: VocabItem = {
          ...currentItem,
          lapseCount: nextLapse,
          isLeech,
        };
        const remaining = queue.slice(1);
        const insertIdx = Math.min(remaining.length, Math.max(2, sGap));
        const nextQueue = [
          ...remaining.slice(0, insertIdx),
          updatedItem,
          ...remaining.slice(insertIdx),
        ];
        setQueue(nextQueue);
      }, 650);
    }
  };

  // ── Matching Mode Tile Click (Red Flash + Shake on Wrong Match) ───────
  const handleTileClick = async (tile: (typeof matchingTiles)[0]) => {
    if (tile.isMatched || wrongTileIds.length > 0) return;

    if (!selectedTile) {
      setSelectedTile({ id: tile.id, wordId: tile.wordId, type: tile.type });
      return;
    }

    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Check if valid pair
    if (selectedTile.wordId === tile.wordId && selectedTile.type !== tile.type) {
      const updatedTiles = matchingTiles.map((t) =>
        t.wordId === tile.wordId ? { ...t, isMatched: true } : t
      );
      setMatchingTiles(updatedTiles);
      setSelectedTile(null);

      // Check if current 4-pair board is finished
      if (updatedTiles.every((t) => t.isMatched)) {
        const boardWords = queue.slice(0, 4);
        const passedWords: VocabItem[] = [];
        const retryWords: VocabItem[] = [];

        for (const w of boardWords) {
          if (failedInBoardIds.has(w.id)) {
            retryWords.push(w);
          } else {
            passedWords.push(w);
            await db.vocab.update(w.id, {
              matchingStep: (w.matchingStep || 0) + 1,
              lastReviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        const nextCompleted = new Set(completedWordIds);
        passedWords.forEach((w) => nextCompleted.add(w.id));
        setCompletedWordIds(nextCompleted);

        const remaining = [...queue.slice(4), ...retryWords];
        if (remaining.length === 0) {
          onComplete();
          return;
        }
        setQueue(remaining);
        setupMatchingMicroBoard(remaining.slice(0, 4));
      }
    } else {
      // WRONG MATCH -> Turn both tiles red fast and shake!
      const pairIds = [selectedTile.id, tile.id];
      setWrongTileIds(pairIds);

      const nextFailed = new Set(failedInBoardIds);
      nextFailed.add(selectedTile.wordId);
      nextFailed.add(tile.wordId);
      setFailedInBoardIds(nextFailed);

      // Record lapse in DB for the wrong word
      const wrongWord = queue.find((w) => w.id === selectedTile.wordId);
      if (wrongWord) {
        const nextLapse = (wrongWord.lapseCount || 0) + 1;
        await db.vocab.update(wrongWord.id, {
          lapseCount: nextLapse,
          isLeech: nextLapse >= 2,
          updatedAt: new Date().toISOString(),
        });
      }

      setTimeout(() => {
        setWrongTileIds([]);
        setSelectedTile(null);
      }, 360);
    }
  };

  // ── Setup Screen: Pick 10–30 Words ────────────────────────────────────
  if (!hasStarted) {
    const maxAvailable = allWords.length;
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white hover:bg-slate-200/70 text-slate-800 text-xs font-bold shadow-xs mb-10 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Quay lại
        </button>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-6">
          Số lượng từ
        </h1>

        <div className="flex items-center justify-center gap-2.5 mb-8 flex-wrap">
          {[10, 15, 20, 25, 30]
            .filter((n) => n <= maxAvailable || n === 10)
            .map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setSessionSize(num)}
                className={`py-3 px-6 rounded-2xl text-sm font-bold transition-all cursor-pointer shadow-xs ${
                  sessionSize === num
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-800 hover:bg-slate-200/70'
                }`}
              >
                {num}
              </button>
            ))}
        </div>

        <button
          type="button"
          onClick={initializeQueue}
          disabled={allWords.length === 0}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white text-sm font-bold rounded-2xl transition-all shadow-md cursor-pointer"
        >
          Bắt đầu
        </button>
      </div>
    );
  }

  // ── Active Arena Screen ───────────────────────────────────────────────
  const progressPercent =
    totalSessionTarget > 0
      ? Math.round((completedWordIds.size / totalSessionTarget) * 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col min-h-[540px]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-5">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-slate-200/70 text-slate-800 text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Thoát
        </button>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <span>{deckTitle}</span>
          <span className="text-slate-400">|</span>
          <span className="text-blue-600">
            {completedWordIds.size} / {totalSessionTarget}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ── MODE 1: Flashcard ────────────────────────────────────────── */}
      {mode === 'flashcard' && currentItem && (
        <div className="flex-1 flex flex-col items-center justify-between py-2">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full max-w-md py-14 px-6 bg-white hover:bg-slate-50 rounded-3xl shadow-sm cursor-pointer select-none text-center transition-all flex flex-col items-center justify-center min-h-[260px]"
          >
            <div className="h-28 flex items-center justify-center">
              <span className="text-6xl font-bold text-slate-900 tracking-tight">
                {currentItem.hanzi}
              </span>
            </div>

            {isFlipped && (
              <div className="space-y-2 mt-4">
                <div className="text-sm font-semibold text-slate-600">
                  <span>{currentItem.pinyin}</span>
                  {currentItem.amHanViet && (
                    <>
                      <span className="text-slate-300 mx-2">|</span>
                      <span>{currentItem.amHanViet}</span>
                    </>
                  )}
                  {currentItem.pos && (
                    <>
                      <span className="text-slate-300 mx-2">|</span>
                      <span>{currentItem.pos}</span>
                    </>
                  )}
                </div>
                <div className="text-base font-bold text-slate-900 pt-1">
                  {currentItem.meaningVi}
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-md grid grid-cols-2 gap-3 mt-8">
            <button
              type="button"
              disabled={!isFlipped || !canClickActions}
              onClick={handleFlashcardWrong}
              className="py-3.5 px-4 bg-white hover:bg-rose-600 hover:text-white disabled:opacity-30 rounded-2xl text-sm font-bold text-slate-800 shadow-xs transition-colors cursor-pointer"
            >
              Chưa thuộc
            </button>
            <button
              type="button"
              disabled={!isFlipped || !canClickActions}
              onClick={handleFlashcardRight}
              className="py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded-2xl text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              Đã thuộc
            </button>
          </div>
        </div>
      )}

      {/* ── MODE 2: Matching (Red Flash + Shake on Wrong) ───────────── */}
      {mode === 'matching' && (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
            {matchingTiles.map((tile) => {
              const isSelected = selectedTile?.id === tile.id;
              const isWrong = wrongTileIds.includes(tile.id);

              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={tile.isMatched}
                  onClick={() => handleTileClick(tile)}
                  className={`h-28 p-3 rounded-2xl text-center flex items-center justify-center text-xs font-bold cursor-pointer ${
                    tile.isMatched
                      ? 'opacity-0 pointer-events-none transition-opacity duration-150'
                      : isWrong
                      ? 'bg-rose-600 text-white shadow-lg animate-shake'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-md scale-95 transition-transform duration-100'
                      : 'bg-white hover:bg-slate-200/70 text-slate-900 shadow-xs transition-colors duration-100'
                  }`}
                >
                  <span className={tile.type === 'hz' ? 'text-2xl font-bold' : 'line-clamp-3'}>
                    {tile.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODE 3: Keyboard Writing Mode ────────────────────────────── */}
      {(mode === 'writing-zh' || mode === 'writing-vi') && currentItem && (
        <div className="flex-1 flex flex-col items-center justify-between py-2">
          <div className="w-full max-w-md py-12 px-6 bg-white rounded-3xl shadow-sm text-center">
            <div className="h-28 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-slate-900 tracking-tight">
                {mode === 'writing-zh'
                  ? currentItem.meaningVi.split(/[,;\/]/)[0].trim()
                  : currentItem.hanzi}
              </span>
              {mode === 'writing-zh' && currentItem.amHanViet && (
                <div className="text-sm text-slate-500 mt-2 font-semibold">
                  {currentItem.amHanViet}
                </div>
              )}
            </div>

            {(hintShown || writeFeedback === 'wrong') && (
              <div className="text-sm font-bold text-rose-600 mt-2">
                {mode === 'writing-zh'
                  ? `${currentItem.hanzi} | ${currentItem.pinyin}`
                  : currentItem.meaningVi}
              </div>
            )}
          </div>

          <form onSubmit={handleVerifyWriting} className="w-full max-w-md mt-6 space-y-3">
            <input
              type="text"
              autoFocus
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={mode === 'writing-zh' ? 'Gõ chữ Hán...' : 'Gõ nghĩa tiếng Việt...'}
              className={`w-full py-4 px-4 rounded-2xl text-sm font-semibold text-center bg-white text-slate-900 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                writeFeedback === 'correct'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-900'
                  : writeFeedback === 'wrong'
                  ? 'ring-2 ring-rose-500 bg-rose-50 text-rose-900 animate-shake'
                  : ''
              }`}
            />

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setHintShown(true)}
                className="py-3.5 px-5 bg-white hover:bg-slate-200/70 text-slate-800 rounded-2xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Gợi ý
              </button>
              <button
                type="submit"
                disabled={!typedInput.trim()}
                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
