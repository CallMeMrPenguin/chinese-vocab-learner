'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db } from '@/lib/db';
import { VocabItem } from '@/lib/types';

interface ImportModalProps {
  deckId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ deckId, isOpen, onClose, onSuccess }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'paste'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [manualHanzi, setManualHanzi] = useState('');
  const [manualPinyin, setManualPinyin] = useState('');
  const [manualAmHanViet, setManualAmHanViet] = useState('');
  const [manualMeaning, setManualMeaning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePasteImport = async () => {
    if (!pasteContent.trim()) return;
    setIsSubmitting(true);

    try {
      const lines = pasteContent.split('\n');
      const newItems: VocabItem[] = [];
      const timestamp = new Date().toISOString();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let parts = line.split(/\t| - |: |;| -/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 1 && line.includes('-')) {
          parts = line.split('-').map(s => s.trim());
        }

        const hanzi = parts[0] || '';
        if (!hanzi) continue;

        let pinyin = '';
        let amHanViet = '';
        let meaning = '';

        if (parts.length >= 4) {
          pinyin = parts[1];
          amHanViet = parts[2];
          meaning = parts.slice(3).join('; ');
        } else if (parts.length === 3) {
          pinyin = parts[1];
          meaning = parts[2];
        } else if (parts.length === 2) {
          meaning = parts[1];
        } else {
          meaning = parts[0];
        }

        newItems.push({
          id: `custom_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          deckId,
          hanzi,
          pinyin,
          amHanViet,
          meaningVi: meaning,
          charCount: hanzi.length,
          flashcardStep: 0,
          matchingStep: 0,
          writingZhStep: 0,
          writingViStep: 0,
          stability: 1.0,
          lapseCount: 0,
          isLeech: false,
          isMastered: false,
          updatedAt: timestamp,
        });
      }

      if (newItems.length > 0) {
        await db.vocab.bulkAdd(newItems);
        const total = await db.vocab.where('deckId').equals(deckId).count();
        await db.decks.update(deckId, { totalWords: total, updatedAt: timestamp });
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHanzi.trim() || !manualMeaning.trim()) return;
    setIsSubmitting(true);

    try {
      const timestamp = new Date().toISOString();
      const newItem: VocabItem = {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        deckId,
        hanzi: manualHanzi.trim(),
        pinyin: manualPinyin.trim(),
        amHanViet: manualAmHanViet.trim(),
        meaningVi: manualMeaning.trim(),
        charCount: manualHanzi.trim().length,
        flashcardStep: 0,
        matchingStep: 0,
        writingZhStep: 0,
        writingViStep: 0,
        stability: 1.0,
        lapseCount: 0,
        isLeech: false,
        isMastered: false,
        updatedAt: timestamp,
      };

      await db.vocab.add(newItem);
      const total = await db.vocab.where('deckId').equals(deckId).count();
      await db.decks.update(deckId, { totalWords: total, updatedAt: timestamp });

      setManualHanzi('');
      setManualPinyin('');
      setManualAmHanViet('');
      setManualMeaning('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Add failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-lg font-bold text-slate-900">Thêm từ vựng</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dán danh sách
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'manual' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhập từng từ
          </button>
        </div>

        {activeTab === 'paste' ? (
          <div>
            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="学习 - xuéxí - Học tập - học tập&#10;准备 - zhǔnbèi - Chuẩn bị - chuẩn bị"
              className="w-full p-3.5 bg-slate-100 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono resize-none leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePasteImport}
                disabled={isSubmitting || !pasteContent.trim()}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded-xl text-xs font-semibold text-white transition-all shadow-xs"
              >
                {isSubmitting ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chữ Hán</label>
              <input
                type="text"
                required
                value={manualHanzi}
                onChange={(e) => setManualHanzi(e.target.value)}
                placeholder="学习"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phiên âm</label>
                <input
                  type="text"
                  value={manualPinyin}
                  onChange={(e) => setManualPinyin(e.target.value)}
                  placeholder="xuéxí"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hán Việt</label>
                <input
                  type="text"
                  value={manualAmHanViet}
                  onChange={(e) => setManualAmHanViet(e.target.value)}
                  placeholder="Học Tập"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nghĩa tiếng Việt</label>
              <input
                type="text"
                required
                value={manualMeaning}
                onChange={(e) => setManualMeaning(e.target.value)}
                placeholder="Học tập, nghiên cứu"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !manualHanzi.trim() || !manualMeaning.trim()}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded-xl text-xs font-semibold text-white transition-all shadow-xs"
              >
                {isSubmitting ? 'Đang lưu...' : 'Thêm từ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
