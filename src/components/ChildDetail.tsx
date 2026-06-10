import type { AssignmentResult, Person } from "../types"

interface Props {
  child: Person
  result: AssignmentResult
  onClose: () => void
}

export function ChildDetail({ child, result, onClose }: Props) {
  const a = result.assignments[child.id]
  const group = a?.groupId ? result.groups.find((g) => g.id === a.groupId) : null

  return (
    <div className="detail">
      <button className="close-x" onClick={onClose} title="Sluiten">
        ×
      </button>
      <h2>{child.fullName}</h2>
      <div className="sub">
        {group ? group.naam : "Nog niet ingedeeld"} · {child.role}
      </div>

      <dl>
        <dt>Account</dt>
        <dd>{child.account || "—"}</dd>
        <dt>School</dt>
        <dd>
          {child.schoolPretty}
          {child.schoolRaw && child.schoolRaw !== child.schoolPretty ? ` (ingevuld: "${child.schoolRaw}")` : ""}
        </dd>
        <dt>Groep / klas</dt>
        <dd>{child.groepRaw || "—"}</dd>
        <dt>Leeftijd</dt>
        <dd>{child.leeftijd || "—"}</dd>
        <dt>Wil in groepje met</dt>
        <dd>{child.wilMet || "—"}</dd>
        <dt>Opmerkingen</dt>
        <dd>{child.opmerkingen || "—"}</dd>
        <dt>Aanwezig</dt>
        <dd>{child.aanwezigOp.join(", ") || "—"}</dd>
      </dl>

      <h3 style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", margin: "0 0 6px" }}>
        Waarom in deze groep
      </h3>
      {a && a.reasons.length > 0 ? (
        <ol className="trace">
          {a.reasons.map((r, i) => (
            <li key={i}>
              <span className="step">[stap {r.step}]</span> {r.text}
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty">Geen indeel-stappen vastgelegd.</div>
      )}

      {a && a.conflicts.length > 0 && (
        <>
          <h3 style={{ fontSize: 12, color: "var(--red)", textTransform: "uppercase", margin: "12px 0 6px" }}>
            Conflicten / aandachtspunten
          </h3>
          <ul className="trace">
            {a.conflicts.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
