'use client';

import React, { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  Play,
  Award,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editTitle, setEditTitle] = useState(deck.title);
  const [editHsk, setEditHsk] = useState(deck.hskLevel || 'Tự do');
  const [editTopic, setEditTopic] = useState(deck.topic || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Leech words count
  const leechCount = useMemo(
    () => vocabList.filter((w) => w.isLeech || (w.lapseCount || 0) >= 2).length,
    [vocabList]
  );

  // Handle Edit Deck
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

  // Handle Delete Deck (inside edit modal per user Rule 16)
  const handleDeleteDeck = async () => {
    await db.vocab.where('deckId').equals(deck.id).delete();
    await db.decks.delete(deck.id);
    setShowDeleteConfirm(false);
    setShowEditDeckModal(false);
    onBack();
  };

  // TanStack Columns for Vocabulary Table
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
        cell: (info) => <span className="font-medium text-slate-700">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'amHanViet',
        header: 'Hán Việt',
        cell: (info) => <span className="text-slate-600">{info.getValue<string>() || '—'}</span>,
      },
      {
        accessorKey: 'pos',
        header: 'Từ loại',
        cell: (info) => (
          <span className="text-slate-400 text-xs">{info.getValue<string>() || '—'}</span>
        ),
      },
      {
        accessorKey: 'meaningVi',
        header: 'Nghĩa tiếng Việt',
        cell: (info) => <span className="text-slate-800 line-clamp-2">{info.getValue<string>()}</span>,
      },
      {
        id: 'progress',
        header: 'Tiến trình',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <span className="py-0.5 px-1.5 bg-slate-100 rounded">F: {item.flashcardStep || 0}/3</span>
              <span className="py-0.5 px-1.5 bg-slate-100 rounded">M: {item.matchingStep || 0}/2</span>
              <span className="py-0.5 px-1.5 bg-slate-100 rounded">W: {item.writingZhStep || 0}/2</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'isMastered',
        header: 'Trạng thái',
        cell: (info) => {
          const isMastered = info.getValue<boolean>();
          return isMastered ? (
            <span className="py-0.5 px-2 bg-emerald-50 text-emerald-600 rounded-full font-semibold text-xs inline-block">
              Tinh thông
            </span>
          ) : (
            <span className="py-0.5 px-2 bg-slate-100 text-slate-400 rounded-full text-xs inline-block">
              Đang học
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors mb-3"
          >
            <ArrowLeft size={13} /> Tất cả bộ từ
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{deck.title}</h1>
            {/* Single Pen Button (Merged Edit inside Modal per Rule 16) */}
            <button
              onClick={() => setShowEditDeckModal(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Chỉnh sửa bộ từ"
            >
              <Edit3 size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500">
            {deck.hskLevel && (
              <span className="py-0.5 px-2.5 bg-slate-100 text-slate-700 rounded-full">
                {deck.hskLevel}
              </span>
            )}
            {deck.topic && (
              <span className="py-0.5 px-2.5 bg-slate-100 text-slate-700 rounded-full">
                {deck.topic}
              </span>
            )}
            <span className="text-slate-300">|</span>
            <span>{vocabList.length} từ vựng</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600">Độ bền trí nhớ: {deck.healthPercent || 100}%</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Nhập</span>
          </button>

          {leechCount > 0 && (
            <button
              onClick={onOpenLeech}
              className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              <span>Từ hay sai ({leechCount})</span>
            </button>
          )}

          {/* Test Button (100% Bloom Criterion) */}
          <button
            onClick={() => onStartTest('mix')}
            className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Award size={14} className="text-blue-600" />
            <span>Kiểm tra (100%)</span>
          </button>
        </div>
      </div>

      {/* ── Practice Modalities Bar ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onStartPractice('flashcard')}
          className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl text-left transition-all group"
        >
          <div className="text-xs font-medium text-slate-400">Chế độ 1</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
            <span>Lật thẻ</span>
            <Play size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">3 lần nhớ không gợi ý</div>
        </button>

        <button
          onClick={() => onStartPractice('matching')}
          className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl text-left transition-all group"
        >
          <div className="text-xs font-medium text-slate-400">Chế độ 2</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
            <span>Ghép thẻ</span>
            <Play size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Dưới 2.0s / cặp (4 cặp/lượt)</div>
        </button>

        <button
          onClick={() => onStartPractice('writing-zh')}
          className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl text-left transition-all group"
        >
          <div className="text-xs font-medium text-slate-400">Chế độ 3A</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
            <span>Gõ chữ Hán</span>
            <Play size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Nghĩa tiếng Việt $\to$ Gõ Hán</div>
        </button>

        <button
          onClick={() => onStartPractice('writing-vi')}
          className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl text-left transition-all group"
        >
          <div className="text-xs font-medium text-slate-400">Chế độ 3B</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
            <span>Gõ tiếng Việt</span>
            <Play size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Chữ Hán $\to$ Gõ nghĩa</div>
        </button>
      </div>

      {/* ── Vocabulary Data Table (Strict Rule 17) ──────────────────── */}
      <div className="pt-2">
        <DataTable<VocabItem>
          data={vocabList}
          columns={columns}
          pageSize={20}
          searchPlaceholder="Tìm chữ Hán, phiên âm, âm Hán Việt, nghĩa..."
          exportFilename={deck.title.toLowerCase().replace(/\s+/g, '_')}
        />
      </div>

      {/* ── Import Modal ────────────────────────────────────────────── */}
      <ImportModal
        deckId={deck.id}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={onDeckUpdated}
      />

      {/* ── Edit Deck Modal (With merged Delete button per Rule 16) ─── */}
      {showEditDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Chỉnh sửa bộ từ
            </h2>

            <form onSubmit={handleSaveDeck} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tên bộ từ *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cấp độ</label>
                  <select
                    value={editHsk}
                    onChange={(e) => setEditHsk(e.target.value)}
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
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    placeholder="Du lịch, Ẩm thực..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>

              {/* Action Buttons: Save & Red Delete inside Edit Modal per Rule 16 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  Xóa bộ từ
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditDeckModal(false)}
                    className="py-2 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>

            {/* Confirm Delete Sub-overlay */}
            {showDeleteConfirm && (
              <div className="absolute inset-0 bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                <AlertTriangle size={32} className="text-rose-600 mb-2" />
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa bộ từ?</h3>
                <p className="text-xs text-slate-500 mt-1 mb-6 max-w-xs">
                  Thao tác này sẽ xóa toàn bộ {vocabList.length} từ vựng và dữ liệu tiến trình học trong bộ từ này.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDeck}
                    className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm"
                  >
                    Đồng ý xóa
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
