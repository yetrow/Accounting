import { object } from "../domain/book.ts";
import type { AuditEvent, Change } from "./repository.ts";
/** Flatten imported histories and retain each immutable event only once.
 * Imported events are provenance, never replayed as local writes. */
export function flattenAudit(events: unknown[]): Map<string, AuditEvent> {
  const found = new Map<string, AuditEvent>();
  const todo = [...events];
  let visited = 0;
  while (todo.length) {
    if (++visited > 100000) throw new Error("审计记录超过 100000 条");
    const raw = object(todo.pop());
    if (
      typeof raw.id !== "string" ||
      !raw.id ||
      raw.id.length > 160 ||
      !Number.isSafeInteger(raw.revision) ||
      Number(raw.revision) < 1 ||
      !Number.isSafeInteger(raw.at) ||
      Number(raw.at) < 0 ||
      typeof raw.kind !== "string" ||
      raw.kind.length > 100 ||
      !Array.isArray(raw.changes)
    )
      throw new Error("审计记录格式错误");
    const changes = raw.changes.map((value) => {
      const c = object(value);
      if (
        !["accounts", "categories", "transactions", "budgets"].includes(
          String(c.entity),
        ) ||
        typeof c.id !== "string" ||
        !c.id ||
        c.before === undefined ||
        c.after === undefined
      )
        throw new Error("审计变更格式错误");
      if (c.before !== null) object(c.before);
      if (c.after !== null) object(c.after);
      return {
        entity: c.entity,
        id: c.id,
        before: c.before,
        after: c.after,
      } as Change;
    });
    const event: AuditEvent = {
      id: raw.id,
      revision: Number(raw.revision),
      at: Number(raw.at),
      kind: raw.kind,
      changes,
    };
    const existing = found.get(event.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event))
      throw new Error("相同审计编号包含不同记录");
    found.set(event.id, event);
    if (raw.sourceAudit !== undefined) {
      if (!Array.isArray(raw.sourceAudit)) throw new Error("来源审计格式错误");
      for (const child of raw.sourceAudit) todo.push(child);
    }
  }
  return found;
}
export function newProvenance(
  incoming: unknown[],
  local: AuditEvent[],
): AuditEvent[] {
  const known = flattenAudit(local),
    source = flattenAudit(incoming),
    result: AuditEvent[] = [];
  for (const [id, event] of source) {
    const prior = known.get(id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(event))
        throw new Error("导入审计与本机同编号记录冲突");
    } else result.push(event);
  }
  return result;
}
