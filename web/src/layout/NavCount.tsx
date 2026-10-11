import { useTenant } from "../tenants/context";
import { countText, type CountNoun } from "./navCounts";
import { useAfterFirstPaint } from "./useAfterFirstPaint";

export function CountBadge({ count, noun }: { count: number | null; noun: CountNoun }) {
  if (count === null || count === 0) return null;
  return (
    <>
      <span className="nav__count" aria-hidden="true">
        {count}
      </span>
      <span className="visually-hidden">, {countText(count, noun)}</span>
    </>
  );
}

export function NavCount({ path }: { path: string }) {
  const { navCounts } = useTenant();
  const painted = useAfterFirstPaint();
  const Count = navCounts[path];
  if (!Count || !painted) return null;
  return <Count />;
}
