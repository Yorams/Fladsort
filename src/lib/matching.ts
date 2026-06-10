// Fuzzy naam-resolutie: zet een vrije-tekst naam-kandidaat om naar een concreet
// kind (Person) uit de deelnemerslijst, of naar een begeleider. Bij meerdere
// kandidaten (bv. alleen een voornaam die op meerdere kinderen past) gebruiken
// we school/groep als tiebreak.

import Fuse from "fuse.js"
import type { Person } from "../types"
import { strip } from "./normalize"

export interface ResolveHit {
  person: Person
  score: number // 0 = perfect, hoger = slechter
  reason: string
}

interface IndexEntry {
  id: string
  full: string
  first: string
  last: string
}

export class NameResolver {
  private byId: Map<string, Person>
  private fuseChildren: Fuse<IndexEntry>
  private fuseBegeleiders: Fuse<IndexEntry>

  constructor(children: Person[], begeleiders: Person[] = []) {
    this.byId = new Map([...children, ...begeleiders].map((p) => [p.id, p]))

    const toEntry = (p: Person): IndexEntry => ({
      id: p.id,
      full: strip(p.fullName),
      first: strip(p.voornaam),
      last: strip(p.achternaam),
    })

    const keys = [
      { name: "full", weight: 0.7 },
      { name: "first", weight: 0.2 },
      { name: "last", weight: 0.1 },
    ]
    this.fuseChildren = new Fuse(children.map(toEntry), {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      keys,
    })
    this.fuseBegeleiders = new Fuse(begeleiders.map(toEntry), {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      keys,
    })
  }

  /** Resolve een naam tegen de begeleiders (strikt: alleen sterke matches). */
  resolveBegeleider(candidate: string): ResolveHit | null {
    const q = strip(candidate)
    if (!q) return null
    const results = this.fuseBegeleiders.search(q)
    if (results.length === 0) return null
    const best = results[0]
    const score = best.score ?? 1
    if (score > 0.4) return null
    const p = this.byId.get(best.item.id)!
    return {
      person: p,
      score,
      reason: `verwijzing naar begeleider "${candidate}" → ${p.fullName} (score ${score.toFixed(2)})`,
    }
  }

  /**
   * Probeer een naam-kandidaat te resolven naar één kind, gezien de context van
   * het verzoekende kind (voor school/groep tiebreak). Geeft null als niets past.
   */
  resolve(candidate: string, requester: Person): ResolveHit | null {
    const q = strip(candidate)
    if (!q) return null

    const results = this.fuseChildren.search(q).filter((r) => r.item.id !== requester.id)
    if (results.length === 0) return null

    const best = results[0]
    const bestScore = best.score ?? 1

    // Verzamel alle near-best kandidaten (binnen kleine marge) voor tiebreak.
    const close = results.filter((r) => (r.score ?? 1) <= bestScore + 0.08)

    if (close.length === 1) {
      const p = this.byId.get(best.item.id)!
      return {
        person: p,
        score: bestScore,
        reason: `fuzzy match op "${candidate}" → ${p.fullName} (score ${bestScore.toFixed(2)})`,
      }
    }

    // Meerdere kandidaten: tiebreak op zelfde school+groep, dan zelfde school.
    const candidates = close.map((r) => this.byId.get(r.item.id)!).filter(Boolean)

    const sameSchoolGroep = candidates.filter(
      (p) =>
        p.schoolCanonical &&
        p.schoolCanonical === requester.schoolCanonical &&
        p.groepNorm != null &&
        p.groepNorm === requester.groepNorm,
    )
    if (sameSchoolGroep.length === 1) {
      const p = sameSchoolGroep[0]
      return {
        person: p,
        score: bestScore,
        reason: `"${candidate}" matchte meerdere kinderen → gekozen op zelfde school+groep (${p.schoolPretty}, gr ${p.groepRaw})`,
      }
    }

    const sameSchool = candidates.filter(
      (p) => p.schoolCanonical && p.schoolCanonical === requester.schoolCanonical,
    )
    if (sameSchool.length === 1) {
      const p = sameSchool[0]
      return {
        person: p,
        score: bestScore,
        reason: `"${candidate}" matchte meerdere kinderen → gekozen op zelfde school (${p.schoolPretty})`,
      }
    }

    // Geen eenduidige tiebreak: neem de beste maar markeer als ambigu.
    const p = this.byId.get(best.item.id)!
    return {
      person: p,
      score: bestScore + 0.5, // strafpunt: minder zeker
      reason: `"${candidate}" matchte meerdere kinderen → ambigu, beste keuze ${p.fullName}`,
    }
  }
}

/** Eén gerichte voorkeur-koppeling tussen twee kinderen. */
export interface PrefEdge {
  from: string // childId die de wens uitte
  to: string // childId waarnaar verwezen wordt
  candidate: string // originele tekst
  reason: string
  score: number
}

/** Een kind dat expliciet bij een begeleider wil. */
export interface BegeleiderEdge {
  from: string // childId
  begeleiderId: string
  candidate: string
  reason: string
}

/**
 * Bouw alle voorkeur-edges over een set kinderen. Namen die naar een begeleider
 * verwijzen geven we als BegeleiderEdge terug; namen die niet resolven naar een
 * kind of begeleider in de lijst geven we terug als "unresolved".
 */
export function buildPreferenceEdges(
  children: Person[],
  resolver: NameResolver,
): { edges: PrefEdge[]; begeleiderEdges: BegeleiderEdge[]; unresolved: Record<string, string[]> } {
  const edges: PrefEdge[] = []
  const begeleiderEdges: BegeleiderEdge[] = []
  const unresolved: Record<string, string[]> = {}

  for (const child of children) {
    for (const cand of child.preferenceNames) {
      // Eerst: expliciete begeleider-verwijzing.
      if (cand.begeleiderHint) {
        const bh = resolver.resolveBegeleider(cand.text)
        if (bh) {
          begeleiderEdges.push({
            from: child.id,
            begeleiderId: bh.person.id,
            candidate: cand.text,
            reason: bh.reason,
          })
          continue
        }
      }

      // Daarna: kind-match.
      const hit = resolver.resolve(cand.text, child)
      if (hit && hit.score <= 0.55) {
        edges.push({
          from: child.id,
          to: hit.person.id,
          candidate: cand.text,
          reason: hit.reason,
          score: hit.score,
        })
        continue
      }

      // Fallback: misschien tóch een begeleider (zonder expliciete hint).
      const bh = resolver.resolveBegeleider(cand.text)
      if (bh) {
        begeleiderEdges.push({
          from: child.id,
          begeleiderId: bh.person.id,
          candidate: cand.text,
          reason: bh.reason,
        })
        continue
      }

      ;(unresolved[child.id] ||= []).push(cand.text)
    }
  }

  return { edges, begeleiderEdges, unresolved }
}
