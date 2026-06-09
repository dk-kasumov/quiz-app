import {
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionLabel, Question } from '../../../domain/models/question.model';

interface OptionDraft {
  label: OptionLabel;
  text: string;
  correct: boolean;
}

/**
 * Modal (native <dialog>) to edit a question: its text, the option texts, and
 * which option(s) are correct (zero, one, or many). Works on a local copy so
 * Cancel/Esc discards; Save emits the updated question.
 */
@Component({
  selector: 'app-question-edit-dialog',
  imports: [FormsModule],
  templateUrl: './question-edit-dialog.html',
  styleUrl: './question-edit-dialog.scss',
})
export class QuestionEditDialog implements OnInit {
  readonly question = input.required<Question>();
  readonly save = output<Question>();
  readonly dismiss = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected text = '';
  protected options: OptionDraft[] = [];

  constructor() {
    // Open as a true modal once the <dialog> is in the DOM.
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  ngOnInit(): void {
    const q = this.question();
    this.text = q.question;
    this.options = q.options.map((o) => ({ label: o.label, text: o.text, correct: o.correct }));
  }

  onSubmit(): void {
    this.save.emit({
      ...this.question(),
      question: this.text.trim(),
      options: this.options.map((o) => ({ label: o.label, text: o.text.trim(), correct: o.correct })),
    });
  }
}
