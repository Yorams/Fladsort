import { useRef, useState } from "react"
import type { Person } from "../types"
import type { SchoolAlias } from "../config/settings"
import { useSettings } from "../state/settingsStore"
import { distinctRawSchools, aliasIdFromDisplay } from "../lib/school"

type Tab = "locatie" | "groepen" | "grootte" | "statussen" | "scholen"

const TABS: { id: Tab; label: string }[] = [
  { id: "locatie", label: "Locatie & profielen" },
  { id: "groepen", label: "Groepen" },
  { id: "grootte", label: "Groepsgrootte" },
  { id: "statussen", label: "Statussen" },
  { id: "scholen", label: "Scholen" },
]

export function SettingsModal({ persons, onClose }: { persons: Person[]; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("locatie")

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Instellingen</h2>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {tab === "locatie" && <LocatieTab />}
            {tab === "groepen" && <GroepenTab />}
            {tab === "grootte" && <GrootteTab />}
            {tab === "statussen" && <StatussenTab persons={persons} />}
            {tab === "scholen" && <ScholenTab persons={persons} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Locatie & profielen -----------------------------------------------------

function LocatieTab() {
  const s = useSettings()
  const importRef = useRef<HTMLInputElement>(null)
  const [newName, setNewName] = useState("")

  return (
    <div className="form">
      <label className="field">
        <span>Actief profiel</span>
        <select value={s.activeId} onChange={(e) => s.switchProfile(e.target.value)}>
          {s.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Naam van deze locatie</span>
        <input
          value={s.settings.locationName}
          onChange={(e) => s.renameProfile(s.activeId, e.target.value)}
        />
      </label>

      <div className="row">
        <input
          placeholder="Naam nieuwe locatie"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => {
            if (newName.trim()) {
              s.createProfile(newName.trim())
              setNewName("")
            }
          }}
        >
          + Nieuw profiel
        </button>
      </div>

      <div className="row">
        <button className="btn secondary" onClick={s.exportActive}>
          ⬇ Exporteer locatie.json
        </button>
        <button className="btn secondary" onClick={() => importRef.current?.click()}>
          ⬆ Importeer profiel
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) {
              try {
                await s.importProfile(f)
              } catch {
                alert("Kon dit bestand niet importeren (geen geldig profiel?).")
              }
            }
            e.target.value = ""
          }}
        />
        {s.profiles.length > 1 && (
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm(`Profiel "${s.settings.locationName}" verwijderen?`)) s.deleteProfile(s.activeId)
            }}
          >
            🗑 Verwijder dit profiel
          </button>
        )}
      </div>

      <p className="hint">
        Instellingen worden lokaal in je browser bewaard (geen persoonsgegevens). Deel een locatie met
        een collega via Exporteer/Importeer.
      </p>
    </div>
  )
}

// --- Groepen -----------------------------------------------------------------

