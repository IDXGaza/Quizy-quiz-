import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import RemoteBuzzer from '../components/RemoteBuzzer';

// --- Types ---
type Team = 'red' | 'green';
type Mode = 'ai' | 'manual';
type CellState = 'idle' | 'active' | 'red' | 'green';

interface CellData {
  id: string;
  row: number;
  col: number;
  letter: string;
  state: CellState;
}

interface QuestionData {
  question: string;
  answer: string;
}

// --- Constants ---
const LETTERS = [
  ['أ', 'ب', 'ت', 'ث', 'ج'],
  ['ح', 'خ', 'د', 'ذ', 'ر'],
  ['ز', 'س', 'ش', 'ص', 'ض'],
  ['ط', 'ظ', 'ع', 'غ', 'ف'],
  ['ق', 'ك', 'ل', 'م', 'ن']
];

const CATEGORIES = [
  'علوم وطبيعة', 'جغرافيا', 'تاريخ', 'رياضة', 'ثقافة عامة', 'فن وأدب'
];

const DIFFICULTIES = ['سهل', 'متوسط', 'صعب'];

// --- Helper Functions ---
const getNeighbors = (row: number, col: number, totalCols: number) => {
  const isEvenRow = row % 2 === 0;
  return [
    [row - 1, isEvenRow ? col - 1 : col],
    [row - 1, isEvenRow ? col : col + 1],
    [row, col - 1],
    [row, col + 1],
    [row + 1, isEvenRow ? col - 1 : col],
    [row + 1, isEvenRow ? col : col + 1],
  ].filter(([r, c]) => r >= 0 && c >= 0 && c < totalCols);
};

const checkWin = (cells: CellData[][], team: Team): string[] | null => {
  const rows = cells.length;
  const cols = cells[0].length;
  const visited = new Set<string>();
  const queue: { r: number; c: number; path: string[] }[] = [];

  // Find starting nodes
  if (team === 'red') {
    // Red wins left to right. Start at col 0.
    for (let r = 0; r < rows; r++) {
      if (cells[r][0].state === 'red') {
        queue.push({ r, c: 0, path: [cells[r][0].id] });
        visited.add(`${r},0`);
      }
    }
  } else {
    // Green wins top to bottom. Start at row 0.
    for (let c = 0; c < cols; c++) {
      if (cells[0][c].state === 'green') {
        queue.push({ r: 0, c, path: [cells[0][c].id] });
        visited.add(`0,${c}`);
      }
    }
  }

  // BFS
  while (queue.length > 0) {
    const { r, c, path } = queue.shift()!;

    // Check win condition
    if (team === 'red' && c === cols - 1) return path;
    if (team === 'green' && r === rows - 1) return path;

    const neighbors = getNeighbors(r, c, cols);
    for (const [nr, nc] of neighbors) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && cells[nr][nc].state === team) {
        visited.add(key);
        queue.push({ r: nr, c: nc, path: [...path, cells[nr][nc].id] });
      }
    }
  }

  return null;
};

// --- Components ---

