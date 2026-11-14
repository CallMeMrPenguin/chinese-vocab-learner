'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { VocabItem, StudyMode } from '@/lib/types';
import { db } from '@/lib/db';
import { EditVocabModal } from '@/components/EditVocabModal';

interface PracticeArenaProps {
  deckId: string;
  deckTitle: string;
  allWords: VocabItem[];
  mode: StudyMode;
  onExit: () => void;
  onComplete: () => void;
}

export function PracticeArena({
  allWords,
  mode,
  onExit,
  onComplete,
}: PracticeArenaProps) {
  const sessionSize = Math.min(20, Math.max(1, allWords.length));
  const sGap = useMemo(() => Math.max(3, Math.floor(sessionSize / 4)), [sessionSize]);

  // Active session queue of words remaining to be answered right
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [totalSessionTarget, setTotalSessionTarget] = useState<number>(0);
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Flashcard state (3D flip + swipe animation + touch/pointer drag)
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [cardTransitionEnabled, setCardTransitionEnabled] = useState<boolean>(true);
  const [swipeAnim, setSwipeAnim] = useState<'idle' | 'left' | 'right'>('idle');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

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

  // Edit vocab modal state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  // ── Setup 4-Pair Micro-Board for Matching ─────────────────────────────
  const setupMatchingMicroBoard = useCallback((cards: VocabItem[]) => {
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
  }, []);

  // ── Auto-Initialize Fixed 20-Word Session on Mount ────────────────────
  useEffect(() => {
    if (initializedRef.current || allWords.length === 0) return;
    initializedRef.current = true;

    const getStep = (w: VocabItem) => {
      if (mode === 'flashcard') return w.flashcardStep || 0;
      if (mode === 'matching') return w.matchingStep || 0;
      if (mode === 'writing-zh') return w.writingZhStep || 0;
      return w.writingViStep || 0;
    };

    const targetCount = Math.min(20, allWords.length);

    const wrongPool = allWords
      .filter((w) => w.isLeech || (w.lapseCount || 0) > 0)
      .sort(() => Math.random() - 0.5);

    const oldPool = allWords
      .filter((w) => !w.isLeech && (w.lapseCount || 0) === 0 && getStep(w) > 0)
      .sort(() => Math.random() - 0.5);

    const newPool = allWords
      .filter((w) => !w.isLeech && (w.lapseCount || 0) === 0 && getStep(w) === 0)
      .sort(() => Math.random() - 0.5);

    const reviewQuota = Math.floor(targetCount * 0.35);
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

    const neededNew = targetCount - chosenReview.length;
    const chosenNew = newPool.slice(0, neededNew);

    const combined = [...chosenReview, ...chosenNew];
    if (combined.length < targetCount) {
      const usedIds = new Set(combined.map((x) => x.id));
      const leftover = allWords
        .filter((w) => !usedIds.has(w.id))
        .sort(() => Math.random() - 0.5);
      combined.push(...leftover.slice(0, targetCount - combined.length));
    }

    const finalQueue = combined.sort(() => Math.random() - 0.5);
    setQueue(finalQueue);
    setTotalSessionTarget(finalQueue.length);
    setCompletedWordIds(new Set());

    if (mode === 'matching') {
      setupMatchingMicroBoard(finalQueue.slice(0, 4));
    }
  }, [allWords, mode, setupMatchingMicroBoard]);

  const currentItem = queue[0];

  useEffect(() => {
    setCardTransitionEnabled(false);
    setIsFlipped(false);
    setSwipeAnim('idle');
    setDragOffset({ x: 0, y: 0 });
    setHintShown(false);
    setTypedInput('');
    setWriteFeedback('idle');
    const raf = requestAnimationFrame(() => {
      setCardTransitionEnabled(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [currentItem?.id, queue.length]);

  // ── Flashcard: Swipe Right (Đã thuộc) & Swipe Left (Đang học) ─────────
  const commitFlashcardRight = useCallback(async () => {
    if (!currentItem) return;
    const nextStep = (currentItem.flashcardStep || 0) + 1;
    await db.vocab.update(currentItem.id, {
      flashcardStep: nextStep,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setCompletedWordIds((prev) => {
      const next = new Set(prev);
      next.add(currentItem.id);
      return next;
    });

    const nextQueue = queue.slice(1);
    if (nextQueue.length === 0) {
      onComplete();
      return;
    }
    setQueue(nextQueue);
  }, [currentItem, queue, onComplete]);

  const commitFlashcardWrong = useCallback(async () => {
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
  }, [currentItem, queue, sGap]);

  const triggerSwipeRight = useCallback(() => {
    if (swipeAnim !== 'idle' || !currentItem) return;
    setSwipeAnim('right');
    setTimeout(() => {
      commitFlashcardRight();
    }, 220);
  }, [swipeAnim, currentItem, commitFlashcardRight]);

  const triggerSwipeLeft = useCallback(() => {
    if (swipeAnim !== 'idle' || !currentItem) return;
    setSwipeAnim('left');
    setTimeout(() => {
      commitFlashcardWrong();
    }, 220);
  }, [swipeAnim, currentItem, commitFlashcardWrong]);

  // ── Desktop Arrow Key Controls for Flashcard ──────────────────────────
  useEffect(() => {
    if (mode !== 'flashcard' || showEditModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerSwipeLeft();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerSwipeRight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, showEditModal, triggerSwipeLeft, triggerSwipeRight]);

  // ── Touch / Pointer Swipe Handlers for Flashcard ──────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeAnim !== 'idle') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture not supported
    }
    pointerStartRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current.active || swipeAnim !== 'idle') return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current.active) return;
    pointerStartRef.current.active = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    setDragOffset({ x: 0, y: 0 });

    if (dx > 25 && Math.abs(dx) >= Math.abs(dy)) {
      triggerSwipeRight();
    } else if (dx < -25 && Math.abs(dx) >= Math.abs(dy)) {
      triggerSwipeLeft();
    } else if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
      setIsFlipped((prev) => !prev);
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      setIsFlipped((prev) => !prev);
    }
  };

  // ── Writing Mode Verification ─────────────────────────────────────────
  const handleVerifyWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !typedInput.trim() || writeFeedback !== 'idle') return;

    const userText = typedInput.trim().toLowerCase();
    let isCorrect = false;

    if (mode === 'writing-zh') {
      isCorrect = userText === currentItem.hanzi.toLowerCase();
    } else {
      const synonyms = currentItem.meaningVi
        .replace(/^\([^)]+\)\s*/g, '')
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

    if (selectedTile.wordId === tile.wordId && selectedTile.type !== tile.type) {
      const updatedTiles = matchingTiles.map((t) =>
        t.wordId === tile.wordId ? { ...t, isMatched: true } : t
      );
      setMatchingTiles(updatedTiles);
      setSelectedTile(null);

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
      const pairIds = [selectedTile.id, tile.id];
      setWrongTileIds(pairIds);

      const nextFailed = new Set(failedInBoardIds);
      nextFailed.add(selectedTile.wordId);
      nextFailed.add(tile.wordId);
      setFailedInBoardIds(nextFailed);

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

  // Handle saving edited word mid-session
  const handleVocabSaved = (updated: VocabItem) => {
    setQueue((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    if (mode === 'matching') {
      setMatchingTiles((prev) =>
        prev.map((t) => {
          if (t.wordId !== updated.id) return t;
          return {
            ...t,
            text:
              t.type === 'hz'
                ? updated.hanzi
                : updated.meaningVi.replace(/^\([^)]+\)\s*/g, '').split(/[,;]/)[0].trim(),
          };
        })
      );
    }
  };

  if (queue.length === 0) return null;

  // Compute swipe wrapper style for Flashcard
  const getSwipeTransformStyle = (): React.CSSProperties => {
    if (swipeAnim === 'left') {
      return {
        transform: 'translateX(-130%) rotate(-14deg)',
        opacity: 0,
        transition: 'transform 0.22s ease-in, opacity 0.22s ease-in',
      };
    }
    if (swipeAnim === 'right') {
      return {
        transform: 'translateX(130%) rotate(14deg)',
        opacity: 0,
        transition: 'transform 0.22s ease-in, opacity 0.22s ease-in',
      };
    }
    if (dragOffset.x !== 0 || dragOffset.y !== 0) {
      return {
        transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.25}px) rotate(${
          dragOffset.x * 0.05
        }deg)`,
        transition: 'none',
      };
    }
    return {
      transform: 'translate(0px, 0px) rotate(0deg)',
      opacity: 1,
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    };
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col min-h-[540px]">
      {/* Top Bar: Exit on left, Edit word + Question count on right (No Deck Title) */}
      <div className="flex items-center justify-between pb-6">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Thoát
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Sửa từ vựng"
          >
            <Edit3 size={13} />
            <span>Sửa từ</span>
          </button>

          <div className="text-xs font-bold text-blue-600 bg-white py-1.5 px-3.5 rounded-xl shadow-2xs">
            {completedWordIds.size} / {totalSessionTarget}
          </div>
        </div>
      </div>

      {/* ── MODE 1: Flashcard with 3D Flip + Swipe Left/Right ─────────── */}
      {mode === 'flashcard' && currentItem && (
        <div className="flex-1 flex flex-col items-center justify-between py-2 overflow-hidden">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ ...getSwipeTransformStyle(), touchAction: 'none' }}
            className="w-full max-w-md h-72 flip-card-perspective cursor-grab active:cursor-grabbing select-none"
          >
            <div
              className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}
              style={!cardTransitionEnabled ? { transition: 'none' } : undefined}
            >
              {/* Front Face */}
              <div
                className={`flip-card-face rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center transition-colors ${
                  dragOffset.x > 18
                    ? 'bg-emerald-50'
                    : dragOffset.x < -18
                    ? 'bg-rose-50'
                    : 'bg-white'
                }`}
              >
                <span className="text-6xl font-bold text-slate-800 tracking-tight">
                  {currentItem.hanzi}
                </span>
              </div>

              {/* Back Face */}
              <div
                className={`flip-card-face flip-card-back rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center transition-colors ${
                  dragOffset.x > 18
                    ? 'bg-emerald-50'
                    : dragOffset.x < -18
                    ? 'bg-rose-50'
                    : 'bg-white'
                }`}
              >
                <span className="text-4xl font-bold text-slate-800 tracking-tight mb-4">
                  {currentItem.hanzi}
                </span>

                <div className="text-sm font-semibold text-blue-600 mb-3">
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
                      <span className="text-slate-500">{currentItem.pos}</span>
                    </>
                  )}
                </div>

                <div className="text-lg font-bold text-slate-800">
                  {currentItem.meaningVi}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md mt-8">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={triggerSwipeLeft}
                className="py-3.5 px-4 bg-white hover:bg-rose-50 rounded-2xl text-sm font-bold text-rose-600 shadow-xs transition-colors cursor-pointer"
              >
                Đang học
              </button>
              <button
                type="button"
                onClick={triggerSwipeRight}
                className="py-3.5 px-4 bg-blue-600 hover:bg-blue-700 rounded-2xl text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
              >
                Đã thuộc
              </button>
            </div>

            {/* Desktop Arrow Key Guide */}
            <div className="hidden sm:flex items-center justify-center gap-3 text-xs font-medium text-slate-500 mt-5">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white rounded-md shadow-2xs font-bold text-slate-700">
                  ↑
                </kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-white rounded-md shadow-2xs font-bold text-slate-700">
                  ↓
                </kbd>{' '}
                Lật thẻ
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white rounded-md shadow-2xs font-bold text-rose-600">
                  ←
                </kbd>{' '}
                Đang học
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white rounded-md shadow-2xs font-bold text-blue-600">
                  →
                </kbd>{' '}
                Đã thuộc
              </span>
            </div>
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
                      : 'bg-white hover:bg-blue-50/70 text-slate-800 shadow-xs transition-colors duration-100'
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
              <span className="text-4xl font-bold text-slate-800 tracking-tight">
                {mode === 'writing-zh'
                  ? currentItem.meaningVi.replace(/^\([^)]+\)\s*/g, '').split(/[,;\/]/)[0].trim()
                  : currentItem.hanzi}
              </span>
              {mode === 'writing-zh' && currentItem.amHanViet && (
                <div className="text-sm text-blue-600 mt-2 font-semibold">
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
              className={`w-full py-4 px-4 rounded-2xl text-sm font-semibold text-center bg-white text-slate-800 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                writeFeedback === 'correct'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-800'
                  : writeFeedback === 'wrong'
                  ? 'ring-2 ring-rose-500 bg-rose-50 text-rose-800 animate-shake'
                  : ''
              }`}
            />

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setHintShown(true)}
                className="py-3.5 px-5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-2xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Gợi ý
              </button>
              <button
                type="submit"
                disabled={!typedInput.trim()}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Vocab Modal inside Practice Arena */}
      <EditVocabModal
        vocab={currentItem || null}
        vocabOptions={mode === 'matching' ? queue.slice(0, 4) : undefined}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={handleVocabSaved}
      />
    </div>
  );
}
