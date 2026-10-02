/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiClient, CanceledError } from './api-client';
export { CanceledError };

export interface IMatch {
  _id?: string;
  item1Id: string;
  userId1: string;
  item2Id: string;
  userId2: string;
  matchScore: number;
  user1Confirmed: boolean;
  user2Confirmed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMatchResponse {
  message: string;
  status: 'FULLY_CONFIRMED' | 'PARTIALLY_CONFIRMED';
  match: IMatch;
  userConfirmed?: 'user1' | 'user2';
  awaitingConfirmation?: 'user1' | 'user2';
}

const getAllByUserId = (userId?: string) => {
  console.log('[MATCH_SERVICE] getAllByUserId called with userId:', userId);
  const abortController = new AbortController();
  
  const request = apiClient.get<IMatch[]>('/match/user/' + userId, {
    signal: abortController.signal,
  }).then(response => {
    console.log('[MATCH_SERVICE] getAllByUserId response:', response);
    return response;
  }).catch(error => {
    console.error('[MATCH_SERVICE] getAllByUserId error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  });

  return { request, abort: () => abortController.abort() };
};

const getById = (id: string) => {
  console.log('[MATCH_SERVICE] getById called with id:', id);
  const abortController = new AbortController();
  
  const request = apiClient.get<IMatch>(`/match/${id}`, {
    signal: abortController.signal,
  }).then(response => {
    console.log('[MATCH_SERVICE] getById response:', response);
    return response;
  }).catch(error => {
    console.error('[MATCH_SERVICE] getById error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  });

  return { request, abort: () => abortController.abort() };
};

const deleteById = (id: string) => {
  console.log('[MATCH_SERVICE] deleteById called with id:', id);
  const abortController = new AbortController();
  
  const request = apiClient.delete<{ message: string }>(`/match/${id}`, {
    signal: abortController.signal,
  }).then(response => {
    console.log('[MATCH_SERVICE] deleteById response:', response);
    return response;
  }).catch(error => {
    console.error('[MATCH_SERVICE] deleteById error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  });

  return { request, abort: () => abortController.abort() };
};

const confirmMatch = (matchId: string, userId: string) => {
  console.log('[MATCH_SERVICE] confirmMatch called with:', { matchId, userId });
  const abortController = new AbortController();
  
  const request = apiClient.post<IMatchResponse>('/match/confirm', {
    matchId,
    userId,
  }, {
    signal: abortController.signal,
  }).then(response => {
    console.log('[MATCH_SERVICE] confirmMatch response:', response);
    return response;
  }).catch(error => {
    console.error('[MATCH_SERVICE] confirmMatch error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    // Enhance error message based on status code
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request. Please check your input.');
    } else if (error.response?.status === 403) {
      throw new Error('You are not authorized to confirm this match.');
    } else if (error.response?.status === 404) {
      throw new Error('Match not found. It may have been deleted or never existed.');
    } else {
      throw new Error('Failed to confirm match. Please try again later.');
    }
  });

  return { request, abort: () => abortController.abort() };
};

export default {
  getAllByUserId,
  getById,
  deleteById,
  confirmMatch,
};
