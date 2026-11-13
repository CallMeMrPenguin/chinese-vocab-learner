'use client';

import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
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

        // Supported formats:
        // 1. "学习 - xuéxí - Học tập - học tập"
        // 2. "学习 - học tập" (tab, colon or dash)
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
        // Update deck count
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
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nhập từ vựng</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Tự động phân tách từ chữ Hán và nghĩa tiếng Việt
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feature 1 Label Note */}
        <div className="flex items-center gap-2 p-2.5 my-3 bg-slate-50 rounded-xl text-xs text-slate-600">
          <AlertCircle size={14} className="text-blue-600 shrink-0" />
          <span>
            Tính năng tra từ tự động đang phát triển. Hiện tại hỗ trợ dán danh sách hoặc nhập trực tiếp.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Dán danh sách
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Nhập từng từ
          </button>
        </div>

        {/* Tab 1: Paste Input */}
        {activeTab === 'paste' ? (
          <div>
            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Dán từ vựng theo dạng:
学习 - xuéxí - Học tập - học tập
准备 - zhǔnbèi - Chuẩn bị - chuẩn bị
hoặc:
学习 - học tập
准备 - chuẩn bị"
              className="w-full p-3.5 bg-slate-50 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 font-mono resize-none leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePasteImport}
                disabled={isSubmitting || !pasteContent.trim()}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded-xl text-xs font-semibold text-white transition-all shadow-sm"
              >
                {isSubmitting ? 'Đang thêm...' : 'Xác nhận nhập'}
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: Manual Input */
          <form onSubmit={handleManualAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Chữ Hán *</label>
              <input
                type="text"
                required
                value={manualHanzi}
                onChange={(e) => setManualHanzi(e.target.value)}
                placeholder="Ví dụ: 学习"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Phiên âm (Pinyin)</label>
                <input
                  type="text"
                  value={manualPinyin}
                  onChange={(e) => setManualPinyin(e.target.value)}
                  placeholder="xuéxí"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Âm Hán Việt</label>
                <input
                  type="text"
                  value={manualAmHanViet}
                  onChange={(e) => setManualAmHanViet(e.target.value)}
                  placeholder="Học tập"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nghĩa tiếng Việt *</label>
              <input
                type="text"
                required
                value={manualMeaning}
                onChange={(e) => setManualMeaning(e.target.value)}
                placeholder="Học tập, nghiên cứu (có thể ngăn cách dấu phẩy)"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !manualHanzi.trim() || !manualMeaning.trim()}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded-xl text-xs font-semibold text-white transition-all shadow-sm"
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

