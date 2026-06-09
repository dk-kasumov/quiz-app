import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { QuizRepository } from '../application/ports/quiz-repository';
import { Question } from '../domain/models/question.model';
import { Quiz, QuizSummary } from '../domain/models/quiz.model';
import { QuizDb } from './db/quiz-db';

/**
 * Infrastructure adapter: serves quizzes from IndexedDB (seeded once by
 * `QuizCatalogSeeder`) and persists question edits back to it.
 */
@Injectable()
export class QuizIndexedDbRepository extends QuizRepository {
  private readonly db = inject(QuizDb);

  listQuizzes(): Observable<QuizSummary[]> {
    return from(this.db.getAllQuizzes()).pipe(
      map((quizzes) =>
        quizzes.map(({ id, title, count }) => ({ id, title, count })),
      ),
    );
  }

  getQuiz(id: string): Observable<Quiz> {
    return from(this.db.getQuiz(id)).pipe(
      map((quiz) => {
        if (!quiz) throw new Error(`Quiz "${id}" not found`);
        return quiz;
      }),
    );
  }

  updateQuestion(quizId: string, question: Question): Observable<void> {
    return from(this.saveQuestion(quizId, question));
  }

  private async saveQuestion(quizId: string, question: Question): Promise<void> {
    const quiz = await this.db.getQuiz(quizId);
    if (!quiz) throw new Error(`Quiz "${quizId}" not found`);
    const questions = quiz.questions.map((q) => (q.id === question.id ? question : q));
    await this.db.putQuiz({ ...quiz, questions });
  }
}
