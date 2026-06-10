// Kern indeel-pijplijn. Neemt de gefilterde personen en produceert groepen +
// per-kind assignments met een leesbare reasons-trace, plus conflicten/warnings.

import type {
  Person,
  Group,
  Assignment,
  AssignmentResult,
  Warning,
} from "../types"
import { strip } from "./normalize"
import {
  NameResolver,
  buildPreferenceEdges,
  type PrefEdge,
  type BegeleiderEdge,
} from "./matching"
import { seedSettings as defaultSettings, type Settings } from "../config/settings"

// --- interne hulpstructuren --------------------------------------------------

class Builder {
  groups: Group[] = []
  assignments: Record<string, Assignment> = {}
  warnings: Warning[] = []
  childIndex: Map<string, Person>
  groupOfChild: Map<string, string> = new Map()
  maxSize: number
  preferEven = true

  constructor(children: Person[], maxSize: number) {
    this.maxSize = maxSize
    this.childIndex = new Map(children.map((c) => [c.id, c]))
    for (const c of children) {
      this.assignments[c.id] = { childId: c.id, groupId: null, reasons: [], conflicts: [] }
    }
  }

  reason(childId: string, step: number, text: string) {
    this.assignments[childId]?.reasons.push({ step, text })
  }
  conflict(childId: string, type: string, text: string) {
    this.assignments[childId]?.conflicts.push({ type, text })
  }
  warn(type: string, text: string) {
    this.warnings.push({ type, text })
  }

  groupById(id: string): Group | undefined {
    return this.groups.find((g) => g.id === id)
  }

  /** Plaats een kind in een groep (zonder capaciteitscheck — caller bewaakt). */
  place(childId: string, groupId: string, step: number, text: string) {
    const g = this.groupById(groupId)
    const child = this.childIndex.get(childId)
    if (!g || !child) return
    // Verwijder uit eventuele oude groep.
    const oldId = this.groupOfChild.get(childId)
    if (oldId && oldId !== groupId) {
      const og = this.groupById(oldId)
      if (og) og.children = og.children.filter((c) => c.id !== childId)
    }
    if (!g.children.some((c) => c.id === childId)) g.children.push(child)
    this.groupOfChild.set(childId, groupId)
    this.assignments[childId].groupId = groupId
    this.reason(childId, step, text)
  }

  countOf(groupId: string): number {
    return this.groupById(groupId)?.children.length ?? 0
  }
  hasRoom(groupId: string, extra = 1): boolean {
    return this.countOf(groupId) + extra <= this.maxSize
  }
}

// --- Stap 1: groepen uit begeleiders ----------------------------------------

function buildGroupsFromBegeleiders(b: Builder, begeleiders: Person[], cfg: Settings) {
  const used = new Set<string>()
  let nameIdx = 0
  const nextName = () => {
    const base = cfg.groupNames[nameIdx] ?? `Naamloos ${nameIdx + 1}`
    nameIdx += 1
    return base
  }

  // Detecteer dubbele begeleiders (zelfde genormaliseerde naam).
  const byNorm = new Map<string, Person[]>()
  for (const beg of begeleiders) {
    const key = strip(beg.fullName)
    ;(byNorm.get(key) || byNorm.set(key, []).get(key)!).push(beg)
  }
  for (const [, list] of byNorm) {
    if (list.length > 1) {
      b.warn(
        "dubbele-begeleider",
        `Begeleider "${list[0].fullName}" komt ${list.length}× voor — mogelijk dubbele inschrijving. Controleer of dit één persoon is.`,
      )
    }
  }

  const findByAccountOrName = (ref: string): Person | undefined => {
    const r = strip(ref)
    if (!r) return undefined
    return begeleiders.find(
      (x) => !used.has(x.id) && (strip(x.account) === r || strip(x.fullName) === r),
    )
  }

  let groupCounter = 0
  const makeGroup = (members: Person[]): Group => {
    groupCounter += 1
    const naam = `${groupCounter}. ${nextName()}`
    const g: Group = { id: `g${groupCounter}`, naam, begeleiders: members, children: [] }
    b.groups.push(g)
    return g
  }

  for (const beg of begeleiders) {
    if (used.has(beg.id)) continue
    used.add(beg.id)

    if (!beg.duoMet) {
      makeGroup([beg])
      continue
    }

    const partner = findByAccountOrName(beg.duoMet)
    if (partner) {
      used.add(partner.id)
      makeGroup([beg, partner])
    } else {
      // Duo-partner niet gevonden onder de (gefilterde) begeleiders.
      b.warn(
        "duo-partner-mist",
        `Begeleider "${beg.fullName}" heeft duo "${beg.duoMet}", maar die partner staat niet (meer) in de lijst. Groep met alleen ${beg.fullName} aangemaakt.`,
      )
      makeGroup([beg])
    }
  }

  if (b.groups.length !== cfg.targetGroups) {
    b.warn(
      "groepsaantal",
      `Er zijn ${b.groups.length} groepen gevormd uit de begeleiders, verwacht ${cfg.targetGroups}. Controleer de begeleiders/duo's.`,
    )
  }
}

