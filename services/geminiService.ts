
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, GameMode, Difficulty } from "../types";

const ARABIC_ALPHABET = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");

const getDifficultyText = (diff: Difficulty) => {
  switch (diff) {
    case Difficulty.EASY: return "سهلة ومباشرة جداً للمبتدئين";
    case Difficulty.MEDIUM: return "متوسطة الصعوبة، تتطلب ثقافة عامة جيدة، أسئلة متوازنة ليست بديهية وليست معقدة جداً";
    case Difficulty.HARD: return "تحدي حقيقي للمثقفين، تتطلب معرفة تخصصية وعميقة، أسئلة معقدة ونادرة";
    default: return "متوازنة";
  }
};

export const generateQuestions = async (
  topic: string,
  numQuestions: number,
  types: QuestionType[],
  mode: GameMode,
  difficulty: Difficulty
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const difficultyContext = getDifficultyText(difficulty);
  let promptText = "";

  if (mode === GameMode.HEX_GRID) {
    const selectedLetters = ARABIC_ALPHABET.slice(0, 25);
    const lettersStr = selectedLetters.join("، ");
    promptText = `أنت خبير متخصص في إعداد المسابقات الثقافية الممتعة والمتوازنة. أنشئ قائمة مكونة من 25 سؤالاً وجواباً عن موضوع "${topic}" بمستوى صعوبة "${difficultyContext}".
يجب أن تبدأ إجابة كل سؤال بالحرف المخصص له بالترتيب من هذه القائمة: [${lettersStr}].
شروط هامة لضمان جودة الأسئلة:
1. الإجابة: يجب أن تكون كلمة واحدة أو مصطلحاً يبدأ فعلياً بالحرف المطلوب ("ال" التعريف لا تحتسب).
2. مراعاة السياق الثقافي: يجب أن تكون الأسئلة ملائمة للثقافة العربية والإسلامية.
3. مستوى متوازن: تجنب الأسئلة السطحية جداً (البديهية)، وفي نفس الوقت تجنب الأسئلة التعجيزية أو التخصصية المعقدة. الأسئلة يجب أن تكون في متناول الشخص المثقف والمطلع.
4. صياغة واضحة: يجب أن يكون السؤال واضحاً، مشوقاً، ولا يحتمل أكثر من إجابة صحيحة.
5. تأكد من دقة المعلومات بنسبة 100%.
6. يجب أن يكون الرد بتنسيق JSON فقط كصفوف في مصفوفة.`;
  } else if (mode === GameMode.GRID) {
    promptText = `أنت خبير متخصص في إعداد المسابقات الثقافية الممتعة والمتوازنة. أنشئ 20 سؤالاً لموضوع "${topic}" مقسمة إلى 4 فئات (categories) مختلفة، كل فئة تحتوي على 5 أسئلة متدرجة الصعوبة (النقاط: 100، 200، 300، 400، 500).
شروط هامة لضمان جودة الأسئلة:
1. مراعاة السياق الثقافي: يجب أن تكون الأسئلة ملائمة للثقافة العربية والإسلامية.
2. مستوى متوازن: تجنب الأسئلة التعجيزية أو التخصصية المعقدة جداً.
3. صياغة واضحة: يجب أن يكون السؤال واضحاً ومشوقاً.
4. يجب أن تتدرج صعوبة الأسئلة بشكل منطقي داخل كل فئة بناءً على النقاط:
- 100 نقطة: سؤال سهل ومباشر.
- 200 نقطة: سؤال يحتاج إلى تفكير بسيط.
- 300 نقطة: سؤال متوسط الصعوبة للمثقف المطلع.
- 400 نقطة: سؤال صعب يحتاج دقة ومعرفة جيدة.
- 500 نقطة: سؤال تحدي لكن له إجابة منطقية يمكن استنتاجها (ليس مستحيلاً).
مستوى الصعوبة العام المختار للمسابقة: ${difficultyContext}. (يرجى تكييف التدرج السابق ليتناسب مع هذا المستوى العام).
تأكد من تنوع الأسئلة ودقة المعلومات بنسبة 100%.`;
  } else {
    promptText = `أنت خبير متخصص في إعداد المسابقات الثقافية الممتعة والمتوازنة. أنشئ ${numQuestions} سؤالاً متنوعاً عن "${topic}" بمستوى صعوبة "${difficultyContext}".
شروط هامة لضمان جودة الأسئلة:
1. مراعاة السياق الثقافي: يجب أن تكون الأسئلة ملائمة للثقافة العربية والإسلامية.
2. مستوى متوازن: تجنب الأسئلة السطحية جداً (البديهية)، وفي نفس الوقت تجنب الأسئلة التعجيزية أو التخصصية المعقدة. الأسئلة يجب أن تكون في متناول الشخص المثقف والمطلع.
3. صياغة واضحة: يجب أن يكون السؤال واضحاً، مشوقاً، ولا يحتمل أكثر من إجابة صحيحة.
4. تأكد من دقة المعلومات بنسبة 100%.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "نص السؤال" },
              answer: { type: Type.STRING, description: "الإجابة الصحيحة" },
              category: { type: Type.STRING, description: "الفئة أو التصنيف" },
              points: { type: Type.NUMBER, description: "عدد النقاط (100-500)" },
              letter: { type: Type.STRING, description: "الحرف الذي تبدأ به الإجابة (لشبكة الحروف فقط)" },
              difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD"], description: "مستوى الصعوبة" }
            },
            required: ["text", "answer", "difficulty"]
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("لم يتم استلام بيانات من الذكاء الاصطناعي.");

    const rawData = JSON.parse(textOutput);
    
    // معالجة البيانات لضمان توافقها مع واجهة التطبيق
    return rawData.map((q: any, idx: number) => ({
      id: `q-${Date.now()}-${idx}`,
      text: q.text,
      answer: q.answer || "",
      category: q.category || topic,
      points: q.points || 100,
      letter: mode === GameMode.HEX_GRID ? (q.letter || ARABIC_ALPHABET[idx % 25]) : q.letter,
      type: QuestionType.OPEN,
      difficulty: (q.difficulty as Difficulty) || difficulty
    }));
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    // في حال فشل الـ RPC، نحاول مرة أخرى بنموذج مختلف كبديل أخير
    if (error.message?.includes("500") || error.message?.includes("Rpc failed")) {
      return fallbackGenerate(topic, numQuestions, mode, difficulty);
    }
    throw error;
  }
};

// وظيفة احتياطية في حالة فشل الخدمة الرئيسية
async function fallbackGenerate(topic: string, num: number, mode: GameMode, difficulty: Difficulty): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: `أنشئ مصفوفة JSON بسيطة لـ ${num} أسئلة عن ${topic} بمستوى صعوبة ${getDifficultyText(difficulty)}. [ { "text": "...", "answer": "..." } ]`
  });
  const data = JSON.parse(response.text || "[]");
  return data.map((q: any, i: number) => {
    let category = topic;
    let points = 100;
    
    if (mode === GameMode.GRID) {
      const catIndex = Math.floor(i / 5);
      category = `الفئة ${catIndex + 1}`;
      points = ((i % 5) + 1) * 100;
    }

    return {
      id: `fb-${i}`,
      text: q.text,
      answer: q.answer || "",
      category: q.category || category,
      points: q.points || points,
      letter: mode === GameMode.HEX_GRID ? ARABIC_ALPHABET[i % 20] : "",
      type: QuestionType.OPEN,
      difficulty: difficulty
    };
  });
}
