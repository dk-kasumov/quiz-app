import { Injectable, computed, inject, signal } from '@angular/core';
import { OptionLabel, Question } from '../domain/models/question.model';
import { Quiz } from '../domain/models/quiz.model';
import { OptionState, evaluateOption, isCorrect } from '../domain/answer-evaluation';
import { QuizRepository } from './ports/quiz-repository';

/**
 * Holds the state of one in-progress quiz attempt and the operations that drive
 * it (select / next / back / restart). All state is signal-based so the UI is a
 * pure projection of it. Answers lock once chosen.
 */
@Injectable({ providedIn: 'root' })
export class QuizSessionService {
  private readonly repo = inject(QuizRepository);

  private readonly _quiz = signal<Quiz | null>(null);
  private readonly _index = signal(0);
  /** questionIndex → chosen option label. A present key means that question is locked. */
  private readonly _selections = signal<ReadonlyMap<number, OptionLabel>>(new Map());
  private readonly _finished = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly quiz = this._quiz.asReadonly();
  readonly index = this._index.asReadonly();
  readonly finished = this._finished.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly total = computed(() => this._quiz()?.questions.length ?? 0);
  readonly current = computed(() => this._quiz()?.questions[this._index()] ?? null);
  readonly selected = computed(() => this._selections().get(this._index()) ?? null);
  readonly isAnswered = computed(() => this.selected() !== null);
  readonly isFirst = computed(() => this._index() === 0);
  readonly isLast = computed(() => this._index() === this.total() - 1);

  /** Correct answers so far. */
  readonly score = computed(() => {
    const quiz = this._quiz();
    if (!quiz) return 0;
    let score = 0;
    for (const [i, label] of this._selections()) {
      if (isCorrect(quiz.questions[i], label)) score++;
    }
    return score;
  });

  /** Visual state for every option of the current question (drives highlighting). */
  readonly optionStates = computed<Record<OptionLabel, OptionState>>(() => {
    const question = this.current();
    const selected = this.selected();
    const states = {} as Record<OptionLabel, OptionState>;
    if (question) {
      for (const option of question.options) {
        states[option.label] = evaluateOption(question, option.label, selected);
      }
    }
    return states;
  });

  /** Load a quiz by id and reset the attempt. */
  start(quizId: string): void {
    this.reset();
    this._loading.set(true);
    this.repo.getQuiz(quizId).subscribe({
      next: (quiz) => {
        this._quiz.set(quiz);
        this._loading.set(false);
      },
      error: () => {
        this._error.set('Не вдалося завантажити вікторину.');
        this._loading.set(false);
      },
    });
  }

  /** Lock in the answer for the current question (ignored once answered). */
  select(label: OptionLabel): void {
    if (this.isAnswered() || !this.current()) return;
    const next = new Map(this._selections());
    next.set(this._index(), label);
    this._selections.set(next);
  }

  /** Advance to the next question, or finish on the last one. */
  next(): void {
    if (this.isLast()) {
      this._finished.set(true);
      return;
    }
    this._index.update((i) => Math.min(i + 1, this.total() - 1));
  }

  /** Step back: from the results screen to the last question, else to the previous question. */
  back(): void {
    if (this._finished()) {
      this._finished.set(false);
      return;
    }
    this._index.update((i) => Math.max(i - 1, 0));
  }

  /** Replay the same quiz from the start. */
  restart(): void {
    this._index.set(0);
    this._selections.set(new Map());
    this._finished.set(false);
  }

  /**
   * Apply an edited question: update the in-memory quiz so highlighting/score
   * recompute immediately, then persist it to the repository (IndexedDB).
   */
  applyEdit(updated: Question): void {
    const quiz = this._quiz();
    if (!quiz) return;
    const questions = quiz.questions.map((q) => (q.id === updated.id ? updated : q));
    this._quiz.set({ ...quiz, questions });
    this.repo.updateQuestion(quiz.id, updated).subscribe({
      error: () => this._error.set('Не вдалося зберегти зміни.'),
    });
  }

  private reset(): void {
    this._quiz.set(null);
    this._index.set(0);
    this._selections.set(new Map());
    this._finished.set(false);
    this._error.set(null);
  }
}
