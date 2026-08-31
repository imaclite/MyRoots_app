import { byBirthThenName, childrenOf, spousesOf, wifeOrdinal, wifeStatusTag } from "./graph";
import {
  CARD_H,
  CARD_W,
  GAP_X,
  GAP_Y,
  PAD,
  SPOUSE_GAP,
  spouseIdList,
  type LayoutEdge,
  type LayoutNode,
  type Person,
  type TreeLayout,
} from "./types";

type Measured = {
  height: number;
  personOffset: number;
};

function measureAncestors(
  people: Record<string, Person>,
  id: string | null,
  seen: Set<string>,
): Measured {
  if (!id || seen.has(id) || !people[id] || seen.size > 40) {
    return { height: CARD_H, personOffset: 0 };
  }
  const person = people[id]!;
  const nextSeen = new Set(seen);
  nextSeen.add(id);
  const hasFather = Boolean(person.fatherId && people[person.fatherId]);
  const hasMother = Boolean(person.motherId && people[person.motherId]);
  if (!hasFather && !hasMother) return { height: CARD_H, personOffset: 0 };

  const father = measureAncestors(people, hasFather ? person.fatherId : null, nextSeen);
  const mother = measureAncestors(people, hasMother ? person.motherId : null, nextSeen);
  if (hasFather && hasMother) {
    const height = father.height + GAP_Y + mother.height;
    return { height, personOffset: (height - CARD_H) / 2 };
  }
  const only = hasFather ? father : mother;
  return { height: Math.max(CARD_H, only.height), personOffset: (Math.max(CARD_H, only.height) - CARD_H) / 2 };
}

function placeAncestors(
  people: Record<string, Person>,
  id: string,
  x: number,
  subtreeTop: number,
  role: LayoutNode["role"],
  nodes: Map<string, LayoutNode>,
  seen: Set<string>,
): void {
  if (seen.has(id) || !people[id]) return;
  seen.add(id);
  const m = measureAncestors(people, id, new Set());
  const y = subtreeTop + m.personOffset;
  nodes.set(id, { id, x, y, w: CARD_W, h: CARD_H, role });

  const person = people[id]!;
  const parentX = x + CARD_W + GAP_X;
  const hasFather = Boolean(person.fatherId && people[person.fatherId]);
  const hasMother = Boolean(person.motherId && people[person.motherId]);
  if (!hasFather && !hasMother) return;

  const fatherM = measureAncestors(people, hasFather ? person.fatherId : null, new Set());
  const motherM = measureAncestors(people, hasMother ? person.motherId : null, new Set());
  const parentRole: LayoutNode["role"] = role === "inlaw" ? "inlaw" : "ancestor";

  if (hasFather && hasMother) {
    const parentsH = fatherM.height + GAP_Y + motherM.height;
    const parentsTop = y + CARD_H / 2 - parentsH / 2;
    placeAncestors(people, person.fatherId!, parentX, parentsTop, parentRole, nodes, seen);
    placeAncestors(
      people,
      person.motherId!,
      parentX,
      parentsTop + fatherM.height + GAP_Y,
      parentRole,
      nodes,
      seen,
    );
  } else if (hasFather) {
    const top = y + CARD_H / 2 - fatherM.height / 2;
    placeAncestors(people, person.fatherId!, parentX, top, parentRole, nodes, seen);
  } else if (hasMother) {
    const top = y + CARD_H / 2 - motherM.height / 2;
    placeAncestors(people, person.motherId!, parentX, top, parentRole, nodes, seen);
  }
}

function placeDescendants(
  people: Record<string, Person>,
  parentId: string,
  parentNode: LayoutNode,
  nodes: Map<string, LayoutNode>,
  seen: Set<string>,
): void {
  const kids = childrenOf(people, parentId).filter((k) => !seen.has(k.id));
  if (!kids.length) return;

  const childX = parentNode.x - CARD_W - GAP_X;
  const blocks = kids.map((person) => {
    const spouses = spousesOf(people, person).filter((s) => !seen.has(s.id) && s.id !== parentId);
    const n = 1 + spouses.length;
    const height = n * CARD_H + Math.max(0, n - 1) * SPOUSE_GAP;
    return { person, spouses, height };
  });
  const total = blocks.reduce((s, b) => s + b.height, 0) + GAP_Y * (blocks.length - 1);
  let y = parentNode.y + parentNode.h / 2 - total / 2;

  for (const block of blocks) {
    seen.add(block.person.id);
    nodes.set(block.person.id, {
      id: block.person.id,
      x: childX,
      y,
      w: CARD_W,
      h: CARD_H,
      role: "child",
    });
    let sy = y + CARD_H + SPOUSE_GAP;
    for (const spouse of block.spouses) {
      seen.add(spouse.id);
      nodes.set(spouse.id, {
        id: spouse.id,
        x: childX,
        y: sy,
        w: CARD_W,
        h: CARD_H,
        role: "spouse",
      });
      sy += CARD_H + SPOUSE_GAP;
    }
    y += block.height + GAP_Y;
  }
}

