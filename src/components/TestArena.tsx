'use client';

import React, { useState } from 'react';
import { ArrowLeft, Award, ShieldAlert, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { VocabItem, TestModeType } from '@/lib/types';
import { db } from '@/lib/db';

interface TestArenaProps {
  deckId: string;
  deckTitle: string;
  allWords: VocabItem[];
  testMode: TestModeType;
  onExit: () => void;
  onSuccess: () => void;
}

interface TestQuestion {
  vocab: VocabItem;
  type: 'writing-zh' | 'writing-vi';
  prompt: string;
  subPrompt?: string;
  expectedAnswers: string[];
}

export function TestArena({
  deckId,
  allWords,
  testMode,
  onExit,
  onSuccess,
}: TestArenaProps) {
  const [testSize, setTestSize] = useState<number>(20);
  const [isStarted, setIsStarted] = useState<boolean>(false);

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>('');
  const [failedVocabList, setFailedVocabList] = useState<VocabItem[]>([]);
  const [isTestFinished, setIsTestFinished] = useState<boolean>(false);

  // Matching test state
  const [matchPool, setMatchPool] = useState<VocabItem[]>([]);
  const [matchBoard, setMatchBoard] = useState<
    Array<{ id: string; vocabId: string; text: string; type: 'zh' | 'vi'; matched: boolean }>
  >([]);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([]);

  const setupMatchingBoard = (pool: VocabItem[]) => {
    const slice = pool.slice(0, 4);
    const tiles: Array<{ id: string; vocabId: string; text: string; type: 'zh' | 'vi'; matched: boolean }> = [];
    slice.forEach((w) => {
      tiles.push({
        id: `zh_${w.id}`,
        vocabId: w.id,
        text: w.hanzi,
        type: 'zh',
        matched: false,
      });
      tiles.push({
        id: `vi_${w.id}`,
        vocabId: w.id,
        text: w.meaningVi.replace(/^\([^)]+\)\s*/g, '').split(/[,;]/)[0].trim(),
        type: 'vi',
        matched: false,
      });
    });
    setMatchBoard(tiles.sort(() => Math.random() - 0.5));
    setSelectedTile(null);
    setWrongPairIds([]);
  };

  const startTest = (wordsToTest?: VocabItem[]) => {
    const sourceWords = wordsToTest
      ? [...wordsToTest]
      : [...allWords]
          .sort(() => Math.random() - 0.5)
          .slice(0, testSize === 0 ? allWords.length : Math.min(testSize, allWords.length));

    setFailedVocabList([]);
    setIsTestFinished(false);

    if (testMode === 'matching') {
      setMatchPool(sourceWords);
      setupMatchingBoard(sourceWords);
      setQuestions(
        sourceWords.map((w) => ({
          vocab: w,
          type: 'writing-vi',
          prompt: w.hanzi,
          expectedAnswers: [w.meaningVi],
        }))
      );
      setIsStarted(true);
      return;
    }

    const list: TestQuestion[] = sourceWords.map((w) => {
      let qType: 'writing-zh' | 'writing-vi' = 'writing-zh';

      if (testMode === 'mix') {
        qType = Math.random() < 0.5 ? 'writing-zh' : 'writing-vi';
      } else if (testMode === 'writing-vi') {
        qType = 'writing-vi';
      } else {
        qType = 'writing-zh';
      }

      if (qType === 'writing-zh') {
        return {
          vocab: w,
          type: qType,
          prompt: w.meaningVi.replace(/^\([^)]+\)\s*/g, '').split(/[,;\/]/)[0].trim(),
          subPrompt: w.amHanViet || undefined,
          expectedAnswers: [w.hanzi.trim().toLowerCase()],
        };
      } else {
        const synonyms = w.meaningVi
          .replace(/^\([^)]+\)\s*/g, '')
          .split(/[,;\/]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return {
          vocab: w,
          type: qType,
          prompt: w.hanzi,
          subPrompt: w.pinyin || undefined,
          expectedAnswers: synonyms,
        };
      }
    });

    setQuestions(list.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setUserInput('');
    setIsStarted(true);
  };

  const handleTileClick = async (tileId: string) => {
    if (wrongPairIds.length > 0) return;
    const clicked = matchBoard.find((t) => t.id === tileId);
    if (!clicked || clicked.matched) return;

    if (!selectedTile) {
      setSelectedTile(tileId);
      return;
    }

    if (selectedTile === tileId) {
      setSelectedTile(null);
      return;
    }

    const prevTile = matchBoard.find((t) => t.id === selectedTile);
    if (!prevTile) {
      setSelectedTile(tileId);
      return;
    }

    if (prevTile.vocabId === clicked.vocabId && prevTile.type !== clicked.type) {
      const updated = matchBoard.map((t) =>
        t.vocabId === clicked.vocabId ? { ...t, matched: true } : t
      );
      setMatchBoard(updated);
      setSelectedTile(null);

      if (updated.every((t) => t.matched)) {
        const remaining = matchPool.slice(4);
        if (remaining.length > 0) {
          setMatchPool(remaining);
          setTimeout(() => setupMatchingBoard(remaining), 220);
        } else {
          await finishTest(failedVocabList);
        }
      }
    } else {
      setWrongPairIds([prevTile.id, clicked.id]);
      setSelectedTile(null);
      const wrongVocab = allWords.find((w) => w.id === prevTile.vocabId);
      if (wrongVocab) {
        setFailedVocabList((prev) =>
          prev.some((item) => item.id === wrongVocab.id) ? prev : [...prev, wrongVocab]
        );
      }
      setTimeout(() => {
        setWrongPairIds([]);
      }, 380);
    }
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questions[currentIndex] || !userInput.trim()) return;

    const currentQ = questions[currentIndex];
    const text = userInput.trim().toLowerCase();
    const isCorrect = currentQ.expectedAnswers.some(
      (ans) => ans === text || (text.length >= 2 && ans.includes(text))
    );

    const updatedFailed = isCorrect
      ? failedVocabList
      : failedVocabList.some((w) => w.id === currentQ.vocab.id)
      ? failedVocabList
      : [...failedVocabList, currentQ.vocab];

    if (!isCorrect) {
      setFailedVocabList(updatedFailed);
    }

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((idx) => idx + 1);
      setUserInput('');
    } else {
      finishTest(updatedFailed);
    }
  };

  const finishTest = async (allFailed: VocabItem[]) => {
    setIsTestFinished(true);
    const isPassed = allFailed.length === 0;

    await db.testRecords.add({
      id: `test_${Date.now()}`,
      deckId,
      mode: testMode,
      totalQuestions: questions.length,
      correctCount: questions.length - allFailed.length,
      isPassed,
      failedVocabIds: allFailed.map((w) => w.id),
      completedAt: new Date().toISOString(),
    });

    if (isPassed) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      for (const q of questions) {
        await db.vocab.update(q.vocab.id, {
          isMastered: true,
          lastReviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      onSuccess();
    } else {
      for (const w of allFailed) {
        const nextLapse = (w.lapseCount || 0) + 1;
        await db.vocab.update(w.id, {
          lapseCount: nextLapse,
          isLeech: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // ── Setup Screen ──────────────────────────────────────────────────────
  if (!isStarted) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold shadow-xs transition-colors mb-10 cursor-pointer"
        >
          <ArrowLeft size={14} /> Quay lại
        </button>

        <div className="bg-white rounded-3xl p-7 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Số lượng từ kiểm tra</h2>

          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: '10', value: 10 },
              { label: '20', value: 20 },
              { label: '30', value: 30 },
              { label: 'Tất cả', value: 0 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTestSize(opt.value)}
                className={`py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                  testSize === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => startTest()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition-colors shadow-sm cursor-pointer"
          >
            Bắt đầu
          </button>
        </div>
      </div>
    );
  }

  // ── Result Screen ─────────────────────────────────────────────────────
  if (isTestFinished) {
    const isPassed = failedVocabList.length === 0;
    const correctCount = questions.length - failedVocabList.length;

    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-xs">
          {isPassed ? (
            <div>
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <Award size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Đạt 100%</h2>
              <div className="text-sm font-semibold text-slate-600 mb-6">
                {correctCount} / {questions.length} từ chính xác
              </div>
              <button
                onClick={onExit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Hoàn thành
              </button>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {correctCount} / {questions.length} chính xác
              </h2>
              <div className="text-sm font-medium text-rose-600 mb-6">
                Sai {failedVocabList.length} từ
              </div>

              <div className="flex items-center justify-center gap-2.5">
                <button
                  onClick={onExit}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  onClick={() => startTest(failedVocabList)}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Làm lại từ sai ({failedVocabList.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Matching Test Screen ──────────────────────────────────────────────
  if (testMode === 'matching') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between pb-6">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} /> Thoát
          </button>

          <div className="text-xs font-bold text-blue-600 bg-white py-1.5 px-3.5 rounded-xl shadow-2xs">
            Còn {matchPool.length} từ
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {matchBoard.map((tile) => {
            const isSelected = selectedTile === tile.id;
            const isWrong = wrongPairIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                disabled={tile.matched}
                onClick={() => handleTileClick(tile.id)}
                className={`h-28 p-3 rounded-2xl text-center flex items-center justify-center cursor-pointer ${
                  tile.matched
                    ? 'opacity-0 pointer-events-none scale-95 transition-all duration-150'
                    : isWrong
                    ? 'bg-rose-600 text-white shadow-md animate-shake'
                    : isSelected
                    ? 'bg-blue-600 text-white shadow-md scale-95 transition-transform duration-100'
                    : 'bg-white hover:bg-blue-50/70 text-slate-800 shadow-xs transition-colors duration-100'
                }`}
              >
                <span className={tile.type === 'zh' ? 'text-2xl font-bold' : 'text-xs font-bold line-clamp-3'}>
                  {tile.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Input Testing Screen ──────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 flex flex-col min-h-[500px] justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-6">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> Thoát
        </button>

        <div className="text-xs font-bold text-blue-600 bg-white py-1.5 px-3.5 rounded-xl shadow-2xs">
          {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Question Card */}
      <div className="py-12 px-6 bg-white rounded-3xl text-center shadow-sm">
        <div className="h-28 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-800 tracking-tight">
            {currentQ.prompt}
          </span>
          {currentQ.subPrompt && (
            <div className="text-sm text-blue-600 mt-2 font-semibold">
              {currentQ.subPrompt}
            </div>
          )}
        </div>
      </div>

      {/* Answer Form */}
      <form onSubmit={handleAnswerSubmit} className="mt-8 space-y-3">
        <input
          type="text"
          autoFocus
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={
            currentQ.type === 'writing-zh'
              ? 'Gõ chữ Hán...'
              : 'Gõ nghĩa tiếng Việt...'
          }
          className="w-full py-4 px-4 rounded-2xl text-base text-center bg-white shadow-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
        />

        <button
          type="submit"
          disabled={!userInput.trim()}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          {currentIndex + 1 === questions.length ? 'Hoàn thành' : 'Tiếp theo'}
        </button>
      </form>
    </div>
  );
}
