import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { Todo } from "../types";

// Local (on-device) one-shot reminders for to-dos. A to-do's `reminderAt`
// is an absolute ISO timestamp; we schedule a single DATE-trigger
// notification to fire at that moment. This is separate from the repeating
// interval reminders in `reminders.ts` (which are for team Tasks).
const STORAGE_KEY = "todo_reminder_ids";
const isWeb = Platform.OS === "web";

type StoredMap = Record<string, string>;

const loadStored = async (): Promise<StoredMap> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStored = async (m: StoredMap) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(m));
};

// Schedule (or re-schedule) the reminder for one to-do. Idempotent: any
// existing reminder for this to-do is cancelled first, so calling it again
// after an edit never leaves a duplicate. No-ops when the to-do has no
// reminder, is already done, or the reminder time is in the past.
export const scheduleTodoReminder = async (todo: Todo) => {
  if (isWeb) return;

  await cancelTodoReminder(todo.id);

  if (!todo.reminderAt) return;
  if (todo.status === "DONE") return;

  const when = new Date(todo.reminderAt);
  if (isNaN(when.getTime())) return;
  if (when.getTime() <= Date.now()) return;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "To-do reminder",
        body: todo.title,
        data: { type: "todo_reminder", todoId: todo.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      } as any,
    });

    const stored = await loadStored();
    stored[todo.id] = id;
    await saveStored(stored);
  } catch (err) {
    console.log("To-do reminder schedule error:", err);
  }
};

export const cancelTodoReminder = async (todoId: string) => {
  if (isWeb) return;

  const stored = await loadStored();
  const id = stored[todoId];

  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // best-effort
    }
  }

  delete stored[todoId];
  await saveStored(stored);
};

// Ensure local reminders exist for the given OPEN to-dos. Called after the
// list loads so reminders survive app restarts / reinstalls and get picked
// up on whichever device is viewing the list. Only schedules for the to-dos
// passed in — it deliberately does NOT cancel others, because the list is
// filtered (Open vs Done) and we must not wipe reminders for items off-screen.
export const ensureTodoReminders = async (openTodos: Todo[]) => {
  if (isWeb) return;
  for (const t of openTodos) {
    if (t.status === "OPEN" && t.reminderAt) {
      await scheduleTodoReminder(t);
    }
  }
};
