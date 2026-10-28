import { useEffect, useState } from 'react';
import { api } from './api';
export function useResource(path) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(path)
      .then((data) => {
        if (active) setState({ data, error: '', loading: false });
      })
      .catch((error) => {
        if (active) setState({ data: null, error: error.message, loading: false });
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