// --- Stap 2b: kinderen die expliciet bij een begeleider willen ---------------

function placeBegeleiderWishes(b: Builder, begeleiderEdges: BegeleiderEdge[]) {
  // Map begeleider-id → groep-id.
  const begToGroup = new Map<string, string>()
  for (const g of b.groups) {
    for (const beg of g.begeleiders) begToGroup.set(beg.id, g.id)
  }

  for (const e of begeleiderEdges) {
    if (b.groupOfChild.has(e.from)) continue
    const gid = begToGroup.get(e.begeleiderId)
    if (!gid) continue
    const g = b.groupById(gid)!
    const begNaam = g.begeleiders.map((x) => x.fullName).join(" & ")
    if (b.hasRoom(gid)) {
      b.place(e.from, gid, 3, `Wil in groepje bij begeleider ${begNaam} — ${e.reason}.`)
    } else {
      b.conflict(e.from, "begeleider-groep-vol", `Wil bij begeleider ${begNaam}, maar ${g.naam} is vol.`)
    }
  }
}

// --- Stap 2: eigen kinderen van begeleiders ---------------------------------

function placeBegeleiderChildren(b: Builder, children: Person[]) {
  const begAccountToGroup = new Map<string, string>()
  for (const g of b.groups) {
    for (const beg of g.begeleiders) {
      if (beg.account) begAccountToGroup.set(strip(beg.account), g.id)
    }
  }

  for (const child of children) {
    if (b.groupOfChild.has(child.id)) continue
    const gid = begAccountToGroup.get(strip(child.account))
    if (!gid) continue
    const begNamen = b.groupById(gid)!.begeleiders.map((x) => x.fullName).join(" & ")
    if (!b.hasRoom(gid)) {
      b.conflict(child.id, "groep-vol", `Groep van ouder/begeleider (${begNamen}) is al vol.`)
    }
    b.place(child.id, gid, 2, `Kind van begeleider ${begNamen} (account-match: "${child.account}").`)
  }
}

// --- voorkeurgraaf helpers ---------------------------------------------------

function edgesByChild(edges: PrefEdge[]): Map<string, PrefEdge[]> {
  const m = new Map<string, PrefEdge[]>()
  for (const e of edges) {
    ;(m.get(e.from) || m.set(e.from, []).get(e.from)!).push(e)
  }
  return m
}

// --- Stap 3: vriendjes koppelen aan bestaande groepen -----------------------

function attachFriendsToGroups(b: Builder, edges: PrefEdge[]) {
  // Bidirectioneel: behandel een edge from→to en ook to→from.
  const undirected: PrefEdge[] = []
  for (const e of edges) {
    undirected.push(e)
    undirected.push({ ...e, from: e.to, to: e.from, reason: `wederzijds: ${e.reason}` })
  }

  let changed = true
  let guard = 0
  while (changed && guard < 50) {
    changed = false
    guard += 1

    for (const e of undirected) {
      // e.from is nog niet ingedeeld, e.to wel → probeer e.from bij e.to.
      if (b.groupOfChild.has(e.from)) continue
      const targetGid = b.groupOfChild.get(e.to)
      if (!targetGid) continue

      const friend = b.childIndex.get(e.to)!
      if (b.hasRoom(targetGid)) {
        b.place(
          e.from,
          targetGid,
          3,
          `Wil in groepje met ${friend.fullName} (zit in ${b.groupById(targetGid)!.naam}) — ${e.reason}.`,
        )
        changed = true
      } else {
        b.conflict(
          e.from,
          "vriend-volle-groep",
          `Wil bij ${friend.fullName}, maar ${b.groupById(targetGid)!.naam} is vol (${b.maxSize}).`,
        )
      }
    }
  }
}

// --- Stap 4: resterende kinderen clusteren ----------------------------------

