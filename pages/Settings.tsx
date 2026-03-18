import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangle, Lock, Mail, ShieldCheck, User } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, permissions, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const displayName = user?.first_name || user?.last_name
    ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
    : user?.username || tr('User', 'User', 'Foydalanuvchi');
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
  const roleLabel = user?.role || '-';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_settings')}</h1>

      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {tr(
              'This page is read-only for now. It shows live account information from the authenticated session until dedicated settings endpoints are added.',
              'Эта страница пока доступна только для чтения. Она показывает данные текущей авторизованной сессии, пока не будут добавлены отдельные endpoints настроек.',
              'Bu sahifa hozircha faqat o‘qish uchun. Alohida sozlamalar endpointlari qo‘shilguncha u joriy sessiyadagi akkaunt ma’lumotlarini ko‘rsatadi.'
            )}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card title={t('profile')}>
            <div className="flex flex-col items-center p-4">
              <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-navy-700 mb-4 overflow-hidden relative flex items-center justify-center text-2xl font-bold text-gray-700 dark:text-white">
                {initials}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{displayName}</h3>
              <p className="text-sm text-gray-500">@{user?.username || '-'}</p>
              <div className="mt-3">
                <Badge variant={isAdmin ? 'success' : 'info'}>{roleLabel}</Badge>
              </div>
            </div>
            <div className="border-t border-light-border dark:border-navy-700 p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><User size={16} /> <span>{tr('Username', 'Имя пользователя', 'Username')}: {user?.username || '-'}</span></div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Mail size={16} /> <span>{tr('Email', 'Электронная почта', 'Email')}: {user?.email || '-'}</span></div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Lock size={16} /> <span>{tr('Role', 'Роль', 'Rol')}: {roleLabel}</span></div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title={tr('Access Summary', 'Сводка доступа', 'Kirish xulosasi')}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Account Type', 'Тип аккаунта', 'Akkaunt turi')}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{isAdmin ? tr('Administrator', 'Администратор', 'Administrator') : tr('Restricted operator', 'Ограниченный оператор', 'Cheklangan operator')}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Permission Count', 'Количество разрешений', 'Ruxsatlar soni')}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{permissions.length}</p>
                </div>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Current Permissions', 'Текущие разрешения', 'Joriy ruxsatlar')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {permissions.length > 0 ? permissions.map((permission) => (
                    <Badge key={permission} variant="default">{permission}</Badge>
                  )) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{tr('No explicit permissions assigned.', 'Явные разрешения не назначены.', 'Aniq ruxsatlar biriktirilmagan.')}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title={tr('Availability', 'Доступность', 'Mavjudlik')}>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>{tr('Theme, language switcher, logout, and page permissions are already active in the current UI.', 'Переключение темы, языка, выход и права страниц уже работают в текущем интерфейсе.', 'Tema, til almashuvi, chiqish va sahifa ruxsatlari hozirgi interfeysda allaqachon ishlaydi.')}</p>
              <p>{tr('Profile editing, password change, and notification preferences should be added only after backend endpoints are defined.', 'Редактирование профиля, смену пароля и настройки уведомлений нужно добавлять только после определения backend endpoints.', 'Profilni tahrirlash, parolni almashtirish va bildirishnoma sozlamalarini faqat backend endpointlari aniq bo‘lgandan keyin qo‘shish kerak.')}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
