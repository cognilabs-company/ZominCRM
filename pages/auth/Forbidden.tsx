import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const Forbidden: React.FC = () => {
  const { language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">403 - {tr('Access Denied', 'Access Denied', 'Kirish taqiqlangan')}</h1>
        <p className="text-sm text-gray-500 mt-2">
            {tr('Your account does not have permission to view this page.', "Bu sahifani ko\'rish uchun akkauntingizda ruxsat yo\'q.", "Bu sahifani ko\'rish uchun akkauntingizda ruxsat yo\'q.")}
        </p>
        <div className="mt-5">
          <Link to="/" className="inline-flex px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
            {tr('Go to Dashboard', "Bosh sahifaga o\'tish", "Bosh sahifaga o\'tish")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Forbidden;
