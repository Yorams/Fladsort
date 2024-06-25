import * as fs from "fs";
import csv from "csv-parser"
import Fuse from "fuse.js"
import * as XLSX from "xlsx"
import { v4 as uuidv4 } from 'uuid';

XLSX.set_fs(fs);

// Input CSV filename
const filename = "fladres-inschrijvingen-2024.csv"
//const filename = "test.csv"

// Geneereer geen XLSX voor test doeleinden
const generateFile = true;

const groepsnamen = [
    "Ontwerpafdeling",
    "Prototypewerkplaats",
    "Materialenmagazijn",
    "Veiligheidsafdeling",
    "Houtbewerkingsafdeling",
    "Verfafdeling",
    "Montageafdeling",
    "Testlab",
    "Verpakkingsafdeling",
    "Kwaliteitscontrole",
    "Magazijnafdeling",
    "Distributiecentrum",
    "Marketingafdeling",
    "Klantenservice",
    "IT - Afdeling",
    "Administratieafdeling",
]

const headers = ["Groepje",
    "Type",
    "Status",
    "Voornaam",
    "Achternaam",
    "Geboortedatum",
    "Leeftijd",
    "Verzorger(s)",
    "Account naam",
    "E-mail",
    "Telefoonnummer",
    "Telefoonnummer (nood)",
    "Straat",
    "Huisnummer",
    "Postcode",
    "Stad",
    "Geslacht",
    "School",
    "Groep / klas",
    "Extra groep / klas info",
    "Mag alleen naar huis",
    "Heeft een zwemdiploma(s)",
    "Is vegetarisch (ook halal)",
    "Eventueel in een groepje met",
    "DUO account code",
    "DUO naam",
    "Vaardigheden",
    "Dagen aanwezig",
    "Opmerkingen",
    "Medische belangrijke informatie",
    "Interne opmerkingen",
    "Geverifieerd op",
    "Aangemaakt op",
    "Laatst bewerkt op",
]


// Init lege arrays
const unsortedBegeleiders = [];
const unsortedDeelnemers = [];
const groepen = [];

/** Deze functie groepeert eventuele duo begeleiders en maakt een groep aan. */
const groepeerBegeleiders = () => {
    const groepsnaam = geefGroepsnaam()

    // Check of begeleider een duo account code heeft
    if (unsortedBegeleiders[0]["DUO account code"] == "") {

        // Voeg groepsnaam toe aan begeleider
        unsortedBegeleiders[0]["Groepje"] = groepsnaam

        // Voeg toe aan groepen array
        groepen.push({
            begeleiders: [unsortedBegeleiders[0]], deelnemers: []
        })
    } else {
        // Zoek naar duo
        const duoIndex = unsortedBegeleiders.findIndex((begeleiderDuo, index) => {
            return (unsortedBegeleiders[0]["Account naam"] == begeleiderDuo["DUO naam"])
        })

        if (duoIndex !== -1) {

            // Voeg groepsnaam toe aan begeleider
            unsortedBegeleiders[0]["Groepje"] = groepsnaam
            unsortedBegeleiders[duoIndex]["Groepje"] = groepsnaam

            groepen.push({
                begeleiders: [unsortedBegeleiders[0], unsortedBegeleiders[duoIndex]], deelnemers: []
            })

            // Verwijder begeleider uit bron array
            unsortedBegeleiders.splice(duoIndex, 1);
        }
    }

    // Verwijder uit begeleiders array
    unsortedBegeleiders.shift();

    // Als array nog niet leeg is, check deze dan nog een keer
    if (unsortedBegeleiders.length > 0) {
        groepeerBegeleiders();
    }
}

/** Deze functie geeft een groepsnaam uit de lijst. Als er geen naam meer is, heet de groep naamloos */
const geefGroepsnaam = () => {
    if (groepsnamen.length > 0) {
        return `${groepen.length + 1}. ${groepsnamen.shift()}`;
    } else {
        return `${groepen.length + 1}. Naamloos`;
    }
}

/** Deze functie zet de kinderen van de begeleiders in de groep van de desbetreffende begeleiders */
const plaatsKinderenVanBegeleiders = () => {
    // Loop door alle groepen en hun begeleiders
    groepen.forEach((groep, indexGroep) => {
        groep.begeleiders.forEach(begeleider => {

            const begeleiderKind = unsortedDeelnemers.find((deelnemer, indexDeelnemer) => {
                if (deelnemer["Account naam"] == begeleider["Account naam"]) {
                    unsortedDeelnemers.splice(indexDeelnemer, 1);
                    return true
                } else {
                    return false
                }
            })

            if (typeof (begeleiderKind) !== "undefined") {
                begeleiderKind["Groepje"] = begeleider["Groepje"]

                groepen[indexGroep].deelnemers.push(begeleiderKind)
            }
        })
    });
}

