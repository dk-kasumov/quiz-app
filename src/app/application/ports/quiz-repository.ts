import { Observable } from 'rxjs';
import { Question } from '../../domain/models/question.model';
import { Quiz, QuizSummary } from '../../domain/models/quiz.model';

/**
 * Port: how the application reads and writes quiz data. The presentation and
 * application layers depend only on this abstraction; the concrete adapter lives
 * in the infrastructure layer and is bound via DI in `app.config.ts`.
 *
 * It is an `abstract class` (not just an interface) so it can double as an
 * Angular injection token.
 */
export abstract class QuizRepository {
  /** The catalogue of available quizzes (the manifest). */
  abstract listQuizzes(): Observable<QuizSummary[]>;
  /** A single quiz with all of its questions. */
  abstract getQuiz(id: string): Observable<Quiz>;
  /** Persist an edited question within its quiz. */
  abstract updateQuestion(quizId: string, question: Question): Observable<void>;
}
