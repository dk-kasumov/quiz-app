import { OptionLabel, Question } from './models/question.model';

/**
 * Visual state of a single option once the user has (or hasn't) answered.
 *  - `idle`      — not answered yet
 *  - `correct`   — a correct answer (green)
 *  - `wrong`     — the user's wrong pick (red)
 *  - `no-answer` — the pick on a question that has no correct answer (blue)
 *  - `neutral`   — any other option after answering (dimmed)
 */
export type OptionState = 'idle' | 'correct' | 'wrong' | 'no-answer' | 'neutral';

/** Labels of every correct option (empty when the source marks none). */
export function correctLabels(question: Question): OptionLabel[] {
  return question.options.filter((o) => o.correct).map((o) => o.label);
}

/** Whether the question has at least one correct option. */
export function hasCorrectAnswer(question: Question): boolean {
  return question.options.some((o) => o.correct);
}

/**
 * The single source of truth for answer highlighting — pure, no framework.
 * Supports multiple correct answers with single-pick play: picking any correct
 * option scores, and every correct option is revealed.
 *
 * Rules:
 *  - no selection yet               → every option is `idle`
 *  - question has no correct answer → the picked option is `no-answer` (blue), rest `neutral`
 *  - otherwise                      → every correct option is `correct` (green);
 *                                     a wrong pick is `wrong` (red); everything else `neutral`
 */
export function evaluateOption(
  question: Question,
  optionLabel: OptionLabel,
  selected: OptionLabel | null,
): OptionState {
  if (selected === null) return 'idle';

  if (!hasCorrectAnswer(question)) {
    return optionLabel === selected ? 'no-answer' : 'neutral';
  }

  const option = question.options.find((o) => o.label === optionLabel);
  if (option?.correct) return 'correct';
  if (optionLabel === selected) return 'wrong';
  return 'neutral';
}

/** Whether a selection scores a point (false when the question has no correct answer). */
export function isCorrect(question: Question, selected: OptionLabel | null): boolean {
  if (selected === null) return false;
  return Boolean(question.options.find((o) => o.label === selected)?.correct);
}