const SetupScreen: React.FC<{ onStart: (config: any) => void }> = ({ onStart }) => {
  const [redTeam, setRedTeam] = useState('الفريق الأحمر');
  const [greenTeam, setGreenTeam] = useState('الفريق الأخضر');
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('متوسط');
  const [manualQuestions, setManualQuestions] = useState<Record<string, QuestionData>>({});

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleManualChange = (letter: string, field: 'question' | 'answer', value: string) => {
    setManualQuestions(prev => ({
      ...prev,
      [letter]: { ...prev[letter], [field]: value }
    }));
  };

  const isManualValid = () => {
    for (const row of LETTERS) {
      for (const letter of row) {
        const q = manualQuestions[letter];
        if (!q || !q.question.trim() || !q.answer.trim() || !q.answer.trimStart().startsWith(letter)) {
          return false;
        }
      }
    }
    return true;
  };

  const handleStart = () => {
    if (mode === 'ai' && selectedCategories.length === 0) {
      alert('الرجاء اختيار فئة واحدة على الأقل');
      return;
    }
    onStart({
      redTeam,
      greenTeam,
      mode,
      categories: selectedCategories,
      difficulty,
      manualQuestions
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl mt-10">
      <h1 className="text-4xl font-black text-center mb-8 text-slate-800">إعداد اللعبة</h1>
      
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div className="space-y-2">
          <label className="font-bold text-lg">اسم الفريق الأحمر 🔴</label>
          <input 
            type="text" 
            value={redTeam} 
            onChange={e => setRedTeam(e.target.value)}
            className="w-full p-4 border-2 border-red-200 rounded-xl focus:border-red-500 outline-none text-xl font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="font-bold text-lg">اسم الفريق الأخضر 🟢</label>
          <input 
            type="text" 
            value={greenTeam} 
            onChange={e => setGreenTeam(e.target.value)}
            className="w-full p-4 border-2 border-green-200 rounded-xl focus:border-green-500 outline-none text-xl font-bold"
          />
        </div>
      </div>

      <div className="border-t-2 border-slate-100 pt-8 mb-8">
        <h2 className="text-2xl font-bold text-center mb-6">كيف تريد إضافة الأسئلة؟</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <button 
            onClick={() => setMode('ai')}
            className={`p-6 rounded-2xl border-4 transition-all text-right ${mode === 'ai' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
          >
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-2xl font-bold mb-2">ذكاء اصطناعي</h3>
            <p className="text-slate-600">يولد أسئلة متنوعة تلقائياً لكل حرف بناءً على الفئات المختارة.</p>
          </button>
          
          <button 
            onClick={() => setMode('manual')}
            className={`p-6 rounded-2xl border-4 transition-all text-right ${mode === 'manual' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
          >
            <div className="text-4xl mb-4">✍️</div>
            <h3 className="text-2xl font-bold mb-2">إضافة يدوية</h3>
            <p className="text-slate-600">أضف أسئلتك وإجاباتك يدوياً لكل حرف في اللوح.</p>
          </button>
        </div>
      </div>

      {mode === 'ai' && (
        <div className="space-y-8 animate-fade-in">
          <div>
            <h3 className="font-bold text-lg mb-3">اختر الفئات:</h3>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-4 py-2 rounded-full font-bold transition-all ${selectedCategories.includes(cat) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-3">مستوى الصعوبة:</h3>
            <div className="flex gap-3">
              {DIFFICULTIES.map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${difficulty === diff ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={handleStart}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg"
          >
            ابدأ اللعبة — سيولد الذكاء الاصطناعي الأسئلة
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6">
            <p className="font-bold text-amber-800">⚠️ تنبيه: يجب أن تبدأ الإجابة بالحرف المخصص للخلية.</p>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto p-2">
            {LETTERS.flat().map(letter => {
              const q = manualQuestions[letter] || { question: '', answer: '' };
              const isValid = q.answer.trim() === '' || q.answer.trimStart().startsWith(letter);
              
              return (
                <div key={letter} className={`flex gap-4 items-start p-4 rounded-xl border-2 ${!isValid ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
                  <div className="w-16 h-16 shrink-0 bg-slate-800 text-white rounded-lg flex items-center justify-center text-3xl font-bold font-['Scheherazade_New']">
                    {letter}
                  </div>
                  <div className="flex-1 space-y-3">
                    <input 
                      type="text" 
                      placeholder="نص السؤال..." 
                      value={q.question}
                      onChange={e => handleManualChange(letter, 'question', e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:border-amber-500 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder={`الإجابة (يجب أن تبدأ بحرف ${letter})`} 
                      value={q.answer}
                      onChange={e => handleManualChange(letter, 'answer', e.target.value)}
                      className={`w-full p-3 border rounded-lg outline-none ${!isValid ? 'border-red-500 text-red-600' : 'border-slate-300 focus:border-amber-500'}`}
                    />
                    {!isValid && <p className="text-red-500 text-sm font-bold">الإجابة لا تبدأ بحرف "{letter}"!</p>}
                  </div>
                </div>
              );
            })}
          </div>
          
          <button 
            onClick={handleStart}
            disabled={!isManualValid()}
            className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold text-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            ابدأ اللعبة
          </button>
        </div>
      )}
    </div>
  );
};

const HexCell: React.FC<{
  cell: CellData;
  onClick: () => void;
  winIndex: number;
}> = ({ cell, onClick, winIndex }) => {
  let fillColor = '#F5F0DC'; // idle cream
  let borderColor = '#000000';
  let content = <span className="text-5xl font-bold font-['Scheherazade_New'] text-black">{cell.letter}</span>;

  if (cell.state === 'active') {
    fillColor = '#FFFACD';
    borderColor = '#FFD700';
  } else if (cell.state === 'red') {
    fillColor = '#CC2200';
    content = <span className="text-5xl font-bold font-['Scheherazade_New'] text-white">{cell.letter} <span className="text-2xl">✓</span></span>;
  } else if (cell.state === 'green') {
    fillColor = '#1A7A00';
    content = <span className="text-5xl font-bold font-['Scheherazade_New'] text-white">{cell.letter} <span className="text-2xl">✓</span></span>;
  }

  const isWinningPath = winIndex !== -1;

  return (
    <div 
      className={`relative w-[100px] h-[115px] flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 ${cell.state === 'active' ? 'animate-pulse-glow z-10' : ''} ${isWinningPath ? 'animate-win-pulse z-20' : ''}`}
      style={isWinningPath ? { animationDelay: `${winIndex * 150}ms` } : {}}
      onClick={cell.state === 'idle' ? onClick : undefined}
    >
      <svg viewBox="0 0 100 115" className="absolute inset-0 w-full h-full drop-shadow-md">
        <polygon 
          points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" 
          fill={fillColor} 
          stroke={borderColor} 
          strokeWidth={cell.state === 'active' ? "6" : "3"} 
        />
      </svg>
      <div className="relative z-10 pointer-events-none">
        {content}
      </div>
    </div>
  );
};

const GameScreen: React.FC<{ config: any }> = ({ config }) => {
  const [cells, setCells] = useState<CellData[][]>([]);
  const [currentTurn, setCurrentTurn] = useState<Team>('red');
  const [activeCell, setActiveCell] = useState<CellData | null>(null);
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isStealPhase, setIsStealPhase] = useState(false);
  const [winningPath, setWinningPath] = useState<string[] | null>(null);
  const [winner, setWinner] = useState<Team | null>(null);
  
  const questionCache = useRef<Record<string, QuestionData>>({});

  // Initialize grid
  useEffect(() => {
    const initialCells: CellData[][] = LETTERS.map((row, rIdx) => 
      row.map((letter, cIdx) => ({
        id: `${rIdx}-${cIdx}`,
        row: rIdx,
        col: cIdx,
        letter,
        state: 'idle'
      }))
    );
    setCells(initialCells);
    
    if (config.mode === 'manual') {
      questionCache.current = config.manualQuestions;
    }
  }, [config]);

  useEffect(() => {
    if (winner) {
      const colors = winner === 'red' ? ['#ef4444', '#b91c1c'] : ['#22c55e', '#15803d'];
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: colors
      });
    }
  }, [winner]);

  // Timer
  useEffect(() => {
    if (!activeCell || isLoading || winner) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [activeCell, isLoading, winner, isStealPhase]);

  const handleTimeout = () => {
    handleAnswer(false);
  };

  const fetchQuestion = async (letter: string) => {
    if (questionCache.current[letter]) {
      return questionCache.current[letter];
    }

    setIsLoading(true);
    try {
      const apiKey = (window as any).anthropic_api_key || (window as any).ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("API key not found");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `أنت منشئ أسئلة مسابقات عربية. 
اكتب سؤالاً واحداً فقط بالعربية تكون إجابته كلمة تبدأ بحرف "${letter}".
الفئة: ${config.categories.join('، ')}
المستوى: ${config.difficulty}

القواعد الصارمة:
- الإجابة يجب أن تبدأ بالحرف "${letter}" حصراً
- السؤال يجب أن يكون واضحاً ومحدداً وله إجابة واحدة فقط
- لا تذكر الإجابة في السؤال

أجب بهذا JSON فقط بدون أي نص إضافي:
{"question": "نص السؤال هنا؟", "answer": "الإجابة هنا"}`
          }]
        })
      });

      const data = await response.json();
      let text = data.content[0].text;
      // Strip markdown if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);
      
      questionCache.current[letter] = parsed;
      return parsed;
    } catch (error) {
      console.error("Failed to fetch question:", error);
      return { question: "حدث خطأ في جلب السؤال. يرجى المحاولة مرة أخرى.", answer: "خطأ" };
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellClick = async (cell: CellData) => {
    if (activeCell || winner || cell.state !== 'idle') return;

    // Update cell state to active
    setCells(prev => prev.map(row => row.map(c => c.id === cell.id ? { ...c, state: 'active' } : c)));
    setActiveCell(cell);
    setTimeLeft(15);
    setIsStealPhase(false);

    const qData = await fetchQuestion(cell.letter);
    setQuestionData(qData);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!activeCell) return;

    if (isCorrect) {
      // Current team gets the cell
      const winningTeam = isStealPhase ? (currentTurn === 'red' ? 'green' : 'red') : currentTurn;
      
      setCells(prev => {
        const newCells = prev.map(row => row.map(c => c.id === activeCell.id ? { ...c, state: winningTeam } : c));
        
        // Check win
        const winPath = checkWin(newCells, winningTeam);
        if (winPath) {
          setWinningPath(winPath);
          setWinner(winningTeam);
        }
        return newCells;
      });
      
      // Reset and switch turn
      setActiveCell(null);
      setQuestionData(null);
      setIsStealPhase(false);
      setCurrentTurn(prev => prev === 'red' ? 'green' : 'red');
      
    } else {
      if (!isStealPhase) {
        // Enter steal phase
        setIsStealPhase(true);
        setTimeLeft(10);
      } else {
        // Steal failed, cell goes back to idle
        setCells(prev => prev.map(row => row.map(c => c.id === activeCell.id ? { ...c, state: 'idle' } : c)));
        setActiveCell(null);
        setQuestionData(null);
        setIsStealPhase(false);
        setCurrentTurn(prev => prev === 'red' ? 'green' : 'red');
      }
    }
  };

  // Calculate scores
  const redScore = cells.flat().filter(c => c.state === 'red').length;
  const greenScore = cells.flat().filter(c => c.state === 'green').length;

  const activeTeamName = currentTurn === 'red' ? config.redTeam : config.greenTeam;
  const activeTeamColor = currentTurn === 'red' ? 'text-red-600' : 'text-green-600';
  
  const answeringTeam = isStealPhase ? (currentTurn === 'red' ? 'green' : 'red') : currentTurn;
  const answeringTeamName = answeringTeam === 'red' ? config.redTeam : config.greenTeam;

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col items-center min-h-screen">
      
      {/* Scoreboard */}
      <div className="w-full bg-white rounded-2xl shadow-md p-4 mb-8 flex items-center justify-between border-2 border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold shadow-inner">
            {redScore}
          </div>
          <div className="text-xl font-bold text-red-700">{config.redTeam}</div>
        </div>
        
        <div className="text-center">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">دور الفريق</div>
          <div className={`text-2xl font-black ${activeTeamColor} px-6 py-2 bg-slate-50 rounded-full border border-slate-100`}>
            ◄ {activeTeamName} ►
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xl font-bold text-green-700">{config.greenTeam}</div>
          <div className="w-16 h-16 bg-green-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold shadow-inner">
            {greenScore}
          </div>
        </div>
      </div>

      {/* Question Panel */}
      {activeCell && (
        <div className={`w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8 mb-8 border-4 transition-colors duration-300 ${answeringTeam === 'red' ? 'border-red-500' : 'border-green-500'}`}>
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div className="text-2xl font-bold">
              الحرف: <span className="text-4xl font-black font-['Scheherazade_New'] text-amber-600">{activeCell.letter}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱</span>
              <span className={`text-4xl font-black font-mono ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                00:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
          
          <div className="min-h-[120px] flex items-center justify-center mb-8">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold">جارٍ توليد السؤال...</p>
              </div>
            ) : questionData ? (
              <div className="text-center w-full">
                {isStealPhase && (
                  <div className="inline-block px-4 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-sm mb-4 animate-bounce">
                    فرصة سرقة للفريق {answeringTeamName}!
                  </div>
                )}
                <h3 className="text-3xl font-bold text-slate-800 leading-relaxed mb-6">{questionData.question}</h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                  <span className="text-slate-500 font-bold mr-2">الإجابة:</span>
                  <span className="text-2xl font-black text-slate-900">{questionData.answer}</span>
                </div>
              </div>
            ) : null}
          </div>

          {!isLoading && (
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => handleAnswer(true)}
                className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-xl hover:bg-green-600 transition-all shadow-lg flex items-center gap-2"
              >
                <span>✅</span> إجابة صحيحة
              </button>
              <button 
                onClick={() => handleAnswer(false)}
                className="px-8 py-4 bg-red-500 text-white rounded-xl font-bold text-xl hover:bg-red-600 transition-all shadow-lg flex items-center gap-2"
              >
                <span>❌</span> إجابة خاطئة
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hex Board */}
      <div className="relative mt-8 p-12 bg-slate-900 rounded-[3rem] shadow-2xl border-8 border-slate-800">
        {/* Top Green Edge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={`top-${i}`} className="w-[80px] h-[92px]">
              <svg viewBox="0 0 100 115" className="w-full h-full drop-shadow-md">
                <polygon points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" fill="#1A7A00" stroke="#000" strokeWidth="3" />
              </svg>
            </div>
          ))}
        </div>

        {/* Bottom Green Edge */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={`bot-${i}`} className="w-[80px] h-[92px]">
              <svg viewBox="0 0 100 115" className="w-full h-full drop-shadow-md">
                <polygon points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" fill="#1A7A00" stroke="#000" strokeWidth="3" />
              </svg>
            </div>
          ))}
        </div>

        {/* Right Red Edge (RTL so it's on the right visually) */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={`right-${i}`} className="w-[80px] h-[92px]" style={{ marginLeft: i % 2 === 0 ? '40px' : '0' }}>
              <svg viewBox="0 0 100 115" className="w-full h-full drop-shadow-md">
                <polygon points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" fill="#CC2200" stroke="#000" strokeWidth="3" />
              </svg>
            </div>
          ))}
        </div>

        {/* Left Red Edge */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={`left-${i}`} className="w-[80px] h-[92px]" style={{ marginRight: i % 2 === 0 ? '40px' : '0' }}>
              <svg viewBox="0 0 100 115" className="w-full h-full drop-shadow-md">
                <polygon points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" fill="#CC2200" stroke="#000" strokeWidth="3" />
              </svg>
            </div>
          ))}
        </div>

        {/* Grid Container */}
        <div className="relative z-10 p-8">
          {cells.map((row, rIdx) => (
            <div 
              key={rIdx} 
              className="flex justify-center"
              style={{ 
                marginTop: rIdx === 0 ? '0' : '-28px',
                marginInlineStart: rIdx % 2 === 0 ? '50px' : '0' // Offset for even rows
              }}
            >
              {row.map((cell) => {
                const winIndex = winningPath?.indexOf(cell.id) ?? -1;
                return (
                  <div key={cell.id} style={{ margin: '0 -2px' }}>
                    <HexCell 
                      cell={cell} 
                      onClick={() => handleCellClick(cell)} 
                      winIndex={winIndex}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Win Overlay */}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-lg w-full border-8 border-amber-400">
            <div className="text-8xl mb-6 animate-bounce">🏆</div>
            <h2 className="text-5xl font-black mb-4">
              فاز {winner === 'red' ? config.redTeam : config.greenTeam}!
            </h2>
            <p className="text-xl text-slate-600 font-bold mb-8">
              {winner === 'red' ? 'بخط متصل من اليمين لليسار' : 'بخط متصل من الأعلى للأسفل'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xl hover:bg-slate-800 transition-all shadow-lg"
            >
              🔄 لعبة جديدة
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default function App() {
  const [config, setConfig] = useState<any>(null);
  const [isRemote, setIsRemote] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'remote') {
      setIsRemote(true);
    }
  }, []);

  if (isRemote) {
    return <RemoteBuzzer />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      {!config ? (
        <SetupScreen onStart={setConfig} />
      ) : (
        <GameScreen config={config} />
      )}
    </div>
  );
}
