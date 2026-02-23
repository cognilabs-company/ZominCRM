import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
import { Search, RefreshCw, CheckCircle, Clock, CreditCard } from 'lucide-react';

interface ApiPaymentAttempt {
    id: string;
    order_id: string;
    amount_uzs: number;
    status: string;
    created_at: string;
}

interface ApiTransaction {
    id: string;
    provider: string;
    amount_uzs: number;
    merchant_card_last4: string | null;
    linked_order_id: string | null;
    linked_payment_attempt_id: string | null;
    occurred_at: string;
    created_at: string;
}

const Payments: React.FC = () => {
    const { t, language } = useLanguage();
    const toast = useToast();
    const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

    const [activeTab, setActiveTab] = useState<'transactions' | 'attempts'>('transactions');

    const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
    const [attempts, setAttempts] = useState<ApiPaymentAttempt[]>([]);

    const [loading, setLoading] = useState(false);
    const [matching, setMatching] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'transactions') {
                const res = await apiRequest<{ results?: ApiTransaction[] }>(ENDPOINTS.PAYMENTS.TRANSACTIONS);
                setTransactions(res.results || []);
            } else {
                const res = await apiRequest<{ results?: ApiPaymentAttempt[] }>(ENDPOINTS.PAYMENTS.ATTEMPTS);
                setAttempts(res.results || []);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : tr('Failed to load data', 'Xatolik', 'Malumotlarni yuklab bo‘lmadi'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMatch = async (tx: ApiTransaction) => {
        try {
            setMatching(tx.id);
            const res = await apiRequest<{ result: string }>(ENDPOINTS.PAYMENTS.TRANSACTION_MATCH(tx.id), {
                method: 'POST'
            });
            if (res.result === 'matched') {
                toast.success(tr('Matched successfully', 'Ulandi', 'Muvaffaqiyatli ulandi'));
                loadData();
            } else {
                toast.warning(tr('No match found', 'Mos kelmadi', 'Mos kelmadi'));
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : tr('Error parsing transaction', 'Xatolik', 'Xatolik yuz berdi'));
        } finally {
            setMatching(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_payments')}</h1>
                <button
                    onClick={loadData}
                    disabled={loading}
                    className="p-2 bg-white dark:bg-navy-800 border border-light-border dark:border-navy-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex gap-4 border-b border-light-border dark:border-navy-700">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transactions'
                        ? 'border-primary-blue text-primary-blue'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    {tr('Transactions', 'Tranzaksiyalar', 'Tranzaksiyalar')}
                </button>
                <button
                    onClick={() => setActiveTab('attempts')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'attempts'
                        ? 'border-primary-blue text-primary-blue'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    {tr('Payment Attempts', 'Urinishlar', 'To‘lov urinishlari')}
                </button>
            </div>

            <Card className="!p-0 overflow-hidden">
                {activeTab === 'transactions' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                                    <th className="px-6 py-4 font-semibold">{tr('Provider', 'Provayder', 'Provayder')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Amount (UZS)', 'Summa', 'Summa (UZS)')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Date', 'Sana', 'Sana')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Status', 'Holat', 'Holat')}</th>
                                    <th className="px-6 py-4 font-semibold text-right">{tr('Action', 'Harakat', 'Harakat')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-navy-700">
                                {loading && transactions.length === 0 ? (
                                    <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('Loading...', 'Yuklanmoqda...', 'Yuklanmoqda...')}</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('No transactions.', 'Bo‘sh.', 'Topilmadi.')}</td></tr>
                                ) : (
                                    transactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${tx.provider === 'UZCARD' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
                                                        <CreditCard size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.provider}</p>
                                                        <p className="text-xs text-gray-500">*{tx.merchant_card_last4 || '----'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{tx.amount_uzs.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(tx.occurred_at).toLocaleString('ru')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {tx.linked_order_id ? (
                                                    <Badge variant="success" className="flex w-max items-center gap-1">
                                                        <CheckCircle size={14} /> {tr('Linked', 'Bog‘langan', 'Bog‘langan')}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="warning">{tr('Unlinked', 'Kutilmoqda', 'Kutilmoqda')}</Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!tx.linked_order_id && (
                                                    <button
                                                        onClick={() => handleMatch(tx)}
                                                        disabled={matching === tx.id}
                                                        className="text-primary-blue hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                                                    >
                                                        {matching === tx.id ? tr('Matching...', 'Tekshirilmoqda...', 'Tekshirilmoqda...') : tr('Auto Match', 'Avto Bog‘lash', 'Avto Bog‘lash')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'attempts' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                                    <th className="px-6 py-4 font-semibold">{tr('Order ID', 'ID', 'ID')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Amount (UZS)', 'Summa', 'Summa (UZS)')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Status', 'Holat', 'Holat')}</th>
                                    <th className="px-6 py-4 font-semibold">{tr('Date', 'Sana', 'Sana')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-navy-700">
                                {loading && attempts.length === 0 ? (
                                    <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('Loading...', 'Yuklanmoqda...', 'Yuklanmoqda...')}</td></tr>
                                ) : attempts.length === 0 ? (
                                    <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('No attempts.', 'Bo‘sh.', 'Topilmadi.')}</td></tr>
                                ) : (
                                    attempts.map(att => (
                                        <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-gray-500">{att.order_id.slice(0, 8)}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{att.amount_uzs.toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={att.status === 'CONFIRMED' ? 'success' : att.status === 'PENDING' ? 'warning' : 'error'}>
                                                    {att.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(att.created_at).toLocaleString('ru')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Payments;
