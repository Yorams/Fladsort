import { useRef, useState } from "react";
import type { FladsortStore } from "../state/store";

export function Uploader({ store }: { store: FladsortStore }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => store.loadCsv(String(reader.result), file.name);
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="welcome">
      <h2 className="welcome-title">🦖 Welkom bij Fladsort</h2>
      <p className="welcome-lead">
        Deel de kinderen van je locatie automatisch in, op basis van je
        inschrijvingen-export.
      </p>

      <button
        type="button"
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <div className="dz-icon">📂</div>
        <div className="dz-main">
          Sleep je CSV-bestand hierheen of klik om te kiezen
        </div>
        <div className="dz-sub">Het bestand blijft op je eigen computer.</div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="welcome-info">
        <p>Zodra je een bestand laadt, doet Fladsort het volgende:</p>
        <ul>
          <li>
            <b>Groepjes maken</b> rond de begeleiders (duo's samen) en hun eigen
            kinderen erbij.
          </li>
          <li>
            <b>Vriendjes koppelen</b> via "wil in een groepje met" en de
            opmerkingen — ook bij schrijffouten of alleen een voornaam.
          </li>
          <li>
            <b>Uitleg per kind</b>: klik een kind aan om te zien waaróm het in
            die groep zit.
          </li>
          <li>
            <b>Conflicten apart</b>: twijfelgevallen zet je met slepen zelf in
            de juiste groep.
          </li>
          <li>
            <b>Exporteren</b> naar Excel als je tevreden bent.
          </li>
        </ul>
        <p className="welcome-privacy">
          🔒 Alle gegevens blijven in je browser — er wordt niets naar een
          server gestuurd.
        </p>
      </div>
    </div>
  );
}
