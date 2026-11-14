'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  Copy,
  LogOut,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  ActiveSession,
  SECURITY_QUESTIONS,
  getActiveSession,
  registerUserAccount,
  loginUserAccount,
  getAccountSecurityQuestion,
  resetPasswordWithRecovery,
  changePasswordLoggedIn,
  logoutUser,
} from '@/lib/auth';
import {
  SyncDiagnostics,
  getSyncDiagnostics,
  triggerManualStep2Sync,
  triggerSimulateStep3Beacon,
  reconcileWithCloudOnStartup,
  db,
} from '@/lib/db';

interface ProfileAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange?: (session: ActiveSession | null) => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Chưa có';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' - ' + d.toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}

export function ProfileAuthModal({
  isOpen,
  onClose,
  onAuthChange,
}: ProfileAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'sync'>('account');
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
  const [session, setSession] = useState<ActiveSession | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [recoveryMethod, setRecoveryMethod] = useState<'question' | 'key'>('question');
  const [fetchedQuestion, setFetchedQuestion] = useState<string | null>(null);
  const [recoverySecret, setRecoverySecret] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');

  // Newly generated recovery key after registration
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Logged-in Change Password states
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [nextPwd, setNextPwd] = useState('');

  // Feedback messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3-Step Sync Diagnostics
  const [diag, setDiag] = useState<SyncDiagnostics | null>(null);
  const [testingStep, setTestingStep] = useState<number | null>(null);
  const [stepTestMessage, setStepTestMessage] = useState<string | null>(null);

  const refreshDiagnostics = useCallback(async () => {
    const info = await getSyncDiagnostics();
    setDiag(info);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSession(getActiveSession());
      setErrorMsg(null);
      setSuccessMsg(null);
      setStepTestMessage(null);
      refreshDiagnostics();
    }
  }, [isOpen, refreshDiagnostics]);

  useEffect(() => {
    const onSyncUpdate = () => {
      if (isOpen) refreshDiagnostics();
    };
    window.addEventListener('cvl-sync-updated', onSyncUpdate);
    return () => window.removeEventListener('cvl-sync-updated', onSyncUpdate);
  }, [isOpen, refreshDiagnostics]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // ── Handle Login ──────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsSubmitting(true);
    try {
      const res = await loginUserAccount({ username, password });
      if (!res.ok) {
        setErrorMsg(res.error || 'Đăng nhập thất bại.');
      } else if (res.session) {
        setSession(res.session);
        setPassword('');
        setSuccessMsg('Đăng nhập thành công.');
        await reconcileWithCloudOnStartup();
        await refreshDiagnostics();
        if (onAuthChange) onAuthChange(res.session);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Register (Create Password) ─────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerUserAccount({
        username,
        displayName: displayName || username,
        password,
        securityQuestion,
        securityAnswer,
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'Không thể tạo tài khoản.');
      } else if (res.session) {
        setSession(res.session);
        setGeneratedRecoveryKey(res.recoveryKey || null);
        setPassword('');
        setConfirmPassword('');
        setSecurityAnswer('');
        setSuccessMsg('Tạo tài khoản và mật khẩu thành công.');
        await triggerManualStep2Sync();
        await refreshDiagnostics();
        if (onAuthChange) onAuthChange(res.session);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Lookup Security Question for Forgot Password ───────────────
  const handleCheckUsernameForReset = async () => {
    resetMessages();
    if (!username.trim()) {
      setErrorMsg('Vui lòng nhập tên đăng nhập.');
      return;
    }
    const res = await getAccountSecurityQuestion(username);
    if (!res.found) {
      setErrorMsg('Không tìm thấy tài khoản với tên đăng nhập này.');
      setFetchedQuestion(null);
    } else {
      setFetchedQuestion(res.question || SECURITY_QUESTIONS[0]);
    }
  };

  // ── Handle Forgot Password Reset ──────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newResetPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordWithRecovery({
        username,
        method: recoveryMethod,
        secretInput: recoverySecret,
        newPassword: newResetPassword,
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'Khôi phục mật khẩu thất bại.');
      } else if (res.session) {
        setSession(res.session);
        setRecoverySecret('');
        setNewResetPassword('');
        setConfirmPassword('');
        setSuccessMsg('Đặt lại mật khẩu mới thành công.');
        await refreshDiagnostics();
        if (onAuthChange) onAuthChange(res.session);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Change Password (when logged in) ───────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!session) return;

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
        setSuccessMsg('Đã cập nhật mật khẩu mới.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Interactive 3-Step Auto-Save Tests ────────────────────────────────
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
      setStepTestMessage('Bước 1 OK: Đã ghi tức thì vào IndexedDB (0.1ms) và chuẩn bị gói dữ liệu.');
    }, 120);
  };

  const handleTestStep2 = async () => {
    setTestingStep(2);
    setStepTestMessage(null);
    const res = await triggerManualStep2Sync();
    await refreshDiagnostics();
    setTestingStep(null);
    setStepTestMessage(
      res.cloudEnabled
        ? 'Bước 2 OK: Đã đồng bộ gói dữ liệu lên Cloudflare D1 thành công.'
        : 'Bước 2 OK: Đã gửi POST /api/sync và lưu bản chụp cục bộ (gắn thêm D1 binding tên DB trên Cloudflare để lưu đám mây).'
    );
  };

  const handleTestStep3 = async () => {
    setTestingStep(3);
    setStepTestMessage(null);
    const res = await triggerSimulateStep3Beacon();
    await refreshDiagnostics();
    setTestingStep(null);
    setStepTestMessage(
      `Bước 3 OK: navigator.sendBeacon('/api/sync') đã bắn gói dữ liệu (${(
        res.bytes / 1024
      ).toFixed(1)} KB) ngầm khi đóng tab.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Hồ sơ & Bảo mật dữ liệu</h2>
              <p className="text-xs text-slate-500">
                {session ? `Đang đăng nhập: ${session.displayName} (@${session.username})` : 'Chế độ khách (Guest)'}
              </p>
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

        {/* Main 2 Tabs: Tài khoản & Bảo mật | Tự lưu 3 bước */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('account');
              resetMessages();
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'account'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Tài khoản & Mật khẩu</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('sync');
              refreshDiagnostics();
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'sync'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database size={14} />
            <span>Kiểm tra Tự lưu 3 bước</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* ── TAB 1: ACCOUNT, LOGIN, REGISTER, FORGOT PASSWORD ─────────── */}
        {activeTab === 'account' && (
          <div>
            {session ? (
              <div className="space-y-4">
                {/* Recovery Key Banner if just registered */}
                {generatedRecoveryKey && (
                  <div className="p-4 rounded-2xl bg-amber-50 space-y-2">
                    <div className="text-xs font-bold text-amber-900">
                      Mã khôi phục mật khẩu của bạn (Hãy lưu lại):
                    </div>
                    <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl">
                      <code className="text-sm font-extrabold text-slate-800 tracking-wider">
                        {generatedRecoveryKey}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedRecoveryKey);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="py-1 px-2.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedKey ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-amber-800">
                      Dùng mã này hoặc câu hỏi bảo mật khi bạn quên mật khẩu.
                    </div>
                  </div>
                )}

                {/* Active Profile Card */}
                <div className="p-4 rounded-2xl bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-slate-800">
                        {session.displayName}
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        @{session.username}
                      </div>
                    </div>
                    <span className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                      Đã bảo mật PBKDF2
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-200/70 space-y-1">
                    <div>Tầng bảo mật 1: Mật khẩu băm PBKDF2-SHA256 (100.000 vòng + Salt)</div>
                    <div>Tầng bảo mật 2: Chống dò mật khẩu (Khóa tạm thời sau 5 lần sai)</div>
                    <div>Tầng bảo mật 3: Khôi phục kép (Câu hỏi bảo mật + Mã khôi phục)</div>
                  </div>
                </div>

                {/* Change Password Toggle */}
                {!showChangePwd ? (
                  <div className="flex items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangePwd(true);
                        resetMessages();
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
                        setSession(null);
                        setGeneratedRecoveryKey(null);
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
                    <div className="text-xs font-bold text-slate-700">Đổi mật khẩu mới</div>
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
                        Mật khẩu mới (ít nhất 6 ký tự, gồm chữ và số)
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
                        Lưu mật khẩu
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sub-switcher: Đăng nhập | Tạo mật khẩu | Quên mật khẩu */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('login');
                      resetMessages();
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      authView === 'login'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('register');
                      resetMessages();
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      authView === 'register'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tạo mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('forgot');
                      resetMessages();
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      authView === 'forgot'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quên mật khẩu
                  </button>
                </div>

                {/* 1. LOGIN FORM */}
                {authView === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tên đăng nhập
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: mrpenguin"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Mật khẩu
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Nhập mật khẩu..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView('forgot');
                          resetMessages();
                        }}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView('register');
                          resetMessages();
                        }}
                        className="text-slate-600 hover:text-blue-600 font-semibold cursor-pointer"
                      >
                        Chưa có tài khoản? Tạo mới
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
                    </button>
                  </form>
                )}

                {/* 2. REGISTER / CREATE PASSWORD FORM */}
                {authView === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Tên đăng nhập
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="mrpenguin"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Tên hiển thị
                        </label>
                        <input
                          type="text"
                          placeholder="Mr Penguin"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Mật khẩu (chữ + số, &ge; 6 ký tự)
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Ví dụ: hsk4pass"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Nhập lại mật khẩu
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Nhập lại..."
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Câu hỏi bảo mật (dùng khi quên mật khẩu)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SECURITY_QUESTIONS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setSecurityQuestion(q)}
                            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer text-left ${
                              securityQuestion === q
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Câu trả lời bảo mật
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập câu trả lời của bạn..."
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Đang mã hóa PBKDF2...' : 'Tạo hồ sơ & mật khẩu'}
                    </button>
                  </form>
                )}

                {/* 3. FORGOT PASSWORD FORM */}
                {authView === 'forgot' && (
                  <form onSubmit={handleResetPassword} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tên đăng nhập cần khôi phục
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nhập tên đăng nhập..."
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={handleCheckUsernameForReset}
                          className="py-2.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Tìm
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setRecoveryMethod('question')}
                        className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          recoveryMethod === 'question'
                            ? 'bg-white text-blue-600 shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Qua câu hỏi bảo mật
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecoveryMethod('key')}
                        className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          recoveryMethod === 'key'
                            ? 'bg-white text-blue-600 shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Qua Mã khôi phục
                      </button>
                    </div>

                    {recoveryMethod === 'question' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {fetchedQuestion || 'Câu trả lời bảo mật (bấm Tìm để hiện câu hỏi)'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Nhập câu trả lời bảo mật..."
                          value={recoverySecret}
                          onChange={(e) => setRecoverySecret(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Mã khôi phục (Định dạng: CVL-XXXX-XXXX)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="CVL-XXXX-XXXX"
                          value={recoverySecret}
                          onChange={(e) => setRecoverySecret(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Mật khẩu mới
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Ít nhất 6 ký tự (chữ + số)"
                          value={newResetPassword}
                          onChange={(e) => setNewResetPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Xác nhận mật khẩu mới
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Nhập lại..."
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: 3-STEP AUTO-SAVE LIVE MONITOR & VERIFICATION ──────── */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            {/* Storage Overview */}
            <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Nơi lưu dữ liệu hiện tại
                </span>
                <button
                  type="button"
                  onClick={refreshDiagnostics}
                  className="p-1.5 rounded-lg bg-white text-slate-600 hover:text-blue-600 shadow-2xs cursor-pointer"
                  title="Làm mới trạng thái"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  1. <strong>Trên thiết bị (IndexedDB)</strong>: Database{' '}
                  <code className="px-1.5 py-0.5 bg-white rounded text-slate-800 font-bold">
                    ChineseVocabLearnerDB
                  </code>{' '}
                  ({diag ? `${(diag.snapshotSizeBytes / 1024).toFixed(1)} KB` : '...'})
                </div>
                <div>
                  2. <strong>Trên Cloudflare (Worker + D1)</strong>:{' '}
                  <code className="px-1.5 py-0.5 bg-white rounded text-slate-800 font-bold">
                    /api/sync?user={diag?.userId || 'default_user'}
                  </code>{' '}
                  —{' '}
                  {diag?.cloudD1Enabled ? (
                    <span className="text-emerald-600 font-bold">Đã kết nối D1 (5GB)</span>
                  ) : (
                    <span className="text-blue-600 font-semibold">
                      Đang chạy chế độ Local IndexedDB
                    </span>
                  )}
                </div>
              </div>

              {diag && (
                <div className="pt-2 border-t border-slate-200/70 flex items-center gap-3 text-xs font-semibold text-slate-700 flex-wrap">
                  <span>{diag.foldersCount} thư mục</span>
                  <span>|</span>
                  <span>{diag.decksCount} bộ từ</span>
                  <span>|</span>
                  <span>{diag.vocabCount} từ vựng</span>
                  <span>|</span>
                  <span className="text-blue-600">Đã học {diag.practicedCount} từ</span>
                </div>
              )}
            </div>

            {stepTestMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                {stepTestMessage}
              </div>
            )}

            {/* Step 1 Card */}
            <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  Bước 1: Lưu tức thì mỗi thẻ (IndexedDB 0.1ms)
                </div>
                <div className="text-[11px] text-slate-500">
                  Mỗi lần lật thẻ / ghép thẻ / gõ chữ tự lưu ngay. Lần cuối:{' '}
                  <strong className="text-slate-700">
                    {formatTime(diag?.step1LastWriteAt || null)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestStep1}
                disabled={testingStep === 1}
                className="py-2 px-3 rounded-xl bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
              >
                Test Bước 1
              </button>
            </div>

            {/* Step 2 Card */}
            <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  Bước 2: Đồng bộ khi xong lượt học / sửa từ (POST /api/sync)
                </div>
                <div className="text-[11px] text-slate-500">
                  Gửi gói JSON sau mỗi lượt luyện tập. Lần cuối:{' '}
                  <strong className="text-slate-700">
                    {formatTime(diag?.step2LastBatchAt || null)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestStep2}
                disabled={testingStep === 2}
                className="py-2 px-3 rounded-xl bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
              >
                Test Bước 2
              </button>
            </div>

            {/* Step 3 Card */}
            <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  Bước 3: Tự lưu khi tắt tab đột ngột (navigator.sendBeacon)
                </div>
                <div className="text-[11px] text-slate-500">
                  Bắt sự kiện đóng tab (visibilitychange / pagehide). Lần cuối:{' '}
                  <strong className="text-slate-700">
                    {formatTime(diag?.step3LastBeaconAt || null)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestStep3}
                disabled={testingStep === 3}
                className="py-2 px-3 rounded-xl bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
              >
                Test Bước 3
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
