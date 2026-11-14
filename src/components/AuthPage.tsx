'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import {
  ActiveSession,
  SECURITY_QUESTIONS,
  loginUserAccount,
  registerUserAccount,
  getAccountSecurityQuestion,
  resetPasswordWithRecovery,
} from '@/lib/auth';
import { reconcileWithCloudOnStartup, triggerManualStep2Sync } from '@/lib/db';

interface AuthPageProps {
  onAuthenticated: (session: ActiveSession) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [recoveryMethod, setRecoveryMethod] = useState<'question' | 'key'>('question');
  const [fetchedQuestion, setFetchedQuestion] = useState<string | null>(null);
  const [recoverySecret, setRecoverySecret] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');

  const [pendingSession, setPendingSession] = useState<ActiveSession | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginUserAccount({ username, password });
      if (!res.ok || !res.session) {
        setErrorMsg(res.error || 'Đăng nhập thất bại.');
        return;
      }
      await reconcileWithCloudOnStartup();
      onAuthenticated(res.session);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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

      if (!res.ok || !res.session) {
        setErrorMsg(res.error || 'Không thể tạo tài khoản.');
        return;
      }

      await triggerManualStep2Sync();
      if (res.recoveryKey) {
        setPendingSession(res.session);
        setGeneratedKey(res.recoveryKey);
      } else {
        onAuthenticated(res.session);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookupQuestion = async () => {
    setErrorMsg(null);
    if (!username.trim()) return;
    const res = await getAccountSecurityQuestion(username);
    if (!res.found) {
      setErrorMsg('Không tìm thấy tài khoản.');
      setFetchedQuestion(null);
    } else {
      setFetchedQuestion(res.question || SECURITY_QUESTIONS[0]);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (newResetPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
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

      if (!res.ok || !res.session) {
        setErrorMsg(res.error || 'Đặt lại mật khẩu thất bại.');
        return;
      }

      await reconcileWithCloudOnStartup();
      onAuthenticated(res.session);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Screen shown right after creating an account so user can copy their Recovery Key before entering
  if (pendingSession && generatedKey) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm space-y-6">
          <h1 className="text-xl font-extrabold text-slate-800 text-center">
            Mã khôi phục tài khoản
          </h1>

          <div className="flex items-center justify-between bg-slate-100 px-4 py-3.5 rounded-2xl">
            <code className="text-base font-extrabold text-slate-800 tracking-wider">
              {generatedKey}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="py-1.5 px-3 rounded-xl bg-white text-blue-600 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {copiedKey ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAuthenticated(pendingSession)}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            Vào trang học
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-800 text-center tracking-tight">
          {mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : 'Quên mật khẩu'}
        </h1>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tạo mật khẩu
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              mode === 'forgot'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quên mật khẩu
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* 1. ĐĂNG NHẬP */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Tên đăng nhập
              </label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* 2. TẠO MẬT KHẨU / ĐĂNG KÝ */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Mật khẩu
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Câu hỏi bảo mật
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
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Câu trả lời
              </label>
              <input
                type="text"
                required
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </form>
        )}

        {/* 3. QUÊN MẬT KHẨU */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Tên đăng nhập
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={handleLookupQuestion}
                  className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
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
                Câu hỏi bảo mật
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
                Mã khôi phục
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {recoveryMethod === 'question'
                  ? fetchedQuestion || 'Câu trả lời bảo mật'
                  : 'Mã khôi phục'}
              </label>
              <input
                type="text"
                required
                value={recoverySecret}
                onChange={(e) => setRecoverySecret(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
