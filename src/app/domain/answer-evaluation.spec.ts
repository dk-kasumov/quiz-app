import { Question } from './models/question.model';
import { correctLabels, evaluateOption, hasCorrectAnswer, isCorrect } from './answer-evaluation';

function make(correct: string[]): Question {
  return {
    id: 1,
    section: 'TEST',
    question: 'q?',
    options: (['A', 'B', 'C', 'D', 'E'] as const).map((label) => ({
      label,
      text: label.toLowerCase(),
      correct: correct.includes(label),
    })),
  };
}

const single = make(['C']);
const multi = make(['B', 'D']);
const none = make([]);

describe('correctLabels / hasCorrectAnswer', () => {
  it('reports the correct labels', () => {
    expect(correctLabels(single)).toEqual(['C']);
    expect(correctLabels(multi)).toEqual(['B', 'D']);
    expect(correctLabels(none)).toEqual([]);
    expect(hasCorrectAnswer(none)).toBe(false);
  });
});

describe('evaluateOption', () => {
  it('marks every option idle before answering', () => {
    for (const o of single.options) expect(evaluateOption(single, o.label, null)).toBe('idle');
  });

  it('marks only the correct option green when the right answer is picked', () => {
    expect(evaluateOption(single, 'C', 'C')).toBe('correct');
    expect(evaluateOption(single, 'A', 'C')).toBe('neutral');
  });

  it('marks the wrong pick red and still shows the correct option green', () => {
    expect(evaluateOption(single, 'A', 'A')).toBe('wrong');
    expect(evaluateOption(single, 'C', 'A')).toBe('correct');
    expect(evaluateOption(single, 'B', 'A')).toBe('neutral');
  });

  it('reveals all correct options when there are several', () => {
    // Picked one correct (B): both B and D are green, others neutral.
    expect(evaluateOption(multi, 'B', 'B')).toBe('correct');
    expect(evaluateOption(multi, 'D', 'B')).toBe('correct');
    expect(evaluateOption(multi, 'A', 'B')).toBe('neutral');
    // Picked a wrong one (A): A red, B and D green.
    expect(evaluateOption(multi, 'A', 'A')).toBe('wrong');
    expect(evaluateOption(multi, 'B', 'A')).toBe('correct');
    expect(evaluateOption(multi, 'D', 'A')).toBe('correct');
  });

  it('marks the pick blue when the question has no correct answer', () => {
    expect(evaluateOption(none, 'B', 'B')).toBe('no-answer');
    expect(evaluateOption(none, 'A', 'B')).toBe('neutral');
  });
});

describe('isCorrect', () => {
  it('scores a point for any correct pick', () => {
    expect(isCorrect(single, 'C')).toBe(true);
    expect(isCorrect(single, 'A')).toBe(false);
    expect(isCorrect(multi, 'B')).toBe(true);
    expect(isCorrect(multi, 'D')).toBe(true);
    expect(isCorrect(multi, 'A')).toBe(false);
    expect(isCorrect(none, 'B')).toBe(false);
    expect(isCorrect(single, null)).toBe(false);
  });
});
