import type { AssignmentResult } from "../types"
import { GroupColumn } from "./GroupColumn"

interface Props {
  result: AssignmentResult
  selectedChild: string | null
  onSelect: (id: string) => void
}

export function GroupBoard({ result, selectedChild, onSelect }: Props) {
  return (
    <div className="board">
      {result.groups.map((g) => (
        <GroupColumn key={g.id} group={g} result={result} selectedChild={selectedChild} onSelect={onSelect} />
      ))}
    </div>
  )
}
