
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, GameMode, Difficulty } from "../types";

const ARABIC_ALPHABET = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");

export const extractJson = (text: string): string => {
  if (!text) return "";
  
  // Try to find JSON inside markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let cleaned = text;
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  }
  
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  
  let startIdx = -1;
  if (firstBracket !== -1 && firstBrace !== -1) {
    startIdx = Math.min(firstBracket, firstBrace);
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  }
  
  if (startIdx === -1) return cleaned;
  
  let extracted = cleaned.substring(startIdx);
  
  // A robust way to fix cut-off JSON arrays/objects
  const closeSequences = [
    '',
    ']',
    '}',
    '}]',
    ']}',
    '"]}',
    '"}',
    '"]',
    '}]}'
  ];
  
  // 1. Try appending closing sequences directly
  for (const seq of closeSequences) {
    try {
      JSON.parse(extracted + seq);
      return extracted + seq;
    } catch (e) {
      // continue
    }
  }
  
  // 2. If appending doesn't work, try truncating to the last '}' or ']' and then appending
  for (let i = extracted.length - 1; i >= 0; i--) {
    const char = extracted[i];
    if (char === '}' || char === ']') {
      const truncated = extracted.substring(0, i + 1);
      for (const seq of closeSequences) {
        try {
          JSON.parse(truncated + seq);
          return truncated + seq;
        } catch (e) {
          // continue
        }
      }
    }
  }
  
  return extracted;
};

const getDifficultyText = (diff: Difficulty) => {
  switch (diff) {
    case Difficulty.EASY: return "سهلة جداً ومباشرة، مناسبة للأطفال أو الثقافة العامة البديهية جداً.";
    case Difficulty.MEDIUM: return "متوسطة الصعوبة للمثقف العام. تجنب الأسئلة التي تتطلب حفظ تواريخ دقيقة أو أسماء غير مشهورة أو أماكن مغمورة. ركز على المعلومات التي يمكن استنتاجها أو المعروفة للمثقف العام. استخدم حقائق مذهلة ومعلومات عامة متوازنة.";
    case Difficulty.HARD: return "تحدي حقيقي للمثقفين، تتطلب معرفة تخصصية وعميقة، أسئلة معقدة ونادرة.";
    default: return "متوازنة";
  }
};

