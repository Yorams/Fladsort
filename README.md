# Fladsort

Webapp die kinderen van het kindervakantiefestijn automatisch in **16 groepen** indeelt op
basis van de CSV-export, en per kind laat zien **waaróm** het in een groep zit. Conflicten en
aandachtspunten staan apart en kun je handmatig naar een groep slepen.

## Starten

```bash
npm install
npm run dev
```

Open daarna de URL die Vite toont (standaard http://localhost:5180) en sleep je CSV-export in
het venster (of gebruik **“CSV laden”**). De indeling verschijnt direct.

Bouwen voor een statische versie: `npm run build` → output in `dist/`.

## Hosten op je eigen server / VPS

De app is een **statische site** (geen backend). Twee manieren:

**Met Docker (aanbevolen):**

```bash
docker build -t fladsort .
docker run -d -p 8080:80 --name fladsort --restart unless-stopped fladsort
```

De app draait dan op `http://<server>:8080`. Zet er een reverse proxy (nginx/Traefik/Caddy) met
HTTPS voor. De meegeleverde [`nginx.conf`](nginx.conf) regelt de SPA-fallback en caching.

**Zonder Docker:** `npm run build` en serveer de inhoud van `dist/` met elke webserver
(nginx, Apache, Caddy). Belangrijk: laat onbekende paden terugvallen op `index.html`
(SPA-fallback). Dankzij `base: "./"` werkt het ook onder een submap.

## Hoe de indeling werkt (in stappen)

De indeling volgt het handmatige werkproces. Elke plaatsing wordt gelogd; klik op een kind om
de volledige redenering te zien.

1. **Groepen uit begeleiders** — duo-begeleiders (kolom _Duo met_) vormen samen één groep,
   solo-begeleiders elk één groep. Doel: 16 groepen.
2. **Eigen kinderen van begeleiders** — kinderen met hetzelfde _Account_ als een begeleider
   gaan bij hun ouder in de groep.
3. **Vriendjes (en begeleiders) koppelen** — namen uit _Eventueel in een groepje met_ (en soms
   _Opmerkingen_) worden fuzzy gematcht. Verwijst een naam naar een **begeleider** (bv.
   "groepje van Annemieke Schreuders"), dan gaat het kind naar die begeleiders groep. Bij alleen
   een voornaam wordt school/groep als tiebreak gebruikt. Zit de vriend al in een groep met ruimte,
   dan komt het kind erbij.
4. **Resterende kinderen clusteren** — nog niet ingedeelde kinderen worden via hun onderlinge
   voorkeuren tot groepjes gekoppeld en in de best passende groep geplaatst (zelfde school+groep
   > zelfde school > ruimte). Clusters groter dan 8 worden gesplitst.
5. **Kinderen zonder voorkeur** — ingedeeld op zelfde school/groep waar ruimte is.
6. **Finaliseren** — niet-plaatsbare kinderen, niet-gevonden namen, oneven groepen en
   negatieve/vrije wensen worden als conflict/waarschuwing getoond.

Regels: max **8** kinderen per groep (hard), **even** aantal heeft voorkeur (zacht).
Begeleiders tellen niet mee in de 8.

## Instellingen (in de app)

Klik op **⚙ Instellingen** in de balk. Wijzigingen passen direct toe en worden lokaal opgeslagen.
Tabs:

- **Locatie & profielen** — meerdere locaties als profielen; aanmaken, hernoemen, verwijderen en
  **Exporteren/Importeren** (`fladsort-<locatie>.json`) om een config te delen of te back-uppen.
- **Groepen** — groepsnamen toevoegen, hernoemen, sorteren, verwijderen.
- **Groepsgrootte** — max kinderen per groep, verwacht aantal groepen, even-voorkeur.
- **Statussen** — welke inschrijvingsstatussen standaard meedoen.
- **Scholen** — schoolnaam-aliassen: koppel schrijfwijzen (bv. "Velduil", "OBS de Velduil",
  "De veldui") aan één nette naam. Varianten met dezelfde alias tellen in de indeling als
  **dezelfde school**. De lijst toont ook alle ruwe schoolnamen uit je geladen CSV, zodat je
  ongekoppelde varianten met één klik aan een alias hangt.

[`src/config/settings.json`](src/config/settings.json) is de **standaard (seed)** die een nieuw
profiel bij de eerste keer overneemt — de werkelijke instellingen leven per locatie-profiel in de
browser (localStorage), niet in dit bestand.

## Multi-locatie

Elke locatie heeft een eigen profiel met eigen groepsnamen, groepsgrootte, statussen en
schoolaliassen. Wissel bovenin van profiel. Profielen bevatten **alleen instellingen, geen
persoonsgegevens** — delen kan veilig via Exporteer/Importeer.

## Bediening

- **Statusfilter** (bovenin): kies welke inschrijvingen meedoen (standaard _Ingeschreven_ +
  _Ingeloot & wacht op betaling_).
- **Slepen**: sleep een kind naar een andere groep, of naar het vak _Niet ingedeeld_ om het uit
  zijn groep te halen. Handmatige verplaatsingen blijven bewaard (ook na verversen).
- **Opnieuw indelen**: zet alle handmatige verplaatsingen terug naar de automatische indeling.
- **Exporteer .xlsx**: één rij per persoon, inclusief groep, reden van indeling en conflicten.

## Privacy (AVG)

De CSV met persoonsgegevens wordt **volledig in de browser** verwerkt en gaat nooit naar een
server — ook niet wanneer je de app op een VPS host (die levert alleen de statische bestanden).
In localStorage staan alleen je instellingen (geen persoonsgegevens) en, als werkkopie, de laatst
geladen indeling op dát apparaat. CSV-bestanden en de geëxporteerde xlsx staan in `.gitignore`.

## Techniek

Vite + React + TypeScript · `papaparse` (CSV) · `fuse.js` (fuzzy match) · `@dnd-kit` (slepen) ·
SheetJS (`xlsx`). De indeel-logica staat los van de UI in `src/lib/` (`normalize.ts`, `school.ts`,
`matching.ts`, `assign.ts`); instellingen/profielen in `src/state/settingsStore.tsx`. Hosting via
`Dockerfile` + `nginx.conf`.
