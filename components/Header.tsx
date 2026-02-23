import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Moon, Sun, Bell, Search, Check, LogOut, ChevronDown, Menu } from 'lucide-react';
import { Language } from '../types';
import { ENDPOINTS, apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { logout, user } = useAuth();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; text: string; time: string; type: 'info' | 'error' | 'success'; read: boolean }>
  >([]);

  React.useEffect(() => {
    (async () => {
      try {
        const conversations = await apiRequest<{ results?: Array<{ id: string; channel: string; started_at: string }> }>(
          ENDPOINTS.CONVERSATIONS.LIST
        );
        const mapped = (conversations.results || []).slice(0, 5).map((item, idx) => ({
          id: item.id || `${idx}`,
          text: tr(`New ${item.channel} conversation`, `Новый диалог ${item.channel}`, `Yangi ${item.channel} suhbati`),
          time: item.started_at ? new Date(item.started_at).toLocaleTimeString() : '',
          type: 'info' as const,
          read: false,
        }));
        setNotifications(mapped);
      } catch {
        setNotifications([]);
      }
    })();
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasUnread = notifications.some((n) => !n.read);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const handleLangSelect = (lang: Language) => { setLanguage(lang); setIsLangOpen(false); };

  const langLabel = language === 'en' ? '🇬🇧 EN' : language === 'ru' ? '🇷🇺 RU' : '🇺🇿 UZ';

  return (
    <header className="h-16 fixed top-0 right-0 left-0 md:left-64 z-20 px-3 sm:px-6 flex items-center justify-between
      bg-white/90 dark:bg-navy-900/95 border-b border-light-border dark:border-white/6
      backdrop-blur-md transition-colors duration-300">

      <div className="flex md:hidden items-center mr-2">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-light-muted dark:text-white/60 hover:text-light-text dark:hover:text-white hover:bg-light-bg dark:hover:bg-white/6 border border-light-border/70 dark:border-white/10 transition-colors"
          title={tr('Menu', 'Меню', 'Menyu')}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* ── Search ─────────────────────────────── */}
      <div className="hidden sm:flex items-center relative w-56 lg:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-muted dark:text-white/30 pointer-events-none" size={16} />
        <input
          type="text"
          placeholder={`${tr('Search anything...', 'Поиск...', 'Qidirish...')}`}
          className="w-full bg-light-bg dark:bg-white/5 text-light-text dark:text-white/80
            pl-9 pr-4 py-2 rounded-lg border border-light-border dark:border-white/8
            text-sm transition-all input-glow placeholder:text-light-muted/60 dark:placeholder:text-white/25"
        />
      </div>

      {/* ── Right controls ─────────────────────── */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto min-w-0">

        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => { setIsLangOpen(!isLangOpen); setIsNotifOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              text-light-muted dark:text-white/60 hover:text-light-text dark:hover:text-white
              hover:bg-light-bg dark:hover:bg-white/6 border border-transparent
              hover:border-light-border dark:hover:border-white/8 transition-all"
          >
            <span>{langLabel}</span>
            <ChevronDown size={12} className={`transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLangOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsLangOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-navy-800
                border border-light-border dark:border-white/8 rounded-xl shadow-modal py-1.5 z-20 animate-fade-in-up">
                {(['en', 'ru', 'uz'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLangSelect(lang)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between
                      hover:bg-light-bg dark:hover:bg-white/6 transition-colors
                      ${language === lang ? 'text-primary-blue font-semibold' : 'text-light-text dark:text-white/70'}`}
                  >
                    <span>{lang === 'en' ? '🇬🇧 English' : lang === 'ru' ? '🇷🇺 Русский' : "🇺🇿 O'zbek"}</span>
                    {language === lang && <Check size={13} className="text-primary-blue" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-light-muted dark:text-white/50
            hover:text-light-text dark:hover:text-white
            hover:bg-light-bg dark:hover:bg-white/6 transition-all border border-transparent
            hover:border-light-border dark:hover:border-white/8"
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          {theme === 'dark'
            ? <Sun size={18} className="text-yellow-400" />
            : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setIsNotifOpen(!isNotifOpen); setIsLangOpen(false); }}
            className={`relative p-2 rounded-lg transition-all border
              ${isNotifOpen
                ? 'bg-light-bg dark:bg-white/8 border-light-border dark:border-white/10 text-primary-blue'
                : 'text-light-muted dark:text-white/50 border-transparent hover:border-light-border dark:hover:border-white/8 hover:bg-light-bg dark:hover:bg-white/6 hover:text-light-text dark:hover:text-white'}`}
          >
            <Bell size={18} />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 rounded-full
                bg-primary-red text-white text-[9px] font-bold flex items-center justify-center px-0.5
                leading-none shadow-glow-red border border-white dark:border-navy-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-navy-800
                border border-light-border dark:border-white/8 rounded-xl shadow-modal py-0 z-20 overflow-hidden animate-fade-in-up">
                <div className="px-4 py-3 border-b border-light-border dark:border-white/6 flex items-center justify-between bg-light-bg dark:bg-white/3">
                  <h4 className="font-semibold text-light-text dark:text-white text-sm">{tr('Notifications', 'Уведомления', 'Bildirishnomalar')}</h4>
                  {hasUnread && (
                    <span className="text-[10px] bg-primary-red text-white rounded-full px-1.5 py-0.5 font-bold">{unreadCount}</span>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="mx-auto text-light-muted/30 dark:text-white/15 mb-2" />
                      <p className="text-sm text-light-muted dark:text-white/40">
                        {tr('No notifications yet.', 'Уведомлений пока нет.', "Hozircha bildirishnoma yo'q.")}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n))}
                        className={`px-4 py-3 hover:bg-light-bg dark:hover:bg-white/4
                          border-b border-light-border/50 dark:border-white/4 last:border-0 cursor-pointer
                          transition-colors ${notif.read ? 'opacity-60' : ''}`}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notif.read ? 'bg-gray-300 dark:bg-white/20'
                              : notif.type === 'error' ? 'bg-primary-red shadow-glow-red'
                                : notif.type === 'success' ? 'bg-accent-emerald'
                                  : 'bg-primary-blue shadow-glow-blue'
                            }`} style={!notif.read ? { boxShadow: notif.type === 'error' ? '0 0 6px rgba(229,57,53,0.8)' : notif.type === 'info' ? '0 0 6px rgba(47,107,255,0.8)' : '' } : {}} />
                          <div className="min-w-0">
                            <p className="text-sm text-light-text dark:text-white/85 leading-snug">{notif.text}</p>
                            <p className="text-[11px] text-light-muted dark:text-white/35 mt-0.5">{notif.time}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-light-border dark:border-white/6 bg-light-bg/80 dark:bg-white/3 text-center">
                  <button
                    onClick={markAllAsRead}
                    disabled={!hasUnread}
                    className="text-xs font-semibold text-primary-blue hover:text-primary-blueDark transition-colors disabled:opacity-40"
                  >
                    {tr('Mark all as read', 'Отметить всё как прочитанное', "Barchasini o'qilgan qilish")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-light-border dark:bg-white/10 mx-1" />

        {/* Logout */}
        <button
          onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
            text-light-muted dark:text-white/50 hover:text-primary-red dark:hover:text-primary-red
            hover:bg-red-50 dark:hover:bg-red-900/15 border border-transparent
            hover:border-red-100 dark:hover:border-red-900/30 transition-all group"
          title={tr('Logout', 'Выйти', 'Chiqish')}
        >
          <LogOut size={16} className="transition-transform group-hover:translate-x-0.5" />
          <span className="hidden sm:inline">{tr('Logout', 'Выйти', 'Chiqish')}</span>
        </button>
      </div>
    </header>
  );
};
