// CSV inlezen met papaparse en omzetten naar Person[].

import Papa from "papaparse"
import type { Person, Role } from "../types"
import { normalizeGroep, parseDagen, parsePreferences, squish } from "./normalize"
import { resolveSchool } from "./school"
import { seedSettings, type Settings } from "../config/settings"

const COL = {
  status: "Status",
  account: "Account",
  type: "Type",
  voornaam: "Voornaam",
  achternaam: "Achternaam",
  geboortedatum: "Geboortedatum",
  leeftijd: "Leeftijd",
  geslacht: "Geslacht",
  aanwezig: "Aanwezig op",
  duoMet: "Duo met",
  school: "School",
  groep: "Groep / klas",
  wilMet: "Eventueel in een groepje met",
  opmerkingen: "Opmerkingen",
} as const

let idCounter = 0
function makeId(): string {
  idCounter += 1
  return `p${idCounter}`
}

function toRole(raw: string): Role {
  const t = squish(raw).toLowerCase()
  if (t.startsWith("groepsbegeleider")) return "Groepsbegeleider"
  if (t.startsWith("deelnemer")) return "Deelnemer"
  return "Onbekend"
}

export interface ParseResult {
  persons: Person[]
  /** Alle voorkomende statussen met aantallen (voor de UI-filter). */
  statusCounts: Record<string, number>
  /** Header-volgorde uit de CSV, voor export. */
  headers: string[]
}

/** Parse de ruwe CSV-tekst naar personen + metadata. */
export function parseCsv(text: string, cfg: Settings = seedSettings): ParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const persons: Person[] = []
  const statusCounts: Record<string, number> = {}

  for (const row of result.data) {
    // Trim alle waarden.
    const raw: Record<string, string> = {}
    for (const key of Object.keys(row)) {
      raw[key] = (row[key] ?? "").toString().trim()
    }

    const status = raw[COL.status] || ""
    if (!status) continue
    statusCounts[status] = (statusCounts[status] || 0) + 1

    const voornaam = raw[COL.voornaam] || ""
    const achternaam = raw[COL.achternaam] || ""
    if (!voornaam && !achternaam) continue

    const schoolRaw = raw[COL.school] || ""
    const school = resolveSchool(schoolRaw, cfg.schoolAliases)
    const { names, flags } = parsePreferences(raw[COL.wilMet] || "", raw[COL.opmerkingen] || "")

    persons.push({
      id: makeId(),
      status,
      role: toRole(raw[COL.type] || ""),
      account: squish(raw[COL.account] || ""),
      voornaam,
      achternaam,
      fullName: squish(`${voornaam} ${achternaam}`),
      geboortedatum: raw[COL.geboortedatum] || "",
      leeftijd: raw[COL.leeftijd] || "",
      geslacht: raw[COL.geslacht] || "",
      schoolRaw,
      schoolCanonical: school.canonical,
      schoolPretty: school.pretty,
      groepRaw: raw[COL.groep] || "",
      groepNorm: normalizeGroep(raw[COL.groep] || ""),
      aanwezigOp: parseDagen(raw[COL.aanwezig] || ""),
      duoMet: squish(raw[COL.duoMet] || ""),
      wilMet: squish(raw[COL.wilMet] || ""),
      opmerkingen: squish(raw[COL.opmerkingen] || ""),
      preferenceNames: names,
      flags,
      raw,
    })
  }

  return { persons, statusCounts, headers }
}
