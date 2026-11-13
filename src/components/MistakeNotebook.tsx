'use client';

import React, { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, RotateCcw } from 'lucide-react';
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
        cell: (info) => <span className="font-semibold text-slate-800">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'amHanViet',
        header: 'Hán Việt',
        cell: (info) => <span className="text-slate-700 font-medium">{info.getValue<string>() || '—'}</span>,
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
          <span className="py-1 px-2.5 bg-rose-100 text-rose-700 rounded-lg font-bold text-xs inline-block">
            {info.getValue<number>()} lần
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-slate-200/70 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
        >
          <ArrowLeft size={14} /> Quay lại
        </button>

        <button
          onClick={onStartDrill}
          disabled={leechWords.length === 0}
          className="py-2 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5"
        >
          <RotateCcw size={13} />
          <span>Luyện từ sai ({leechWords.length})</span>
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Từ hay sai</h1>

      <DataTable<VocabItem>
        data={leechWords}
        columns={columns}
        pageSize={20}
        searchPlaceholder="Tìm từ..."
        emptyMessage="Chưa có từ nào bị sai."
        exportFilename="tu_hay_sai"
      />
    </div>
  );
}
