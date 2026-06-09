import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { QuizRepository } from './ports/quiz-repository';

/** Exposes the catalogue of quizzes for the selection screen. */
@Injectable({ providedIn: 'root' })
export class QuizCatalogService {
  private readonly repo = inject(QuizRepository);

  /** All available quizzes; loaded once and exposed as a signal (empty until then). */
  readonly quizzes = toSignal(this.repo.listQuizzes(), { initialValue: [] });
}
