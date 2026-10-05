import { useEffect, useState } from "react";

export function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPainted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return painted;
}
