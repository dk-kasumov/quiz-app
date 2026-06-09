import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A labelled progress bar showing the current question position within a quiz. */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
})
export class ProgressBar {
  /** 1-based position of the current question. */
  readonly current = input.required<number>();
  readonly total = input.required<number>();

  readonly percent = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.current() / this.total()) * 100),
  );
}
