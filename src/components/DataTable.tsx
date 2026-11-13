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

// ── Column Filter Popover (Anchored directly inside <th>) ───────────────
function ColumnFilterPopover({
  column,
  table,
  alignRight,
  onClose,
}: {
  column: any;
  table: any;
  alignRight?: boolean;
  onClose: () => void;
}) {
  const [filterSearch, setFilterSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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
      onClick={(e) => e.stopPropagation()}
      className={`filter-dropdown-menu absolute top-full mt-1.5 ${
        alignRight ? 'right-0' : 'left-0'
      } z-50 w-64 bg-white rounded-2xl p-3.5 text-slate-900 font-normal normal-case tracking-normal shadow-2xl`}
      style={{ boxShadow: '0 16px 36px -6px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08)' }}
    >
      <div className="flex items-center justify-between pb-2.5 mb-2.5">
        <span className="text-xs font-bold text-slate-900">
          Lọc: {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
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
          className="py-1.5 px-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <ArrowUp size={12} /> A-Z
        </button>
        <button
          type="button"
          onClick={() => {
            column.toggleSorting(true);
            onClose();
          }}
          className="py-1.5 px-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <ArrowDown size={12} /> Z-A
        </button>
      </div>

      {/* Search in values */}
      <div className="relative mb-2.5">
        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Tìm giá trị..."
          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-100 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-slate-200/70"
        />
      </div>

      {/* Value Checkbox List */}
      <div className="max-h-44 overflow-y-auto space-y-1 mb-2 pr-1">
        {filteredValues.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-3">Không có kết quả</div>
        ) : (
          filteredValues.map((val) => {
            const isChecked = currentFilterValue.includes(val);
            return (
              <label
                key={val}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-xs text-slate-800"
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

      {currentFilterValue.length > 0 && (
        <button
          type="button"
          onClick={() => {
            column.setFilterValue(undefined);
            onClose();
          }}
          className="w-full py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors font-semibold cursor-pointer"
        >
          Xóa bộ lọc cột
        </button>
      )}
    </div>
  );
}

// ── Draggable Header Component ──────────────────────────────────────────
function DraggableHeader({
  header,
  table,
  colIndex,
  totalCols,
  activeFilterCol,
  setActiveFilterCol,
}: {
  header: any;
  table: any;
  colIndex: number;
  totalCols: number;
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
  const isFilterOpen = activeFilterCol === header.id;

  return (
    <th
      style={style}
      className="py-3.5 px-4 text-left font-bold text-xs text-slate-700 uppercase tracking-wider bg-slate-200/75 select-none group first:rounded-tl-2xl last:rounded-tr-2xl"
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {table.options.enableColumnReorder && (
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-400 hover:text-slate-700 transition-colors"
            >
              <GripVertical size={13} />
            </span>
          )}
          <span
            className="truncate cursor-pointer hover:text-slate-950 transition-colors"
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {isSorted === 'asc' && <ArrowUp size={13} className="text-blue-600 shrink-0" />}
          {isSorted === 'desc' && <ArrowDown size={13} className="text-blue-600 shrink-0" />}
        </div>

        {header.column.getCanFilter() && (
          <button
            type="button"
            title="Lọc cột"
            onClick={(e) => {
              e.stopPropagation();
              setActiveFilterCol(isFilterOpen ? null : header.id);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isFiltered || isFilterOpen
                ? 'text-blue-600 bg-blue-100'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-300/70'
            }`}
          >
            <Filter size={12} />
          </button>
        )}
      </div>

      {/* Filter Popover anchored right inside this <th> */}
      {isFilterOpen && (
        <ColumnFilterPopover
          column={header.column}
          table={table}
          alignRight={colIndex >= totalCols - 2}
          onClose={() => setActiveFilterCol(null)}
        />
      )}

      {table.options.enableColumnResizing && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-500 ${
            header.column.getIsResizing() ? 'bg-blue-600 w-2' : ''
          }`}
        />
      )}
    </th>
  );
}

// ── Main DataTable Component ────────────────────────────────────────────
export function DataTable<TData>({
  data,
  columns,
  loading = false,
  loadingMessage = 'Đang tải...',
  emptyMessage = 'Không có dữ liệu',
  pageSize = 20,
  showPagination = true,
  enableGlobalSearch = true,
  enableColumnVisibility = true,
  enableRowSelection = false,
  enableColumnResizing = true,
  enableColumnReorder = true,
  enableExport = true,
  searchPlaceholder = 'Tìm kiếm...',
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

  // Custom multi-select array filter function for column checkbox filters
  const defaultColumn = useMemo(
    () => ({
      filterFn: (row: any, columnId: string, filterValue: any) => {
        if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) return true;
        const rowVal = String(row.getValue(columnId) ?? '');
        return filterValue.includes(rowVal);
      },
    }),
    []
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn,
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
        pageSize: 20,
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

  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, table, onSelectionChange]);

  const handleExportExcel = () => {
    const visibleRows = table.getFilteredRowModel().rows.map((r) => r.original);
    const worksheet = XLSX.utils.json_to_sheet(visibleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vocab');
    XLSX.writeFile(workbook, `${exportFilename}.xlsx`);
    setShowExportMenu(false);
  };

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
    <div className="w-full flex flex-col space-y-3">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          {toolbarLeft}

          {enableGlobalSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-white hover:bg-slate-50 focus:bg-white text-slate-900 rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {toolbarRight}

          {enableColumnVisibility && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowColPicker(!showColPicker);
                  setShowExportMenu(false);
                }}
                className="py-2 px-3.5 text-xs font-semibold bg-white hover:bg-slate-200/70 text-slate-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye size={14} className="text-slate-600" />
                <span>Cột</span>
              </button>

              {showColPicker && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-white rounded-2xl shadow-2xl p-3 text-slate-800"
                  style={{ boxShadow: '0 16px 36px -6px rgba(15, 23, 42, 0.18)' }}
                >
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {table.getAllLeafColumns().map((column) => {
                      if (column.id === 'actions' || column.id === 'select') return null;
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer"
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

          {enableExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(!showExportMenu);
                  setShowColPicker(false);
                }}
                className="py-2 px-3.5 text-xs font-semibold bg-white hover:bg-slate-200/70 text-slate-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={14} className="text-slate-600" />
                <span>Xuất file</span>
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-white rounded-2xl shadow-2xl p-1.5 text-slate-800"
                  style={{ boxShadow: '0 16px 36px -6px rgba(15, 23, 42, 0.18)' }}
                >
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full text-left py-2 px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full text-left py-2 px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Table Container ───────────────────────────────────────────── */}
      <div className="w-full bg-white rounded-2xl shadow-xs overflow-visible">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header, idx) => (
                      <DraggableHeader
                        key={header.id}
                        header={header}
                        table={table}
                        colIndex={idx}
                        totalCols={headerGroup.headers.length}
                        activeFilterCol={activeFilterCol}
                        setActiveFilterCol={setActiveFilterCol}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-xs text-slate-500">
                    {loadingMessage}
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-xs text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={`transition-colors duration-100 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100/70'} hover:bg-blue-50/60`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3.5 px-4 text-xs text-slate-800">
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

      {/* ── Strict 20 Rows / Page Pagination ─────────────────────────── */}
      {showPagination && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-900">
              {table.getRowModel().rows.length > 0
                ? table.getState().pagination.pageIndex * 20 + 1
                : 0}
              –
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * 20,
                table.getFilteredRowModel().rows.length
              )}
            </span>{' '}
            / <span className="font-bold text-slate-900">{table.getFilteredRowModel().rows.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="py-2 px-3.5 bg-white hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none rounded-xl shadow-xs text-slate-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            <span className="px-3 py-1.5 font-bold text-slate-800">
              Trang {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>

            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="py-2 px-3.5 bg-white hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none rounded-xl shadow-xs text-slate-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
