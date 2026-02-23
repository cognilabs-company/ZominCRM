import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Send, RefreshCw } from 'lucide-react';

interface ToolCatalogItem {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface PlaygroundResponse {
  message?: {
    id: string;
    text: string;
    created_at: string;
  };
  conversation?: {
    id?: string;
    channel?: string;
    external_thread_id?: string;
  };
  chat?: {
    user_text?: string;
    assistant_text?: string;
  };
  tools?: {
    called?: boolean;
    called_functions?: string[];
  };
  executed_tools?: Array<{
    index?: number | null;
    call_id?: string;
    name?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    error?: unknown;
  }>;
  iterations?: number;
  debug?: {
    provider_requested?: string;
    provider_used?: string;
    prompt_source?: {
      system_prompt?: string;
      user_prompt?: string;
    };
    prompt_credential_id?: string | null;
    used_db_prompts?: boolean;
  };
  trace?: {
    iterations?: Array<{
      iteration?: number;
      model_text?: string;
    }>;
  };
  note?: string;
}

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: string;
}

const AITools: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const [input, setInput] = useState('');
  const [activeConversationId, setActiveConversationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [toolCatalog, setToolCatalog] = useState<ToolCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const chatAreaRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el || !shouldStickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chatHistory.length]);

  const handleChatScroll = () => {
    const el = chatAreaRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 80;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingCatalog(true);
        const data = await apiRequest<{ results?: ToolCatalogItem[] } | ToolCatalogItem[]>(ENDPOINTS.AI.TOOLS);
        const tools = Array.isArray(data) ? data : (data.results || []);
        setToolCatalog(tools);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (e instanceof ApiError && e.status === 403) {
          setError(tr('AI access denied', 'AI kirish taqiqlangan', 'AI kirish taqiqlangan'));
          return;
        }
        toast.warning(e instanceof Error ? e.message : tr('Failed to load AI tool catalog', 'AI tool katalogini yuklab bo‘lmadi', 'AI tool katalogini yuklab bo‘lmadi'));
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, [navigate, toast]);

  const stringify = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value ?? '');
    }
  };

  const handleRun = async () => {
    if (!input.trim()) return;
    try {
      setIsLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        text: input.trim(),
        provider: 'openai',
        include_trace: true,
      };

      const reusedConversation = activeConversationId.trim();
      if (reusedConversation) {
        payload.conversation_id = reusedConversation;
      } else {
        payload.channel = 'telegram';
        payload.external_thread_id = 'playground';
      }

      const data = await apiRequest<PlaygroundResponse>(ENDPOINTS.AI.PLAYGROUND, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newConversationId = data.conversation?.id || '';
      if (newConversationId) setActiveConversationId(newConversationId);
      setResult(data);
      const userText = data.chat?.user_text || input.trim();
      const assistantText = data.chat?.assistant_text || data.message?.text || '';
      const ts = Date.now();
      setChatHistory((prev) => [
        ...prev,
        {
          id: `u-${ts}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'user',
          text: userText,
          createdAt: data.message?.created_at,
        },
        {
          id: data.message?.id || `a-${ts}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          text: assistantText || '-',
          createdAt: data.message?.created_at,
        },
      ]);
      setInput('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        setError(tr('AI access denied', 'AI kirish taqiqlangan', 'AI kirish taqiqlangan'));
        toast.error(tr('AI access denied', 'AI kirish taqiqlangan', 'AI kirish taqiqlangan'));
        return;
      }
      if (e instanceof ApiError && (e.status === 400 || e.status === 409)) {
        toast.warning(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : tr('Playground request failed', 'Playground so‘rovi bajarilmadi', 'Playground so‘rovi bajarilmadi'));
      }
      setError(e instanceof Error ? e.message : tr('Playground request failed', 'Playground so‘rovi bajarilmadi', 'Playground so‘rovi bajarilmadi'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('AI Playground', 'AI sinov maydoni', 'AI sinov maydoni')}</h1>
      </div>

      {error && <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="flex-1 min-h-0 bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-xl shadow-sm overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 min-h-0">
          <div className="bg-gray-50 dark:bg-navy-900/50 min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-light-border dark:border-navy-700 flex items-start justify-between gap-3 shrink-0 bg-white dark:bg-navy-800">
              <div>
                <p className="text-sm font-semibold text-light-text dark:text-white">{t('ai_playground')}</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {tr('Session', 'Sessiya', 'Sessiya')}: <span className="font-mono">{activeConversationId || tr('auto-create on first run', 'birinchi yuborishda avtomatik yaratiladi', 'birinchi yuborishda avtomatik yaratiladi')}</span>
                </p>
              </div>
              <button
                onClick={() => { setResult(null); setActiveConversationId(''); setChatHistory([]); setInput(''); }}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"
                title={t('reset')}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div
              ref={chatAreaRef}
              onScroll={handleChatScroll}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
            >
              {chatHistory.length === 0 ? (
                <p className="text-sm text-gray-500">{tr('Response will appear here.', 'Javob shu yerda ko‘rinadi.', 'Javob shu yerda ko‘rinadi.')}</p>
              ) : (
                chatHistory.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                        msg.role === 'user'
                          ? 'rounded-br-none bg-primary-blue text-white'
                          : 'rounded-bl-none bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {msg.text}
                      {msg.createdAt && (
                        <div className={`mt-1 text-[10px] ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-light-border dark:border-navy-700 shrink-0 bg-white dark:bg-navy-800">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading && input.trim()) {
                        handleRun();
                      }
                    }
                  }}
                  placeholder={t('test_bot_hint')}
                  className="flex-1 h-20 bg-gray-100 dark:bg-navy-900 rounded-lg px-3 py-2 text-sm border border-light-border dark:border-navy-600 text-gray-800 dark:text-white resize-none"
                />
                <button
                  onClick={handleRun}
                  disabled={!input.trim() || isLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  <Send size={16} />
                  {isLoading ? tr('Running...', 'Bajarilmoqda...', 'Bajarilmoqda...') : tr('Send', 'Yuborish', 'Yuborish')}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-l border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 min-h-0 overflow-y-auto space-y-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700 flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {tr('Conversation', 'Suhbat', 'Suhbat')}: {(result?.conversation?.id || '-').toString().slice(0, 8)}
              </span>
              <span className="px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                {tr('Provider', 'Provayder', 'Provayder')}: {result?.debug?.provider_used || '-'}
              </span>
              <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                {tr('Channel', 'Kanal', 'Kanal')}: {result?.conversation?.channel || '-'}
              </span>
              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300">
                {tr('Iterations', 'Iteratsiyalar', 'Iteratsiyalar')}: {(result?.trace?.iterations || []).length}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700">
              <p className="text-xs text-gray-500 mb-2">{tr('Tool Catalog', 'Tool katalogi', 'Tool katalogi')}</p>
              {loadingCatalog ? (
                <p className="text-xs text-gray-500">{tr('Loading tools...', 'Toollar yuklanmoqda...', 'Toollar yuklanmoqda...')}</p>
              ) : toolCatalog.length === 0 ? (
                <p className="text-xs text-gray-500">{tr('No tools found.', 'Toollar topilmadi.', 'Toollar topilmadi.')}</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {toolCatalog.map((tool) => (
                    <div key={tool.name} className="rounded border border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 px-2 py-2">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{tool.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{tool.description || '-'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700">
              <p className="text-xs text-gray-500 mb-1">{tr('Functions', 'Funksiyalar', 'Funksiyalar')}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 break-words [overflow-wrap:anywhere]">
                {(result?.tools?.called_functions || []).join(', ') || tr('No tools called', 'Tool chaqirilmadi', 'Tool chaqirilmadi')}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700">
              <p className="text-xs text-gray-500 mb-2">{tr('Executed Tools', 'Bajarilgan toollar', 'Bajarilgan toollar')}</p>
              {(result?.executed_tools || []).length === 0 ? (
                <p className="text-xs text-gray-500">{tr('No tool execution details.', 'Tool bajarilishi tafsilotlari yo‘q.', 'Tool bajarilishi tafsilotlari yo‘q.')}</p>
              ) : (
                <div className="space-y-2">
                  {(result?.executed_tools || []).map((row, index) => (
                    <div key={`${row.call_id || row.name || 'tool'}-${index}`} className="rounded border border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 p-2">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{row.name || '-'}</p>
                      <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">{tr('args', 'argumentlar', 'argumentlar')}: {stringify(row.arguments || {})}</pre>
                      <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">{tr('result', 'natija', 'natija')}: {stringify(row.result ?? {})}</pre>
                      {row.error && (
                        <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-red-600">{tr('error', 'xato', 'xato')}: {stringify(row.error)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700">
              <p className="text-xs text-gray-500 mb-1">{tr('Prompt Source', 'Prompt manbasi', 'Prompt manbasi')}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{tr('system', 'tizim', 'tizim')}: {result?.debug?.prompt_source?.system_prompt || '-'}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{tr('user', 'foydalanuvchi', 'foydalanuvchi')}: {result?.debug?.prompt_source?.user_prompt || '-'}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{tr('credential', 'credential', 'credential')}: {result?.debug?.prompt_credential_id || '-'}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{tr('db prompts', 'db promptlar', 'db promptlar')}: {typeof result?.debug?.used_db_prompts === 'boolean' ? String(result?.debug?.used_db_prompts) : '-'}</p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-light-border dark:border-navy-700">
              <p className="text-xs text-gray-500 mb-2">{tr('Trace', 'Iz', 'Iz')}</p>
              <div className="space-y-2">
                {(result?.trace?.iterations || []).map((it, idx) => (
                  <div key={idx} className="rounded border border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 px-2 py-2">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{tr('Iteration', 'Qadam', 'Qadam')} {it.iteration ?? idx + 1}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{it.model_text || '-'}</p>
                  </div>
                ))}
                {(result?.trace?.iterations || []).length === 0 && (
                  <p className="text-xs text-gray-500">{tr('No trace data yet.', 'Hozircha trace ma’lumoti yo‘q.', 'Hozircha trace ma’lumoti yo‘q.')}</p>
                )}
              </div>
            </div>

            {result?.note && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                {result.note}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITools;
