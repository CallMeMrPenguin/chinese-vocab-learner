'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ColumnOrderState,
  RowSelectionState,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  X,
  GripVertical,
} from 'lucide-react';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: React.ReactNode;
  pageSize?: number;
  showPagination?: boolean;
  enableGlobalSearch?: boolean;
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  enableColumnResizing?: boolean;
  enableColumnReorder?: boolean;
  enableExport?: boolean;
  searchPlaceholder?: string;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  exportFilename?: string;
  onRowClick?: (row: TData) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
}

// ── Draggable Header Component ──────────────────────────────────────────
function DraggableHeader({
  header,
  table,
  activeFilterCol,
  setActiveFilterCol,
}: {
  header: any;
  table: any;
  activeFilterCol: string | null;
  setActiveFilterCol: (id: string | null) => void;
}) {
  const { attributes, listeners, transform, transition, isDragging } = useSortable({
    id: header.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    width: header.getSize(),
  };

  const isSorted = header.column.getIsSorted();
  const isFiltered = header.column.getIsFiltered();

  return (
    <th
      ref={header.column.columnDef.enableColumnReorder !== false ? undefined : undefined}
      style={style}
      className="py-3 px-4 text-left font-medium text-xs text-slate-500 uppercase tracking-wider bg-slate-50 select-none group"
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {table.options.enableColumnReorder && (
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-300 hover:text-slate-600 transition-colors"
            >
              <GripVertical size={13} />
            </span>
          )}
          <span
            className="truncate cursor-pointer hover:text-slate-900 transition-colors"
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {isSorted === 'asc' && <ArrowUp size={13} className="text-blue-600" />}
          {isSorted === 'desc' && <ArrowDown size={13} className="text-blue-600" />}
        </div>

        {/* Column Filter Popover Trigger */}
        {header.column.getCanFilter() && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveFilterCol(activeFilterCol === header.id ? null : header.id);
            }}
            className={`p-1 rounded-md transition-colors ${
              isFiltered
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter size={12} />
          </button>
        )}
      </div>

      {/* Resize Handle */}
      {table.options.enableColumnResizing && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-400 ${
            header.column.getIsResizing() ? 'bg-blue-600 w-2' : ''
          }`}
        />
      )}
    </th>
  );
}

