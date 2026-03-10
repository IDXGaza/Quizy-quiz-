import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Type } from "@google/genai";
import { GameConfig, GameMode, Question, Player, Difficulty, QuestionType, PowerType } from '../types';
import BuzzerScreen from './BuzzerScreen';
import TimedChallengeScreen from './TimedChallengeScreen';
import PictureGuessScreen from './PictureGuessScreen';
import { useSettings } from '../contexts/SettingsContext';
import { extractJson, getAI } from '../services/geminiService';

interface Props {
  config: GameConfig;
  questions: Question[];
  players: Player[];
  onFinish: (players: Player[]) => void;
}

const TIMER_DURATION = 20;

const LETTERS = [
  ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'],
  ['د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'],
  ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق'],
  ['ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي']
];

const GameScreen: React.FC<Props> = ({ config, questions, players: initialPlayers, onFinish }) => {
  const { settings } = useSettings();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({}); 
  const [revealed, setRevealed] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [winner, setWinner] = useState<Player | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [winningPath, setWinningPath] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<Partial<Question>>({});
  
  // Powers state
  const [frozenCells, setFrozenCells] = useState<Record<string, number>>({}); // cellId -> rounds remaining
  const [shieldedCells, setShieldedCells] = useState<Record<string, boolean>>({}); // cellId -> isShielded
  const [activePower, setActivePower] = useState<PowerType | null>(null);

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
    if (!players || players.length === 0) return [];
    
    if (config.mode === GameMode.HEX_GRID) {
      // 4x7 grid for HEX_GRID (28 letters)
      if (questions && questions.length > 0) {
        const cols: Question[][] = [];
        let idx = 0;
        for (let c = 0; c < 4; c++) {
          const col: Question[] = [];
          for (let r = 0; r < 7; r++) {
            const q = questions[idx++];
            if (q) {
              col.push({
                ...q,
                id: `${c}-${r}`,
                letter: q.letter || LETTERS[c][r]
              });
            } else {
              // Fallback for missing questions
              col.push({
                id: `${c}-${r}`,
                text: '',
                answer: '',
                category: '',
                points: 100,
                letter: LETTERS[c][r],
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
      // Classic GRID layout (e.g. Jeopardy) - 5 categories x 5 questions
      const layout = [5, 5, 5, 5, 5];
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
    if (config.mode !== GameMode.HEX_GRID || !grid || grid.length === 0) return false;
    
    const rows = 7;
    const cols = 4;
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

    if (color === players[0]?.color) { // Red: Left to Right (col 0 to col 3)
      if (!grid[0]) return false;
      for (let r = 0; r < rows; r++) {
        if (grid[0] && grid[0][r] && answeredMap[grid[0][r].id] === color) {
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
    } else if (color === players[1]?.color) { // Green: Top to Bottom (row 0 to row 6)
      for (let c = 0; c < cols; c++) {
        if (grid[c] && grid[c][0]) {
          const qId = grid[c][0].id;
          if (answeredMap[qId] === color) {
            queue.push({ r: 0, c, path: [qId] });
            visited.add(`${c},0`);
          }
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
        
        // If it was a steal, remove shield if any
        if (activePower === PowerType.STEAL) {
          setShieldedCells(prev => ({ ...prev, [activeQuestion.id]: false }));
        }

        // Close question after a correct answer
        setActiveQuestion(null);
        setRevealed(false);
        setShowScoring(false);
      }
    } else if (playerId && !isCorrect) {
      // Wrong answer - subtract points in Grid mode
      newPlayers = players.map(p => {
        if (p.id === playerId) {
          const pts = activeQuestion.points || 100;
          const scoreChange = config.mode === GameMode.GRID ? -pts : 0;
          return { ...p, score: Math.max(0, p.score + scoreChange) };
        }
        return p;
      });
      setPlayers(newPlayers);
      
      // If it's HEX_GRID, turn switches and question closes
      if (config.mode === GameMode.HEX_GRID) {
        setActiveQuestion(null);
        setRevealed(false);
        setShowScoring(false);
      }
      // In GRID mode, we stay on the question so others can try
    } else if (!playerId && !isCorrect) {
      // Mark as skipped/no one answered
      updatedAnsweredMap[activeQuestion.id] = '#475569'; // slate-600
      setAnsweredMap(updatedAnsweredMap);
      setActiveQuestion(null);
      setRevealed(false);
      setShowScoring(false);
    }

    if (playerId) {
      setPlayers(newPlayers);
    }

    // Switch turn if it's HEX_GRID mode and turn is over
    if (config.mode === GameMode.HEX_GRID && (isCorrect || !isCorrect || !playerId)) {
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
      setActivePower(null);
      
      setFrozenCells(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          next[id] -= 1;
          if (next[id] <= 0) delete next[id];
        });
        return next;
      });
    }

    if (!activeQuestion) {
      setTimeLeft(TIMER_DURATION);
    }
  }, [activeQuestion, players, answeredMap, config.mode, activePower]);

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
    
    if (!questions || questions.length === 0) return {};

    questions.forEach(q => {
      const catName = q.category || 'عام';
      if (!categories[catName]) {
        categories[catName] = [];
      }
      categories[catName].push(q);
    });
    // Sort questions by points within each category
    Object.keys(categories).forEach(cat => {
      categories[cat].sort((a, b) => (a.points || 0) - (b.points || 0));
    });
    return categories;
  }, [questions, config.mode, config.categories]);

  const renderJeopardyBoard = () => {
    const categories = Object.keys(jeopardyGrid);
    // Use provided categories order if available
    const displayCategories = config.categories && config.categories.length > 0 
      ? config.categories.filter(c => categories.includes(c))
      : categories;

    if (displayCategories.length === 0 && categories.length > 0) {
      // Fallback to all categories if filter resulted in empty
      return (
        <div className="w-full max-w-6xl mx-auto bg-slate-900 p-4 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 border-slate-800 overflow-x-auto">
          <div className={`grid gap-4 min-w-[800px] md:min-w-0`} style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
            {categories.map((cat, i) => (
              <div key={i} className="space-y-4">
                <div className="bg-sky-600 text-white p-4 rounded-2xl text-center shadow-inner h-24 flex items-center justify-center border-b-4 border-sky-800">
                  <h3 className="font-black text-lg md:text-xl leading-tight">{cat}</h3>
                </div>
                {jeopardyGrid[cat].map((q) => {
                  const isAnswered = !!answeredMap[q.id];
                  const color = answeredMap[q.id];
                  return (
                    <button
                      key={q.id}
                      disabled={isAnswered}
                      onClick={() => {
                        setActiveQuestion(q);
                        setEditedQuestion(q);
                        setIsEditing(false);
                      }}
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
    }

    if (categories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900 rounded-[3rem] border-4 border-slate-800 w-full max-w-4xl mx-auto">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-2xl font-bold text-white mb-2">لم يتم العثور على أسئلة</h3>
          <p className="text-slate-400">حاول إعادة البدء بموضوع مختلف</p>
        </div>
      );
    }

    return (
      <div className="w-full max-w-6xl mx-auto bg-slate-900 p-4 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 border-slate-800 overflow-x-auto">
        <div className={`grid gap-4 min-w-[800px] md:min-w-0`} style={{ gridTemplateColumns: `repeat(${displayCategories.length}, 1fr)` }}>
          {displayCategories.map((cat, i) => (
            <div key={i} className="space-y-4">
              <div className="bg-sky-600 text-white p-4 rounded-2xl text-center shadow-inner h-24 flex items-center justify-center border-b-4 border-sky-800">
                <h3 className="font-black text-lg md:text-xl leading-tight">{cat}</h3>
              </div>
              {jeopardyGrid[cat].map((q) => {
                const isAnswered = !!answeredMap[q.id];
                const color = answeredMap[q.id];
                return (
                  <button
                    key={q.id}
                    disabled={isAnswered}
                    onClick={() => {
                      setActiveQuestion(q);
                      setEditedQuestion(q);
                      setIsEditing(false);
                    }}
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
      const topic = config.topic || 'عام';
      const promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات محترف. 
اكتب سؤالاً واحداً فقط بالعربية تكون إجابته كلمة تبدأ بحرف "${letter}".
الموضوع: ${topic}
المستوى: ${config.difficulty === Difficulty.MEDIUM ? "متوسط (متوازن، يتطلب ثقافة عامة جيدة دون تعقيد مفرط)" : config.difficulty}

شروط الجودة الفائقة (عدل السؤال خليه عدل):
- الإجابة يجب أن تبدأ بالحرف "${letter}" حصراً (تجاهل "ال" التعريف).
- الابتكار والعمق: ابتعد عن الأسئلة التقليدية السطحية. استخدم أسلوب الألغاز الذكية، الوصف الأدبي، أو الحقائق المذهلة التي تجعل المتسابق يفكر بعمق.
- الملاءمة الثقافية: يجب أن يكون السؤال ملائماً للثقافة العربية والإسلامية ويستخدم لغة عربية فصيحة.
- الوضوح والدقة: يجب أن يكون السؤال واضحاً، مشوقاً، ولا يحتمل أكثر من إجابة صحيحة واحدة دقيقة.
- لا تذكر الإجابة في السؤال.
- تأكد من دقة المعلومات بنسبة 100%.`;

      let textOutput = "";

      if (settings.aiModel.startsWith("gemini")) {
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: settings.aiModel,
          contents: promptText,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 1024,
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
        textOutput = response.text || "{}";
      } else {
        const backendPrompt = promptText + `\n\nIMPORTANT: You MUST return ONLY a valid JSON object with two keys: "question" (string) and "answer" (string). Do NOT wrap the JSON in markdown blocks like \`\`\`json. Just return the raw JSON object.`;
        
        const res = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptText: backendPrompt, model: settings.aiModel })
        });
        
        if (!res.ok) {
          let errorMessage = "Failed to generate from backend";
          try {
            const err = await res.json();
            errorMessage = err.error || errorMessage;
          } catch (e) {
            errorMessage = await res.text();
          }
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        textOutput = data.text;
      }
      
      textOutput = extractJson(textOutput);
      // Fix potential JSON issues with extremely large numbers before parsing
      // Handle numbers that might be cut off or extremely long
      textOutput = textOutput.replace(/:\s*([0-9]{15,})[^,}\]]*/g, ': 100');
      const parsed = JSON.parse(textOutput);
      
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
    } catch (error: any) {
      // Fallback to Gemini if another model fails
      if (settings.aiModel !== "gemini-3-flash-preview") {
        console.log(`Model ${settings.aiModel} failed to fetch question. Falling back to gemini-3-flash-preview...`);
        try {
          const ai = getAI();
          const topic = config.topic || 'عام';
          const promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات محترف. 
اكتب سؤالاً واحداً فقط بالعربية تكون إجابته كلمة تبدأ بحرف "${letter}".
الموضوع: ${topic}
المستوى: ${config.difficulty === Difficulty.MEDIUM ? "متوسط (متوازن، يتطلب ثقافة عامة جيدة دون تعقيد مفرط)" : config.difficulty}

شروط الجودة الفائقة (عدل السؤال خليه عدل):
- الإجابة يجب أن تبدأ بالحرف "${letter}" حصراً (تجاهل "ال" التعريف).
- الابتكار والعمق: ابتعد عن الأسئلة التقليدية السطحية. استخدم أسلوب الألغاز الذكية، الوصف الأدبي، أو الحقائق المذهلة التي تجعل المتسابق يفكر بعمق.
- الملاءمة الثقافية: يجب أن يكون السؤال ملائماً للثقافة العربية والإسلامية ويستخدم لغة عربية فصيحة.
- الوضوح والدقة: يجب أن يكون السؤال واضحاً، مشوقاً، ولا يحتمل أكثر من إجابة صحيحة واحدة دقيقة.
- لا تذكر الإجابة في السؤال.
- تأكد من دقة المعلومات بنسبة 100%.`;

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: promptText,
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 1024,
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
          let textOutput = response.text || "{}";
          textOutput = extractJson(textOutput);
          // Fix potential JSON issues with extremely large numbers before parsing
          // Handle numbers that might be cut off or extremely long
          textOutput = textOutput.replace(/:\s*([0-9]{15,})[^,}\]]*/g, ': 100');
          const parsed = JSON.parse(textOutput);
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
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
        }
      }

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
    if (isLoadingQuestion) return;
    
    const isFrozen = frozenCells[q.id] > 0;
    const isShielded = shieldedCells[q.id];
    const currentColor = answeredMap[q.id];
    const player = players[currentPlayerIndex];

    // If cell is frozen, nobody can click it
    if (isFrozen) {
      alert("هذه الخلية مجمدة حالياً!");
      return;
    }

    // If using FREEZE power
    if (activePower === PowerType.FREEZE) {
      if (currentColor) {
        alert("لا يمكنك تجميد خلية محتلة!");
        return;
      }
      setFrozenCells(prev => ({ ...prev, [q.id]: players.length })); // Freeze for one full round
      // Consume power
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, powers: { ...p.powers, [PowerType.FREEZE]: p.powers[PowerType.FREEZE] - 1 } } : p));
      setActivePower(null);
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
      return;
    }

    // If using SHIELD power
    if (activePower === PowerType.SHIELD) {
      if (currentColor !== player.color) {
        alert("يمكنك حماية خلاياك فقط!");
        return;
      }
      setShieldedCells(prev => ({ ...prev, [q.id]: true }));
      // Consume power
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, powers: { ...p.powers, [PowerType.SHIELD]: p.powers[PowerType.SHIELD] - 1 } } : p));
      setActivePower(null);
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
      return;
    }

    // If using STEAL power
    if (activePower === PowerType.STEAL) {
      if (!currentColor || currentColor === player.color) {
        alert("يمكنك سرقة خلايا الخصم فقط!");
        return;
      }
      if (isShielded) {
        alert("هذه الخلية محمية بدرع!");
        return;
      }
      // Proceed to question but it will be HARD
      // Consume power
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, powers: { ...p.powers, [PowerType.STEAL]: p.powers[PowerType.STEAL] - 1 } } : p));
    } else {
      // Normal click
      if (currentColor) return;
    }

    if (config.hexMode === 'ai' && !q.text) {
      // If stealing, we might want a harder question
      const fetchedQ = await fetchQuestion(q.letter!);
      const finalQ = activePower === PowerType.STEAL ? { ...fetchedQ, difficulty: Difficulty.HARD, points: fetchedQ.points * 2 } : fetchedQ;
      setActiveQuestion(finalQ);
      setEditedQuestion(finalQ);
    } else {
      const finalQ = activePower === PowerType.STEAL ? { ...q, difficulty: Difficulty.HARD, points: q.points * 2 } : q;
      setActiveQuestion(finalQ);
      setEditedQuestion(finalQ);
    }
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (activeQuestion && editedQuestion) {
      const updatedQ = { ...activeQuestion, ...editedQuestion } as Question;
      setActiveQuestion(updatedQ);
      
      // Update cache if applicable
      if (updatedQ.letter && questionCache.current[updatedQ.letter]) {
        questionCache.current[updatedQ.letter] = updatedQ;
      }
      
      // Update grid/questions list if needed (though activeQuestion is what's rendered)
      // For a more robust solution, we'd update the parent's questions array, 
      // but modifying the activeQuestion and cache is sufficient for the immediate display.
      
      setIsEditing(false);
    }
  };

  const renderActiveQuestion = () => {
    if (!activeQuestion && !isLoadingQuestion) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
        <div className="bg-white w-full max-w-3xl rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-2xl relative overflow-y-auto max-h-[90vh] text-center border-8 md:border-[12px] border-slate-50">
          {!isLoadingQuestion && <div className="absolute top-0 left-0 h-2 bg-blue-600 transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}></div>}
          
          {isLoadingQuestion ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="w-16 h-16 border-8 border-slate-100 border-t-sky-500 rounded-full animate-spin"></div>
              <h3 className="text-2xl font-black text-slate-800">جاري توليد السؤال...</h3>
            </div>
          ) : activeQuestion && (
            <>
              {isEditing ? (
                <div className="space-y-4 text-right">
                  <h3 className="text-2xl font-black text-slate-800 mb-4">تعديل السؤال</h3>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">نص السؤال</label>
                    <textarea 
                      value={editedQuestion.text || ''} 
                      onChange={e => setEditedQuestion({...editedQuestion, text: e.target.value})}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold text-lg"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">الإجابة</label>
                    <input 
                      type="text"
                      value={editedQuestion.answer || ''} 
                      onChange={e => setEditedQuestion({...editedQuestion, answer: e.target.value})}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1">الفئة</label>
                      <input 
                        type="text"
                        value={editedQuestion.category || ''} 
                        onChange={e => setEditedQuestion({...editedQuestion, category: e.target.value})}
                        className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1">النقاط</label>
                      <input 
                        type="number"
                        value={editedQuestion.points || 100} 
                        onChange={e => setEditedQuestion({...editedQuestion, points: parseInt(e.target.value) || 0})}
                        className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={handleSaveEdit} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-black hover:bg-green-600">حفظ التعديلات</button>
                    <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl font-black hover:bg-slate-300">إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 relative">
                  {config.hexMode === 'manual' && !revealed && (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="absolute top-0 right-0 p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-sky-100 hover:text-sky-600 transition-colors"
                      title="تعديل السؤال"
                    >
                      ✏️
                    </button>
                  )}
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
              )}

              {!isEditing && (
                <div className="mt-12">
                  <div className="flex flex-col gap-6">
                    {!revealed && (
                      <button 
                        onClick={() => setRevealed(true)}
                        className="w-full py-6 sky-btn rounded-2xl text-2xl font-black shadow-xl transform transition hover:scale-102 active:scale-98 mb-4"
                      >
                        إظهار الإجابة 👁️
                      </button>
                    )}

                    {revealed && !showScoring && (
                      <div className="animate-fade-up">
                        <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner relative mb-8">
                          {config.hexMode === 'manual' && (
                            <button 
                              onClick={() => setIsEditing(true)}
                              className="absolute top-4 right-4 p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                              title="تعديل الإجابة"
                            >
                              ✏️
                            </button>
                          )}
                          <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                          <p className="text-5xl font-black text-black">{activeQuestion.answer}</p>
                        </div>
                        <button 
                          onClick={() => setShowScoring(true)}
                          className="w-full py-6 bg-emerald-500 text-white rounded-2xl text-2xl font-black shadow-xl transform transition hover:scale-102 active:scale-98"
                        >
                          رصد الدرجات 📝
                        </button>
                      </div>
                    )}

                    {showScoring && (
                      <>
                        <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner relative mb-8 animate-fade-up">
                          {config.hexMode === 'manual' && (
                            <button 
                              onClick={() => setIsEditing(true)}
                              className="absolute top-4 right-4 p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                              title="تعديل الإجابة"
                            >
                              ✏️
                            </button>
                          )}
                          <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                          <p className="text-5xl font-black text-black">{activeQuestion.answer}</p>
                        </div>

                        <div className={`grid gap-4 ${players.length > 4 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'} max-h-[40vh] overflow-y-auto p-2 custom-scrollbar`}>
                          {players.map((p) => (
                            <div key={p.id} className="flex flex-col gap-2">
                              <button 
                                onClick={() => handleAnswer(p.id, true)}
                                className={`w-full ${players.length > 6 ? 'py-3 text-lg' : 'py-6 text-xl'} rounded-3xl text-white font-black shadow-xl transform transition hover:scale-105 active:scale-95`}
                                style={{ backgroundColor: p.color }}
                              >
                                {players.length > 6 ? p.name : `إجابة صحيحة (${p.name})`}
                              </button>
                              <button 
                                onClick={() => handleAnswer(p.id, false)}
                                className={`w-full ${players.length > 6 ? 'py-1 text-xs' : 'py-3 text-sm'} rounded-2xl text-white/80 font-bold border-2 border-white/20 hover:bg-white/10 transition-all`}
                                style={{ backgroundColor: p.color + '99' }}
                              >
                                إجابة خاطئة
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    
                    <button 
                      onClick={() => handleAnswer(null, false)}
                      className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black hover:bg-slate-200 transition-all text-xl mt-4"
                    >
                      تخطي / لا أحد أجاب
                    </button>
                  </div>
                </div>
              )}
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
        <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl text-center border-[16px] border-slate-50 overflow-y-auto max-h-[90vh]">
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

  if (config.mode === GameMode.TIMED) {
    return <TimedChallengeScreen config={config} questions={questions} players={players} onFinish={onFinish} />;
  }

  if (config.mode === GameMode.PICTURE_GUESS) {
    return <PictureGuessScreen config={config} questions={questions} players={players} onFinish={onFinish} />;
  }

  return (
    <div className="flex flex-col items-center gap-6 md:gap-10 py-4 md:py-8 min-h-screen bg-slate-50/50">
      {/* عرض النقاط المطور - بطاقات عائمة (Sticky) */}
      <div className="sticky top-20 z-40 flex flex-wrap justify-center gap-3 md:gap-6 w-full max-w-7xl px-4 backdrop-blur-md bg-white/30 py-4 rounded-3xl shadow-sm">
        {players.map((p, idx) => {
          const isCurrent = idx === currentPlayerIndex;
          return (
            <div 
              key={p.id} 
              className={`flex-1 min-w-[140px] md:min-w-[180px] bg-white p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 shadow-lg flex items-center gap-3 md:gap-5 transform transition-all ${isCurrent ? 'scale-105 border-sky-400 ring-4 ring-sky-100' : 'border-slate-200 opacity-90 hover:opacity-100'}`}
            >
              <div 
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-3xl font-black shadow-md shrink-0" 
                style={{backgroundColor: p.color, boxShadow: `0 8px 16px ${p.color}44`}}
              >
                {p.score}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5">
                  {config.mode === GameMode.HEX_GRID ? (idx === 0 ? 'المسار الأفقي' : 'المسار العمودي') : 'النقاط'}
                  {isCurrent && config.mode === GameMode.HEX_GRID && <span className="mr-2 text-sky-500">● دورك</span>}
                </span>
                <p className="text-lg md:text-xl font-black text-slate-800 truncate w-full">{p.name}</p>
                
                {config.mode === GameMode.HEX_GRID && isCurrent && (
                  <div className="flex gap-1.5 mt-1.5">
                    <button 
                      onClick={() => setActivePower(activePower === PowerType.FREEZE ? null : PowerType.FREEZE)}
                      disabled={p.powers[PowerType.FREEZE] <= 0}
                      className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${activePower === PowerType.FREEZE ? 'bg-blue-500 text-white shadow-md scale-110' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} disabled:opacity-30`}
                      title="تجميد خلية"
                    >
                      ❄️ {p.powers[PowerType.FREEZE]}
                    </button>
                    <button 
                      onClick={() => setActivePower(activePower === PowerType.STEAL ? null : PowerType.STEAL)}
                      disabled={p.powers[PowerType.STEAL] <= 0}
                      className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${activePower === PowerType.STEAL ? 'bg-orange-500 text-white shadow-md scale-110' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'} disabled:opacity-30`}
                      title="سرقة خلية"
                    >
                      🥷 {p.powers[PowerType.STEAL]}
                    </button>
                    <button 
                      onClick={() => setActivePower(activePower === PowerType.SHIELD ? null : PowerType.SHIELD)}
                      disabled={p.powers[PowerType.SHIELD] <= 0}
                      className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${activePower === PowerType.SHIELD ? 'bg-emerald-500 text-white shadow-md scale-110' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'} disabled:opacity-30`}
                      title="درع حماية"
                    >
                      🛡️ {p.powers[PowerType.SHIELD]}
                    </button>
                  </div>
                )}
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
          className="relative group animate-fade-in w-full flex justify-center px-4" 
          style={{ '--current-player-color': players[currentPlayerIndex].color } as React.CSSProperties}
        >
          <div className="game-board-area relative z-10 transition-transform duration-700 hover:scale-[1.02] w-full max-w-3xl">
            <div className="board-wrapper flex justify-center">
              <div className="hex-grid-center w-full">
                <svg viewBox="0 0 420 820" className="w-full h-auto max-h-[65vh] hex-svg-container drop-shadow-2xl mx-auto">
                  <defs>
                    <filter id="scribble-filter" x="-20%" y="-20%" width="140%" height="140%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                      <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
                    </filter>
                  </defs>
                  
                  {/* Left Red Goal - Interlocking */}
                  <path 
                    d="M 0 0 L 40 18 L 10 70 L 40 122 L 10 174 L 40 226 L 10 278 L 40 330 L 10 382 L 40 434 L 10 486 L 40 538 L 10 590 L 40 642 L 10 694 L 40 746 L 0 820 Z" 
                    className={`goal-area goal-area-red ${currentPlayerIndex === 0 ? 'active-turn' : ''}`}
                  />
                  
                  {/* Right Red Goal - Interlocking */}
                  <path 
                    d="M 420 0 L 370 70 L 400 122 L 370 174 L 400 226 L 370 278 L 400 330 L 370 382 L 400 434 L 370 486 L 400 538 L 370 590 L 400 642 L 370 694 L 400 746 L 370 798 L 420 820 Z" 
                    className={`goal-area goal-area-red ${currentPlayerIndex === 0 ? 'active-turn' : ''}`}
                  />

                  {/* Top Green Goal - Interlocking */}
                  <path 
                    d="M 0 0 L 420 0 L 370 70 L 310 70 L 280 18 L 220 18 L 190 70 L 130 70 L 100 18 L 40 18 Z" 
                    className={`goal-area goal-area-green ${currentPlayerIndex === 1 ? 'active-turn' : ''}`}
                  />

                  {/* Bottom Green Goal - Interlocking */}
                  <path 
                    d="M 0 820 L 420 820 L 370 798 L 310 798 L 280 746 L 220 746 L 190 798 L 130 798 L 100 746 L 40 746 Z" 
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
                          onClick={() => handleHexClick(q)}
                        >
                          <polygon points={points} className="hex-polygon" />
                          {frozenCells[q.id] > 0 && (
                            <text x="60" y="30" className="text-[20px] fill-blue-400 animate-pulse pointer-events-none" textAnchor="middle">❄️</text>
                          )}
                          {shieldedCells[q.id] && (
                            <text x="60" y="85" className="text-[20px] fill-emerald-400 pointer-events-none" textAnchor="middle">🛡️</text>
                          )}
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