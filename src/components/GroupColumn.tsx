import { useDroppable } from "@dnd-kit/core"
import type { AssignmentResult, Group } from "../types"
import { useSettings } from "../state/settingsStore"
import { ChildCard } from "./ChildCard"

interface Props {
  group: Group
  result: AssignmentResult
  selectedChild: string | null
  onSelect: (id: string) => void
}

export function GroupColumn({ group, result, selectedChild, onSelect }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id })
  const { settings } = useSettings()
  const max = settings.maxChildrenPerGroup
  const count = group.children.length
  const badgeClass = count > max ? "over" : count % 2 === 0 ? "even" : "odd"

  return (
    <div ref={setNodeRef} className={`group${isOver ? " over" : ""}`}>
      <div className="group-head">
        <div className="title">
          <span>{group.naam}</span>
          <span className={`badge ${badgeClass}`}>
            {count}/{max}
          </span>
        </div>
        <div className="begeleiders">
          🧑‍🏫 {group.begeleiders.map((b) => b.fullName).join(" & ") || "geen begeleider"}
        </div>
      </div>
      <div className="group-body">
        {group.children.map((c) => (
          <ChildCard
            key={c.id}
            child={c}
            assignment={result.assignments[c.id]}
            selected={selectedChild === c.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