// ── Column Filter Popover ───────────────────────────────────────────────
function ColumnFilterPopover({
  column,
  table,
  onClose,
}: {
  column: any;
  table: any;
  onClose: () => void;
}) {
  const [filterSearch, setFilterSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Extract unique column values
  const uniqueValues = useMemo(() => {
    const values = new Set<string>();
    const rows = table.getPreFilteredRowModel().rows;
    for (const r of rows) {
      const v = r.getValue(column.id);
      if (v !== undefined && v !== null && v !== '') {
        values.add(String(v));
      }
    }
    return Array.from(values).sort();
  }, [table, column.id]);

  const filteredValues = useMemo(() => {
    if (!filterSearch.trim()) return uniqueValues;
    const q = filterSearch.toLowerCase().trim();
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, filterSearch]);

  const currentFilterValue = (column.getFilterValue() as string[]) || [];

  const handleToggleValue = (val: string) => {
    let next: string[];
    if (currentFilterValue.includes(val)) {
      next = currentFilterValue.filter((v) => v !== val);
    } else {
      next = [...currentFilterValue, val];
    }
    column.setFilterValue(next.length > 0 ? next : undefined);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-12 left-0 z-50 w-64 bg-white rounded-xl shadow-xl p-3 border-0 text-slate-800"
      style={{ boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-700">
          Lọc: {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
        >
          <X size={14} />
        </button>
      </div>

      {/* Sort Buttons */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={() => {
            column.toggleSorting(false);
            onClose();
          }}
          className="py-1 px-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1 transition-colors"
        >
          <ArrowUp size={12} /> A-Z
        </button>
        <button
          type="button"
          onClick={() => {
            column.toggleSorting(true);
            onClose();
          }}
          className="py-1 px-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1 transition-colors"
        >
          <ArrowDown size={12} /> Z-A
        </button>
      </div>

      {/* Search in values */}
      <div className="relative mb-2">
        <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Tìm giá trị..."
          className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Value Checkbox List */}
      <div className="max-h-40 overflow-y-auto space-y-1 mb-2.5 pr-1">
        {filteredValues.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-2">Không có giá trị</div>
        ) : (
          filteredValues.map((val) => {
            const isChecked = currentFilterValue.includes(val);
            return (
              <label
                key={val}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleValue(val)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="truncate">{val}</span>
              </label>
            );
          })
        )}
      </div>

      {/* Reset Filter Button */}
      {currentFilterValue.length > 0 && (
        <button
          type="button"
          onClick={() => {
            column.setFilterValue(undefined);
            onClose();
          }}
          className="w-full py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium"
        >
          Xóa bộ lọc cột
        </button>
      )}
    </div>
  );
}

// ── Main DataTable Component ────────────────────────────────────────────
export function DataTable<TData>({
  data,
  columns,
  loading = false,
  loadingMessage = 'Đang tải dữ liệu...',
  emptyMessage = 'Không có dữ liệu',
  pageSize = 20, // Mandatory Strict 20 Rows / Page
  showPagination = true,
  enableGlobalSearch = true,
  enableColumnVisibility = true,
  enableRowSelection = false,
  enableColumnResizing = true,
  enableColumnReorder = true,
  enableExport = true,
  searchPlaceholder = 'Tìm kiếm từ vựng, phiên âm...',
  toolbarLeft,
  toolbarRight,
  exportFilename = 'vocab_export',
  onRowClick,
  onSelectionChange,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    columns.map((c) => (c.id ? c.id : (c as any).accessorKey))
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  }

  // TanStack Table Instance
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 20, // STRICT 20 ROWS PER PAGE (RULE 2)
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing,
    columnResizeMode: 'onChange',
  });

  // Notify selection change
  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, table, onSelectionChange]);

  // Excel Export Handler
  const handleExportExcel = () => {
    const visibleRows = table.getFilteredRowModel().rows.map((r) => r.original);
    const worksheet = XLSX.utils.json_to_sheet(visibleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vocab');
    XLSX.writeFile(workbook, `${exportFilename}.xlsx`);
    setShowExportMenu(false);
  };

  // PDF Export Handler
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const visibleCols = table.getVisibleLeafColumns().filter((c) => c.id !== 'actions' && c.id !== 'select');
    const headers = visibleCols.map((c) =>
      typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id
    );
    const rows = table.getFilteredRowModel().rows.map((r) =>
      visibleCols.map((c) => String(r.getValue(c.id) ?? ''))
    );
    (doc as any).autoTable({
      head: [headers],
      body: rows,
    });
    doc.save(`${exportFilename}.pdf`);
    setShowExportMenu(false);
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left Toolbar Slots & Global Search */}
        <div className="flex items-center gap-2.5 flex-1">
          {toolbarLeft}

          {enableGlobalSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 rounded-xl transition-all focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Toolbar Slots: Column Visibility & Export */}
        <div className="flex items-center gap-2 justify-end">
          {toolbarRight}

          {/* Column Visibility Dropdown */}
          {enableColumnVisibility && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColPicker(!showColPicker)}
                className="py-2 px-3 text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Eye size={13} className="text-slate-400" />
                <span>Cột</span>
              </button>

              {showColPicker && (
                <div
                  className="absolute right-0 top-11 z-50 w-48 bg-white rounded-xl shadow-xl p-2.5 text-slate-800"
                  style={{ boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                >
                  <div className="text-xs font-semibold text-slate-700 pb-1.5 mb-1.5 border-b border-slate-100">
                    Hiển thị cột
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {table.getAllLeafColumns().map((column) => {
                      if (column.id === 'actions' || column.id === 'select') return null;
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                            className="rounded text-blue-600 focus:ring-0"
                          />
                          <span className="truncate">
                            {typeof column.columnDef.header === 'string'
                              ? column.columnDef.header
                              : column.id}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export Dropdown */}
          {enableExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="py-2 px-3 text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Download size={13} className="text-slate-400" />
                <span>Xuất file</span>
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-11 z-50 w-36 bg-white rounded-xl shadow-xl p-1.5 text-slate-800"
                  style={{ boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                >
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full text-left py-1.5 px-2.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Xuất Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full text-left py-1.5 px-2.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Xuất PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Table Container ───────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto rounded-2xl bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <React.Fragment key={header.id}>
                        <DraggableHeader
                          header={header}
                          table={table}
                          activeFilterCol={activeFilterCol}
                          setActiveFilterCol={setActiveFilterCol}
                        />
                      </React.Fragment>
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-xs text-slate-400">
                    {loadingMessage}
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-xs text-slate-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={`transition-colors duration-150 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/60`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3 px-4 text-xs text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* Active Column Filter Dropdown Position Anchor */}
      {activeFilterCol && (
        <ColumnFilterPopover
          column={table.getColumn(activeFilterCol)}
          table={table}
          onClose={() => setActiveFilterCol(null)}
        />
      )}

      {/* ── Strict 20 Rows / Page Pagination ─────────────────────────── */}
      {showPagination && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
          <div>
            Hiển thị{' '}
            <span className="font-semibold text-slate-800">
              {table.getRowModel().rows.length > 0
                ? table.getState().pagination.pageIndex * 20 + 1
                : 0}
            </span>{' '}
            đến{' '}
            <span className="font-semibold text-slate-800">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * 20,
                table.getFilteredRowModel().rows.length
              )}
            </span>{' '}
            trong <span className="font-semibold text-slate-800">{table.getFilteredRowModel().rows.length}</span> từ
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-700 font-medium transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              <span>Trước</span>
            </button>

            <span className="px-3 py-1.5 font-medium text-slate-700">
              Trang {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>

            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-700 font-medium transition-colors flex items-center gap-1"
            >
              <span>Sau</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