function clusterAndPlace(b: Builder, children: Person[], edges: PrefEdge[]) {
  const unplaced = children.filter((c) => !b.groupOfChild.has(c.id))
  const unplacedSet = new Set(unplaced.map((c) => c.id))

  // Union-find over edges tussen niet-ingedeelde kinderen.
  const parent = new Map<string, string>()
  unplaced.forEach((c) => parent.set(c.id, c.id))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const union = (a: string, c: string) => {
    const ra = find(a)
    const rc = find(c)
    if (ra !== rc) parent.set(ra, rc)
  }
  for (const e of edges) {
    if (unplacedSet.has(e.from) && unplacedSet.has(e.to)) union(e.from, e.to)
  }

  // Verzamel clusters.
  const clusters = new Map<string, Person[]>()
  for (const c of unplaced) {
    const root = find(c.id)
    ;(clusters.get(root) || clusters.set(root, []).get(root)!).push(c)
  }

  // Sorteer clusters: grootste eerst (lastigst plaatsbaar).
  const ordered = [...clusters.values()].sort((a, c) => c.length - a.length)

  for (const cluster of ordered) {
    // Splits clusters > MAX in stukken; houd verbonden paren zoveel mogelijk samen.
    const chunks = splitCluster(cluster, edges, b.maxSize)
    for (const chunk of chunks) {
      if (chunk.length !== cluster.length && cluster.length > b.maxSize) {
        for (const c of chunk) {
          b.conflict(
            c.id,
            "cluster-gesplitst",
            `Vriendengroep was groter dan ${b.maxSize}; in een deelgroepje geplaatst met ${chunk
              .filter((x) => x.id !== c.id)
              .map((x) => x.voornaam)
              .join(", ") || "niemand"}.`,
          )
        }
      }
      placeChunk(b, chunk)
    }
  }
}

/** Splits een cluster in stukken van max maxSize; houd edge-paren bijeen. */
function splitCluster(cluster: Person[], edges: PrefEdge[], maxSize: number): Person[][] {
  if (cluster.length <= maxSize) return [cluster]

  const ids = new Set(cluster.map((c) => c.id))
  const adj = new Map<string, Set<string>>()
  cluster.forEach((c) => adj.set(c.id, new Set()))
  for (const e of edges) {
    if (ids.has(e.from) && ids.has(e.to)) {
      adj.get(e.from)!.add(e.to)
      adj.get(e.to)!.add(e.from)
    }
  }

  const remaining = new Map(cluster.map((c) => [c.id, c]))
  const chunks: Person[][] = []

  while (remaining.size > 0) {
    // Start een chunk met een willekeurig overgebleven kind en groei via edges.
    const startId = remaining.keys().next().value as string
    const chunk: Person[] = []
    const queue = [startId]
    while (queue.length > 0 && chunk.length < maxSize) {
      const id = queue.shift()!
      if (!remaining.has(id)) continue
      chunk.push(remaining.get(id)!)
      remaining.delete(id)
      for (const nb of adj.get(id) ?? []) {
        if (remaining.has(nb) && chunk.length < maxSize) queue.push(nb)
      }
    }
    chunks.push(chunk)
  }
  return chunks
}

/** Plaats een groepje kinderen samen in de best passende groep met ruimte. */
function placeChunk(b: Builder, chunk: Person[]) {
  const gid = pickBestGroup(b, chunk)
  if (!gid) {
    for (const c of chunk) {
      b.conflict(c.id, "geen-ruimte", `Geen groep met voldoende ruimte gevonden voor dit groepje (${chunk.length} kinderen).`)
    }
    return
  }
  const friendNames = chunk.map((x) => x.voornaam).filter(Boolean)
  for (const c of chunk) {
    const others = friendNames.filter((n) => n !== c.voornaam)
    const why =
      chunk.length > 1
        ? `Vriendengroepje met ${others.join(", ")} — geplaatst in ${b.groupById(gid)!.naam}.`
        : `Nog niet ingedeeld — geplaatst in ${b.groupById(gid)!.naam}.`
    b.place(c.id, gid, 4, why + groupFitNote(b, gid, c))
  }
}

/**
 * Kies de beste groep voor een chunk: voldoende ruimte, voorkeur voor groepen
 * waar de meeste leden dezelfde school+groep / school delen, en even-pariteit.
 */
function pickBestGroup(b: Builder, chunk: Person[]): string | null {
  const size = chunk.length
  const schoolKeys = chunk.map((c) => c.schoolCanonical).filter(Boolean)
  const sgKeys = chunk
    .map((c) => (c.schoolCanonical && c.groepNorm != null ? `${c.schoolCanonical}#${c.groepNorm}` : ""))
    .filter(Boolean)

  let best: { id: string; score: number } | null = null
  for (const g of b.groups) {
    if (!b.hasRoom(g.id, size)) continue
    let score = 0
    // School+groep match met bestaande leden.
    for (const m of g.children) {
      const mSg = m.schoolCanonical && m.groepNorm != null ? `${m.schoolCanonical}#${m.groepNorm}` : ""
      if (mSg && sgKeys.includes(mSg)) score += 3
      else if (m.schoolCanonical && schoolKeys.includes(m.schoolCanonical)) score += 1
    }
    // Even-pariteit licht belonen.
    const after = g.children.length + size
    if (b.preferEven && after % 2 === 0) score += 0.5
    // Lichte voorkeur voor minder volle groepen (spreiding).
    score += (b.maxSize - g.children.length) * 0.1

    if (!best || score > best.score) best = { id: g.id, score }
  }
  return best?.id ?? null
}

