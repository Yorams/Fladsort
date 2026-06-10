import { useState } from "react"
import type { FladsortStore } from "../state/store"

export function Uploader({ store }: { store: FladsortStore }) {
  const [drag, setDrag] = useState(false)

  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => store.loadCsv(String(reader.result), file.name)
    reader.readAsText(file, "utf-8")
  }

  return (
    <div
      className={`dropzone${drag ? " drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <h2>Sleep je CSV-export hierheen</h2>
      <p>
        Of gebruik <b>“CSV laden”</b> linksboven. De inschrijvingen worden automatisch in 16 groepen
        ingedeeld; conflicten en aandachtspunten verschijnen rechts.
      </p>
    </div>
  )
}
