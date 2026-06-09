import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OptionLabel, Question } from '../../../domain/models/question.model';
import { OptionState } from '../../../domain/answer-evaluation';

/** Renders a question and its options, emitting the label the user picks. */
@Component({
  selector: 'app-question-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-card.html',
  styleUrl: './question-card.scss',
})
export class QuestionCard {
  readonly question = input.required<Question>();
  /** Per-option visual state (label → state), provided by the session. */
  readonly states = input.required<Record<OptionLabel, OptionState>>();
  /** Once answered, options are locked. */
  readonly answered = input.required<boolean>();

  readonly pick = output<OptionLabel>();
  readonly edit = output<void>();
}
