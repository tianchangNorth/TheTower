import type { ReactNode } from "react";

/** Feed 的 loading / error 包装；empty 由各 feed 自行判断。 */
export function FeedState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error?: string;
  children: ReactNode;
}) {
  if (loading) {
    return <p className="m-auto p-4 text-[12px] text-tower-text-muted">Loading…</p>;
  }
  if (error) {
    return <p className="m-auto p-4 text-[12px] text-tower-accent-danger">{error}</p>;
  }
  return <>{children}</>;
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="m-auto p-4 text-[12px] text-tower-text-muted">{text}</p>
  );
}
