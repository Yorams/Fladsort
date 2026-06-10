// Centrale app-state als hook. Houdt de ruwe CSV, statusfilter en handmatige
// verplaatsingen bij (gepersisteerd in localStorage), en levert de berekende
// indeling op. Handmatige moves worden bovenop de automatische indeling gelegd.

import { useCallback, useEffect, useMemo, useState } from "react"
import { parseCsv } from "../lib/csv"
import { assign } from "../lib/assign"
import type { AssignmentResult, Person } from "../types"
import type { Settings } from "../config/settings"

const LS_KEY = "fladsort.v3.state"

const UNASSIGNED = "__UNASSIGNED__"

interface Persisted {
  csvText: string
  fileName: string
  manualMoves: Record<string, string> // childId -> groupId | UNASSIGNED
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

/** Pas handmatige verplaatsingen toe op een verse automatische indeling. */
function applyManualMoves(base: AssignmentResult, moves: Record<string, string>): AssignmentResult {
  if (Object.keys(moves).length === 0) return base

  // Diepe (genoeg) kopie van de groepen + assignments.
  const groups = base.groups.map((g) => ({ ...g, children: [...g.children] }))
  const byId = new Map(groups.map((g) => [g.id, g]))
  const assignments = Object.fromEntries(
    Object.entries(base.assignments).map(([k, v]) => [k, { ...v, reasons: [...v.reasons], conflicts: [...v.conflicts] }]),
  )
  const childById = new Map(base.children.map((c) => [c.id, c]))

  for (const [childId, target] of Object.entries(moves)) {
    const child = childById.get(childId)
    if (!child) continue
    // Verwijder uit huidige groep.
    for (const g of groups) g.children = g.children.filter((c) => c.id !== childId)
    if (target === UNASSIGNED) {
      assignments[childId].groupId = null
      assignments[childId].reasons.push({ step: 9, text: "Handmatig uit alle groepen gehaald." })
      continue
    }
    const g = byId.get(target)
    if (!g) continue
    g.children.push(child)
    assignments[childId].groupId = g.id
    assignments[childId].reasons.push({ step: 9, text: `Handmatig verplaatst naar ${g.naam}.` })
  }

  return { ...base, groups, assignments }
}

export interface FladsortStore {
  csvText: string
  fileName: string
  persons: Person[]
  statusCounts: Record<string, number>
  result: AssignmentResult | null
  loadCsv: (text: string, fileName: string) => void
  moveChild: (childId: string, targetGroupId: string | null) => void
  reset: () => void
  clearAll: () => void
}

export function useFladsort(settings: Settings): FladsortStore {
  const persisted = useMemo(() => loadPersisted(), [])

  const [csvText, setCsvText] = useState(persisted?.csvText ?? "")
  const [fileName, setFileName] = useState(persisted?.fileName ?? "")
  const [manualMoves, setManualMoves] = useState<Record<string, string>>(persisted?.manualMoves ?? {})

  // Parse CSV → personen + statusCounts (schoolaliassen uit settings).
  const parsed = useMemo(() => {
    if (!csvText) return { persons: [] as Person[], statusCounts: {} as Record<string, number>, headers: [] as string[] }
    return parseCsv(csvText, settings)
  }, [csvText, settings])

  // Filter op de statussen uit de instellingen (Statussen-tab).
  const filtered = useMemo(
    () => parsed.persons.filter((p) => settings.defaultStatuses.includes(p.status)),
    [parsed.persons, settings.defaultStatuses],
  )

  // Automatische indeling + handmatige moves.
  const result = useMemo<AssignmentResult | null>(() => {
    if (filtered.length === 0) return null
    const base = assign(filtered, settings)
    return applyManualMoves(base, manualMoves)
  }, [filtered, manualMoves, settings])

  // Persistentie.
  useEffect(() => {
    if (!csvText) {
      localStorage.removeItem(LS_KEY)
      return
    }
    const data: Persisted = { csvText, fileName, manualMoves }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    } catch {
      /* quota — negeer */
    }
  }, [csvText, fileName, manualMoves])

  const loadCsv = useCallback((text: string, name: string) => {
    setCsvText(text)
    setFileName(name)
    setManualMoves({})
  }, [])

  const moveChild = useCallback((childId: string, targetGroupId: string | null) => {
    setManualMoves((prev) => ({ ...prev, [childId]: targetGroupId ?? UNASSIGNED }))
  }, [])

  const reset = useCallback(() => setManualMoves({}), [])

  const clearAll = useCallback(() => {
    setCsvText("")
    setFileName("")
    setManualMoves({})
    localStorage.removeItem(LS_KEY)
  }, [])

  return {
    csvText,
    fileName,
    persons: parsed.persons,
    statusCounts: parsed.statusCounts,
    result,
    loadCsv,
    moveChild,
    reset,
    clearAll,
  }
}

export { UNASSIGNED }
