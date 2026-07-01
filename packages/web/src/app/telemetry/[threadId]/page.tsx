import { Suspense } from "react";
import { TelemetryPageClient } from "@/components/telemetry/TelemetryPageClient";

// 指定 thread 的观测入口：URL threadId 作为筛选与 context 来源。
export default async function ThreadTelemetryPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <Suspense fallback={null}>
      <TelemetryPageClient threadId={threadId} />
    </Suspense>
  );
}
