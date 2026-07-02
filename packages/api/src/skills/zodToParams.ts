import { z } from "zod";
import type { McpToolParam } from "@the-tower/shared";

/**
 * 把 MCP 工具的 zod inputSchema（Record<string, ZodTypeAny>）序列化成可下发的参数列表，
 * 给 /api/mcp-tools 目录/详情页用。只覆盖 7 个工具实际用到的 zod 类型：
 * string / number / boolean / enum / array / object / optional / union / default。
 * 嵌套 object（如 handoffPayload）递归进 nested[]。
 */
export function zodToParams(shape: Record<string, z.ZodTypeAny>): McpToolParam[] {
  return Object.entries(shape).map(([name, field]) => toParam(name, field));
}

function toParam(name: string, type: z.ZodTypeAny): McpToolParam {
  const { inner, required } = unwrapOptional(type);
  return {
    name,
    type: describeType(inner),
    required,
    description: type.description ?? inner.description,
    nested: nestedParams(inner),
  };
}

function unwrapOptional(type: z.ZodTypeAny): { inner: z.ZodTypeAny; required: boolean } {
  if (type instanceof z.ZodOptional) return { inner: type.unwrap(), required: false };
  if (type instanceof z.ZodDefault) return { inner: type.removeDefault(), required: false };
  if (type instanceof z.ZodNullable) return { inner: type.unwrap(), required: false };
  return { inner: type, required: true };
}

function describeType(type: z.ZodTypeAny): string {
  if (type instanceof z.ZodString) return "string";
  if (type instanceof z.ZodNumber) return "number";
  if (type instanceof z.ZodBoolean) return "boolean";
  if (type instanceof z.ZodEnum) return `enum(${type.options.join(" | ")})`;
  if (type instanceof z.ZodArray) return `array<${describeType(type.element)}>`;
  if (type instanceof z.ZodObject) return "object";
  if (type instanceof z.ZodUnion) {
    const options = type.options as z.ZodTypeAny[];
    return options.map(describeType).join(" | ");
  }
  if (type instanceof z.ZodLiteral) return `literal(${JSON.stringify(type.value)})`;
  return "any";
}

function nestedParams(type: z.ZodTypeAny): McpToolParam[] | undefined {
  let inner = type;
  if (inner instanceof z.ZodArray) inner = inner.element;
  inner = unwrapOptional(inner).inner;
  if (inner instanceof z.ZodObject) {
    return Object.entries(inner.shape).map(([name, field]) => toParam(name, field as z.ZodTypeAny));
  }
  return undefined;
}
