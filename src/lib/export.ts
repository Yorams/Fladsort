// Export van de indeling naar .xlsx (SheetJS).

import * as XLSX from "xlsx"
import type { AssignmentResult, Person } from "../types"

function reasonsText(res: AssignmentResult, childId: string): string {
  return (res.assignments[childId]?.reasons ?? []).map((r) => `(${r.step}) ${r.text}`).join("  |  ")
}
function conflictsText(res: AssignmentResult, childId: string): string {
  return (res.assignments[childId]?.conflicts ?? []).map((c) => c.text).join("  |  ")
}

interface ExportRow {
  Groep: string
  Rol: string
  Voornaam: string
  Achternaam: string
  Account: string
  "School (net)": string
  "School (origineel)": string
  "Groep/klas": string
  "Wil in groepje met": string
  Opmerkingen: string
  "Reden van indeling": string
  "Conflicten / flags": string
}

export function buildWorkbook(res: AssignmentResult): XLSX.WorkBook {
  const rows: ExportRow[] = []
  const groupName = new Map(res.groups.map((g) => [g.id, g.naam]))

  const pushPerson = (p: Person, groep: string) => {
    rows.push({
      Groep: groep,
      Rol: p.role,
      Voornaam: p.voornaam,
      Achternaam: p.achternaam,
      Account: p.account,
      "School (net)": p.schoolPretty,
      "School (origineel)": p.schoolRaw,
      "Groep/klas": p.groepRaw,
      "Wil in groepje met": p.wilMet,
      Opmerkingen: p.opmerkingen,
      "Reden van indeling": p.role === "Groepsbegeleider" ? "Begeleider van deze groep" : reasonsText(res, p.id),
      "Conflicten / flags": p.role === "Groepsbegeleider" ? "" : conflictsText(res, p.id),
    })
  }

  // Per groep: eerst begeleiders, dan kinderen.
  for (const g of res.groups) {
    for (const beg of g.begeleiders) pushPerson(beg, g.naam)
    for (const c of g.children) pushPerson(c, g.naam)
  }

  // Niet-ingedeelde kinderen onderaan.
  const placed = new Set<string>()
  res.groups.forEach((g) => g.children.forEach((c) => placed.add(c.id)))
  for (const c of res.children) {
    if (!placed.has(c.id)) pushPerson(c, "— NIET INGEDEELD —")
  }

  const ws = XLSX.utils.json_to_sheet(rows)

  // Kolombreedtes op basis van header-lengte (zoals de oude app).
  const headers = Object.keys(rows[0] ?? {})
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Indeling")
  return wb
}

export function downloadXlsx(res: AssignmentResult, filename = "fladsort-indeling.xlsx") {
  const wb = buildWorkbook(res)
  XLSX.writeFile(wb, filename, { compression: true })
}
