import { useCallback } from 'react';
import { api } from '../services/api';

export function useApi() {
  const get = useCallback((url, config) => api.get(url, config), []);
  const post = useCallback((url, data, config) => api.post(url, data, config), []);
  const put = useCallback((url, data, config) => api.put(url, data, config), []);
  const del = useCallback((url, config) => api.delete(url, config), []);

  return { get, post, put, del };
}

export default useApi;