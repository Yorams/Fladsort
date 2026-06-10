// Schoolnaam-resolutie op basis van per-locatie configureerbare aliassen.
//
// Een alias koppelt meerdere schrijfwijzen (terms) aan één nette naam (display).
// resolveSchool levert een gedeelde `canonical` (de alias-id) zodat varianten in
// het ALGORITME als één school gelden, niet alleen in de weergave. Zonder match
// valt het terug op het oude gedrag (genormaliseerde sleutel + ruwe naam).

import { strip, squish, normalizeSchoolName } from "./normalize"
import type { SchoolAlias } from "../config/settings"
import type { Person } from "../types"

export interface SchoolResolution {
  canonical: string
  pretty: string
  aliasId: string | null
}

/** Matcht een genormaliseerde sleutel tegen een (genormaliseerde) term. */
function termMatches(key: string, term: string): boolean {
  const t = normalizeSchoolName(term)
  if (!t || !key) return false
  if (t.length < 4) return key === t // korte termen: alleen exact, voorkomt vals-positief
  return key === t || key.includes(t) || t.includes(key)
}

/** Zet een ruwe schoolnaam om naar canonical + nette naam, gegeven de aliassen. */
export function resolveSchool(raw: string, aliases: SchoolAlias[]): SchoolResolution {
  const key = normalizeSchoolName(raw)
  if (!key) return { canonical: "", pretty: squish(raw), aliasId: null }

  for (const alias of aliases) {
    if (alias.terms.some((term) => termMatches(key, term))) {
      return { canonical: alias.id, pretty: alias.display, aliasId: alias.id }
    }
  }
  // Geen alias: zoals voorheen — sleutel als canonical, ruwe naam als weergave.
  return { canonical: key, pretty: squish(raw), aliasId: null }
}

export interface RawSchoolInfo {
  raw: string
  count: number
  resolution: SchoolResolution
}

/**
 * Unieke ruwe schoolnamen uit de geladen personen, met hun huidige resolve.
 * Voor de Scholen-tab in de instellingen, om varianten snel te koppelen.
 */
export function distinctRawSchools(persons: Person[], aliases: SchoolAlias[]): RawSchoolInfo[] {
  const map = new Map<string, number>()
  for (const p of persons) {
    const raw = squish(p.schoolRaw)
    if (!raw) continue
    map.set(raw, (map.get(raw) || 0) + 1)
  }
  return [...map.entries()]
    .map(([raw, count]) => ({ raw, count, resolution: resolveSchool(raw, aliases) }))
    .sort((a, b) => {
      // Ongekoppelde scholen bovenaan, daarna op aantal.
      if (!!a.resolution.aliasId !== !!b.resolution.aliasId) return a.resolution.aliasId ? 1 : -1
      return b.count - a.count
    })
}

/**
 * Stel automatisch nieuwe aliassen voor op basis van de geladen personen.
 * Clustert ruwe schoolnamen die (nog) geen alias hebben op hun genormaliseerde
 * sleutel; per cluster wordt de meest voorkomende schrijfwijze de nette naam en
 * alle varianten worden de terms. Bestaande aliassen blijven ongemoeid; geeft
 * ALLEEN de nieuw toe te voegen aliassen terug (leeg = niets te doen).
 */
export function suggestAliases(persons: Person[], existing: SchoolAlias[]): SchoolAlias[] {
  const unmatched = distinctRawSchools(persons, existing).filter((r) => !r.resolution.aliasId)

  const clusters = new Map<string, { raw: string; count: number }[]>()
  for (const u of unmatched) {
    const key = normalizeSchoolName(u.raw)
    if (!key) continue
    const list = clusters.get(key) ?? clusters.set(key, []).get(key)!
    list.push({ raw: u.raw, count: u.count })
  }

  const taken = new Set(existing.map((a) => a.id))
  const result: SchoolAlias[] = []
  for (const variants of clusters.values()) {
    // Nette naam = meest voorkomend; bij gelijk de langste (meestal de volledige vorm).
    const sorted = [...variants].sort((a, b) => b.count - a.count || b.raw.length - a.raw.length)
    const display = sorted[0].raw
    let id = aliasIdFromDisplay(display)
    while (taken.has(id)) id += "-2"
    taken.add(id)
    result.push({ id, display, terms: [...new Set(variants.map((v) => v.raw))] })
  }
  return result
}

/** Maak een stabiele alias-id uit een nette naam. */
export function aliasIdFromDisplay(display: string): string {
  return (
    strip(display)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "school"
  )
}
