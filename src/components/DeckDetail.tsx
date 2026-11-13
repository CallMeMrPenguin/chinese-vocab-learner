'use client';

import React, { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  Plus,
  Edit3,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Deck, VocabItem, StudyMode, TestModeType } from '@/lib/types';
import { db } from '@/lib/db';
import { DataTable } from '@/components/DataTable';
import { ImportModal } from '@/components/ImportModal';

interface DeckDetailProps {
  deck: Deck;
  vocabList: VocabItem[];
  onBack: () => void;
  onStartPractice: (mode: StudyMode) => void;
  onStartTest: (testMode: TestModeType) => void;
  onOpenLeech: () => void;
  onDeckUpdated: () => void;
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
  const [selectedMainTrack, setSelectedMainTrack] = useState<'practice' | 'test' | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editTitle, setEditTitle] = useState(deck.title);
  const [editHsk, setEditHsk] = useState(deck.hskLevel || 'Tự do');
  const [editTopic, setEditTopic] = useState(deck.topic || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const columns = useMemo<ColumnDef<VocabItem>[]>(
    () => [
      {
        accessorKey: 'hanzi',
        header: 'Chữ Hán',
        cell: (info) => (
          <span className="text-base font-bold text-slate-900">{info.getValue<string>()}</span>
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
        cell: (info) => <span className="text-slate-700 font-medium">{info.getValue<string>() || '—'}</span>,
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
        cell: (info) => <span className="text-slate-900 line-clamp-2">{info.getValue<string>()}</span>,
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
              <span className="py-1 px-2.5 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-xs inline-block">
                Đã thuộc
              </span>
            );
          }
          if (practiced) {
            return (
              <span className="py-1 px-2.5 bg-blue-100 text-blue-800 rounded-lg font-semibold text-xs inline-block">
                Đang học
              </span>
            );
          }
          return (
            <span className="py-1 px-2.5 bg-slate-200/80 text-slate-600 rounded-lg font-medium text-xs inline-block">
              Chưa học
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-slate-200/70 text-slate-800 text-xs font-semibold shadow-xs transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft size={14} /> Tất cả bộ từ
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{deck.title}</h1>
            <button
              type="button"
              onClick={() => setShowEditDeckModal(true)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-200/70 shadow-xs transition-colors cursor-pointer"
              title="Chỉnh sửa"
            >
              <Edit3 size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2.5 text-xs font-semibold text-slate-600">
            {deck.hskLevel && (
              <span className="py-1 px-2.5 bg-slate-200 text-slate-800 rounded-lg">
                {deck.hskLevel}
              </span>
            )}
            {deck.topic && (
              <span className="py-1 px-2.5 bg-slate-200 text-slate-800 rounded-lg">
                {deck.topic}
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span>{vocabList.length} từ</span>
          </div>
        </div>

        {/* Utility Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="py-2.5 px-4 bg-white hover:bg-slate-200/70 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200/70 text-slate-900'
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
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-200/70 text-slate-900'
            }`}
          >
            Kiểm tra
          </button>
        </div>

        {/* Sub-mode Selection when Luyện tập is clicked */}
        {selectedMainTrack === 'practice' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onStartPractice('flashcard')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Lật thẻ
            </button>
            <button
              type="button"
              onClick={() => onStartPractice('matching')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Ghép thẻ
            </button>
            <button
              type="button"
              onClick={() => onStartPractice('writing-zh')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Gõ chữ Hán
            </button>
            <button
              type="button"
              onClick={() => onStartPractice('writing-vi')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Gõ tiếng Việt
            </button>
          </div>
        )}

        {/* Sub-mode Selection when Kiểm tra is clicked */}
        {selectedMainTrack === 'test' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onStartTest('mix')}
              className="py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Hỗn hợp
            </button>
            <button
              type="button"
              onClick={() => onStartTest('flashcard')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Lật thẻ
            </button>
            <button
              type="button"
              onClick={() => onStartTest('matching')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Ghép thẻ
            </button>
            <button
              type="button"
              onClick={() => onStartTest('writing-zh')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Gõ chữ Hán
            </button>
            <button
              type="button"
              onClick={() => onStartTest('writing-vi')}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-sm font-bold text-center transition-colors shadow-xs cursor-pointer"
            >
              Gõ tiếng Việt
            </button>
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

      {/* ── Edit Deck Modal ────────────────────────────────────────── */}
      {showEditDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-900 pb-3">
              Chỉnh sửa bộ từ
            </h2>

            <form onSubmit={handleSaveDeck} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tên bộ từ</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Cấp độ</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Tự do', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEditHsk(lvl)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        editHsk === lvl
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Chủ đề</label>
                <input
                  type="text"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Du lịch, Ẩm thực..."
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </form>

            {showDeleteConfirm && (
              <div className="absolute inset-0 bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                <AlertTriangle size={32} className="text-rose-600 mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-6">Xác nhận xóa bộ từ này?</h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2.5 px-5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
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
