import { apiCall } from "./http";
import { Todo, TodoPriority, TodoStatus } from "../types";

export interface TodoPayload {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TodoPriority;
  reminderAt?: string;
}

export const listTodos = (
  token: string,
  opts: { status?: TodoStatus; limit?: number } = {}
): Promise<Todo[]> => {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiCall(`/todos${qs ? `?${qs}` : ""}`, { token });
};

export const createTodo = (
  token: string,
  payload: TodoPayload
): Promise<Todo> =>
  apiCall("/todos", { method: "POST", body: payload, token });

export const updateTodo = (
  token: string,
  id: string,
  payload: Partial<TodoPayload>
): Promise<Todo> =>
  apiCall(`/todos/${id}`, { method: "PUT", body: payload, token });

export const completeTodo = (
  token: string,
  id: string
): Promise<{ message: string }> =>
  apiCall(`/todos/${id}/complete`, { method: "POST", token });

export const reopenTodo = (
  token: string,
  id: string
): Promise<{ message: string }> =>
  apiCall(`/todos/${id}/reopen`, { method: "POST", token });

export const deleteTodo = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/todos/${id}`, { method: "DELETE", token });
