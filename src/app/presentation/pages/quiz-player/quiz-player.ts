import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuizSessionService } from '../../../application/quiz-session.service';
import { OptionLabel, Question } from '../../../domain/models/question.model';
import { ProgressBar } from '../../components/progress-bar/progress-bar';
import { QuestionCard } from '../../components/question-card/question-card';
import { QuestionEditDialog } from '../../components/question-edit-dialog/question-edit-dialog';

/** Plays through a quiz: progress bar, question, answer feedback, Back/Next, results. */
@Component({
  selector: 'app-quiz-player',
  imports: [RouterLink, ProgressBar, QuestionCard, QuestionEditDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-player.html',
  styleUrl: './quiz-player.scss',
})
export class QuizPlayer implements OnInit {
  /** Route param `:id`, bound via `withComponentInputBinding()`. */
  readonly id = input.required<string>();
  protected readonly session = inject(QuizSessionService);

  /** Whether the edit modal is open. */
  protected readonly editing = signal(false);

  ngOnInit(): void {
    this.session.start(this.id());
  }

  pick(label: OptionLabel): void {
    this.session.select(label);
  }

  saveEdit(updated: Question): void {
    this.session.applyEdit(updated);
    this.editing.set(false);
  }
}