function shiftNodes(nodes: Map<string, LayoutNode>, ids: Set<string>, dy: number): void {
  for (const id of ids) {
    const n = nodes.get(id);
    if (n) n.y += dy;
  }
}

function bboxOf(nodes: Iterable<LayoutNode>): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function overlaps(a: LayoutNode, b: LayoutNode, pad = 10): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

function elbow(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const midX = (from.x + to.x) / 2;
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}

function buildGeneralEdges(people: Record<string, Person>, nodes: Map<string, LayoutNode>): LayoutEdge[] {
  const edges: LayoutEdge[] = [];

  const addParentEdge = (childId: string, parentId: string | null) => {
    if (!parentId) return;
    const c = nodes.get(childId);
    const p = nodes.get(parentId);
    if (!c || !p) return;
    edges.push({
      id: `p-${childId}-${parentId}`,
      kind: "parent",
      points: elbow(
        { x: c.x + c.w, y: c.y + c.h / 2 },
        { x: p.x, y: p.y + p.h / 2 },
      ),
    });
  };

  for (const node of nodes.values()) {
    const person = people[node.id];
    if (!person) continue;
    if (person.fatherId && nodes.has(person.fatherId)) addParentEdge(person.id, person.fatherId);
    if (person.motherId && nodes.has(person.motherId)) addParentEdge(person.id, person.motherId);
  }

  const spouseDrawn = new Set<string>();
  for (const node of nodes.values()) {
    const person = people[node.id];
    if (!person) continue;
    for (const spouse of spousesOf(people, person)) {
      const sn = nodes.get(spouse.id);
      if (!sn) continue;
      const key = [person.id, spouse.id].sort().join("::");
      if (spouseDrawn.has(key)) continue;
      spouseDrawn.add(key);
      if (Math.abs(node.x - sn.x) > 4) continue;
      const top = node.y <= sn.y ? node : sn;
      const bot = node.y <= sn.y ? sn : node;
      edges.push({
        id: `s-${key}`,
        kind: "spouse",
        points: [
          { x: top.x, y: top.y + top.h },
          { x: bot.x, y: bot.y },
        ],
      });
    }
  }

  return edges;
}

function buildEdges(
  people: Record<string, Person>,
  nodes: Map<string, LayoutNode>,
  focusId: string,
): LayoutEdge[] {
  const focus = people[focusId];
  if (!focus) return [];

  const edges = buildGeneralEdges(people, nodes);
  const focusNode = nodes.get(focusId);

  const kids = childrenOf(people, focusId).filter((k) => nodes.has(k.id));
  const spouseNodes = spousesOf(people, focus)
    .map((s) => nodes.get(s.id))
    .filter((n): n is LayoutNode => Boolean(n));
  if (focusNode && kids.length) {
    const childNodes = kids.map((k) => nodes.get(k.id)!);
    const busX = childNodes[0]!.x + CARD_W + GAP_X / 2;
    const lastSpouse = spouseNodes[spouseNodes.length - 1];
    const coupleTop = focusNode.y;
    const coupleBottom = lastSpouse ? lastSpouse.y + lastSpouse.h : focusNode.y + focusNode.h;
    const coupleY = (coupleTop + coupleBottom) / 2;
    const ys = childNodes.map((n) => n.y + n.h / 2);
    const minY = Math.min(...ys, coupleY);
    const maxY = Math.max(...ys, coupleY);

    edges.push({
      id: `bus-${focusId}`,
      kind: "child",
      points: [
        { x: busX, y: minY },
        { x: busX, y: maxY },
      ],
    });
    for (const n of childNodes) {
      edges.push({
        id: `c-${n.id}`,
        kind: "child",
        points: [
          { x: n.x + n.w, y: n.y + n.h / 2 },
          { x: busX, y: n.y + n.h / 2 },
        ],
      });
    }
    edges.push({
      id: `c-to-${focusId}`,
      kind: "child",
      points: [
        { x: busX, y: coupleY },
        { x: focusNode.x, y: coupleY },
      ],
    });
  }

  return edges;
}

