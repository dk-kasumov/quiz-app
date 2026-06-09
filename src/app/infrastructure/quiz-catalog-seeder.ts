import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Quiz } from '../domain/models/quiz.model';
import { QuizDb } from './db/quiz-db';

interface Catalog {
  version: number;
  quizzes: Quiz[];
}

/**
 * Seeds the quiz catalog into IndexedDB on app start.
 *
 * Warm starts fetch only the tiny `version.json`; the 1.2 MB catalog is fetched
 * only when IndexedDB is empty or the shipped version is newer (version-gated
 * re-seed). If the network is unavailable but the DB already holds data, that
 * data is used (offline-friendly).
 */
@Injectable({ providedIn: 'root' })
export class QuizCatalogSeeder {
  private readonly http = inject(HttpClient);
  private readonly db = inject(QuizDb);

  async ensureSeeded(): Promise<void> {
    let fileVersion: number;
    try {
      fileVersion = (await firstValueFrom(this.http.get<{ version: number }>('quizs/version.json')))
        .version;
    } catch {
      if (!(await this.db.isEmpty())) return; // offline but already seeded
      throw new Error('Quiz catalog is unavailable and nothing is cached.');
    }

    const needsSeed = (await this.db.isEmpty()) || fileVersion > (await this.db.getVersion());
    if (!needsSeed) return;

    const catalog = await firstValueFrom(this.http.get<Catalog>('quizs/questions.json'));
    await this.db.replaceAll(catalog.quizzes, catalog.version);
  }
}
