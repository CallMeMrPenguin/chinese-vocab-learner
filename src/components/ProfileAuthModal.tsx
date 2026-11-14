'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  KeyRound,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  ActiveSession,
  getActiveSession,
  changePasswordLoggedIn,
  logoutUser,
} from '@/lib/auth';
import {
  SyncDiagnostics,
  getSyncDiagnostics,
  triggerManualStep2Sync,
  triggerSimulateStep3Beacon,
  db,
} from '@/lib/db';

interface ProfileAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange?: (session: ActiveSession | null) => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return (
      d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      ' ' +
      d.toLocaleDateString('vi-VN')
    );
  } catch {
    return iso;
  }
}

export function ProfileAuthModal({
  isOpen,
  onClose,
  onAuthChange,
}: ProfileAuthModalProps) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin-only 3-Step Sync Diagnostics
  const [diag, setDiag] = useState<SyncDiagnostics | null>(null);
  const [testingStep, setTestingStep] = useState<number | null>(null);
  const [stepTestMessage, setStepTestMessage] = useState<string | null>(null);

  const isAdmin = session?.username === 'admin' || Boolean(session?.isAdmin);

  const refreshDiagnostics = useCallback(async () => {
    const info = await getSyncDiagnostics();
    setDiag(info);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const s = getActiveSession();
      setSession(s);
      setErrorMsg(null);
      setSuccessMsg(null);
      setStepTestMessage(null);
      setShowChangePwd(false);
      if (s?.username === 'admin' || s?.isAdmin) {
        refreshDiagnostics();
      }
    }
  }, [isOpen, refreshDiagnostics]);

  if (!isOpen || !session) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    setIsSubmitting(true);
    try {
      const res = await changePasswordLoggedIn({
        username: session.username,
        currentPassword: currentPwd,
        newPassword: nextPwd,
      });
      if (!res.ok) {
        setErrorMsg(res.error || 'Không thể đổi mật khẩu.');
      } else {
        setCurrentPwd('');
        setNextPwd('');
        setShowChangePwd(false);
        setSuccessMsg('Đã cập nhật mật khẩu.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestStep1 = async () => {
    setTestingStep(1);
    setStepTestMessage(null);
    const firstDeck = await db.decks.toCollection().first();
    if (firstDeck) {
      await db.decks.update(firstDeck.id, { updatedAt: new Date().toISOString() });
    }
    setTimeout(async () => {
      await refreshDiagnostics();
      setTestingStep(null);
      setStepTestMessage('Bước 1 OK (IndexedDB)');
    }, 100);
  };

  const handleTestStep2 = async () => {
    setTestingStep(2);
    setStepTestMessage(null);
    const res = await triggerManualStep2Sync();
    await refreshDiagnostics();
    setTestingStep(null);
    setStepTestMessage(res.cloudEnabled ? 'Bước 2 OK (Cloud D1)' : 'Bước 2 OK (Local Snapshot)');
  };

  const handleTestStep3 = async () => {
    setTestingStep(3);
    setStepTestMessage(null);
    const res = await triggerSimulateStep3Beacon();
    await refreshDiagnostics();
    setTestingStep(null);
    setStepTestMessage(`Bước 3 OK (sendBeacon ${(res.bytes / 1024).toFixed(1)} KB)`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">{session.displayName}</div>
              <div className="text-xs font-semibold text-slate-500">@{session.username}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {!showChangePwd ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowChangePwd(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound size={14} />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logoutUser();
                onClose();
                if (onAuthChange) onAuthChange(null);
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="p-4 rounded-2xl bg-slate-50 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mật khẩu mới
              </label>
              <input
                type="password"
                required
                value={nextPwd}
                onChange={(e) => setNextPwd(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowChangePwd(false)}
                className="py-2 px-3.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        )}

        {/* Admin-Only 3-Step Sync Test Panel */}
        {isAdmin && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Kiểm tra Tự lưu 3 bước (Admin)
              </span>
              <button
                type="button"
                onClick={refreshDiagnostics}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-blue-600 cursor-pointer"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {diag && (
              <div className="p-3 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-between flex-wrap gap-2">
                <span>
                  {diag.foldersCount} thư mục | {diag.decksCount} bộ từ | {diag.vocabCount} từ
                </span>
                <span className="text-blue-600">
                  {diag.cloudD1Enabled ? 'Cloud D1: Đã kết nối' : 'Local IndexedDB'}
                </span>
              </div>
            )}

            {stepTestMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                {stepTestMessage}
              </div>
            )}

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Bước 1: IndexedDB</div>
                  <div className="text-[11px] text-slate-500">
                    {formatTime(diag?.step1LastWriteAt || null)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestStep1}
                  disabled={testingStep === 1}
                  className="py-1.5 px-3 rounded-lg bg-white text-blue-600 text-xs font-bold shadow-2xs cursor-pointer"
                >
                  Test Bước 1
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Bước 2: Batch Sync (/api/sync)</div>
                  <div className="text-[11px] text-slate-500">
                    {formatTime(diag?.step2LastBatchAt || null)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestStep2}
                  disabled={testingStep === 2}
                  className="py-1.5 px-3 rounded-lg bg-white text-blue-600 text-xs font-bold shadow-2xs cursor-pointer"
                >
                  Test Bước 2
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Bước 3: sendBeacon</div>
                  <div className="text-[11px] text-slate-500">
                    {formatTime(diag?.step3LastBeaconAt || null)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestStep3}
                  disabled={testingStep === 3}
                  className="py-1.5 px-3 rounded-lg bg-white text-blue-600 text-xs font-bold shadow-2xs cursor-pointer"
                >
                  Test Bước 3
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
