// Datamodel voor Fladsort

export type Role = "Deelnemer" | "Groepsbegeleider" | "Onbekend"

/** Een geparste regel uit de CSV (kind of begeleider). */
export interface Person {
  id: string
  status: string
  role: Role
  account: string

  voornaam: string
  achternaam: string
  fullName: string

  geboortedatum: string
  leeftijd: string
  geslacht: string

  schoolRaw: string
  schoolCanonical: string
  schoolPretty: string

  groepRaw: string
  groepNorm: number | null

  aanwezigOp: string[]
  duoMet: string

  wilMet: string
  opmerkingen: string

  /** Geparste kandidaat-namen uit wilMet + opmerkingen die we proberen te matchen. */
  preferenceNames: PreferenceCandidate[]
  /** Vrije-tekst signalen die handmatige aandacht vragen (negatief, schoolwens, etc.). */
  flags: Flag[]

  /** Alle originele kolommen, voor het detailpaneel en de export. */
  raw: Record<string, string>
}

/** Een naam-kandidaat uit de vrije-tekstvelden, met of die op een begeleider duidt. */
export interface PreferenceCandidate {
  text: string
  /** True als de tekst expliciet naar een (groeps)begeleider verwees. */
  begeleiderHint: boolean
}

export interface Flag {
  type: "negatief" | "schoolwens" | "niet-gevonden" | "info" | "ambigu"
  text: string
}

export interface Reason {
  step: number
  text: string
}

export interface Conflict {
  type: string
  text: string
}

/** Een groep met (duo-)begeleiders en ingedeelde kinderen. */
export interface Group {
  id: string
  naam: string
  begeleiders: Person[]
  children: Person[]
}

/** Indeling-resultaat per kind. */
export interface Assignment {
  childId: string
  groupId: string | null
  reasons: Reason[]
  conflicts: Conflict[]
}

/** Structurele waarschuwing over de hele dataset (niet aan één kind gekoppeld). */
export interface Warning {
  type: string
  text: string
}

/** Volledige uitkomst van de indeel-pijplijn. */
export interface AssignmentResult {
  groups: Group[]
  /** childId -> Assignment (ook voor niet-ingedeelde kinderen, groupId === null). */
  assignments: Record<string, Assignment>
  /** Alle kinderen (Deelnemers), ook de niet-ingedeelde. */
  children: Person[]
  /** Alle begeleiders. */
  begeleiders: Person[]
  warnings: Warning[]
}
