export const APP_VERSION = 'v1.0.0-beta';

export interface TimelineItem {
  id: string;
  baseId: string;
  emoji: string;
  label: string;
  type: 'instant' | 'duration';
  startTime: number;
  endTime?: number | null;
  createdAt: number;
  isPanic?: boolean;
}

export interface ExpenseItem {
  id: string;
  amount: number;
  note: string;
  category: string;
  timestamp: number;
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  timestamp: number;
  dueDate: string;
  source?: 'manual' | 'default' | 'scheduled';
  templateKey?: string;
}

export interface ScheduledTask {
  id: string;
  text: string;
  dueDate: string;
  createdAt: number;
}

export interface DailyState {
  date: string;
  intention: string;
  battery: number;
  timeline: TimelineItem[];
  expenses: ExpenseItem[];
  tasks: TaskItem[];
  v?: string;
}