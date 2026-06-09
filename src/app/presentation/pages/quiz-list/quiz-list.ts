import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuizCatalogService } from '../../../application/quiz-catalog.service';

/** Selection screen: lists every available quiz. */
@Component({
  selector: 'app-quiz-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-list.html',
  styleUrl: './quiz-list.scss',
})
export class QuizList {
  private readonly catalog = inject(QuizCatalogService);
  readonly quizzes = this.catalog.quizzes;
}