function groupFitNote(b: Builder, gid: string, c: Person): string {
  const g = b.groupById(gid)
  if (!g) return ""
  const sameSg = g.children.some(
    (m) => m.id !== c.id && m.schoolCanonical === c.schoolCanonical && m.groepNorm === c.groepNorm && c.schoolCanonical,
  )
  if (sameSg) return ` (zelfde school+groep aanwezig: ${c.schoolPretty} gr ${c.groepRaw}).`
  const sameSchool = g.children.some((m) => m.id !== c.id && m.schoolCanonical === c.schoolCanonical && c.schoolCanonical)
  if (sameSchool) return ` (zelfde school aanwezig: ${c.schoolPretty}).`
  return ""
}

// --- Stap 5: kinderen zonder voorkeur ---------------------------------------

function placeRemaining(b: Builder, children: Person[]) {
  const left = children
    .filter((c) => !b.groupOfChild.has(c.id))
    .sort((a, c) => {
      const s = (a.schoolCanonical || "zzz").localeCompare(c.schoolCanonical || "zzz")
      if (s !== 0) return s
      return (a.groepNorm ?? 99) - (c.groepNorm ?? 99)
    })

  for (const c of left) {
    const gid = pickBestGroup(b, [c])
    if (!gid) {
      b.conflict(c.id, "geen-ruimte", "Alle groepen zitten vol — kon niet automatisch indelen.")
      continue
    }
    b.place(c.id, gid, 5, `Geen (gevonden) voorkeur — ingedeeld op school/groep in ${b.groupById(gid)!.naam}${groupFitNote(b, gid, c)}`)
  }
}

// --- Stap 6: finaliseren -----------------------------------------------------

function finalize(b: Builder, children: Person[], unresolved: Record<string, string[]>) {
  // Niet-gevonden voorkeurnamen als notitie/flag.
  for (const [childId, names] of Object.entries(unresolved)) {
    for (const n of names) {
      b.conflict(childId, "naam-niet-gevonden", `Voorkeur "${n}" niet teruggevonden in de lijst — genegeerd.`)
    }
  }
  // Vrije-tekst flags doorzetten als conflict-notities (handmatige aandacht).
  for (const c of children) {
    for (const f of c.flags) {
      b.conflict(c.id, `flag-${f.type}`, f.text)
    }
  }
  // Oneven groepen zacht melden.
  for (const g of b.groups) {
    if (g.children.length > 0 && g.children.length % 2 === 1) {
      b.warn("oneven-groep", `${g.naam} heeft een oneven aantal kinderen (${g.children.length}).`)
    }
    if (g.children.length > b.maxSize) {
      b.warn("groep-te-vol", `${g.naam} heeft ${g.children.length} kinderen (> ${b.maxSize}).`)
    }
  }
}

// --- Publieke entry ----------------------------------------------------------

export function assign(persons: Person[], cfg: Settings = defaultSettings): AssignmentResult {
  const begeleiders = persons.filter((p) => p.role === "Groepsbegeleider")
  const children = persons.filter((p) => p.role !== "Groepsbegeleider")

  const b = new Builder(children, cfg.maxChildrenPerGroup)
  b.preferEven = cfg.preferEvenGroups

  // Stap 1 + 2
  buildGroupsFromBegeleiders(b, begeleiders, cfg)
  placeBegeleiderChildren(b, children)

  // Voorkeurgraaf (kinderen + begeleiders).
  const resolver = new NameResolver(children, begeleiders)
  const { edges, begeleiderEdges, unresolved } = buildPreferenceEdges(children, resolver)

  // Stap 3 (begeleider-wens) + 3 (vriendjes) + 4 + 5 + 6
  placeBegeleiderWishes(b, begeleiderEdges)
  attachFriendsToGroups(b, edges)
  clusterAndPlace(b, children, edges)
  placeRemaining(b, children)
  finalize(b, children, unresolved)

  return {
    groups: b.groups,
    assignments: b.assignments,
    children,
    begeleiders,
    warnings: b.warnings,
  }
}
