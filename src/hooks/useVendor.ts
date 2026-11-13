import { useEffect, useState } from "react";
import { getMe, type Me } from "../services/api";

/** Loads the signed-in vendor (store, subscription, next step). Used by every dashboard page. */
export function useVendor() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getMe().then((r) => {
      if (cancelled) return;
      if (r.ok) setMe(r.data);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { me, error };
}
