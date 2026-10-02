/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiClient, CanceledError } from './api-client';
export { CanceledError };

export interface INotification {
    _id?: string;
    userId: string;
    matchId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
}


const getAllByUserId = (userId?: string) => {
  const abortController = new AbortController();
  
  const request = apiClient.get<{ data: INotification[] }>('/notification', {
    params: { userId },
    signal: abortController.signal,
  });

  return { request, abort: () => abortController.abort() };
};


const getById = (id: string) => {
  const abortController = new AbortController();
  
  const request = apiClient.get<{ data: INotification }>(`/notification/${id}`, {
    signal: abortController.signal,
  });

  return { request, abort: () => abortController.abort() };
};


const deleteById = (id: string) => {
  const abortController = new AbortController();
  
  const request = apiClient.delete<{ message: string }>(`/notification/${id}`, {
    signal: abortController.signal,
  });

  return { request, abort: () => abortController.abort() };
};


const markAsRead = (id: string) => {
  const abortController = new AbortController();
  
  const request = apiClient.put<{ data: INotification }>(`/notification/${id}/read`, {}, {
    signal: abortController.signal,
  });

  return { request, abort: () => abortController.abort() };
};


const markAllAsRead = (userId: string) => {
  const abortController = new AbortController();
  
  const request = apiClient.put<{ message: string }>('/notification/read-all', { userId }, {
    signal: abortController.signal,
  });

  return { request, abort: () => abortController.abort() };
};

export default {
  getAllByUserId,
  getById,
  deleteById,
  markAsRead,
  markAllAsRead,
};
