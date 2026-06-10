// Normalisatie van schoolnamen, namen, aanwezigheidsdagen en het parsen van
// vrije-tekst voorkeurvelden ("Eventueel in een groepje met" + "Opmerkingen").

import type { Flag, PreferenceCandidate } from "../types"

/** Verwijder accenten en maak lowercase. */
export function strip(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’`´]/g, "'")
    .trim()
}

/** Collapse meervoudige spaties. */
export function squish(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim()
}

// --- Schoolnaam normalisatie -------------------------------------------------

// Losse woorden die we weghalen (alleen als heel woord).
const SCHOOL_REMOVE_WORDS = [
  "'t",
  "t",
  "de",
  "het",
  "obs",
  "bs",
  "cbs",
  "rkbs",
  "pcbs",
  "ikc",
  "kc",
  "sbo",
  "in",
  "houten",
]
// Fragmenten die we overal weghalen.
const SCHOOL_REMOVE_ANYWHERE = ["basisschool", "school", "openbare"]

/** Canonieke (vergelijkbare) sleutel voor een schoolnaam. */
export function normalizeSchoolName(name: string): string {
  let cleaned = strip(name)

  for (const w of SCHOOL_REMOVE_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, "gi"), " ")
  }
  for (const p of SCHOOL_REMOVE_ANYWHERE) {
    cleaned = cleaned.replace(new RegExp(p, "gi"), " ")
  }

  return cleaned.replace(/[^a-z0-9]/g, "").trim()
}

// De nette-naam toewijzing zit nu in lib/school.ts (configureerbare aliassen).

// --- Groep / klas ------------------------------------------------------------

/** Parse "Groep / klas" naar een getal waar mogelijk (3, 4, ...). */
export function normalizeGroep(raw: string): number | null {
  const m = strip(raw).match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

// --- Aanwezigheidsdagen ------------------------------------------------------

const DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"]

export function parseDagen(raw: string): string[] {
  const s = strip(raw)
  return DAGEN.filter((d) => s.includes(d)).map((d) => d[0].toUpperCase() + d.slice(1))
}

// --- Voorkeur-parsing --------------------------------------------------------

// Signaalwoorden die wijzen op een negatieve / speciale wens i.p.v. een naam.
const NEGATIVE_HINTS = [
  "niet bij",
  "niet met",
  "niet samen",
  "liever niet",
  "geen foto",
  "geen social",
  "error zal geven",
  "druk klasgenoot",
]
const SCHOOLWISH_HINTS = ["school", "klas", "klasgeno", "groep "]

// Woorden die wijzen op een (groeps)begeleider i.p.v. een kind.
const BEGELEIDER_KEYWORD = /\b(groeps?begeleider|begeleidster|begeleider|juf|meester|meneer)\b/i

/** Strip een naam-kandidaat: haakjes weg, rolaanduiding weg, trim leestekens. */
function cleanCandidate(raw: string): string {
  let s = raw
  // Haakjes-inhoud weghalen (vaak toelichting).
  s = s.replace(/\([^)]*\)/g, " ")
  // Rolaanduidingen weghalen.
  s = s.replace(BEGELEIDER_KEYWORD, " ")
  s = s.replace(/\bouder van\b/gi, " ")
  // Bijgenaamd "..." weghalen.
  s = s.replace(/bijgenaamd\s+\S+/gi, " ")
  return squish(s.replace(/[.,;:!?]+$/g, "").replace(/^[.,;:!?]+/g, ""))
}

export interface ParsedPreferences {
  names: PreferenceCandidate[]
  flags: Flag[]
}

/**
 * Parse de twee vrije-tekstvelden naar (a) kandidaat-namen om te matchen en
 * (b) flags voor handmatige aandacht. Positieve namen worden later fuzzy
 * geresolved; negatieve/schoolwensen worden enkel geflagd (niet afgedwongen).
 */
export function parsePreferences(wilMet: string, opmerkingen: string): ParsedPreferences {
  const names: PreferenceCandidate[] = []
  const flags: Flag[] = []

  const handleField = (field: string, source: string) => {
    const value = squish(field)
    if (!value) return

    const low = strip(value)

    // Negatieve signalen → flag, geen naam-extractie.
    for (const hint of NEGATIVE_HINTS) {
      if (low.includes(hint)) {
        flags.push({ type: "negatief", text: `${source}: "${value}"` })
        return
      }
    }

    // Splits op scheidingstekens en " en ".
    const parts = value.split(/\s*(?:,|;|\/|&|\n|\ben\b)\s*/i).filter((p) => p.trim())

    for (const rawPart of parts) {
      let begeleiderHint = false
      let candidateRaw = rawPart

      // "(in het) groepje van X" / "groep van X" → naam X, duidt op begeleider.
      const groepVan = rawPart.match(/groepje?\s+van\s+(.+)/i)
      // "bij X in (de groep)" → naam X.
      const bijIn = rawPart.match(/\bbij\s+(.+?)\s+in\b/i)

      if (BEGELEIDER_KEYWORD.test(rawPart)) {
        begeleiderHint = true
      } else if (groepVan) {
        begeleiderHint = true
        candidateRaw = groepVan[1]
      } else if (bijIn) {
        candidateRaw = bijIn[1]
      }

      const part = cleanCandidate(candidateRaw)
      const lowPart = strip(part)
      if (!lowPart) continue
      const wordCount = part.split(" ").filter(Boolean).length

      // Begeleider-verwijzing: accepteer als naam (max 3 woorden), anders info-flag.
      if (begeleiderHint) {
        if (wordCount >= 1 && wordCount <= 3) names.push({ text: part, begeleiderHint: true })
        else flags.push({ type: "info", text: `${source}: "${rawPart}"` })
        continue
      }

      // Schoolwens / klasgenoot-zin zonder duidelijke naam → flag.
      const looksLikeWish = SCHOOLWISH_HINTS.some((h) => lowPart.includes(h))
      if (looksLikeWish && wordCount > 2) {
        flags.push({ type: "schoolwens", text: `${source}: "${part}"` })
        continue
      }

      // Te lange vrije tekst (meer dan 4 woorden, geen naam) → info-flag.
      if (wordCount > 4) {
        flags.push({ type: "info", text: `${source}: "${part}"` })
        continue
      }

      // "Klasgenoot?" / "andere kinderen" e.d. zonder echte naam.
      if (/klasgeno|andere kinderen|nog niet|onbekend|\?$/i.test(part) && wordCount <= 3) {
        flags.push({ type: "ambigu", text: `${source}: "${part}"` })
        continue
      }

      names.push({ text: part, begeleiderHint: false })
    }
  }

  handleField(wilMet, "Wil in groepje met")
  handleField(opmerkingen, "Opmerking")

  // Dedup namen (case-insensitief; begeleiderHint=true wint).
  const byKey = new Map<string, PreferenceCandidate>()
  for (const n of names) {
    const k = strip(n.text)
    const existing = byKey.get(k)
    if (!existing) byKey.set(k, n)
    else if (n.begeleiderHint) existing.begeleiderHint = true
  }

  return { names: [...byKey.values()], flags }
}