export function layoutHourglass(people: Record<string, Person>, focusId: string | null): TreeLayout {
  const empty: TreeLayout = { nodes: [], edges: [], bbox: { x: 0, y: 0, w: 800, h: 600 } };
  if (!focusId || !people[focusId]) return empty;

  const nodes = new Map<string, LayoutNode>();
  const ancestorSeen = new Set<string>();
  placeAncestors(people, focusId, 0, 0, "focus", nodes, ancestorSeen);
  const focusNode = nodes.get(focusId);
  if (!focusNode) return empty;
  focusNode.role = "focus";

  const spouses = spousesOf(people, people[focusId]!);
  const inlawIds = new Set<string>();
  let lastSpouseY = focusNode.y;
  spouses.forEach((spouse, index) => {
    const parentBottoms = [people[focusId]!.fatherId, people[focusId]!.motherId]
      .map((id) => (id ? nodes.get(id) : undefined))
      .filter((n): n is LayoutNode => Boolean(n))
      .map((n) => n.y + n.h);
    const spouseY =
      index === 0
        ? Math.max(focusNode.y + CARD_H + SPOUSE_GAP, ...parentBottoms, 0) + (parentBottoms.length ? SPOUSE_GAP : 0)
        : lastSpouseY + CARD_H + SPOUSE_GAP;
    lastSpouseY = spouseY;
    nodes.set(spouse.id, {
      id: spouse.id,
      x: focusNode.x,
      y: spouseY,
      w: CARD_W,
      h: CARD_H,
      role: "spouse",
      caption:
        spouse.gender === "female"
          ? ["الزوجة " + wifeOrdinal(index), wifeStatusTag(spouse)].filter(Boolean).join(" · ")
          : "الزوج",
    });
    inlawIds.add(spouse.id);
    if (index > 0) return;
    const inlawSeen = new Set<string>([focusId, spouse.id, ...ancestorSeen]);
    const parentX = focusNode.x + CARD_W + GAP_X;
    const person = people[spouse.id]!;
    const hasFather = Boolean(person.fatherId && people[person.fatherId]);
    const hasMother = Boolean(person.motherId && people[person.motherId]);
    if (hasFather || hasMother) {
      const fatherM = measureAncestors(people, hasFather ? person.fatherId : null, new Set());
      const motherM = measureAncestors(people, hasMother ? person.motherId : null, new Set());
      if (hasFather && hasMother) {
        const parentsH = fatherM.height + GAP_Y + motherM.height;
        const parentsTop = spouseY + CARD_H / 2 - parentsH / 2;
        placeAncestors(people, person.fatherId!, parentX, parentsTop, "inlaw", nodes, inlawSeen);
        placeAncestors(
          people,
          person.motherId!,
          parentX,
          parentsTop + fatherM.height + GAP_Y,
          "inlaw",
          nodes,
          inlawSeen,
        );
      } else if (hasFather) {
        placeAncestors(
          people,
          person.fatherId!,
          parentX,
          spouseY + CARD_H / 2 - fatherM.height / 2,
          "inlaw",
          nodes,
          inlawSeen,
        );
      } else if (hasMother) {
        placeAncestors(
          people,
          person.motherId!,
          parentX,
          spouseY + CARD_H / 2 - motherM.height / 2,
          "inlaw",
          nodes,
          inlawSeen,
        );
      }
      for (const [id, n] of nodes) {
        if (n.role === "inlaw") inlawIds.add(id);
      }
    }

    const focusSide = [...nodes.values()].filter((n) => n.role === "focus" || n.role === "ancestor");
    let dy = 0;
    for (const inlaw of [...nodes.values()].filter((n) => inlawIds.has(n.id))) {
      for (const other of focusSide) {
        if (overlaps(inlaw, other, 18)) {
          const need = other.y + other.h + GAP_Y + 8 - inlaw.y;
          dy = Math.max(dy, need);
        }
      }
    }
    if (dy > 0) shiftNodes(nodes, inlawIds, dy);
  });

  const descSeen = new Set<string>([focusId, ...spouses.map((s) => s.id)]);
  placeDescendants(people, focusId, focusNode, nodes, descSeen);

  const raw = bboxOf(nodes.values());
  const ox = PAD - raw.x;
  const oy = PAD - raw.y;
  for (const n of nodes.values()) {
    n.x += ox;
    n.y += oy;
  }
  const edges = buildEdges(people, nodes, focusId);
  const bbox = bboxOf(nodes.values());
  return {
    nodes: [...nodes.values()],
    edges,
    bbox: {
      x: 0,
      y: 0,
      w: bbox.w + PAD * 2,
      h: bbox.h + PAD * 2,
    },
  };
}

