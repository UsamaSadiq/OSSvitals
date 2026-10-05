import { useCallback, useEffect, useRef, useState } from "react";
import { isPaletteToggle, isSlashOpen } from "./paletteKeys";

export interface CommandPaletteControls {
  open: boolean;
  show: () => void;
  dismiss: () => void;
  closeForNavigation: () => void;
}

function focusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function useCommandPalette(): CommandPaletteControls {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    opener.current = focusedElement();
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
    opener.current = null;
  }, []);

  const closeForNavigation = useCallback(() => {
    setOpen(false);
    opener.current = null;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isPaletteToggle(event)) {
        event.preventDefault();
        if (open) dismiss();
        else show();
      } else if (!open && isSlashOpen(event)) {
        event.preventDefault();
        show();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show, dismiss]);

  return { open, show, dismiss, closeForNavigation };
}
