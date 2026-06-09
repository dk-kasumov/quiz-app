import { Routes } from '@angular/router';
import { QuizList } from './presentation/pages/quiz-list/quiz-list';
import { QuizPlayer } from './presentation/pages/quiz-player/quiz-player';

export const routes: Routes = [
  { path: '', component: QuizList, title: 'Оберіть вікторину' },
  { path: 'quiz/:id', component: QuizPlayer, title: 'Вікторина' },
  { path: '**', redirectTo: '' },
];
