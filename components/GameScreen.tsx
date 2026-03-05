import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { GameConfig, GameMode, Question, Player, Difficulty, QuestionType } from '../types';
import BuzzerScreen from './BuzzerScreen';

interface Props {
  config: GameConfig;
  questions: Question[];
  players: Player[];
  onFinish: (players: Player[]) => void;
}

const TIMER_DURATION = 20;

const LETTERS = [
  ['أ', 'ب', 'ت', 'ث', 'ج'],
  ['ح', 'خ', 'د', 'ذ', 'ر'],
  ['ز', 'س', 'ش', 'ص', 'ض'],
  ['ط', 'ظ', 'ع', 'غ', 'ف'],
  ['ق', 'ك', 'ل', 'م', 'ن']
];

const GameScreen: React.FC<Props> = ({ config, questions, players: initialPlayers, onFinish }) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({}); 
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [winner, setWinner] = useState<Player | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [winningPath, setWinningPath] = useState<string[]>([]);

  const questionCache = useRef<Record<string, Question>>({});

  // Initialize cache with manual questions or start background pre-fetching for AI
  useEffect(() => {
    if (config.mode === GameMode.HEX_GRID) {
      if (config.hexMode === 'manual' && config.hexManualQuestions) {
        const cache: Record<string, Question> = {};
        Object.entries(config.hexManualQuestions).forEach(([letter, data]) => {
          const qData = data as { question: string; answer: string };
          cache[letter] = {
            id: `manual-${letter}`,
            text: qData.question,
            answer: qData.answer,
            category: 'يدوي',
            points: 100,
            letter: letter,
            type: QuestionType.OPEN,
            difficulty: config.difficulty
          };
        });
        questionCache.current = cache;
      }
    }
  }, [config]);

  const grid: Question[][] = useMemo(() => {
    if (config.mode === GameMode.HEX_GRID) {
      // 5x5 grid for HEX_GRID
      // If we have pre-generated questions, map them to the grid (5 columns of 5 rows)
      if (questions && questions.length > 0) {
        const questionMap = new Map<string, Question>();
        questions.forEach(q => {
          if (q.letter) questionMap.set(q.letter, q);
        });

        const cols: Question[][] = [];
        for (let c = 0; c < 5; c++) {
          const col: Question[] = [];
          for (let r = 0; r < 5; r++) {
            const expectedLetter = LETTERS[c][r];
            const q = questionMap.get(expectedLetter);
            
            if (q) {
              col.push(q);
            } else {
              // Fallback for missing questions
              col.push({
                id: `${c}-${r}`,
                text: '',
                answer: '',
                category: '',
                points: 100,
                letter: expectedLetter,
                type: QuestionType.OPEN,
                difficulty: config.difficulty
              });
            }
          }
          cols.push(col);
        }
        return cols;
      }

      // Fallback: empty grid with letters
      return LETTERS.map((colLetters, cIdx) => 
        colLetters.map((letter, rIdx) => ({
          id: `${cIdx}-${rIdx}`,
          text: '',
          answer: '',
          category: '',
          points: 100,
          letter: letter,
          type: QuestionType.OPEN,
          difficulty: config.difficulty
        }))
      );
    } else {
      // Classic GRID layout (e.g. Jeopardy)
      const layout = [4, 4, 4, 4, 4];
      const cols: Question[][] = [[], [], [], [], []];
      let currentIdx = 0;
      layout.forEach((count, colIdx) => {
        for (let i = 0; i < count; i++) {
          if (questions[currentIdx]) {
            cols[colIdx].push(questions[currentIdx]);
            currentIdx++;
          }
        }
      });
      return cols;
    }
  }, [questions, config.mode, config.difficulty]);

  const checkPath = useCallback((color: string) => {
    if (config.mode !== GameMode.HEX_GRID) return false;
    
    const rows = 5;
    const cols = 5;
    const visited = new Set<string>();
    const queue: { r: number; c: number; path: string[] }[] = [];

    const getNeighbors = (r: number, c: number) => {
      const isEvenCol = c % 2 === 0;
      // Neighbors for column-staggered grid (even columns are high, odd columns are low)
      const neighbors = isEvenCol ? [
        [r - 1, c], [r + 1, c], // same col
        [r - 1, c - 1], [r, c - 1], // prev col
        [r - 1, c + 1], [r, c + 1], // next col
      ] : [
        [r - 1, c], [r + 1, c], // same col
        [r, c - 1], [r + 1, c - 1], // prev col
        [r, c + 1], [r + 1, c + 1], // next col
      ];
      
      return neighbors.filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols);
    };

    if (color === players[0]?.color) { // Red: Left to Right (col 0 to col 4)
      for (let r = 0; r < rows; r++) {
        if (answeredMap[grid[0][r].id] === color) {
          queue.push({ r, c: 0, path: [grid[0][r].id] });
          visited.add(`0,${r}`);
        }
      }
      
      while (queue.length > 0) {
        const { r, c, path } = queue.shift()!;
        if (c === cols - 1) {
          setWinningPath(path);
          return true;
        }

        for (const [nr, nc] of getNeighbors(r, c)) {
          const nqId = grid[nc][nr].id;
          const key = `${nc},${nr}`;
          if (answeredMap[nqId] === color && !visited.has(key)) {
            visited.add(key);
            queue.push({ r: nr, c: nc, path: [...path, nqId] });
          }
        }
      }
    } else if (color === players[1]?.color) { // Green: Top to Bottom (row 0 to row 4)
      for (let c = 0; c < cols; c++) {
        const qId = grid[c][0].id;
        if (answeredMap[qId] === color) {
          queue.push({ r: 0, c, path: [qId] });
          visited.add(`${c},0`);
        }
      }

      while (queue.length > 0) {
        const { r, c, path } = queue.shift()!;
        if (r === rows - 1) {
          setWinningPath(path);
          return true;
        }

        for (const [nr, nc] of getNeighbors(r, c)) {
          const nqId = grid[nc][nr].id;
          const key = `${nc},${nr}`;
          if (answeredMap[nqId] === color && !visited.has(key)) {
            visited.add(key);
            queue.push({ r: nr, c: nc, path: [...path, nqId] });
          }
        }
      }
    }
    return false;
  }, [grid, answeredMap, config.mode, players]);

  const handleAnswer = useCallback((playerId: string | null, isCorrect: boolean) => {
    if (!activeQuestion) return;
    
    let newPlayers = [...players];
    let updatedAnsweredMap = { ...answeredMap };
    
    if (playerId && isCorrect) {
      const player = players.find(p => p.id === playerId);
      if (player) {
        updatedAnsweredMap[activeQuestion.id] = player.color;
        setAnsweredMap(updatedAnsweredMap);
      }
    } else if (!playerId && !isCorrect) {
      // Mark as skipped
      updatedAnsweredMap[activeQuestion.id] = '#475569'; // slate-600
      setAnsweredMap(updatedAnsweredMap);
    }

    if (playerId) {
      newPlayers = players.map(p => {
        if (p.id === playerId) {
          const pts = activeQuestion.points || 100;
          return { ...p, score: Math.max(0, p.score + (isCorrect ? pts : 0)) };
        }
        return p;
      });
      setPlayers(newPlayers);
    }

    // Switch turn if it's HEX_GRID mode
    if (config.mode === GameMode.HEX_GRID) {
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
    }

    setActiveQuestion(null);
  }, [activeQuestion, players, answeredMap]);

  useEffect(() => {
    // Check for winner whenever answeredMap changes
    if (config.mode === GameMode.HEX_GRID) {
      players.forEach(p => {
        if (checkPath(p.color)) {
          setWinner(p);
        }
      });
    } else if (config.mode === GameMode.GRID) {
      if (Object.keys(answeredMap).length === questions.length && questions.length > 0) {
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        setWinner(sortedPlayers[0]);
      }
    }
  }, [answeredMap, checkPath, players, config.mode, questions.length]);

  useEffect(() => {
    let timer: number;
    if (activeQuestion && !revealed) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAnswer(null, false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuestion, revealed, handleAnswer]);

  useEffect(() => {
    if (activeQuestion) {
      setTimeLeft(TIMER_DURATION);
      setRevealed(false);
    }
  }, [activeQuestion]);

  const jeopardyGrid = useMemo(() => {
    if (config.mode !== GameMode.GRID) return {};
    const categories: Record<string, Question[]> = {};
    questions.forEach(q => {
      if (!categories[q.category]) {
        categories[q.category] = [];
      }
      categories[q.category].push(q);
    });
    // Sort questions by points within each category
    Object.keys(categories).forEach(cat => {
      categories[cat].sort((a, b) => a.points - b.points);
    });
    return categories;
  }, [questions, config.mode]);

  const renderJeopardyBoard = () => {
    const categories = Object.keys(jeopardyGrid);
    if (categories.length === 0) return null;

    return (
      <div className="w-full max-w-6xl mx-auto bg-slate-900 p-6 rounded-[3rem] shadow-2xl border-4 border-slate-800">
        <div className="grid grid-cols-4 gap-4">
          {categories.map((cat, i) => (
            <div key={i} className="space-y-4">
              <div className="bg-sky-600 text-white p-4 rounded-2xl text-center shadow-inner h-24 flex items-center justify-center border-b-4 border-sky-800">
                <h3 className="font-black text-lg md:text-xl leading-tight">{cat}</h3>
              </div>
              {jeopardyGrid[cat].map((q, j) => {
                const isAnswered = !!answeredMap[q.id];
                const color = answeredMap[q.id];
                return (
                  <button
                    key={q.id}
                    disabled={isAnswered}
                    onClick={() => setActiveQuestion(q)}
                    className={`w-full h-20 rounded-2xl font-black text-3xl transition-all transform hover:scale-105 ${
                      isAnswered 
                        ? 'opacity-50 cursor-not-allowed text-white shadow-inner' 
                        : 'bg-slate-800 text-sky-400 hover:bg-sky-500 hover:text-white shadow-lg border-2 border-slate-700 hover:border-sky-400'
                    }`}
                    style={isAnswered ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {isAnswered ? '✓' : q.points}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const fetchQuestion = async (letter: string, silent: boolean = false): Promise<Question> => {
    if (questionCache.current[letter]) {
      return questionCache.current[letter];
    }

    if (!silent) setIsLoadingQuestion(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const topic = config.topic || 'عام';
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `أنت خبير متخصص في إعداد المسابقات الثقافية الممتعة والمتوازنة. 
اكتب سؤالاً واحداً فقط بالعربية تكون إجابته كلمة تبدأ بحرف "${letter}".
الموضوع: ${topic}
المستوى: ${config.difficulty === Difficulty.MEDIUM ? "متوسط (متوازن، يتطلب ثقافة عامة جيدة دون تعقيد مفرط)" : config.difficulty}

القواعد الصارمة لضمان جودة السؤال:
- الإجابة يجب أن تبدأ بالحرف "${letter}" حصراً.
- "ال" التعريف لا تحتسب كبداية للكلمة.
- مراعاة السياق الثقافي: يجب أن يكون السؤال ملائماً للثقافة العربية والإسلامية.
- مستوى متوازن: تجنب الأسئلة السطحية جداً (البديهية)، وفي نفس الوقت تجنب الأسئلة التعجيزية أو التخصصية المعقدة. السؤال يجب أن يكون في متناول الشخص المثقف والمطلع.
- صياغة واضحة: يجب أن يكون السؤال واضحاً، مشوقاً، ولا يحتمل أكثر من إجابة صحيحة.
- لا تذكر الإجابة في السؤال.
- تأكد من دقة المعلومات بنسبة 100%.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "نص السؤال" },
              answer: { type: Type.STRING, description: "الإجابة" }
            },
            required: ["question", "answer"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      
      const q: Question = {
        id: `ai-${letter}-${Date.now()}`,
        text: parsed.question,
        answer: parsed.answer,
        category: 'ذكاء اصطناعي',
        points: 100,
        letter: letter,
        type: QuestionType.OPEN,
        difficulty: config.difficulty
      };
      questionCache.current[letter] = q;
      return q;
    } catch (error) {
      console.error("Failed to fetch question:", error);
      return { 
        id: `error-${letter}`,
        text: "حدث خطأ في جلب السؤال. يرجى المحاولة مرة أخرى.", 
        answer: "خطأ",
        category: 'خطأ',
        points: 0,
        letter: letter,
        type: QuestionType.OPEN,
        difficulty: config.difficulty
      };
    } finally {
      if (!silent) setIsLoadingQuestion(false);
    }
  };

  const handleHexClick = async (q: Question) => {
    if (answeredMap[q.id] || isLoadingQuestion) return;
    
    if (config.hexMode === 'ai' && !q.text) {
      const fetchedQ = await fetchQuestion(q.letter!);
      setActiveQuestion(fetchedQ);
    } else {
      setActiveQuestion(q);
    }
  };

  const renderActiveQuestion = () => {
    if (!activeQuestion && !isLoadingQuestion) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
        <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden text-center border-[12px] border-slate-50">
          {!isLoadingQuestion && <div className="absolute top-0 left-0 h-2 bg-blue-600 transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}></div>}
          
          {isLoadingQuestion ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="w-16 h-16 border-8 border-slate-100 border-t-sky-500 rounded-full animate-spin"></div>
              <h3 className="text-2xl font-black text-slate-800">جاري توليد السؤال...</h3>
            </div>
          ) : activeQuestion && (
            <>
              <div className="space-y-6">
                <div className="flex justify-center items-center gap-6">
                  <div className={`w-24 h-24 bg-black rounded-[2rem] flex items-center justify-center text-[#fefcd2] font-black shadow-2xl transform -rotate-2 ${config.mode === GameMode.GRID ? 'text-4xl' : 'text-6xl'}`}>
                    {config.mode === GameMode.GRID 
                      ? activeQuestion.points 
                      : (activeQuestion.letter || (activeQuestion.answer ? activeQuestion.answer[0] : '?'))}
                  </div>
                </div>
                <h3 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">
                  {activeQuestion.text}
                </h3>
                <div className="flex justify-center gap-3">
                  <p className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-400 font-black tracking-widest uppercase text-[10px]">{activeQuestion.category}</p>
                  <p className={`px-4 py-2 rounded-2xl font-black tracking-widest uppercase text-[10px] ${
                    activeQuestion.difficulty === Difficulty.EASY ? 'bg-green-100 text-green-600' :
                    activeQuestion.difficulty === Difficulty.MEDIUM ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {activeQuestion.difficulty === Difficulty.EASY ? 'سهل' : 
                     activeQuestion.difficulty === Difficulty.MEDIUM ? 'متوسط' : 'صعب'}
                  </p>
                </div>
              </div>

              <div className="mt-12">
                {!revealed ? (
                  <button 
                    onClick={() => setRevealed(true)}
                    className="w-full py-6 sky-btn rounded-2xl text-2xl font-black shadow-xl transform transition hover:scale-102 active:scale-98"
                  >
                    تحقق من الإجابة
                  </button>
                ) : (
                  <div className="space-y-10 animate-fade-up">
                    <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner">
                      <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                      <p className="text-5xl font-black text-black">{activeQuestion.answer}</p>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex gap-4">
                        {players.map((p, idx) => (
                          <button 
                            key={p.id}
                            onClick={() => handleAnswer(p.id, true)}
                            className="flex-1 py-6 rounded-3xl text-white text-2xl font-black shadow-xl transform transition hover:scale-105 active:scale-95"
                            style={{ backgroundColor: p.color }}
                          >
                            إجابة صحيحة ({p.name})
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleAnswer(null, false)}
                        className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black hover:bg-slate-200 transition-all text-xl"
                      >
                        تخطي / لا أحد أجاب
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderWinnerModal = () => {
    if (!winner) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl text-center border-[16px] border-slate-50">
          <div className="text-8xl mb-8">🏆</div>
          <h2 className="text-5xl font-black text-slate-900 mb-4">فوز مستحق!</h2>
          <div className="inline-block px-8 py-3 rounded-2xl text-white text-2xl font-black mb-8" style={{backgroundColor: winner.color}}>
            {winner.name}
          </div>
          <p className="text-slate-500 font-bold mb-12">
            {config.mode === GameMode.HEX_GRID 
              ? 'لقد نجحتم في تكوين المسار المتصل أولاً!' 
              : `لقد فزتم بأعلى رصيد من النقاط (${winner.score} نقطة)!`}
          </p>
          <button 
            onClick={() => onFinish(players)}
            className="w-full py-6 sky-btn rounded-2xl text-2xl font-black shadow-xl"
          >
            عرض النتائج النهائية
          </button>
        </div>
      </div>
    );
  };

  if (config.mode === GameMode.BUZZER) {
    return <BuzzerScreen config={config} questions={questions} players={players} onFinish={onFinish} />;
  }

  return (
    <div className="flex flex-col items-center gap-12 py-10 min-h-screen bg-slate-50/50">
      {/* عرض النقاط المطور - بطاقات عائمة */}
      <div className="flex justify-center gap-8 w-full max-w-5xl px-6">
        {players.map((p, idx) => {
          const isCurrent = idx === currentPlayerIndex;
          return (
            <div 
              key={p.id} 
              className={`flex-1 bg-white p-6 rounded-[2.5rem] border-2 shadow-xl flex items-center gap-6 transform transition-all ${isCurrent ? 'scale-110 border-sky-400 ring-4 ring-sky-100' : 'border-slate-200 opacity-80'}`}
            >
              <div 
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-lg shrink-0" 
                style={{backgroundColor: p.color, boxShadow: `0 10px 20px ${p.color}44`}}
              >
                {p.score}
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                  {config.mode === GameMode.HEX_GRID ? (idx === 0 ? 'المسار الأفقي' : 'المسار العمودي') : 'النقاط'}
                  {isCurrent && config.mode === GameMode.HEX_GRID && <span className="mr-2 text-sky-500">● دورك الآن</span>}
                </span>
                <p className="text-xl font-black text-slate-800 truncate max-w-[120px]">{p.name}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* لوحة اللعب الرئيسية */}
      {config.mode === GameMode.GRID ? (
        renderJeopardyBoard()
      ) : (
        <div 
          className="relative group animate-fade-in w-full flex justify-center" 
          style={{ '--current-player-color': players[currentPlayerIndex].color } as React.CSSProperties}
        >
          <div className="game-board-area relative z-10 transition-transform duration-700 hover:scale-[1.02]">
            <div className="board-wrapper">
              <div className="hex-grid-center">
                <svg viewBox="0 0 500 600" className="w-full h-auto max-w-[1000px] hex-svg-container drop-shadow-2xl mx-auto">
                  <defs>
                    <filter id="scribble-filter" x="-20%" y="-20%" width="140%" height="140%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                      <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
                    </filter>
                  </defs>
                  
                  {/* Left Red Goal - Interlocking */}
                  <path 
                    d="M 0 0 L 40 18 L 10 70 L 40 122 L 10 174 L 40 226 L 10 278 L 40 330 L 10 382 L 40 434 L 10 486 L 40 538 L 0 600 Z" 
                    className={`goal-area goal-area-red ${currentPlayerIndex === 0 ? 'active-turn' : ''}`}
                  />
                  
                  {/* Right Red Goal - Interlocking */}
                  <path 
                    d="M 500 0 L 460 18 L 490 70 L 460 122 L 490 174 L 460 226 L 490 278 L 460 330 L 490 382 L 460 434 L 490 486 L 460 538 L 500 600 Z" 
                    className={`goal-area goal-area-red ${currentPlayerIndex === 0 ? 'active-turn' : ''}`}
                  />

                  {/* Top Green Goal - Interlocking */}
                  <path 
                    d="M 0 0 L 500 0 L 460 18 L 400 18 L 370 70 L 310 70 L 280 18 L 220 18 L 190 70 L 130 70 L 100 18 L 40 18 Z" 
                    className={`goal-area goal-area-green ${currentPlayerIndex === 1 ? 'active-turn' : ''}`}
                  />

                  {/* Bottom Green Goal - Interlocking */}
                  <path 
                    d="M 0 600 L 500 600 L 460 538 L 400 538 L 370 590 L 310 590 L 280 538 L 220 538 L 190 590 L 130 590 L 100 538 L 40 538 Z" 
                    className={`goal-area goal-area-green ${currentPlayerIndex === 1 ? 'active-turn' : ''}`}
                  />

                  {grid.map((col, cIdx) => {
                    // Flat-topped hexagon: Width=120, Height=104
                    // Horizontal spacing = 90 (120 * 0.75)
                    // Vertical spacing = 104
                    const x = cIdx * 90 + 70; 
                    
                    // Stagger columns: odd columns are shifted down by half height (52)
                    const verticalOffset = (cIdx % 2 === 1) ? 52 : 0;
                    
                    return col.map((q, rIdx) => {
                      const y = rIdx * 104 + verticalOffset + 70;
                      const color = answeredMap[q.id];
                      
                      const isRed = color?.toLowerCase() === players[0]?.color.toLowerCase();
                      const isGreen = color?.toLowerCase() === players[1]?.color.toLowerCase();
                      const isSkipped = color === '#475569';
                      const activeClass = isRed ? 'active-red' : isGreen ? 'active-green' : isSkipped ? 'opacity-40 grayscale' : '';
                      
                      const isWinning = winningPath.includes(q.id);
                      
                      // Flat-topped hexagon points (120x104)
                      const points = "30,0 90,0 120,52 90,104 30,104 0,52";
                      const animDelay = `${(cIdx + rIdx) * 0.1}s`;
                      
                      return (
                        <g 
                          key={q.id} 
                          transform={`translate(${x - 60}, ${y - 52})`}
                          className={`hex-group ${activeClass} ${isWinning ? 'animate-win-pulse' : ''} cursor-pointer transition-all duration-300`}
                          style={{ animationDelay: animDelay }}
                          onClick={() => !color && handleHexClick(q)}
                        >
                          <polygon points={points} className="hex-polygon" />
                          <text x="60" y="52" className="hex-text select-none">
                            {q.letter || (q.answer ? q.answer[0] : '?')}
                          </text>
                        </g>
                      );
                    });
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderActiveQuestion()}
      {renderWinnerModal()}

      <div className="flex gap-4 mt-4">
        <button 
          onClick={() => onFinish(players)}
          className="px-12 py-5 bg-white text-slate-900 border-2 border-slate-200 rounded-3xl font-black hover:bg-slate-50 transition-all shadow-lg text-lg"
        >
          عرض الترتيب الحالي
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-5 bg-red-50 text-red-600 rounded-3xl font-black hover:bg-red-100 transition-all text-lg"
        >
          إعادة البدء
        </button>
      </div>
    </div>
  );
};

export default GameScreen;