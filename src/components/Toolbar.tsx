import { useRef } from "react";
import type { FladsortStore } from "../state/store";
import { useSettings } from "../state/settingsStore";
import type { SettingsTab } from "./SettingsModal";
import { downloadXlsx } from "../lib/export";
import vlinder from "../../assets/FladderVlinder.svg";

interface Props {
  store: FladsortStore;
  onOpenSettings: (tab?: SettingsTab) => void;
}

export function Toolbar({ store, onOpenSettings }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  const res = store.result;

  const placed = new Set<string>();
  res?.groups.forEach((g) => g.children.forEach((c) => placed.add(c.id)));
  const unplaced = res
    ? res.children.filter((c) => !placed.has(c.id)).length
    : 0;

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => store.loadCsv(String(reader.result), file.name);
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="toolbar">
      <img src={vlinder} style={{ height: "30px" }} />
      <h1>Fladsort</h1>
      <button
        className="btn secondary"
        title="Locatie & profielen openen"
        onClick={() => onOpenSettings("locatie")}
      >
        📍 {settings.locationName}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        className="btn secondary"
        onClick={() => fileRef.current?.click()}
      >
        📂 CSV laden
      </button>
      {store.fileName && (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {store.fileName}
        </span>
      )}

      <div className="spacer" />

      <button
        className="btn ghost"
        onClick={() => onOpenSettings()}
        title="Instellingen"
      >
        ⚙ Instellingen
      </button>

      {res && (
        <div className="stats">
          <span>
            <b>{res.groups.length}</b> groepen
          </span>
          <span>
            <b>{placed.size}</b> ingedeeld
          </span>
          <span>
            <b style={{ color: unplaced ? "var(--red)" : "var(--ink)" }}>
              {unplaced}
            </b>{" "}
            open
          </span>
          <span>
            <b
              style={{
                color: res.warnings.length ? "var(--amber)" : "var(--ink)",
              }}
            >
              {res.warnings.length}
            </b>{" "}
            waarsch.
          </span>
        </div>
      )}

      {res && (
        <>
          <button
            className="btn ghost"
            onClick={() => {
              if (
                confirm(
                  "Alle handmatige verplaatsingen ongedaan maken en opnieuw automatisch indelen?",
                )
              )
                store.reset();
            }}
          >
            ↺ Opnieuw indelen
          </button>
          <button className="btn" onClick={() => downloadXlsx(res)}>
            ⬇ Exporteer .xlsx
          </button>
        </>
      )}
      {store.fileName && (
        <button
          className="btn ghost"
          title="CSV wissen"
          onClick={() => {
            if (confirm("CSV en alle indeling wissen?")) store.clearAll();
          }}
        >
          🗑
        </button>
      )}
    </div>
  );
}
