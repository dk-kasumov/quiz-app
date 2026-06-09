/** The five answer slots every question carries. */
export type OptionLabel = 'A' | 'B' | 'C' | 'D' | 'E';

/** A single answer option of a question. */
export interface QuizOption {
  readonly label: OptionLabel;
  readonly text: string;
  /** Whether this option is (one of) the correct answer(s). */
  readonly correct: boolean;
}

/**
 * One exam question. Correctness is carried per option (`options[].correct`), so a
 * question may have zero, one, or several correct answers.
 */
export interface Question {
  readonly id: number;
  readonly section: string;
  readonly question: string;
  readonly options: readonly QuizOption[];
}
