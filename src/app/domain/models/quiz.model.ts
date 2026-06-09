import { Question } from './question.model';

/** Lightweight quiz descriptor used by the selection screen (the manifest). */
export interface QuizSummary {
  readonly id: string;
  readonly title: string;
  readonly count: number;
}

/** A full quiz: its descriptor plus the questions to play through. */
export interface Quiz extends QuizSummary {
  readonly questions: readonly Question[];
}
