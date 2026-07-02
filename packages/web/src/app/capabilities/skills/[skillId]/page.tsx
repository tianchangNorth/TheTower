import { SkillDetailPageClient } from "@/components/capabilities/SkillDetailPageClient";

// 单个 Skill 详情：manifest 字段 + 完整 SKILL.md prompt。
export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  return <SkillDetailPageClient skillId={skillId} />;
}
