'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Check, RefreshCw, Eye, AlertCircle } from 'lucide-react';
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

interface ActiveCard {
  item: VocabItem;
  cleanPasses: number; // how many clean passes in this session
}

export function PracticeArena({
  deckId,
  deckTitle,
  allWords,
  mode,
  onExit,
  onComplete,
}: PracticeArenaProps) {
  // Session size selector (10 to 30)
  const [sessionSize, setSessionSize] = useState<number>(() => {
    const saved = localStorage.getItem(`session_size_${deckId}`);
    return saved ? parseInt(saved, 10) : Math.min(20, Math.max(10, allWords.length));
  });
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Active session queue
  const [queue, setQueue] = useState<ActiveCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [canClickActions, setCanClickActions] = useState<boolean>(false);
  const [hintShown, setHintShown] = useState<boolean>(false);

  // Writing mode text inputs
  const [typedInput, setTypedInput] = useState<string>('');
  const [writeFeedback, setWriteFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Matching mode micro-board state (4 pairs = 8 tiles)
  const [matchingTiles, setMatchingTiles] = useState<
    Array<{ id: string; text: string; wordId: string; type: 'hz' | 'vi'; isMatched: boolean }>
  >([]);
  const [selectedTile, setSelectedTile] = useState<{ id: string; wordId: string; type: string } | null>(null);
  const [matchingErrors, setMatchingErrors] = useState<number>(0);
  const [microBoardRoundStartTime, setMicroBoardRoundStartTime] = useState<number>(0);

  // Total completed words in this session
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());

  // Dynamic spacing gap: S_gap = max(3, floor(N / 4))
  const sGap = useMemo(() => Math.max(3, Math.floor(sessionSize / 4)), [sessionSize]);

  // Target passes per mode
  const targetPasses = mode === 'flashcard' ? 3 : 2;

  // ── Prepare Session Queue (70/30 Rolling Snowball) ─────────────────────
  const initializeQueue = () => {
    const unmastered = allWords.filter((w) => !w.isMastered);
    const pool = unmastered.length >= sessionSize ? unmastered : allWords;

    // Separate new words vs decaying/review words
    const newWords = pool.filter((w) => {
      if (mode === 'flashcard') return (w.flashcardStep || 0) === 0;
      if (mode === 'matching') return (w.matchingStep || 0) === 0;
      if (mode === 'writing-zh') return (w.writingZhStep || 0) === 0;
      return (w.writingViStep || 0) === 0;
    });

    const reviewWords = pool.filter((w) => {
      if (mode === 'flashcard') return (w.flashcardStep || 0) > 0;
      if (mode === 'matching') return (w.matchingStep || 0) > 0;
      if (mode === 'writing-zh') return (w.writingZhStep || 0) > 0;
      return (w.writingViStep || 0) > 0;
    });

    // 70% new, 30% review
    const nNew = Math.min(newWords.length, Math.ceil(0.7 * sessionSize));
    const nRev = Math.min(reviewWords.length, sessionSize - nNew);

    const selected: VocabItem[] = [
      ...newWords.slice(0, nNew),
      ...reviewWords.slice(0, nRev),
    ];

    // If still less than sessionSize, fill from pool
    if (selected.length < sessionSize) {
      const remaining = pool.filter((w) => !selected.some((s) => s.id === w.id));
      selected.push(...remaining.slice(0, sessionSize - selected.length));
    }

    // Shuffle initial batch
    const shuffled = [...selected].sort(() => Math.random() - 0.5);
    const activeCards: ActiveCard[] = shuffled.map((item) => ({
      item,
      cleanPasses: 0,
    }));

    setQueue(activeCards);
    setCurrentIndex(0);
    setCompletedWordIds(new Set());
    setHasStarted(true);
    localStorage.setItem(`session_size_${deckId}`, sessionSize.toString());

    // If matching mode, setup first micro-board
    if (mode === 'matching') {
      setupMatchingMicroBoard(activeCards.slice(0, 4));
    }
  };

  // ── Setup Micro-Board for Matching (4 pairs) ──────────────────────────
  const setupMatchingMicroBoard = (cards: ActiveCard[]) => {
    if (cards.length === 0) return;
    const tiles: Array<{ id: string; text: string; wordId: string; type: 'hz' | 'vi'; isMatched: boolean }> = [];
    cards.forEach((c) => {
      tiles.push({
        id: `hz_${c.item.id}`,
        text: c.item.hanzi,
        wordId: c.item.id,
        type: 'hz',
        isMatched: false,
      });
      tiles.push({
        id: `vi_${c.item.id}`,
        text: c.item.meaningVi.split(/[,;\/]/)[0].trim(), // first primary meaning
        wordId: c.item.id,
        type: 'vi',
        isMatched: false,
      });
    });
    setMatchingTiles(tiles.sort(() => Math.random() - 0.5));
    setSelectedTile(null);
    setMatchingErrors(0);
    setMicroBoardRoundStartTime(Date.now());
  };

  // ── Current Active Card ───────────────────────────────────────────────
  const currentCard = queue[currentIndex];

  // Flip debounce lock (150ms safeguard)
  useEffect(() => {
    if (isFlipped) {
      setCanClickActions(false);
      const timer = setTimeout(() => setCanClickActions(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isFlipped]);

  // Reset inputs when card changes
  useEffect(() => {
    setIsFlipped(false);
    setHintShown(false);
    setTypedInput('');
    setWriteFeedback('idle');
  }, [currentIndex]);

  // ── Flashcard Actions ─────────────────────────────────────────────────
  const handleFlashcardRemember = async () => {
    if (!currentCard) return;
    const wordId = currentCard.item.id;
    const nextPasses = currentCard.cleanPasses + 1;

    // Update database step
    const nextStep = Math.min(3, (currentCard.item.flashcardStep || 0) + 1);
    await db.vocab.update(wordId, {
      flashcardStep: nextStep,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (nextPasses >= targetPasses) {
      // Completed this word!
      const nextCompleted = new Set(completedWordIds);
      nextCompleted.add(wordId);
      setCompletedWordIds(nextCompleted);

      // Remove from active queue
      const nextQueue = queue.filter((_, idx) => idx !== currentIndex);
      if (nextQueue.length === 0) {
        onComplete();
        return;
      }
      setQueue(nextQueue);
      setCurrentIndex(currentIndex % nextQueue.length);
    } else {
      // Advance to next card
      const updatedQueue = [...queue];
      updatedQueue[currentIndex] = { ...currentCard, cleanPasses: nextPasses };
      setQueue(updatedQueue);
      setCurrentIndex((currentIndex + 1) % updatedQueue.length);
    }
  };

  const handleFlashcardForget = async () => {
    if (!currentCard) return;
    const wordId = currentCard.item.id;

    // Increment lapse count & reset step
    const nextLapse = (currentCard.item.lapseCount || 0) + 1;
    const isLeech = nextLapse >= 2;
    await db.vocab.update(wordId, {
      flashcardStep: 0,
      lapseCount: nextLapse,
      isLeech,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Reset clean passes and recycle card sGap cards later
    const updatedCard: ActiveCard = {
      item: { ...currentCard.item, flashcardStep: 0, lapseCount: nextLapse, isLeech },
      cleanPasses: 0,
    };

    const remaining = queue.filter((_, idx) => idx !== currentIndex);
    const insertIdx = Math.min(remaining.length, sGap);
    const nextQueue = [...remaining.slice(0, insertIdx), updatedCard, ...remaining.slice(insertIdx)];

    setQueue(nextQueue);
    setCurrentIndex(currentIndex < nextQueue.length ? currentIndex : 0);
  };

  // ── Writing Mode Verification ─────────────────────────────────────────
  const handleVerifyWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard || !typedInput.trim()) return;

    const userText = typedInput.trim().toLowerCase();
    let isCorrect = false;

    if (mode === 'writing-zh') {
      // Prompt: Vietnamese -> User types: Chinese characters
      isCorrect = userText === currentCard.item.hanzi.toLowerCase();
    } else {
      // Prompt: Chinese -> User types: Vietnamese meaning
      // Smart synonym splitting: split by commas, semicolons, slashes
      const synonyms = currentCard.item.meaningVi
        .split(/[,;\/]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      isCorrect = synonyms.some((syn) => syn === userText || userText.includes(syn));
    }

    if (isCorrect) {
      setWriteFeedback('correct');
      const wordId = currentCard.item.id;
      const nextPasses = currentCard.cleanPasses + 1;

      // Update DB step
      const stepField = mode === 'writing-zh' ? 'writingZhStep' : 'writingViStep';
      const currentStep = (currentCard.item as any)[stepField] || 0;
      await db.vocab.update(wordId, {
        [stepField]: Math.min(2, currentStep + 1),
        lastReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        if (nextPasses >= targetPasses) {
          const nextCompleted = new Set(completedWordIds);
          nextCompleted.add(wordId);
          setCompletedWordIds(nextCompleted);

          const nextQueue = queue.filter((_, idx) => idx !== currentIndex);
          if (nextQueue.length === 0) {
            onComplete();
            return;
          }
          setQueue(nextQueue);
          setCurrentIndex(currentIndex % nextQueue.length);
        } else {
          const updatedQueue = [...queue];
          updatedQueue[currentIndex] = { ...currentCard, cleanPasses: nextPasses };
          setQueue(updatedQueue);
          setCurrentIndex((currentIndex + 1) % updatedQueue.length);
        }
      }, 500);
    } else {
      setWriteFeedback('wrong');
      const wordId = currentCard.item.id;
      const nextLapse = (currentCard.item.lapseCount || 0) + 1;
      const isLeech = nextLapse >= 2;
      const stepField = mode === 'writing-zh' ? 'writingZhStep' : 'writingViStep';

      await db.vocab.update(wordId, {
        [stepField]: 0,
        lapseCount: nextLapse,
        isLeech,
        lastReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        const updatedCard: ActiveCard = {
          item: { ...currentCard.item, [stepField]: 0, lapseCount: nextLapse, isLeech },
          cleanPasses: 0,
        };
        const remaining = queue.filter((_, idx) => idx !== currentIndex);
        const insertIdx = Math.min(remaining.length, sGap);
        const nextQueue = [...remaining.slice(0, insertIdx), updatedCard, ...remaining.slice(insertIdx)];
        setQueue(nextQueue);
        setCurrentIndex(currentIndex < nextQueue.length ? currentIndex : 0);
      }, 800);
    }
  };

  // ── Matching Mode Tile Click ──────────────────────────────────────────
  const handleTileClick = async (tile: (typeof matchingTiles)[0]) => {
    if (tile.isMatched) return;

    if (!selectedTile) {
      setSelectedTile({ id: tile.id, wordId: tile.wordId, type: tile.type });
      return;
    }

    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Checking pair
    if (selectedTile.wordId === tile.wordId && selectedTile.type !== tile.type) {
      // MATCHED!
      const updatedTiles = matchingTiles.map((t) =>
        t.wordId === tile.wordId ? { ...t, isMatched: true } : t
      );
      setMatchingTiles(updatedTiles);
      setSelectedTile(null);

      // Check if current micro-board is cleared
      if (updatedTiles.every((t) => t.isMatched)) {
        const elapsedSeconds = (Date.now() - microBoardRoundStartTime) / 1000;
        const avgLatency = elapsedSeconds / 4;
        const isClean = matchingErrors === 0 && avgLatency <= 2.0;

        // Update database for the 4 words
        const microCards = queue.slice(0, 4);
        for (const c of microCards) {
          const nextStep = isClean ? Math.min(2, (c.item.matchingStep || 0) + 1) : 0;
          await db.vocab.update(c.item.id, {
            matchingStep: nextStep,
            lastReviewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Mark completed or advance
        const nextCompleted = new Set(completedWordIds);
        microCards.forEach((c) => nextCompleted.add(c.item.id));
        setCompletedWordIds(nextCompleted);

        const nextQueue = queue.slice(4);
        if (nextQueue.length === 0) {
          onComplete();
          return;
        }
        setQueue(nextQueue);
        setupMatchingMicroBoard(nextQueue.slice(0, 4));
      }
    } else {
      // MISCLICK!
      setMatchingErrors((e) => e + 1);
      setSelectedTile(null);
    }
  };

  // ── Start Screen: Select Session Size (10 to 30) ──────────────────────
  if (!hasStarted) {
    const maxAvailable = allWords.length;
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Quay lại bộ từ
        </button>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Thiết lập số lượng từ luyện tập
        </h1>
        <div className="text-sm text-slate-500 mt-1 mb-8">
          Chọn số lượng từ cho phiên học (10 đến 30 từ). Thuật toán ngắt quãng sẽ tự động điều chỉnh.
        </div>

        {/* Size Pills */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {[10, 15, 20, 25, 30]
            .filter((n) => n <= maxAvailable || n === 10)
            .map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setSessionSize(num)}
                className={`py-2.5 px-6 rounded-2xl text-sm font-semibold transition-all ${
                  sessionSize === num
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {num} từ
              </button>
            ))}
        </div>

        <div className="text-xs text-slate-400 mb-8">
          Khoảng cách lặp lại trong phiên: {sGap} thẻ | Tỉ lệ trộn: 70% từ mới, 30% từ cần ôn
        </div>

        <button
          type="button"
          onClick={initializeQueue}
          disabled={allWords.length === 0}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white text-sm font-semibold rounded-2xl transition-all shadow-md"
        >
          Bắt đầu luyện tập
        </button>
      </div>
    );
  }

  // ── Arena Screen ──────────────────────────────────────────────────────
  const progressPercent = Math.round((completedWordIds.size / sessionSize) * 100);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 flex flex-col min-h-[560px]">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-6">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
        >
          <ArrowLeft size={13} /> Thoát phiên
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>{deckTitle}</span>
          <span className="text-slate-300">|</span>
          <span className="text-blue-600">
            {completedWordIds.size} / {sessionSize} hoàn thành
          </span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1 bg-slate-100 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ── MODE 1: Flashcard ────────────────────────────────────────── */}
      {mode === 'flashcard' && currentCard && (
        <div className="flex-1 flex flex-col items-center justify-between py-4">
          {/* Central Flashcard Arena (Direct on flat canvas, no card-in-card) */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full max-w-md py-12 px-6 bg-slate-50/70 hover:bg-slate-50 rounded-3xl cursor-pointer select-none text-center transition-all flex flex-col items-center justify-center min-h-[260px]"
          >
            {/* HERO TEXT: Fixed height container (64px to 80px) */}
            <div className="h-28 flex items-center justify-center">
              <span className="text-6xl font-bold text-slate-900 tracking-tight">
                {currentCard.item.hanzi}
              </span>
            </div>

            {/* Revealed Back or Click Hint */}
            {isFlipped ? (
              <div className="space-y-2 mt-4 animate-in fade-in duration-200">
                {/* SMALL TEXT with vertical pipes */}
                <div className="text-sm font-medium text-slate-600">
                  <span>{currentCard.item.pinyin}</span>
                  {currentCard.item.amHanViet && (
                    <>
                      <span className="text-slate-300 mx-2">|</span>
                      <span>Hán Việt: {currentCard.item.amHanViet}</span>
                    </>
                  )}
                  {currentCard.item.pos && (
                    <>
                      <span className="text-slate-300 mx-2">|</span>
                      <span>{currentCard.item.pos}</span>
                    </>
                  )}
                </div>
                <div className="text-base font-semibold text-slate-900 pt-1">
                  {currentCard.item.meaningVi}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 mt-4">Nhấp vào đây để lật thẻ</div>
            )}
          </div>

          {/* Action Zone: Fixed bottom zone */}
          <div className="w-full max-w-md grid grid-cols-2 gap-3 mt-8">
            <button
              type="button"
              disabled={!isFlipped || !canClickActions}
              onClick={handleFlashcardForget}
              className="py-3 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 rounded-2xl text-xs font-semibold text-slate-600 transition-colors"
            >
              Quên (Lặp lại)
            </button>
            <button
              type="button"
              disabled={!isFlipped || !canClickActions}
              onClick={handleFlashcardRemember}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded-2xl text-xs font-semibold text-white transition-colors shadow-sm"
            >
              Đã nhớ ({currentCard.cleanPasses + 1}/{targetPasses})
            </button>
          </div>
        </div>
      )}

      {/* ── MODE 2: Matching ─────────────────────────────────────────── */}
      {mode === 'matching' && (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <div className="text-xs text-slate-400 mb-6">
            Ghép nhanh chữ Hán với nghĩa tương ứng (Mục tiêu dưới 2.0s/cặp)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg">
            {matchingTiles.map((tile) => {
              const isSelected = selectedTile?.id === tile.id;
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={tile.isMatched}
                  onClick={() => handleTileClick(tile)}
                  className={`h-24 p-3 rounded-2xl text-center flex items-center justify-center transition-all text-xs font-semibold ${
                    tile.isMatched
                      ? 'opacity-0 pointer-events-none'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-md scale-95'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <span className={tile.type === 'hz' ? 'text-2xl font-bold' : 'line-clamp-3'}>
                    {tile.text}
                  </span>
                </button>
              );
            })}
          </div>

          {matchingErrors > 0 && (
            <div className="text-xs text-rose-500 mt-6 font-medium">
              Số lần bấm sai: {matchingErrors}
            </div>
          )}
        </div>
      )}

      {/* ── MODE 3: Keyboard Writing Mode ────────────────────────────── */}
      {(mode === 'writing-zh' || mode === 'writing-vi') && currentCard && (
        <div className="flex-1 flex flex-col items-center justify-between py-4">
          <div className="w-full max-w-md py-8 px-6 bg-slate-50/70 rounded-3xl text-center">
            {/* HERO TEXT: Fixed height container */}
            <div className="h-28 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-slate-900 tracking-tight">
                {mode === 'writing-zh'
                  ? currentCard.item.meaningVi.split(/[,;\/]/)[0].trim()
                  : currentCard.item.hanzi}
              </span>
              {/* Homonym Disambiguation in Small Text */}
              {mode === 'writing-zh' && currentCard.item.amHanViet && (
                <div className="text-xs text-slate-400 mt-2 font-medium">
                  Hán Việt: {currentCard.item.amHanViet}
                </div>
              )}
            </div>

            {/* Hint reveal */}
            {hintShown && (
              <div className="text-xs font-medium text-slate-500 mt-2">
                Gợi ý:{' '}
                {mode === 'writing-zh' ? currentCard.item.pinyin : currentCard.item.meaningVi}
              </div>
            )}
          </div>

          {/* Typing Form */}
          <form onSubmit={handleVerifyWriting} className="w-full max-w-md mt-6 space-y-4">
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={
                  mode === 'writing-zh' ? 'Gõ chữ Hán vào đây...' : 'Gõ nghĩa tiếng Việt vào đây...'
                }
                className={`w-full py-3.5 px-4 rounded-2xl text-sm text-center bg-slate-50 focus:bg-white text-slate-900 transition-all focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                  writeFeedback === 'correct'
                    ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-900'
                    : writeFeedback === 'wrong'
                    ? 'ring-2 ring-rose-500 bg-rose-50 text-rose-900'
                    : ''
                }`}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHintShown(true)}
                className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-medium transition-colors"
              >
                Gợi ý
              </button>
              <button
                type="submit"
                disabled={!typedInput.trim()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
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
