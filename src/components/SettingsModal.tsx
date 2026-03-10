import React from 'react';
import { useSettings, Theme, AIModel } from '../contexts/SettingsContext';

const SettingsModal: React.FC = () => {
  const { settings, updateSettings, isSettingsOpen, setIsSettingsOpen } = useSettings();

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl border-4 border-slate-100 dark:border-slate-800 relative">
        <button 
          onClick={() => setIsSettingsOpen(false)}
          className="absolute top-6 right-6 w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold"
        >
          ✕
        </button>
        
        <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">الإعدادات</h2>

        <div className="space-y-8">
          {/* Theme Selection */}
          <div className="space-y-3">
            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المظهر (الثيم)</label>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'colorful'] as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    settings.theme === t 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-200'
                  }`}
                >
                  {t === 'light' ? 'فاتح ☀️' : t === 'dark' ? 'داكن 🌙' : 'ملون 🎨'}
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="space-y-3">
            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">نموذج الذكاء الاصطناعي</label>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div className="text-xs font-bold text-slate-400 mt-2">Google Gemini</div>
              {(['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'] as AIModel[]).map(m => (
                <button
                  key={m}
                  onClick={() => updateSettings({ aiModel: m })}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all text-right flex justify-between items-center ${
                    settings.aiModel === m 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200'
                  }`}
                >
                  <span dir="ltr">{m}</span>
                  {settings.aiModel === m && <span>✓</span>}
                </button>
              ))}

              <div className="text-xs font-bold text-slate-400 mt-2">OpenAI</div>
              {(['gpt-4o', 'gpt-4o-mini'] as AIModel[]).map(m => (
                <button
                  key={m}
                  onClick={() => updateSettings({ aiModel: m })}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all text-right flex justify-between items-center ${
                    settings.aiModel === m 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200'
                  }`}
                >
                  <span dir="ltr">{m}</span>
                  {settings.aiModel === m && <span>✓</span>}
                </button>
              ))}

              <div className="text-xs font-bold text-slate-400 mt-2">Anthropic</div>
              {(['claude-3-5-sonnet-latest'] as AIModel[]).map(m => (
                <button
                  key={m}
                  onClick={() => updateSettings({ aiModel: m })}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all text-right flex justify-between items-center ${
                    settings.aiModel === m 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200'
                  }`}
                >
                  <span dir="ltr">{m}</span>
                  {settings.aiModel === m && <span>✓</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              * ملاحظة: استخدام نماذج OpenAI و Anthropic يتطلب إضافة مفاتيح API الخاصة بها في إعدادات الخادم.
            </p>
          </div>

          {/* Timed Mode Duration */}
          <div className="space-y-3">
            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">مدة "تحدي الوقت" (بالثواني)</label>
            <input 
              type="number" 
              min="30" 
              max="300" 
              step="10"
              value={settings.timedDuration}
              onChange={(e) => updateSettings({ timedDuration: parseInt(e.target.value) || 120 })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 font-bold text-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
