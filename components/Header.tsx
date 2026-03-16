import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Moon, Sun, Bell, Search, Check, LogOut, ChevronDown, Menu } from 'lucide-react';
import { Language } from '../types';
import { ENDPOINTS, apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const NOTIFICATION_READ_KEY = 'header_notification_read_ids';

type HeaderNotification = {
  id: string;
  text: string;
  time: string;
  type: 'info' | 'error' | 'success';
  read: boolean;
};

export const Header: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { logout } = useAuth();
  const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  const getStoredReadIds = useCallback(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_READ_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
    } catch {
      return new Set<string>();
    }
  }, []);

  const persistReadIds = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedReadIds = getStoredReadIds();
        const conversations = await apiRequest<{ results?: Array<{ id: string; channel: string; started_at: string }> }>(
          ENDPOINTS.CONVERSATIONS.LIST
        );
        const mapped = (conversations.results || []).slice(0, 5).map((item, idx) => ({
          id: item.id || `${idx}`,
          text: tr(`New ${item.channel} conversation`, `Novyy dialog ${item.channel}`, `Yangi ${item.channel} suhbati`),
          time: item.started_at ? new Date(item.started_at).toLocaleTimeString() : '',
          type: 'info' as const,
          read: storedReadIds.has(item.id || `${idx}`),
        }));
        setNotifications(mapped);
      } catch {
        setNotifications([]);
      }
    })();
  }, [getStoredReadIds, language, tr]);

  const hasUnread = notifications.some((n) => !n.read);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    const next = getStoredReadIds();
    next.add(id);
    persistReadIds(next);
  }, [getStoredReadIds, persistReadIds]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const nextReadIds = getStoredReadIds();
      prev.forEach((n) => nextReadIds.add(n.id));
      persistReadIds(nextReadIds);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, [getStoredReadIds, persistReadIds]);

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setIsLangOpen(false);
  };

  const langLabel = useMemo(() => {
    if (language === 'en') return 'EN';
    if (language === 'ru') return 'RU';
    return 'UZ';
  }, [language]);

  return (
    <header className="h-16 fixed top-0 right-0 left-0 md:left-64 z-20 px-4 sm:px-8 flex items-center justify-between bg-white dark:bg-navy-900 border-b border-gray-200 dark:border-white/8 shadow-sm transition-colors duration-300">
      {/* Mobile Menu */}
      <div className="flex md:hidden items-center">
        <button
          onClick={onMenuClick}
          className="p-2.5 rounded-lg text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          title={tr('Menu', 'Menu', 'Menyu')}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="hidden sm:flex items-center relative flex-1 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" size={18} />
        <input
          type="text"
          placeholder={tr('Search...', 'Поиск...', 'Qidirish...')}
          className="w-full bg-gray-50 dark:bg-white/6 text-gray-900 dark:text-white pl-11 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm transition-all placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue dark:focus:ring-primary-blue/30"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => { setIsLangOpen(!isLangOpen); setIsNotifOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          >
            <span>{langLabel}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLangOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsLangOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-navy-800 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1.5 z-20 animate-fade-in-up">
                {(['en', 'ru', 'uz'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLangSelect(lang)}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${language === lang ? 'bg-blue-50 dark:bg-blue-500/20 text-primary-blue dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <span>{lang === 'en' ? 'English' : lang === 'ru' ? 'Русский' : "Ўзбек"}</span>
                    {language === lang && <Check size={14} className="text-primary-blue dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setIsNotifOpen(!isNotifOpen); setIsLangOpen(false); }}
            className={`relative p-2.5 rounded-lg transition-colors ${isNotifOpen ? 'bg-blue-50 dark:bg-blue-500/20 text-primary-blue dark:text-blue-400' : 'text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8'}`}
          >
            <Bell size={18} />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-5 rounded-full bg-primary-red text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none shadow-lg">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-navy-800 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg z-20 overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{tr('Notifications', 'Уведомления', 'Bildirishnomalar')}</h4>
                  {hasUnread && (
                    <span className="text-[11px] bg-primary-red text-white rounded-full px-2 py-1 font-bold">{unreadCount}</span>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <Bell size={24} className="mx-auto text-gray-300 dark:text-white/15 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-white/40">
                        {tr('No notifications', 'Нет уведомлений', "Bildirishnoma yo'q")}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-4 py-3 border-b border-gray-200 dark:border-white/8 last:border-0 cursor-pointer transition-colors ${notif.read ? 'bg-white dark:bg-navy-800 opacity-60' : 'bg-blue-50/50 dark:bg-blue-500/10'} hover:bg-gray-50 dark:hover:bg-white/5`}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 flex-none ${notif.read ? 'bg-gray-300 dark:bg-white/20' : notif.type === 'error' ? 'bg-primary-red' : notif.type === 'success' ? 'bg-green-500' : 'bg-primary-blue'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 dark:text-white font-medium leading-tight">{notif.text}</p>
                            <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{notif.time}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {hasUnread && (
                  <div className="px-4 py-2.5 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3 text-center">
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-primary-blue dark:text-blue-400 hover:text-primary-blue/80 transition-colors"
                    >
                      {tr('Mark all as read', 'Отметить все как прочитанные', "Barchasini o'qilgan qilish")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />

        {/* Logout */}
        <button
          onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          title={tr('Logout', 'Выход', 'Chiqish')}
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">{tr('Logout', 'Выход', 'Chiqish')}</span>
        </button>
      </div>
    </header>
  );
};