function GroepenTab() {
  const { settings, updateSettings } = useSettings()
  const names = settings.groupNames

  const setNames = (next: string[]) => updateSettings({ groupNames: next })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= names.length) return
    const next = [...names]
    ;[next[i], next[j]] = [next[j], next[i]]
    setNames(next)
  }

  return (
    <div className="form">
      <p className="hint">
        Groepsnamen worden op volgorde gebruikt. Zijn er meer groepen (begeleiders) dan namen, dan
        krijgen die "Naamloos N".
      </p>
      <div className="list">
        {names.map((n, i) => (
          <div key={i} className="list-row">
            <span className="idx">{i + 1}.</span>
            <input
              value={n}
              onChange={(e) => {
                const next = [...names]
                next[i] = e.target.value
                setNames(next)
              }}
            />
            <button className="icon-btn" title="Omhoog" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button className="icon-btn" title="Omlaag" onClick={() => move(i, 1)}>
              ↓
            </button>
            <button
              className="icon-btn danger"
              title="Verwijderen"
              onClick={() => setNames(names.filter((_, k) => k !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setNames([...names, `Groep ${names.length + 1}`])}>
        + Groepsnaam toevoegen
      </button>
    </div>
  )
}

// --- Groepsgrootte -----------------------------------------------------------

function GrootteTab() {
  const { settings, updateSettings } = useSettings()
  return (
    <div className="form">
      <label className="field">
        <span>Max. kinderen per groep</span>
        <input
          type="number"
          min={1}
          max={20}
          value={settings.maxChildrenPerGroup}
          onChange={(e) => updateSettings({ maxChildrenPerGroup: Math.max(1, Number(e.target.value) || 1) })}
        />
      </label>
      <label className="field">
        <span>Verwacht aantal groepen</span>
        <input
          type="number"
          min={1}
          max={100}
          value={settings.targetGroups}
          onChange={(e) => updateSettings({ targetGroups: Math.max(1, Number(e.target.value) || 1) })}
        />
        <small className="hint">Alleen voor een waarschuwing; het echte aantal volgt uit de begeleiders.</small>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.preferEvenGroups}
          onChange={(e) => updateSettings({ preferEvenGroups: e.target.checked })}
        />
        <span>Voorkeur voor een even aantal kinderen per groep</span>
      </label>
    </div>
  )
}

// --- Statussen ---------------------------------------------------------------

function StatussenTab({ persons }: { persons: Person[] }) {
  const { settings, updateSettings } = useSettings()
  const counts: Record<string, number> = {}
  for (const p of persons) counts[p.status] = (counts[p.status] || 0) + 1
  const statuses = Object.entries(counts).sort((a, b) => b[1] - a[1])

  const toggle = (status: string) => {
    const cur = new Set(settings.defaultStatuses)
    if (cur.has(status)) cur.delete(status)
    else cur.add(status)
    updateSettings({ defaultStatuses: [...cur] })
  }

  return (
    <div className="form">
      <p className="hint">Welke inschrijvingsstatussen meedoen in de indeling. Wijzigingen passen direct toe.</p>
      {statuses.length === 0 && <p className="hint">Laad eerst een CSV om de statussen te zien.</p>}
      {/* Toon ook statussen uit settings die (nog) niet in de data zitten. */}
      {Array.from(new Set([...statuses.map((x) => x[0]), ...settings.defaultStatuses])).map((status) => (
        <label key={status} className="checkbox">
          <input
            type="checkbox"
            checked={settings.defaultStatuses.includes(status)}
            onChange={() => toggle(status)}
          />
          <span>
            {status} {counts[status] ? `(${counts[status]})` : ""}
          </span>
        </label>
      ))}
    </div>
  )
}

// --- Scholen -----------------------------------------------------------------

function ScholenTab({ persons }: { persons: Person[] }) {
  const { settings, updateSettings } = useSettings()
  const aliases = settings.schoolAliases
  const setAliases = (next: SchoolAlias[]) => updateSettings({ schoolAliases: next })

  const rawSchools = distinctRawSchools(persons, aliases)

  const linkRawToAlias = (raw: string, aliasId: string) => {
    setAliases(
      aliases.map((a) => (a.id === aliasId ? { ...a, terms: [...new Set([...a.terms, raw])] } : a)),
    )
  }
  const createAliasFromRaw = (raw: string) => {
    let id = aliasIdFromDisplay(raw)
    while (aliases.some((a) => a.id === id)) id += "-2"
    setAliases([...aliases, { id, display: raw, terms: [raw] }])
  }

  return (
    <div className="form">
      <p className="hint">
        Aliassen koppelen schrijfwijzen aan één nette schoolnaam. Varianten met dezelfde alias gelden
        in de indeling als <b>dezelfde school</b>.
      </p>

      {persons.length > 0 && (
        <>
          <h4>Scholen in de huidige data</h4>
          <div className="list">
            {rawSchools.map((rs) => (
              <div key={rs.raw} className="list-row">
                <span className="grow">
                  {rs.raw} <small className="muted">×{rs.count}</small>
                </span>
                <span className={`resolve${rs.resolution.aliasId ? "" : " none"}`}>
                  → {rs.resolution.aliasId ? rs.resolution.pretty : "geen alias"}
                </span>
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === "__new__") createAliasFromRaw(rs.raw)
                    else if (v) linkRawToAlias(rs.raw, v)
                    e.target.value = ""
                  }}
                >
                  <option value="">koppel…</option>
                  {aliases.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display}
                    </option>
                  ))}
                  <option value="__new__">+ Nieuwe alias van deze naam</option>
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>Aliassen</h4>
      <div className="list">
        {aliases.map((a, i) => (
          <div key={a.id} className="alias-row">
            <input
              className="alias-display"
              value={a.display}
              placeholder="Nette naam"
              onChange={(e) => {
                const next = [...aliases]
                next[i] = { ...a, display: e.target.value }
                setAliases(next)
              }}
            />
            <input
              className="alias-terms"
              value={a.terms.join(", ")}
              placeholder="schrijfwijzen, komma-gescheiden"
              onChange={(e) => {
                const next = [...aliases]
                next[i] = { ...a, terms: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }
                setAliases(next)
              }}
            />
            <button
              className="icon-btn danger"
              title="Verwijderen"
              onClick={() => setAliases(aliases.filter((_, k) => k !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn"
        onClick={() => {
          let id = "school-" + (aliases.length + 1)
          while (aliases.some((a) => a.id === id)) id += "-2"
          setAliases([...aliases, { id, display: "", terms: [] }])
        }}
      >
        + Alias toevoegen
      </button>
    </div>
  )
}