export const getAI = () => {
  // Vite replaces process.env.GEMINI_API_KEY statically during build
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

let useGeminiOnly = false;

export const generateQuestions = async (
  topic: string,
  numQuestions: number,
  types: QuestionType[],
  mode: GameMode,
  difficulty: Difficulty,
  aiModel: string = "gemini-3-flash-preview",
  categories?: string[]
): Promise<Question[]> => {
  const ai = getAI();
  const difficultyContext = getDifficultyText(difficulty);
  const searchKeywords = `استخدم الكلمات المفتاحية التالية للبحث عن أفضل الأسئلة: "مسابقات ثقافية"، "أسئلة ذكاء"، "معلومات عامة"، "أوائل"، "حقائق مذهلة".`;

  const generateSingleBatch = async (batchNum: number, batchStartIdx: number, batchLetters?: string[]): Promise<Question[]> => {
    let promptText = "";
    if (mode === GameMode.HEX_GRID) {
      const lettersStr = batchLetters?.join("، ");
      promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات محترف متخصص في "شبكة الحروف".
الموضوع: ${topic}
المستوى العام المطلوب: ${difficultyContext}
${searchKeywords}

مهمتك هي توليد ${batchNum} سؤالاً، حيث تبدأ إجابة كل سؤال بحرف محدد من القائمة التالية بالترتيب: [${lettersStr}].

شروط الجودة الفائقة (إلزامية جداً):
1. الدقة الحرفية (أهم شرط): يجب أن تبدأ الإجابة بالحرف المطلوب بالضبط. إذا كان الحرف المطلوب هو "ب"، فيجب أن تكون الإجابة "بطيخ" أو "البطيخ" (حيث يتم تجاهل "ال" التعريف).
2. الابتكار: ابتعد عن الأسئلة المباشرة المملة. استخدم أسلوب الألغاز، الوصف المشوق، أو الحقائق المذهلة.
3. المنطق والملاءمة: يجب أن يكون السؤال منطقياً، له إجابة واحدة دقيقة، وملائماً للثقافة العربية.
4. التنسيق: أرجع البيانات كمصفوفة JSON تحتوي على ${batchNum} كائناً (text, answer, letter, difficulty).`;
    } else if (mode === GameMode.GRID) {
      const catsProvided = categories && categories.length > 0;
      const catsText = catsProvided 
        ? `الفئات الخمس المطلوبة حرفياً: ${categories.join('، ')}` 
        : `قم بابتكار 5 فئات فرعية ذكية ومناسبة جداً لموضوع "${topic}".`;
      
      promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات محترف متخصص في نظام "جيبوردي" (Jeopardy).
الموضوع الرئيسي للمسابقة: ${topic}
${catsText}
المستوى العام المطلوب: ${difficultyContext}

مهمتك هي توليد ${batchNum} سؤالاً، مقسمة بالتساوي على 5 فئات (5 أسئلة لكل فئة).
يجب أن تكون الأسئلة مرتبطة بشكل وثيق جداً باسم الفئة. لا تقم بتوليد أسئلة عشوائية لا تمت للفئة بصلة.

خطوات العمل:
1. صمم 5 أسئلة لكل فئة تتدرج في الصعوبة والنقاط (100، 200، 300، 400، 500).
2. تأكد أن حقل "category" في الـ JSON يحتوي على اسم الفئة بدقة.

شروط الجودة الفائقة:
1. صياغة الأسئلة: اجعل الأسئلة واضحة، غير غامضة، ولها إجابة واحدة محددة ومنطقية.
2. التنوع: نوع في صياغة الأسئلة.
3. الدقة: تأكد من صحة المعلومات بنسبة 100%.
4. الملاءمة: يجب أن تكون الأسئلة ملائمة للثقافة العربية والإسلامية.
5. التنسيق: أرجع البيانات كمصفوفة JSON تحتوي على ${batchNum} كائناً (text, answer, category, points, difficulty).`;
    } else if (mode === GameMode.PICTURE_GUESS) {
      promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات عبقري. أنشئ ${batchNum} سؤالاً من نوع "تحدي الصور والكلمات" (Rebus Puzzles) عن موضوع "${topic}" بمستوى صعوبة "${difficultyContext}".

فكرة التحدي: دمج صور مع نصوص أو إيموجي لتكوين كلمة جديدة أو عبارة.
**هام جداً:** يجب أن تكون الصور تعبر عن مقاطع الكلمة أو معناها المباشر. 

لكل سؤال، قم بتوفير:
1. الإجابة (الكلمة أو العبارة المطلوبة).
2. مصفوفة من العناصر (pictureElements) التي تكون الكلمة. يمكن أن تكون العناصر من نوع "image" أو "text".
   - إذا كان النوع "text"، اجعل القيمة (value) إيموجي أو حرف/كلمة قصيرة.
   - إذا كان النوع "image"، **يجب** أن تكون القيمة (value) كلمة إنجليزية بسيطة جداً ومفردة (مثل: "apple", "car", "king", "sun", "water") لكي نتمكن من جلب صورة دقيقة لها من الإنترنت. لا تستخدم كلمات عربية أو جمل معقدة في حقل value للصور.
3. نص السؤال.
4. تلميح (hint): تلميح يظهر للمتسابقين قبل الإجابة.
5. الشرح (explanation): اشرح كيف تكونت الكلمة من الصور والنصوص.

التنسيق: أرجع البيانات كمصفوفة JSON تحتوي على كائنات (text, answer, pictureElements, category, points, difficulty, hint, explanation).`;
    } else {
      const buzzerContext = mode === GameMode.BUZZER ? "اجعل الأسئلة سهلة ومباشرة جداً وممتعة، مناسبة لسرعة البديهة." : "";
      promptText = `أنت صانع محتوى إبداعي ومصمم مسابقات محترف. أنشئ ${batchNum} سؤالاً عن "${topic}" بمستوى صعوبة "${difficultyContext}".
وضع اللعبة: ${mode}
${buzzerContext}
${searchKeywords}

شروط الجودة:
1. الابتكار والوضوح والدقة.
2. الملاءمة الثقافية.
3. التنسيق: أرجع البيانات كمصفوفة JSON تحتوي على كائنات (text, answer, category, points, difficulty).`;
    }

    try {
      let textOutput = "";
      const currentModel = useGeminiOnly ? "gemini-3-flash-preview" : aiModel;
      
      if (currentModel.startsWith("gemini")) {
        const response = await ai.models.generateContent({
          model: currentModel, 
          contents: promptText,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  category: { type: Type.STRING },
                  points: { type: Type.NUMBER },
                  letter: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD"] },
                  imageKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emojis: { type: Type.ARRAY, items: { type: Type.STRING } },
                  pictureElements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, enum: ["image", "text"] },
                        value: { type: Type.STRING },
                        emoji: { type: Type.STRING }
                      },
                      required: ["type", "value"]
                    }
                  }
                },
                required: ["text", "answer"]
              }
            }
          }
        });
        textOutput = response.text || "";
      } else {
        const res = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptText: promptText + " Return raw JSON array.", model: currentModel })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.error || `Backend failed with status ${res.status}`;
          if (res.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("QUOTA_EXCEEDED")) {
            useGeminiOnly = true;
            throw new Error("QUOTA_EXCEEDED: " + errorMsg);
          }
          throw new Error(errorMsg);
        }
        const data = await res.json();
        textOutput = data.text;
      }

      textOutput = extractJson(textOutput);
      
      // Fix potential JSON issues with extremely large numbers before parsing
      // Handle numbers that might be cut off or extremely long
      textOutput = textOutput.replace(/:\s*([0-9]{15,})[^,}\]]*/g, ': 100');
      
      let rawData: any[] = [];
      try {
        rawData = JSON.parse(textOutput);
      } catch (e) {
        console.error("JSON Parse Error in geminiService:", e, textOutput);
        throw new Error("فشل في تحليل الأسئلة المولدة من الذكاء الاصطناعي.");
      }
      
      return rawData.map((q: any, idx: number) => {
        const globalIdx = batchStartIdx + idx;
        let actualLetter = q.letter;
        if (mode === GameMode.HEX_GRID) {
          actualLetter = batchLetters ? batchLetters[idx] : ARABIC_ALPHABET[globalIdx % 25];
          const ans = q.answer || "";
          const firstChar = ans.replace(/^ال/, '').trim().charAt(0);
          if (firstChar !== actualLetter) {
            console.warn(`Validation failed: Answer "${ans}" does not start with letter "${actualLetter}"`);
            q.explanation = (q.explanation ? q.explanation + " - " : "") + `(ملاحظة: الإجابة كان يجب أن تبدأ بحرف ${actualLetter})`;
          }
        }

        let category = q.category || topic;
        let points = q.points || 100;

        if (mode === GameMode.GRID) {
          const catIndex = Math.floor(globalIdx / 5);
          category = q.category || `الفئة ${catIndex + 1}`;
          points = q.points || ((globalIdx % 5) + 1) * 100;
        }

        return {
          id: `q-${Date.now()}-${globalIdx}`,
          text: q.text,
          answer: q.answer || "",
          category: category,
          points: points,
          letter: actualLetter,
          hint: q.hint,
          explanation: q.explanation,
          type: QuestionType.OPEN,
          difficulty: (q.difficulty as Difficulty) || difficulty,
          imageKeywords: q.imageKeywords,
          emojis: q.emojis,
          pictureElements: q.pictureElements
        };
      });
    } catch (error: any) {
      const isQuotaError = error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("QUOTA_EXCEEDED");
      if (!isQuotaError) {
        console.error(`Batch generation error (startIdx: ${batchStartIdx}):`, error);
      }
      throw error;
    }
  };

  try {
    const allQuestions: Question[] = [];
    
    if (mode === GameMode.HEX_GRID) {
      const selectedLetters = ARABIC_ALPHABET.slice(0, 28);
      const batch1 = await generateSingleBatch(14, 0, selectedLetters.slice(0, 14));
      const batch2 = await generateSingleBatch(14, 14, selectedLetters.slice(14, 28));
      allQuestions.push(...batch1, ...batch2);
    } else if (mode === GameMode.GRID) {
      const batch = await generateSingleBatch(25, 0);
      allQuestions.push(...batch);
    } else if (numQuestions > 10) {
      for (let i = 0; i < numQuestions; i += 10) {
        const batchSize = Math.min(10, numQuestions - i);
        const batch = await generateSingleBatch(batchSize, i);
        allQuestions.push(...batch);
      }
    } else {
      const batch = await generateSingleBatch(numQuestions, 0);
      allQuestions.push(...batch);
    }

    return allQuestions;
  } catch (error: any) {
    const isQuotaError = error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("QUOTA_EXCEEDED");
    if (isQuotaError) {
      useGeminiOnly = true;
      console.warn(`Model ${aiModel} quota exceeded. Falling back to gemini-3-flash-preview.`);
    } else {
      console.error("Generation failed, attempting fallback:", error.message || error);
    }
    
    // If we're not already using the simplest model, try it
    if (aiModel !== "gemini-3-flash-preview") {
      return fallbackGenerate(topic, numQuestions, mode, difficulty, "gemini-3-flash-preview");
    }
    
    // Otherwise try one last time with the current model but a simpler prompt
    return fallbackGenerate(topic, numQuestions, mode, difficulty, aiModel);
  }
};

export const parseCustomJson = (
  jsonStr: string,
  topic: string,
  mode: GameMode,
  difficulty: Difficulty
): Question[] => {
  try {
    const rawData = JSON.parse(jsonStr);
    if (!Array.isArray(rawData)) {
      throw new Error("يجب أن يكون النص المدخل عبارة عن مصفوفة JSON.");
    }

    return rawData.map((q: any, idx: number) => {
      let category = q.category || topic;
      let points = q.points || 100;
      
      if (mode === GameMode.GRID && !q.category) {
        const catIndex = Math.floor(idx / 5);
        category = `الفئة ${catIndex + 1}`;
        points = ((idx % 5) + 1) * 100;
      }

      return {
        id: `custom-${Date.now()}-${idx}`,
        text: q.text || "سؤال غير معروف",
        answer: q.answer || "",
        category: category,
        points: points,
        letter: mode === GameMode.HEX_GRID ? (q.letter || ARABIC_ALPHABET[idx % 25]) : q.letter,
        type: QuestionType.OPEN,
        difficulty: (q.difficulty as Difficulty) || difficulty,
        imageKeywords: q.imageKeywords,
        emojis: q.emojis,
        pictureElements: q.pictureElements
      };
    });
  } catch (error: any) {
    throw new Error("فشل في تحليل JSON المدخل: " + error.message);
  }
};

export const getSampleJson = (mode: GameMode, topic: string): string => {
  if (mode === GameMode.HEX_GRID) {
    const samples = ARABIC_ALPHABET.slice(0, 25).map(l => ({
      text: `سؤال يبدأ بحرف ${l} عن ${topic}`,
      answer: `${l}...`,
      difficulty: "MEDIUM",
      letter: l
    }));
    return JSON.stringify(samples, null, 2);
  } else {
    const samples = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 1; j <= 5; j++) {
        samples.push({
          text: `سؤال الفئة ${i + 1} بقيمة ${j * 100} عن ${topic}`,
          answer: "إجابة نموذجية",
          category: `الفئة ${i + 1}`,
          points: j * 100,
          difficulty: "MEDIUM"
        });
      }
    }
    return JSON.stringify(samples, null, 2);
  }
};

async function fallbackGenerate(topic: string, num: number, mode: GameMode, difficulty: Difficulty, aiModel: string = "gemini-3-flash-preview"): Promise<Question[]> {
  const ai = getAI();
  let textOutput = "";
  const currentModel = useGeminiOnly ? "gemini-3-flash-preview" : aiModel;
  let promptText = `أنشئ مصفوفة JSON بسيطة لـ ${num} أسئلة عن ${topic} بمستوى صعوبة ${getDifficultyText(difficulty)}. 
يجب أن يكون الرد عبارة عن مصفوفة JSON فقط تحتوي على كائنات بها الحقول "text" و "answer".
مثال: [ { "text": "سؤال؟", "answer": "إجابة" } ]`;
  
  try {
    if (currentModel.startsWith("gemini")) {
      const response = await ai.models.generateContent({
        model: currentModel, 

        contents: promptText,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                answer: { type: Type.STRING },
                hint: { type: Type.STRING },
                explanation: { type: Type.STRING },
                imageKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                emojis: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["text", "answer"]
            }
          }
        }
      });
      textOutput = response.text || "[]";
    } else {
      // If we are here, it means the previous attempt with a non-gemini model failed.
      // We should avoid using the backend again if it's likely to fail.
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: promptText + " Return ONLY valid JSON array.", model: currentModel })
      });
      if (!res.ok) {
        throw new Error("Backend failed during fallback");
      }
      const data = await res.json();
      textOutput = data.text;
    }

    textOutput = extractJson(textOutput);
    // Fix potential JSON issues with extremely large numbers before parsing
    // Handle numbers that might be cut off or extremely long
    textOutput = textOutput.replace(/:\s*([0-9]{15,})[^,}\]]*/g, ': 100');
    
    let data: any[] = [];
    try {
      data = JSON.parse(textOutput || "[]");
    } catch (e) {
      console.error("Fallback JSON Parse Error:", e, textOutput);
      return getStaticFallbackQuestions(topic, num, mode, difficulty);
    }
    
    return data.map((q: any, i: number) => {
      let category = topic;
      let points = 100;
      
      if (mode === GameMode.GRID) {
        const catIndex = Math.floor(i / 5);
        category = `الفئة ${catIndex + 1}`;
        points = ((i % 5) + 1) * 100;
      }

      let actualLetter = "";
      if (mode === GameMode.HEX_GRID) {
        if (q.answer) {
          actualLetter = q.answer.replace(/^ال/, '').trim().charAt(0).toUpperCase();
        } else {
          actualLetter = ARABIC_ALPHABET[i % 25];
        }
      }

      return {
        id: `fb-${Date.now()}-${i}`,
        text: q.text,
        answer: q.answer || "",
        category: q.category || category,
        points: q.points || points,
        letter: actualLetter,
        hint: q.hint,
        explanation: q.explanation,
        type: QuestionType.OPEN,
        difficulty: difficulty,
        imageKeywords: q.imageKeywords,
        emojis: q.emojis,
        pictureElements: q.pictureElements
      };
    });
  } catch (error: any) {
    console.error("Fallback Generation Error:", error.message || error);
    // Final safety net: return some static questions so the app doesn't crash
    return getStaticFallbackQuestions(topic, num, mode, difficulty);
  }
}

function getStaticFallbackQuestions(topic: string, num: number, mode: GameMode, difficulty: Difficulty): Question[] {
  const questions: Question[] = [];
  for (let i = 0; i < num; i++) {
    questions.push({
      id: `static-${Date.now()}-${i}`,
      text: `سؤال احتياطي ${i + 1} عن ${topic} (حدث خطأ في الاتصال بالذكاء الاصطناعي)`,
      answer: "إجابة احتياطية",
      category: topic,
      points: (i + 1) * 100,
      difficulty: difficulty,
      type: QuestionType.OPEN
    });
  }
  return questions;
}
