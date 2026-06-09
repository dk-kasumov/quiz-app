import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Quiz } from '../../domain/models/quiz.model';

interface HistoQuizDb extends DBSchema {
  quizzes: { key: string; value: Quiz };
  meta: { key: string; value: number };
}

const DB_NAME = 'histoquiz';
const DB_VERSION = 1;
const VERSION_KEY = 'catalogVersion';

/**
 * Thin promise-based gateway over IndexedDB (via `idb`). Holds the quiz catalog
 * in the `quizzes` store and the seeded data version in `meta`.
 */
@Injectable({ providedIn: 'root' })
export class QuizDb {
  private dbPromise?: Promise<IDBPDatabase<HistoQuizDb>>;

  private db(): Promise<IDBPDatabase<HistoQuizDb>> {
    this.dbPromise ??= openDB<HistoQuizDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('quizzes', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
    return this.dbPromise;
  }

  async isEmpty(): Promise<boolean> {
    return (await (await this.db()).count('quizzes')) === 0;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    return (await this.db()).getAll('quizzes');
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    return (await this.db()).get('quizzes', id);
  }

  async putQuiz(quiz: Quiz): Promise<void> {
    await (await this.db()).put('quizzes', quiz);
  }

  /** Replace the whole catalog atomically (used when seeding / re-seeding). */
  async replaceAll(quizzes: Quiz[], version: number): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['quizzes', 'meta'], 'readwrite');
    await tx.objectStore('quizzes').clear();
    for (const quiz of quizzes) await tx.objectStore('quizzes').put(quiz);
    await tx.objectStore('meta').put(version, VERSION_KEY);
    await tx.done;
  }

  async getVersion(): Promise<number> {
    return (await (await this.db()).get('meta', VERSION_KEY)) ?? 0;
  }
}