const zoekVriendenVanDeelnemers = () => {

    // Zoek met de naam van de deelnemers in al gemaakte groepen in de lijst met deelnemers die nog niet zijn ingedeeld.
    const options = {
        includeScore: true,
        threshold: 0.4,
        // Search in:
        keys: ['Eventueel in een groepje met']
    }

    const fuse = new Fuse(unsortedDeelnemers, options)

    // Loop door groepen array
    groepen.forEach((groep, groepIndex) => {
        if (groep.deelnemers.length > 0) {
            //console.log(groepIndex)

            // Loop door deelnemers van groepen
            groep.deelnemers.forEach(groepDeelnemer => {
                // Zoek in de deelnemers lijst naar vrienden
                const results = fuse.search(groepDeelnemer["Voornaam"] + " " + groepDeelnemer["Achternaam"])

                /* console.log(groepDeelnemer["Voornaam"] + " " + groepDeelnemer["Achternaam"])
                console.log(results.map((item) => {
                    return `${item.item["Voornaam"]} ${item.item["Achternaam"]}, ${item.item["Eventueel in een groepje met"]}, ${item.score}`
                })); */

                // Voeg deze vrienden toe aan de groepen.
                results.forEach(result => {
                    if (typeof (result.item) !== "undefined") {
                        // Voeg groepnaam toe aan item
                        result.item["Groepje"] = groep.begeleiders[0]["Groepje"]

                        // Voeg toe aan deelnemers array van de groep
                        groepen[groepIndex].deelnemers.push(result.item);

                        // Verwijder uit unsorted deelnemers array
                        const indexToDelete = unsortedDeelnemers.findIndex((deelnemer) => {
                            return deelnemer.uuid === result.item.uuid
                        })

                        if (indexToDelete != -1) {
                            unsortedDeelnemers.splice(indexToDelete, 1)
                        }
                    }
                });

            });
        }
    });
}

// Parse CSV bestand
fs.createReadStream(filename)
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        if (row["Status"] !== "Uitgeschreven") {
            // Trim whitespace
            for (const [key, value] of Object.entries(row)) {
                row[key] = value.trim()
            }

            // Add uuid to every row
            row["uuid"] = uuidv4();

            // Splits deelnemers en begeleiders
            switch (row["Type"]) {
                case "Groepsbegeleider":
                    unsortedBegeleiders.push(row)
                    break;
                case "Deelnemer":
                    unsortedDeelnemers.push(row)
                    break;
                default:
                    break;
            }
        }
    })
    .on('end', () => {
        console.log('CSV-bestand succesvol gelezen, wordt verwerkt...');

        // Maak groepen aan door begeleiders te groeperen
        groepeerBegeleiders();

        // Zet kinderen van begeleiders bij de groepen
        plaatsKinderenVanBegeleiders();

        // Zoek vriendjes en vriendinnen van deelnemers
        zoekVriendenVanDeelnemers();

        // Flatten groepen en merge overige deelnemers
        var merged = groepen.flatMap((groep) => {
            return [...groep.begeleiders, ...groep.deelnemers]
        })
        merged = [...merged, ...unsortedDeelnemers]

        if (generateFile) {
            // Generate XLSX
            const worksheet = XLSX.utils.json_to_sheet(merged);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Inschrijvingen");

            /* fix headers */
            XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

            worksheet["!cols"] = [];
            /* calculate column width */
            headers.forEach((item) => {
                worksheet["!cols"].push({ wch: item.length, hidden: 0 });
            })

            /* create an XLSX file and try to save to Presidents.xlsx */
            XLSX.writeFile(workbook, 'output.xlsx', { compression: true });
        } else {
            // Log die shit
            groepen.map((groep, index) => {
                //console.log(index)
                groep.begeleiders.forEach(begeleider => {
                    //console.log(">>", begeleider["Voornaam"], begeleider["DUO naam"])
                });
                groep.deelnemers.forEach(deelnemer => {
                    //console.log(deelnemer["Voornaam"], deelnemer["Account naam"])
                });
            });
        }
    });