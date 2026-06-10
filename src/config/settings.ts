// Configuratie van de indeling. settings.json is de SEED/default die bij eerste
// gebruik in een profiel wordt geladen. Tijdens gebruik komt de actieve Settings
// uit het gekozen locatie-profiel (zie state/settingsStore.ts).

import raw from "./settings.json"

/** Koppelt meerdere schrijfwijzen (terms) aan één nette schoolnaam. */
export interface SchoolAlias {
  id: string
  display: string
  terms: string[]
}

export interface Settings {
  /** Naam van de locatie (voor het actieve profiel). */
  locationName: string
  /** Verwacht aantal groepen (waarschuwing bij afwijking). */
  targetGroups: number
  /** Harde bovengrens kinderen per groep. */
  maxChildrenPerGroup: number
  /** Voorkeur voor een even aantal kinderen per groep (zacht). */
  preferEvenGroups: boolean
  /** Statussen die standaard meedoen in de indeling. */
  defaultStatuses: string[]
  /** Leuke groepsnamen; op = "Naamloos N". */
  groupNames: string[]
  /** Schoolnaam-aliassen voor normalisatie/weergave. */
  schoolAliases: SchoolAlias[]
}

export const defaultSettings: Settings = {
  locationName: "Mijn locatie",
  targetGroups: 16,
  maxChildrenPerGroup: 8,
  preferEvenGroups: true,
  defaultStatuses: ["Ingeschreven", "Ingeloot & wacht op betaling"],
  groupNames: [],
  schoolAliases: [],
}

/** De seed uit settings.json, aangevuld met defaults voor ontbrekende velden. */
export const seedSettings: Settings = { ...defaultSettings, ...(raw as Partial<Settings>) }

// Achterwaartse compatibiliteit: sommige modules importeerden `settings`.
export const settings: Settings = seedSettings
