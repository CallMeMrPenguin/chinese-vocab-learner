'use client';

import React, { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Plus,
  Edit3,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Deck, VocabItem, StudyMode, TestModeType } from '@/lib/types';
import { db, resetDeckProgress } from '@/lib/db';
import { DataTable } from '@/components/DataTable';
import { ImportModal } from '@/components/ImportModal';
import { EditVocabModal } from '@/components/EditVocabModal';

interface DeckDetailProps {
  deck: Deck;
  vocabList: VocabItem[];
  onBack: () => void;
  onStartPractice: (mode: StudyMode) => void;
  onStartTest: (testMode: TestModeType) => void;
  onOpenLeech: () => void;
  onDeckUpdated: () => void;
}

function trunc1Dec(val: number): string {
  const truncated = Math.floor(val * 10) / 10;
  return Number.isInteger(truncated) ? `${truncated}` : truncated.toFixed(1);
}

export function DeckDetail({
  deck,
  vocabList,
  onBack,
  onStartPractice,
  onStartTest,
  onOpenLeech,
  onDeckUpdated,
}: DeckDetailProps) {
  const [selectedMainTrack, setSelectedMainTrack] = useState<'practice' | 'test' | null>('practice');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editTitle, setEditTitle] = useState(deck.title);
  const [editHsk, setEditHsk] = useState(deck.hskLevel || 'Tự do');
  const [editTopic, setEditTopic] = useState(deck.topic || '');
  const [editFolderId, setEditFolderId] = useState<string | null>(deck.folderId ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Word editing modal state
  const [editingVocab, setEditingVocab] = useState<VocabItem | null>(null);

  const folders = useLiveQuery(() => db.folders.toArray(), []);

  const stats = useMemo(() => {
    const total = vocabList.length;
    const flashcardDone = vocabList.filter((w) => (w.flashcardStep || 0) > 0).length;
    const matchingDone = vocabList.filter((w) => (w.matchingStep || 0) > 0).length;
    const writingZhDone = vocabList.filter((w) => (w.writingZhStep || 0) > 0).length;
    const writingViDone = vocabList.filter((w) => (w.writingViStep || 0) > 0).length;
    const masteredDone = vocabList.filter((w) => !!w.isMastered).length;

    const totalPossibleSteps = total * 4;
    const completedSteps = flashcardDone + matchingDone + writingZhDone + writingViDone;
    const overallPct = totalPossibleSteps > 0 ? (completedSteps / totalPossibleSteps) * 100 : 0;

    return {
      total,
      flashcardDone,
      matchingDone,
      writingZhDone,
      writingViDone,
      masteredDone,
      overallPct,
      hasAnyProgress:
        flashcardDone > 0 ||
        matchingDone > 0 ||
        writingZhDone > 0 ||
        writingViDone > 0 ||
        masteredDone > 0,
    };
  }, [vocabList]);

  const leechCount = useMemo(
    () => vocabList.filter((w) => w.isLeech || (w.lapseCount || 0) >= 2).length,
    [vocabList]
  );

  const handleSaveDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    await db.decks.update(deck.id, {
      title: editTitle.trim(),
      hskLevel: editHsk,
      topic: editTopic.trim(),
      folderId: editFolderId,
      updatedAt: new Date().toISOString(),
    });
    setShowEditDeckModal(false);
    onDeckUpdated();
  };

  const handleDeleteDeck = async () => {
    await db.vocab.where('deckId').equals(deck.id).delete();
    await db.decks.delete(deck.id);
    setShowDeleteConfirm(false);
    setShowEditDeckModal(false);
    onBack();
  };

  const handleResetMode = async (
    target: StudyMode | 'test' | 'all',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    await resetDeckProgress(deck.id, target);
    onDeckUpdated();
  };

  const columns = useMemo<ColumnDef<VocabItem>[]>(
    () => [
      {
        accessorKey: 'hanzi',
        header: 'Chữ Hán',
        cell: (info) => (
          <span className="text-base font-bold text-slate-800">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'pinyin',
        header: 'Phiên âm',
        cell: (info) => <span className="font-semibold text-slate-700">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'amHanViet',
        header: 'Hán Việt',
        cell: (info) => <span className="text-slate-600 font-medium">{info.getValue<string>() || '—'}</span>,
      },
      {
        accessorKey: 'pos',
        header: 'Từ loại',
        cell: (info) => (
          <span className="text-slate-500 text-xs">{info.getValue<string>() || '—'}</span>
        ),
      },
      {
        accessorKey: 'meaningVi',
        header: 'Nghĩa tiếng Việt',
        cell: (info) => <span className="text-slate-800 line-clamp-2">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'isMastered',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const item = row.original;
          const practiced =
            (item.flashcardStep || 0) > 0 ||
            (item.matchingStep || 0) > 0 ||
            (item.writingZhStep || 0) > 0 ||
            (item.writingViStep || 0) > 0;
          if (item.isMastered) {
            return (
              <span className="py-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs inline-block">
                Đã thuộc
              </span>
            );
          }
          if (practiced) {
            return (
              <span className="py-1 px-2.5 bg-blue-50 text-blue-700 rounded-lg font-semibold text-xs inline-block">
                Đang học
              </span>
            );
          }
          return (
            <span className="py-1 px-2.5 bg-slate-100 text-slate-500 rounded-lg font-medium text-xs inline-block">
              Chưa học
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGlobalFilter: false,
        size: 56,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingVocab(row.original);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Chỉnh sửa từ"
            >
              <Edit3 size={14} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const practiceModes: Array<{
    mode: StudyMode;
    label: string;
    done: number;
  }> = [
    { mode: 'flashcard', label: 'Lật thẻ', done: stats.flashcardDone },
    { mode: 'matching', label: 'Ghép thẻ', done: stats.matchingDone },
    { mode: 'writing-zh', label: 'Gõ chữ Hán', done: stats.writingZhDone },
    { mode: 'writing-vi', label: 'Gõ tiếng Việt', done: stats.writingViDone },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-semibold shadow-xs transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft size={14} /> Quay lại
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{deck.title}</h1>
            <button
              type="button"
              onClick={() => {
                setEditTitle(deck.title);
                setEditHsk(deck.hskLevel || 'Tự do');
                setEditTopic(deck.topic || '');
                setEditFolderId(deck.folderId ?? null);
                setShowEditDeckModal(true);
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 shadow-xs transition-colors cursor-pointer"
              title="Chỉnh sửa bộ từ"
            >
              <Edit3 size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2.5 text-xs font-semibold text-slate-600">
            {deck.hskLevel && (
              <span className="py-1 px-2.5 bg-blue-50 text-blue-700 rounded-lg font-bold">
                {deck.hskLevel}
              </span>
            )}
            {deck.topic && (
              <span className="py-1 px-2.5 bg-white text-slate-600 rounded-lg shadow-2xs">
                {deck.topic}
              </span>
            )}
            <span className="text-slate-300">|</span>
            <span>{vocabList.length} từ</span>
          </div>
        </div>

        {/* Utility Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleResetMode('all')}
            disabled={!stats.hasAnyProgress}
            className="py-2.5 px-3.5 bg-white hover:bg-rose-50 disabled:opacity-40 text-slate-700 hover:text-rose-600 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Đặt lại toàn bộ tiến độ bộ từ này"
          >
            <RotateCcw size={14} />
            <span>Đặt lại tiến độ</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Nhập</span>
          </button>

          {leechCount > 0 && (
            <button
              type="button"
              onClick={onOpenLeech}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Từ hay sai ({leechCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Overall Deck Progress Bar ───────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700">Tiến độ tổng</span>
          <span className="text-blue-600">
            {trunc1Dec(stats.overallPct)}% | Đã thuộc {stats.masteredDone}/{stats.total} từ
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, stats.overallPct)}%` }}
          />
        </div>
      </div>

      {/* ── 2 Main Modes: Luyện tập & Kiểm tra ─────────────────────── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() =>
              setSelectedMainTrack(selectedMainTrack === 'practice' ? null : 'practice')
            }
            className={`py-4 px-6 rounded-2xl text-base font-bold transition-all cursor-pointer shadow-xs ${
              selectedMainTrack === 'practice'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-blue-50/70 text-slate-700 hover:text-blue-600'
            }`}
          >
            Luyện tập
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedMainTrack(selectedMainTrack === 'test' ? null : 'test')
            }
            className={`py-4 px-6 rounded-2xl text-base font-bold transition-all cursor-pointer shadow-xs ${
              selectedMainTrack === 'test'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-blue-50/70 text-slate-700 hover:text-blue-600'
            }`}
          >
            Kiểm tra
          </button>
        </div>

        {/* Sub-mode Selection when Luyện tập is clicked (with per-mode progress bar + reset button) */}
        {selectedMainTrack === 'practice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {practiceModes.map(({ mode, label, done }) => {
              const pct = stats.total > 0 ? (done / stats.total) * 100 : 0;
              return (
                <div
                  key={mode}
                  onClick={() => onStartPractice(mode)}
                  className="p-4 bg-white hover:bg-blue-50/50 rounded-2xl shadow-xs transition-all cursor-pointer group flex flex-col justify-between gap-3 border border-transparent hover:border-blue-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleResetMode(mode, e)}
                      disabled={done === 0}
                      title={`Đặt lại tiến độ ${label}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>
                        {done} / {stats.total} từ
                      </span>
                      <span className="text-blue-600 font-bold">{trunc1Dec(pct)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-mode Selection when Kiểm tra is clicked (All buttons uniform slate-700, no blue on Hỗn hợp) */}
        {selectedMainTrack === 'test' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => onStartTest('mix')}
                className="py-3.5 px-4 bg-white hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
              >
                Hỗn hợp
              </button>
              <button
                type="button"
                onClick={() => onStartTest('matching')}
                className="py-3.5 px-4 bg-white hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
              >
                Ghép thẻ
              </button>
              <button
                type="button"
                onClick={() => onStartTest('writing-zh')}
                className="py-3.5 px-4 bg-white hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
              >
                Gõ chữ Hán
              </button>
              <button
                type="button"
                onClick={() => onStartTest('writing-vi')}
                className="py-3.5 px-4 bg-white hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
              >
                Gõ tiếng Việt
              </button>
            </div>

            <div className="bg-white rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Tiến độ kiểm tra (Đã thuộc)</span>
                  <span className="text-emerald-600">
                    {stats.masteredDone} / {stats.total} từ (
                    {stats.total > 0 ? trunc1Dec((stats.masteredDone / stats.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        stats.total > 0 ? Math.min(100, (stats.masteredDone / stats.total) * 100) : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleResetMode('test', e)}
                disabled={stats.masteredDone === 0}
                className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 disabled:opacity-30 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Đặt lại tiến độ Kiểm tra"
              >
                <RotateCcw size={12} />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Vocabulary Data Table ──────────────────────────────────── */}
      <div className="pt-2">
        <DataTable<VocabItem>
          data={vocabList}
          columns={columns}
          pageSize={20}
          searchPlaceholder="Tìm chữ Hán, phiên âm, Hán Việt, nghĩa..."
          exportFilename={deck.title.toLowerCase().replace(/\s+/g, '_')}
        />
      </div>

      <ImportModal
        deckId={deck.id}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={onDeckUpdated}
      />

      <EditVocabModal
        vocab={editingVocab}
        isOpen={!!editingVocab}
        onClose={() => setEditingVocab(null)}
        onSaved={() => {
          setEditingVocab(null);
          onDeckUpdated();
        }}
        onDeleted={() => {
          setEditingVocab(null);
          onDeckUpdated();
        }}
      />

      {/* ── Edit Deck Modal ────────────────────────────────────────── */}
      {showEditDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-800 pb-3">
              Chỉnh sửa bộ từ
            </h2>

            <form onSubmit={handleSaveDeck} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tên bộ từ</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Thư mục</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => setEditFolderId(null)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      editFolderId === null
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ngoài cùng (Gốc)
                  </button>
                  {(folders || []).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditFolderId(f.id)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        editFolderId === f.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Cấp độ</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Tự do', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEditHsk(lvl)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        editHsk === lvl
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
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Chủ đề</label>
                <input
                  type="text"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Du lịch, Ẩm thực..."
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-2 px-3.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                >
                  Xóa bộ từ
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditDeckModal(false)}
                    className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </form>

            {showDeleteConfirm && (
              <div className="absolute inset-0 bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                <AlertTriangle size={32} className="text-rose-600 mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-6">Xác nhận xóa bộ từ này?</h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2.5 px-5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDeck}
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
    </div>
  );
}
