import React, { CSSProperties, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ApiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Bot, AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const darkInputStyle: CSSProperties = {
    color: '#FFFFFF',
    caretColor: '#FFFFFF',
    WebkitTextFillColor: '#FFFFFF',
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(username, password);
      toast.success(tr('Logged in successfully', 'Muvaffaqiyatli kirildi', 'Muvaffaqiyatli kirildi'));
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(tr("Invalid username or password.", "Login yoki parol noto'g'ri.", "Login yoki parol noto'g'ri."));
      } else if (err instanceof ApiError && err.status === 403) {
        setError(tr('Access denied for this account.', 'Bu akkaunt uchun kirish taqiqlangan.', 'Bu akkaunt uchun kirish taqiqlangan.'));
      } else {
        setError(err instanceof Error ? err.message : tr('Login failed', 'Kirish muvaffaqiyatsiz', 'Kirish muvaffaqiyatsiz'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060D18 0%, #0B1220 50%, #0F1B2E 100%)' }}>

      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large red glow top-left */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #E53935 0%, transparent 70%)' }} />
        {/* Blue glow bottom-right */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2F6BFF 0%, transparent 70%)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Glow border effect */}
        <div className="absolute -inset-0.5 rounded-2xl opacity-20 blur-sm"
          style={{ background: 'linear-gradient(135deg, #E53935, #2F6BFF)' }} />

        <div className="relative bg-navy-800/90 border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

          {/* Top accent */}
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #E53935 0%, #2F6BFF 50%, transparent 100%)' }} />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-glow-red"
                  style={{ background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' }}>
                  <Bot size={28} className="text-white" strokeWidth={2} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-navy-800"
                  style={{ background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Zomin <span style={{ color: '#E53935' }}>CRM</span>
              </h1>
              <p className="text-sm text-white/40 mt-1">
                {tr('Sign in to your account', 'Akkountingizga kiring', "Hisobingizga kiring")}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl text-sm bg-red-950/40 border border-red-800/40 text-red-300 animate-fade-in-up">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  {tr('Username', 'Login', 'Login')}
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm !text-white caret-white bg-white/10 border border-white/15 placeholder:text-white/35 transition-all input-glow" style={darkInputStyle}
                    placeholder={tr('Enter username', 'Login kiriting', 'Login kiriting')}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  {tr('Password', 'Parol', 'Parol')}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm !text-white caret-white bg-white/10 border border-white/15 placeholder:text-white/35 transition-all input-glow" style={darkInputStyle}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/75 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                disabled={loading}
                type="submit"
                className="w-full mt-2 px-4 py-3 rounded-xl text-sm font-semibold text-white
                  btn-shimmer transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
                style={{ background: loading ? '#555' : 'linear-gradient(135deg, #E53935 0%, #C62828 100%)', boxShadow: loading ? 'none' : '0 4px 20px rgba(229,57,53,0.4)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {tr('Signing in...', 'Kirilmoqda...', 'Kirilmoqda...')}
                  </>
                ) : tr('Sign in', 'Kirish', 'Kirish')}
              </button>
            </form>

            {/* Footer note */}
            <p className="mt-6 text-center text-xs text-white/25">
              {tr('Use your admin or superuser credentials', "Admin yoki superuser ma'lumotlarini kiriting", "Admin yoki superuser ma'lumotlarini kiriting")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

