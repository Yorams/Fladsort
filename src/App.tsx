import { useEffect, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useFladsort } from "./state/store"
import { SettingsProvider, useSettings } from "./state/settingsStore"
import { suggestAliases } from "./lib/school"
import { Toolbar } from "./components/Toolbar"
import { Uploader } from "./components/Uploader"
import { GroupBoard } from "./components/GroupBoard"
import { ConflictPanel, UNASSIGN_ZONE } from "./components/ConflictPanel"
import { ChildDetail } from "./components/ChildDetail"
import { SettingsModal } from "./components/SettingsModal"

function Workspace() {
  const { settings, updateSettings } = useSettings()
  const store = useFladsort(settings)
  const res = store.result
  const [selected, setSelected] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Genereer automatisch ontbrekende schoolaliassen uit de geladen CSV.
  // Idempotent: zodra alles gekoppeld is, voegt dit niets meer toe.
  useEffect(() => {
    if (store.persons.length === 0) return
    const extra = suggestAliases(store.persons, settings.schoolAliases)
    if (extra.length > 0) {
      updateSettings({ schoolAliases: [...settings.schoolAliases, ...extra] })
    }
  }, [store.persons, settings.schoolAliases, updateSettings])

  // Klein sleep-startdrempeltje zodat klikken (selecteren) blijft werken.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    const childId = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!over) return
    if (over === UNASSIGN_ZONE) store.moveChild(childId, null)
    else store.moveChild(childId, over) // over is een groep-id
  }

  const selectedChild = res?.children.find((c) => c.id === selected) ?? null
  const draggedChild = res?.children.find((c) => c.id === dragId) ?? null

  return (
    <div className="app">
      <Toolbar store={store} onOpenSettings={() => setSettingsOpen(true)} />
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="main">
          <div className="board-wrap">
            {res ? (
              <GroupBoard result={res} selectedChild={selected} onSelect={setSelected} />
            ) : (
              <Uploader store={store} />
            )}
          </div>

          {res && (
            <div className="sidebar">
              {selectedChild ? (
                <ChildDetail child={selectedChild} result={res} onClose={() => setSelected(null)} />
              ) : (
                <ConflictPanel result={res} selectedChild={selected} onSelect={setSelected} />
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {draggedChild ? <div className="drag-overlay-card">{draggedChild.fullName}</div> : null}
        </DragOverlay>
      </DndContext>

      {settingsOpen && <SettingsModal persons={store.persons} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export function App() {
  return (
    <SettingsProvider>
      <Workspace />
    </SettingsProvider>
  )
}
