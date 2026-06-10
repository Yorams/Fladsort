import { useDroppable } from "@dnd-kit/core"
import type { AssignmentResult } from "../types"
import { ChildCard } from "./ChildCard"

interface Props {
  result: AssignmentResult
  selectedChild: string | null
  onSelect: (id: string) => void
}

export const UNASSIGN_ZONE = "__unassign_zone__"

export function ConflictPanel({ result, selectedChild, onSelect }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGN_ZONE })

  const placed = new Set<string>()
  result.groups.forEach((g) => g.children.forEach((c) => placed.add(c.id)))
  const unplaced = result.children.filter((c) => !placed.has(c.id))

  // Kinderen mét waarschuwingen/flags die wél ingedeeld zijn.
  const flagged = result.children.filter((c) => {
    if (!placed.has(c.id)) return false
    const a = result.assignments[c.id]
    return a && a.conflicts.length > 0
  })

  return (
    <>
      <div className="sec">
        <h3>Niet ingedeeld ({unplaced.length})</h3>
        <div ref={setNodeRef} className="body" style={isOver ? { background: "#fee2e2" } : undefined}>
          {unplaced.length === 0 && <div className="empty">Alle kinderen zijn ingedeeld 🎉</div>}
          {unplaced.map((c) => (
            <div key={c.id} className="conflict-item unplaced">
              <ChildCard
                child={c}
                assignment={result.assignments[c.id]}
                selected={selectedChild === c.id}
                onSelect={onSelect}
              />
              {result.assignments[c.id]?.conflicts.slice(0, 2).map((cf, i) => (
                <div key={i} className="why">
                  {cf.text}
                </div>
              ))}
            </div>
          ))}
          <div className="empty" style={{ paddingTop: 8 }}>
            Sleep een kind hierheen om het uit zijn groep te halen.
          </div>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="sec">
          <h3>Aandachtspunten ({flagged.length})</h3>
          <div className="body">
            {flagged.map((c) => (
              <div key={c.id} className="conflict-item" onClick={() => onSelect(c.id)} style={{ cursor: "pointer" }}>
                <div className="name">{c.fullName}</div>
                {result.assignments[c.id]?.conflicts.map((cf, i) => (
                  <div key={i} className="why">
                    {cf.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="sec">
          <h3>Waarschuwingen ({result.warnings.length})</h3>
          <div className="body">
            {result.warnings.map((w, i) => (
              <div key={i} className="warning">
                {w.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
