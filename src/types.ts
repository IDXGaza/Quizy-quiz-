
export enum GameMode {
  GRID = 'GRID',
  HEX_GRID = 'HEX_GRID',
  POINTS = 'POINTS',
  BUZZER = 'BUZZER'
}

export enum QuestionType {
  MCQ = 'MCQ',
  TRUE_FALSE = 'TRUE_FALSE',
  OPEN = 'OPEN'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  answer: string;
  category: string;
  points: number;
  letter?: string;
  explanation?: string;
  type: QuestionType;
  difficulty: Difficulty;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface GameConfig {
  topic: string;
  numQuestions: number;
  mode: GameMode;
  questionTypes: QuestionType[];
  difficulty: Difficulty;
  players: Player[];
  manualQuestions: Question[];
  sessionId?: string;
  // Hex Grid specific
  hexMode?: 'ai' | 'manual';
  hexCategories?: string[];
  hexManualQuestions?: Record<string, {question: string, answer: string}>;
  customJson?: string;
}
