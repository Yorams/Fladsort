import { useDraggable } from "@dnd-kit/core"
import type { Assignment, Person } from "../types"

interface Props {
  child: Person
  assignment?: Assignment
  selected: boolean
  onSelect: (id: string) => void
}

export function ChildCard({ child, assignment, selected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: child.id })

  const hasPref = child.preferenceNames.length > 0 || !!child.wilMet
  const hasOpm = !!child.opmerkingen
  const conflicts = assignment?.conflicts ?? []
  const hasFlag = conflicts.some((c) => c.type.startsWith("flag-") || c.type === "naam-niet-gevonden")
  const hasHardConflict = conflicts.some(
    (c) => !c.type.startsWith("flag-") && c.type !== "naam-niet-gevonden",
  )

  return (
    <div
      ref={setNodeRef}
      data-child-id={child.id}
      className={`card${isDragging ? " dragging" : ""}${selected ? " selected" : ""}`}
      onClick={() => onSelect(child.id)}
      {...listeners}
      {...attributes}
    >
      <div className="name">{child.fullName || child.voornaam}</div>
      <div className="meta">
        <span>{child.schoolPretty || "?"}</span>
        {child.groepRaw && <span>gr {child.groepRaw}</span>}
      </div>
      <div className="meta">
        <span title="Account">👤 {child.account || "—"}</span>
      </div>
      {(hasPref || hasOpm || hasFlag || hasHardConflict) && (
        <div className="icons">
          {hasPref && <span className="chip" title={child.wilMet}>wil-met</span>}
          {hasOpm && <span className="chip" title={child.opmerkingen}>opm</span>}
          {hasFlag && <span className="chip warn" title="Aandachtspunt">⚑</span>}
          {hasHardConflict && <span className="chip bad" title="Conflict">!</span>}
        </div>
      )}
    </div>
  )
}
