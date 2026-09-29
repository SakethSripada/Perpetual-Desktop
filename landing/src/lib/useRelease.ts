import { useEffect, useState } from 'react';
import { latestRelease, type Release } from './release';

export function useRelease() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void latestRelease().then((result) => {
      if (active) {
        setRelease(result);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { release, loading };
}
