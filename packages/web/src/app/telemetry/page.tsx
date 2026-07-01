import { Suspense } from "react";
import { TelemetryPageClient } from "@/components/telemetry/TelemetryPageClient";

// 跨线程观测与审计中心。useSearchParams 需要 Suspense 包裹以参与静态预渲染。
export default function TelemetryPage() {
  return (
    <Suspense fallback={null}>
      <TelemetryPageClient />
    </Suspense>
  );
}
