'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { VocabItem } from '@/lib/types';
import { db, refreshDeckStats } from '@/lib/db';

interface EditVocabModalProps {
  vocab: VocabItem | null;
  vocabOptions?: VocabItem[]; // When in Matching mode (4 words on screen), allows choosing which word on screen to edit
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: VocabItem) => void;
  onDeleted?: (deletedId: string) => void;
}

export function EditVocabModal({
  vocab,
  vocabOptions,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: EditVocabModalProps) {
  const [selectedVocabId, setSelectedVocabId] = useState<string>('');
  const [hanzi, setHanzi] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [amHanViet, setAmHanViet] = useState('');
  const [pos, setPos] = useState('');
  const [meaningVi, setMeaningVi] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeTarget =
    vocabOptions && vocabOptions.length > 0
      ? vocabOptions.find((w) => w.id === selectedVocabId) || vocabOptions[0]
      : vocab;

  useEffect(() => {
    if (vocabOptions && vocabOptions.length > 0) {
      setSelectedVocabId(vocab?.id || vocabOptions[0].id);
    }
  }, [vocab?.id, vocabOptions, isOpen]);

  useEffect(() => {
    if (activeTarget) {
      setHanzi(activeTarget.hanzi || '');
      setPinyin(activeTarget.pinyin || '');
      setAmHanViet(activeTarget.amHanViet || '');
      setPos(activeTarget.pos || '');
      setMeaningVi(activeTarget.meaningVi || '');
      setShowDeleteConfirm(false);
    }
  }, [activeTarget?.id, isOpen]);

  if (!isOpen || !activeTarget) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hanzi.trim() || !meaningVi.trim()) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const updatedItem: VocabItem = {
        ...activeTarget,
        hanzi: hanzi.trim(),
        pinyin: pinyin.trim(),
        amHanViet: amHanViet.trim(),
        pos: pos.trim(),
        meaningVi: meaningVi.trim(),
        charCount: hanzi.trim().length,
        updatedAt: now,
      };

      await db.vocab.put(updatedItem);
      await refreshDeckStats(activeTarget.deckId);
      onSaved(updatedItem);
      onClose();
    } catch (err) {
      console.error('Failed to update vocab:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await db.vocab.delete(activeTarget.id);
      await refreshDeckStats(activeTarget.deckId);
      if (onDeleted) onDeleted(activeTarget.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete vocab:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa từ vựng</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selector when editing during Matching Mode (multiple cards on board) */}
        {vocabOptions && vocabOptions.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Chọn từ trên bàn
            </label>
            <div className="flex flex-wrap gap-1.5">
              {vocabOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedVocabId(item.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTarget.id === item.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.hanzi}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Chữ Hán</label>
              <input
                type="text"
                required
                value={hanzi}
                onChange={(e) => setHanzi(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phiên âm</label>
              <input
                type="text"
                value={pinyin}
                onChange={(e) => setPinyin(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Hán Việt</label>
              <input
                type="text"
                value={amHanViet}
                onChange={(e) => setAmHanViet(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Từ loại</label>
              <input
                type="text"
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                placeholder="Danh từ, Động từ..."
                className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nghĩa tiếng Việt
            </label>
            <textarea
              rows={3}
              required
              value={meaningVi}
              onChange={(e) => setMeaningVi(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            {onDeleted ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2 px-3.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
              >
                Xóa từ
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving || !hanzi.trim() || !meaningVi.trim()}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle size={32} className="text-rose-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-2">
              Xóa từ &ldquo;{activeTarget.hanzi}&rdquo;?
            </h3>
            <div className="flex items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 px-5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
