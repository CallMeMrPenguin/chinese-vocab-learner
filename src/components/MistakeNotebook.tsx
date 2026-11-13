'use client';

import React, { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { VocabItem } from '@/lib/types';
import { DataTable } from '@/components/DataTable';

interface MistakeNotebookProps {
  leechWords: VocabItem[];
  onBack: () => void;
  onStartDrill: () => void;
}

export function MistakeNotebook({ leechWords, onBack, onStartDrill }: MistakeNotebookProps) {
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
        accessorKey: 'meaningVi',
        header: 'Nghĩa tiếng Việt',
        cell: (info) => <span className="text-slate-800 line-clamp-2">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'lapseCount',
        header: 'Số lần sai',
        cell: (info) => (
          <span className="py-1 px-2.5 bg-rose-50 text-rose-600 rounded-full font-semibold text-xs inline-block">
            {info.getValue<number>()} lần
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between pb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
        >
          <ArrowLeft size={13} /> Quay lại
        </button>

        <button
          onClick={onStartDrill}
          disabled={leechWords.length === 0}
          className="py-2 px-5 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
        >
          <RotateCcw size={13} />
          <span>Luyện riêng từ hay sai ({leechWords.length})</span>
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sổ tay từ hay sai</h1>
        <div className="text-xs text-slate-400 mt-1">
          Tập hợp các từ bị làm sai từ 2 lần trở lên hoặc chưa vượt qua bài kiểm tra.
        </div>
      </div>

      <DataTable<VocabItem>
        data={leechWords}
        columns={columns}
        pageSize={20}
        searchPlaceholder="Tìm từ hay sai..."
        emptyMessage="Không có từ nào trong sổ tay từ hay sai."
        exportFilename="so_tay_tu_hay_sai"
      />
    </div>
  );
}

