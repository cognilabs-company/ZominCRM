import React from 'react';
import { Card } from '../components/ui/Card';
import { useLanguage } from '../context/LanguageContext';
import { User, Lock, Save, AlertTriangle } from 'lucide-react';

const Settings: React.FC = () => {
  const { t, language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_settings')}</h1>

      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {tr(
              'Backend currently has no `/internal/auth/profile` or auth settings endpoints. This page remains local UI only.',
              "Backendda hozircha `/internal/auth/profile` yoki auth sozlamalari endpointlari yo'q. Bu sahifa vaqtincha lokal UI.",
              "Backendda hozircha `/internal/auth/profile` yoki auth sozlamalari endpointlari yo'q. Bu sahifa vaqtincha lokal UI."
            )}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card title={t('profile')}>
            <div className="flex flex-col items-center p-4">
              <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-navy-700 mb-4 overflow-hidden relative">
                <div className="w-full h-full flex items-center justify-center text-gray-500"><User size={30} /></div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tr('User', 'Foydalanuvchi', 'Foydalanuvchi')}</h3>
              <p className="text-sm text-gray-500">{tr('No backend profile endpoint', "Backendda profil endpointi yo'q", "Backendda profil endpointi yo'q")}</p>
            </div>
            <div className="border-t border-light-border dark:border-navy-700 p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><User size={16} /> <span>{tr('Edit Profile', 'Profilni tahrirlash', 'Profilni tahrirlash')}</span></div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Lock size={16} /> <span>{tr('Change Password', "Parolni o'zgartirish", "Parolni o'zgartirish")}</span></div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title={t('notifications')}>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {tr(
                  'Notification and account settings will appear here when backend endpoints are added.',
                  "Backend endpointlari qo'shilganda bildirishnoma va akkaunt sozlamalari shu yerda chiqadi.",
                  "Backend endpointlari qo'shilganda bildirishnoma va akkaunt sozlamalari shu yerda chiqadi."
                )}
              </p>
            </div>
          </Card>
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-primary-blue hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/30">
              <Save size={18} /> {t('save')} {tr('Changes', "o'zgarishlar", "o'zgarishlar")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
