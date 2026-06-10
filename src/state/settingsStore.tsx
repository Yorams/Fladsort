// Locatie-profielen + actieve instellingen, gepersisteerd in localStorage.
// Bevat GEEN persoonsgegevens — alleen configuratie.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { defaultSettings, seedSettings, type Settings } from "../config/settings"

export interface Profile {
  id: string
  name: string
  settings: Settings
}

const LS_PROFILES = "fladsort.profiles"
const LS_ACTIVE = "fladsort.activeProfile"

function newId(): string {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Vul ontbrekende velden aan zodat oude/partiële profielen blijven werken. */
function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  return { ...defaultSettings, ...(s ?? {}) }
}

function loadProfiles(): { profiles: Profile[]; activeId: string } {
  try {
    const rawP = localStorage.getItem(LS_PROFILES)
    const rawA = localStorage.getItem(LS_ACTIVE)
    if (rawP) {
      const parsed = JSON.parse(rawP) as Profile[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const profiles = parsed.map((p) => ({ ...p, settings: normalizeSettings(p.settings) }))
        const activeId = rawA && profiles.some((p) => p.id === rawA) ? rawA : profiles[0].id
        return { profiles, activeId }
      }
    }
  } catch {
    /* val terug op seed */
  }
  // Eerste run: één profiel uit de seed.
  const seed: Profile = { id: newId(), name: seedSettings.locationName, settings: seedSettings }
  return { profiles: [seed], activeId: seed.id }
}

export interface SettingsApi {
  profiles: Profile[]
  activeId: string
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void
  createProfile: (name: string) => void
  renameProfile: (id: string, name: string) => void
  deleteProfile: (id: string) => void
  switchProfile: (id: string) => void
  exportActive: () => void
  importProfile: (file: File) => Promise<void>
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadProfiles, [])
  const [profiles, setProfiles] = useState<Profile[]>(initial.profiles)
  const [activeId, setActiveId] = useState<string>(initial.activeId)

  useEffect(() => {
    try {
      localStorage.setItem(LS_PROFILES, JSON.stringify(profiles))
      localStorage.setItem(LS_ACTIVE, activeId)
    } catch {
      /* quota — negeer */
    }
  }, [profiles, activeId])

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? {
                ...p,
                settings: { ...p.settings, ...partial },
                name: partial.locationName ?? p.name,
              }
            : p,
        ),
      )
    },
    [activeId],
  )

  const createProfile = useCallback(
    (name: string) => {
      const base = profiles.find((p) => p.id === activeId)?.settings ?? defaultSettings
      const id = newId()
      const settings: Settings = { ...base, locationName: name || "Nieuwe locatie" }
      setProfiles((prev) => [...prev, { id, name: settings.locationName, settings }])
      setActiveId(id)
    },
    [profiles, activeId],
  )

  const renameProfile = useCallback((id: string, name: string) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name, settings: { ...p.settings, locationName: name } } : p,
      ),
    )
  }, [])

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((prev) => {
        const remaining = prev.filter((p) => p.id !== id)
        if (remaining.length === 0) {
          const seed: Profile = { id: newId(), name: seedSettings.locationName, settings: seedSettings }
          setActiveId(seed.id)
          return [seed]
        }
        if (id === activeId) setActiveId(remaining[0].id)
        return remaining
      })
    },
    [activeId],
  )

  const switchProfile = useCallback((id: string) => setActiveId(id), [])

  const exportActive = useCallback(() => {
    const p = profiles.find((x) => x.id === activeId)
    if (!p) return
    const blob = new Blob([JSON.stringify(p.settings, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safe = (p.name || "locatie").replace(/[^a-z0-9-_]+/gi, "_")
    a.download = `fladsort-${safe}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [profiles, activeId])

  const importProfile = useCallback(async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as Partial<Settings>
    const settings = normalizeSettings(parsed)
    const id = newId()
    const name = settings.locationName || file.name.replace(/\.json$/i, "")
    setProfiles((prev) => [...prev, { id, name, settings: { ...settings, locationName: name } }])
    setActiveId(id)
  }, [])

  const api: SettingsApi = {
    profiles,
    activeId,
    settings: active.settings,
    updateSettings,
    createProfile,
    renameProfile,
    deleteProfile,
    switchProfile,
    exportActive,
    importProfile,
  }

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings moet binnen <SettingsProvider> gebruikt worden")
  return ctx
}
