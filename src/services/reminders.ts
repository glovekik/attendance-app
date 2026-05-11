import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { Task } from "../types";

const STORAGE_KEY = "task_reminder_ids";
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

export const scheduleTaskReminder = async (task: Task) => {

  if (isWeb) return;

  await cancelTaskReminder(task.id);

  if (!task.reminderIntervalMinutes) return;
  if (task.reminderIntervalMinutes <= 0) return;
  if (task.status === "COMPLETED") return;

  const seconds = task.reminderIntervalMinutes * 60;

  if (seconds < 60) return;

  try {

    const id = await Notifications.scheduleNotificationAsync({

      content: {
        title: "Task reminder",
        body: task.title,
        data: { taskId: task.id },
      },

      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      } as any,
    });

    const stored = await loadStored();
    stored[task.id] = id;
    await saveStored(stored);

  } catch (err) {
    console.log("Reminder schedule error:", err);
  }
};

export const cancelTaskReminder = async (taskId: string) => {

  if (isWeb) return;

  const stored = await loadStored();
  const id = stored[taskId];

  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // best-effort
    }
  }

  delete stored[taskId];
  await saveStored(stored);
};

export const syncRemindersToTasks = async (tasks: Task[]) => {

  if (isWeb) return;

  // Use the OS's actual scheduled-notifications list as the source of
  // truth, not our local map. The map can drift if the app was killed
  // mid-cancel, if Expo's stored IDs change format, or if repeating
  // reminders queue iterations the cancel call doesn't reach in time.
  const taskById: Record<string, Task> = {};
  for (const t of tasks) taskById[t.id] = t;

  let scheduled: Notifications.NotificationRequest[] = [];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    scheduled = [];
  }

  const survivingMap: StoredMap = {};

  // Walk every OS-scheduled notification. Cancel anything tagged with a
  // taskId that is COMPLETED, ONGOING, missing from the live list, or
  // has its reminder interval cleared.
  for (const req of scheduled) {
    const data: any = (req.content && req.content.data) || {};
    const taskId: string | undefined = data.taskId;
    if (!taskId) continue;
    const task = taskById[taskId];
    const shouldKeep =
      task &&
      task.status === "PENDING" &&
      task.reminderIntervalMinutes &&
      task.reminderIntervalMinutes > 0;
    if (!shouldKeep) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          req.identifier
        );
      } catch {
        /* best-effort */
      }
    } else {
      survivingMap[taskId] = req.identifier;
    }
  }

  // Schedule new reminders for any PENDING task that has an interval
  // but no live OS-scheduled notification.
  for (const task of tasks) {
    if (
      task.status === "PENDING" &&
      task.reminderIntervalMinutes &&
      task.reminderIntervalMinutes > 0 &&
      !survivingMap[task.id]
    ) {
      await scheduleTaskReminder(task);
    }
  }

  // Persist the OS-truth map so future calls start from a clean state.
  await saveStored(survivingMap);
};

export const clearAllReminders = async () => {

  if (isWeb) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(STORAGE_KEY);
};
