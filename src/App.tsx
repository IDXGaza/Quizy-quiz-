
import React, { useState, useEffect } from 'react';
import { GameConfig, Player, Question, GameMode, QuestionType, SavedSet } from './types';
import { generateQuestions, parseCustomJson } from './services/geminiService';
import ConfigScreen from './components/ConfigScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';
import RemoteBuzzer from './components/RemoteBuzzer';
import SettingsModal from './components/SettingsModal';
import LibraryScreen from './components/LibraryScreen';
import { useSettings } from './contexts/SettingsContext';
import { auth } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'config' | 'loading' | 'playing' | 'summary' | 'remote' | 'error' | 'library'>('config');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { settings, setIsSettingsOpen } = useSettings();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((error: any) => {
          if (error.code === 'auth/admin-restricted-operation') {
            setAuthError("عذراً، ميزة اللعب عن بُعد (Remote Buzzer) معطلة لأن 'Anonymous Authentication' غير مفعل في Firebase.");
          } else {
            console.error("Auth Error:", error);
            setAuthError(error.message);
          }
          // Allow the app to be "ready" even with auth error, so local modes work
          setIsAuthReady(true);
        });
      } else {
        setIsAuthReady(true);
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'remote') {
      setGameState('remote');
    }
  }, []);

  // Removed redundant return

  const handleStartGame = async (newConfig: GameConfig) => {
    setConfig({ ...newConfig, sessionId });
    setPlayers(newConfig.players);
    setGameState('loading');
    setErrorMessage('');
    
    try {
      setConfig(newConfig);
      setPlayers(newConfig.players);
      
      if (newConfig.mode === GameMode.HEX_GRID && newConfig.hexMode === 'manual') {
        setQuestions([]);
        setGameState('playing');
        return;
      }

      // If manual questions are provided (for non-hex modes), use them
      if (newConfig.manualQuestions && newConfig.manualQuestions.length > 0) {
        setQuestions(newConfig.manualQuestions);
        setGameState('playing');
        return;
      }

      const requiredCount = newConfig.mode === GameMode.HEX_GRID ? 28 : (newConfig.mode === GameMode.GRID ? 25 : newConfig.numQuestions);
      const topicToUse = newConfig.topic || 'عام';

      let generated: Question[] = [];

      if (newConfig.customJson) {
        generated = parseCustomJson(newConfig.customJson, topicToUse, newConfig.mode, newConfig.difficulty);
      } else {
        generated = await generateQuestions(
          topicToUse,
          requiredCount,
          newConfig.questionTypes,
          newConfig.mode,
          newConfig.difficulty,
          settings.aiModel,
          newConfig.categories
        );
      }
      
      if (!generated || generated.length === 0) {
        throw new Error("لم يتم العثور على أسئلة، حاول تغيير الموضوع.");
      }
      
      setQuestions(generated);
      setGameState('playing');
    } catch (error: any) {
      console.error("Game Start Error:", error);
      setErrorMessage(error.message || "حدث خطأ غير متوقع أثناء توليد الأسئلة.");
      setGameState('error');
    }
  };

  const handleFinishGame = (finalPlayers: Player[]) => {
    setPlayers(finalPlayers);
    setGameState('summary');
  };

  const handleReset = () => {
    setGameState('config');
    setQuestions([]);
    setErrorMessage('');
  };

  const handlePlaySavedSet = (set: SavedSet, selectedPlayers: Player[]) => {
    const newConfig: GameConfig = {
      topic: set.topic,
      numQuestions: set.numQuestions,
      mode: set.mode,
      questionTypes: [QuestionType.OPEN],
      difficulty: set.difficulty,
      players: selectedPlayers,
      manualQuestions: set.questions,
      sessionId
    };
    setConfig(newConfig);
    setPlayers(newConfig.players);
    setQuestions(set.questions);
    setGameState('playing');
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <SettingsModal />
      <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
          <div className="w-10 h-10 sky-gradient rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-xl">⭐</span>
          </div>
          <h1 className="text-2xl font-black sky-text">جيمي كويز</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {gameState === 'config' && (
            <button 
              onClick={() => setGameState('library')} 
              className="px-5 py-2 bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 rounded-full font-bold text-sm hover:bg-sky-200 dark:hover:bg-sky-800/50 transition-all flex items-center gap-2"
            >
              <span>📚</span> مكتبتي
            </button>
          )}
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xl"
            title="الإعدادات"
          >
            ⚙️
          </button>
          {gameState !== 'config' && gameState !== 'loading' && gameState !== 'library' && (
            <button onClick={handleReset} className="px-5 py-2 border border-sky-500 text-sky-600 dark:text-sky-400 rounded-full font-bold text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all">
              إلغاء
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {!isAuthReady ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-6">
            <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
            <h2 className="text-2xl font-bold text-slate-400">جاري تهيئة النظام...</h2>
          </div>
        ) : (
          <>
            {authError && gameState === 'remote' && (
              <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                <div className="text-6xl">🔒</div>
                <h2 className="text-2xl font-bold text-red-500">خطأ في المصادقة</h2>
                <p className="text-slate-500 max-w-md">{authError}</p>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm">
                  يجب تفعيل "Anonymous Authentication" في Firebase Console لاستخدام هذه الميزة.
                </div>
                <button onClick={handleReset} className="sky-btn px-10 py-3 rounded-xl font-bold">العودة للرئيسية</button>
              </div>
            )}

            {gameState === 'remote' && !authError && <RemoteBuzzer />}
            
            {gameState === 'config' && <ConfigScreen onStart={handleStartGame} />}
            
            {gameState === 'library' && <LibraryScreen onPlaySet={handlePlaySavedSet} onClose={() => setGameState('config')} />}
            
            {gameState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-40 space-y-6">
                <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
                <h2 className="text-2xl font-bold text-slate-400">جاري إنشاء الأسئلة والشبكة...</h2>
                <p className="text-slate-300 text-sm">قد يستغرق هذا بضع ثوانٍ</p>
              </div>
            )}

            {gameState === 'error' && (
              <div className="flex flex-col items-center justify-center py-40 space-y-6 text-center">
                <div className="text-6xl">⚠️</div>
                <h2 className="text-2xl font-bold text-red-500">فشل الاتصال</h2>
                <p className="text-slate-500 max-w-md">{errorMessage}</p>
                <button onClick={handleReset} className="sky-btn px-10 py-3 rounded-xl font-bold">إعادة المحاولة</button>
              </div>
            )}

            {gameState === 'playing' && config && (
              <GameScreen config={config} questions={questions} players={players} onFinish={handleFinishGame} />
            )}
            
            {gameState === 'summary' && config && <SummaryScreen config={config} questions={questions} players={players} onRestart={handleReset} />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