export function layoutFullTree(people: Record<string, Person>): TreeLayout {
  const empty: TreeLayout = { nodes: [], edges: [], bbox: { x: 0, y: 0, w: 800, h: 600 } };
  const allIds = Object.keys(people);
  if (!allIds.length) return empty;

  const spouseOfSomeone = new Set<string>();
  for (const p of Object.values(people)) {
    for (const sid of spouseIdList(p)) spouseOfSomeone.add(sid);
  }

  const primaryParentId = (p: Person): string | null => {
    if (p.fatherId && people[p.fatherId]) return p.fatherId;
    if (p.motherId && people[p.motherId]) return p.motherId;
    return null;
  };

  const childrenByParent = new Map<string, Person[]>();
  for (const p of Object.values(people)) {
    const pp = primaryParentId(p);
    if (!pp) continue;
    const arr = childrenByParent.get(pp) ?? [];
    arr.push(p);
    childrenByParent.set(pp, arr);
  }
  for (const arr of childrenByParent.values()) arr.sort(byBirthThenName);

  const nodes = new Map<string, LayoutNode>();
  const placed = new Set<string>();
  const heightCache = new Map<string, number>();

  function measure(id: string, stack: Set<string>): number {
    if (stack.has(id)) return CARD_H;
    const cached = heightCache.get(id);
    if (cached !== undefined) return cached;
    const person = people[id]!;
    const spouses = spousesOf(people, person);
    const ownHeight = (1 + spouses.length) * CARD_H + spouses.length * SPOUSE_GAP;
    const kids = childrenByParent.get(id) ?? [];
    let h = ownHeight;
    if (kids.length) {
      const nextStack = new Set(stack);
      nextStack.add(id);
      const total = kids.reduce((s, k) => s + measure(k.id, nextStack), 0) + GAP_Y * (kids.length - 1);
      h = Math.max(ownHeight, total);
    }
    heightCache.set(id, h);
    return h;
  }

  function place(id: string, x: number, top: number, stack: Set<string>): void {
    if (placed.has(id) || stack.has(id) || !people[id]) return;
    placed.add(id);
    const person = people[id]!;
    const spouses = spousesOf(people, person).filter((s) => !placed.has(s.id));
    const blockHeight = measure(id, stack);
    const ownHeight = (1 + spouses.length) * CARD_H + spouses.length * SPOUSE_GAP;
    const ownTop = top + (blockHeight - ownHeight) / 2;
    nodes.set(id, {
      id,
      x,
      y: ownTop,
      w: CARD_W,
      h: CARD_H,
      role: stack.size === 0 ? "focus" : "child",
    });
    let sy = ownTop + CARD_H + SPOUSE_GAP;
    spouses.forEach((spouse, index) => {
      placed.add(spouse.id);
      nodes.set(spouse.id, {
        id: spouse.id,
        x,
        y: sy,
        w: CARD_W,
        h: CARD_H,
        role: "spouse",
        caption:
          spouse.gender === "female"
            ? ["الزوجة " + wifeOrdinal(index), wifeStatusTag(spouse)].filter(Boolean).join(" · ")
            : "الزوج",
      });
      sy += CARD_H + SPOUSE_GAP;
    });

    const kids = childrenByParent.get(id) ?? [];
    if (kids.length) {
      const nextStack = new Set(stack);
      nextStack.add(id);
      const childX = x - CARD_W - GAP_X;
      const total = kids.reduce((s, k) => s + measure(k.id, nextStack), 0) + GAP_Y * (kids.length - 1);
      let cy = top + (blockHeight - total) / 2;
      for (const kid of kids) {
        const kh = measure(kid.id, nextStack);
        place(kid.id, childX, cy, nextStack);
        cy += kh + GAP_Y;
      }
    }
  }

  const byName = (a: string, b: string) =>
    (people[a]!.givenName || "").localeCompare(people[b]!.givenName || "", "ar");

  const roots = allIds
    .filter((id) => !primaryParentId(people[id]!) && !spouseOfSomeone.has(id))
    .sort(byName);

  let cursorY = 0;
  for (const rootId of roots) {
    if (placed.has(rootId)) continue;
    const h = measure(rootId, new Set());
    place(rootId, 0, cursorY, new Set());
    cursorY += h + GAP_Y * 3;
  }

  // شبكة أمان: أي شخص لم يظهر بعد (بيانات ناقصة أو رابط غير مكتمل) يُضاف كجذر مستقل
  // حتى تظهر كل الأسماء دائمًا.
  const leftover = allIds.filter((id) => !placed.has(id)).sort(byName);
  for (const id of leftover) {
    if (placed.has(id)) continue;
    const h = measure(id, new Set());
    place(id, 0, cursorY, new Set());
    cursorY += h + GAP_Y * 3;
  }

  const raw = bboxOf(nodes.values());
  const ox = PAD - raw.x;
  const oy = PAD - raw.y;
  for (const n of nodes.values()) {
    n.x += ox;
    n.y += oy;
  }

  const edges = buildGeneralEdges(people, nodes);
  const bbox = bboxOf(nodes.values());
  return {
    nodes: [...nodes.values()],
    edges,
    bbox: {
      x: 0,
      y: 0,
      w: bbox.w + PAD * 2,
      h: bbox.h + PAD * 2,
    },
  };
}

export function nodeMap(layout: TreeLayout): Map<string, LayoutNode> {
  return new Map(layout.nodes.map((n) => [n.id, n]));
}
