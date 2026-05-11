import { apiCall } from "./http";
import { Comment } from "../types";

export const listComments = (
  token: string,
  taskId: string
) =>
  apiCall<Comment[]>(`/tasks/${taskId}/comments`, { token });

export const addComment = (
  token: string,
  taskId: string,
  text: string
) =>
  apiCall<Comment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: { text },
    token,
  });

export const deleteComment = (
  token: string,
  taskId: string,
  commentId: string
) =>
  apiCall<{ message: string }>(
    `/tasks/${taskId}/comments/${commentId}`,
    { method: "DELETE", token }
  );
