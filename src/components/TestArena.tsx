'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, ShieldAlert, Award, RotateCcw } from 'lucide-react';
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
  type: 'flashcard' | 'writing-zh' | 'writing-vi';
  prompt: string;
  subPrompt?: string;
  expectedAnswers: string[];
}

export function TestArena({
  deckId,
  deckTitle,
  allWords,
  testMode,
  onExit,
  onSuccess,
}: TestArenaProps) {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>('');
  const [failedVocabList, setFailedVocabList] = useState<VocabItem[]>([]);
  const [isTestFinished, setIsTestFinished] = useState<boolean>(false);
  const [isRemediationMode, setIsRemediationMode] = useState<boolean>(false);

  // Initialize Questions
  useEffect(() => {
    generateQuestions(allWords);
  }, [allWords, testMode]);

  const generateQuestions = (words: VocabItem[]) => {
    const list: TestQuestion[] = words.map((w) => {
      let qType: 'flashcard' | 'writing-zh' | 'writing-vi' = 'writing-zh';

      if (testMode === 'mix') {
        const types: Array<'flashcard' | 'writing-zh' | 'writing-vi'> = [
          'flashcard',
          'writing-zh',
          'writing-vi',
        ];
        qType = types[Math.floor(Math.random() * types.length)];
      } else if (testMode === 'writing-vi') {
        qType = 'writing-vi';
      } else if (testMode === 'flashcard') {
        qType = 'flashcard';
      } else {
        qType = 'writing-zh';
      }

      if (qType === 'writing-zh') {
        return {
          vocab: w,
          type: qType,
          prompt: w.meaningVi.split(/[,;\/]/)[0].trim(),
          subPrompt: w.amHanViet ? `Hán Việt: ${w.amHanViet}` : undefined,
          expectedAnswers: [w.hanzi.trim().toLowerCase()],
        };
      } else if (qType === 'writing-vi') {
        const synonyms = w.meaningVi
          .split(/[,;\/]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return {
          vocab: w,
          type: qType,
          prompt: w.hanzi,
          subPrompt: w.pinyin,
          expectedAnswers: synonyms,
        };
      } else {
        // Flashcard recognition
        const synonyms = w.meaningVi
          .split(/[,;\/]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return {
          vocab: w,
          type: qType,
          prompt: w.hanzi,
          subPrompt: w.amHanViet ? `Hán Việt: ${w.amHanViet}` : undefined,
          expectedAnswers: synonyms,
        };
      }
    });

    setQuestions(list.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setUserInput('');
    setFailedVocabList([]);
    setIsTestFinished(false);
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questions[currentIndex] || !userInput.trim()) return;

    const currentQ = questions[currentIndex];
    const text = userInput.trim().toLowerCase();
    const isCorrect = currentQ.expectedAnswers.some(
      (ans) => ans === text || text.includes(ans)
    );

    if (!isCorrect) {
      setFailedVocabList((prev) => [...prev, currentQ.vocab]);
    }

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((idx) => idx + 1);
      setUserInput('');
    } else {
      // Completed all questions in test!
      finishTest(isCorrect ? failedVocabList : [...failedVocabList, currentQ.vocab]);
    }
  };

  const finishTest = async (allFailed: VocabItem[]) => {
    setIsTestFinished(true);
    const isPassed = allFailed.length === 0;

    // Record test in DB
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
      // 100% Passed!
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      // Mark all words as Mastered!
      for (const w of allWords) {
        await db.vocab.update(w.id, {
          isMastered: true,
          lastReviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      onSuccess();
    } else {
      // Quarantine failed words into Sổ tay từ hay sai
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

  // Launch Vòng Cứu Hộ (Targeted Remediation)
  const startRemediation = () => {
    setIsRemediationMode(true);
    generateQuestions(failedVocabList);
  };

  // ── Result Screen ─────────────────────────────────────────────────────
  if (isTestFinished) {
    const isPassed = failedVocabList.length === 0;
    const correctCount = questions.length - failedVocabList.length;

    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        {isPassed ? (
          <div>
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <Award size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Đạt 100% - Tinh thông</h2>
            <div className="text-sm text-slate-500 mt-2 mb-8">
              Chúc mừng! Bạn đã hoàn thành chính xác toàn bộ {questions.length} câu hỏi theo tiêu chuẩn Mastery Learning.
            </div>
            <button
              onClick={onExit}
              className="py-3 px-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl text-xs transition-colors"
            >
              Hoàn thành bài thi
            </button>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Chưa đạt tiêu chuẩn 100%</h2>
            <div className="text-sm text-slate-500 mt-2 mb-2">
              Kết quả: {correctCount} / {questions.length} câu đúng.
            </div>
            <div className="text-xs text-slate-400 mb-8">
              Theo quy tắc Mastery Learning, cần 100% để được công nhận. Các từ chưa đúng đã được chuyển vào Sổ tay từ hay sai.
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onExit}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Về danh sách
              </button>
              <button
                onClick={startRemediation}
                className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Vòng cứu hộ ({failedVocabList.length} từ)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Testing Screen ────────────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 flex flex-col min-h-[500px] justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-6">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors"
        >
          <ArrowLeft size={13} /> Dừng bài kiểm tra
        </button>

        <div className="text-xs font-semibold text-slate-700">
          Câu {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Question Card */}
      <div className="py-12 px-6 bg-slate-50/70 rounded-3xl text-center">
        <div className="h-28 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-900 tracking-tight">
            {currentQ.prompt}
          </span>
          {currentQ.subPrompt && (
            <div className="text-xs text-slate-400 mt-2 font-medium">
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
          className="w-full py-3.5 px-4 rounded-2xl text-sm text-center bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
        />

        <button
          type="submit"
          disabled={!userInput.trim()}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded-2xl text-xs font-semibold transition-all shadow-sm"
        >
          {currentIndex + 1 === questions.length ? 'Nộp bài thi' : 'Câu tiếp theo'}
        </button>
      </form>
    </div>
  );
}
