
    /*CDSI69
    Version : 2.16- novembre 2026
    Fichier : package.json

    Auteurs :
        Claude Frey
        &
        OpenAI ChatGPT

    
    Architecture :
        aide.html 
        index.html
        manifest.json
        package.json
        package-lock.json
        service-worker.js
        test-gps.html
        Version.txt
        vite.config.js
            |
            |__js
                +__app.js
                +__carte.js
                +__debug.js
                +__dictee.js
                +__export.js
                +__export_GPX.js
                +__gps.js
                +__gpx.js
                +__jszip.min.js
                +__leaflet.js
                +__leaflet-omnivore.js
                +__photos.js
                +__sauvegarde.js
                +__waypoints.js
                +__xlsx.bundle.js
                +__xlsx.full.min.js
            |__css
                +leaflet.css
                +__style.js
            |__dist
                |__assets
                |__images
                |__js
                +__index.html
            |__Documents
                +__CDSI69_Carnet_d_architecture_v1
            |__icones
                +__icon-50.png
                +__icon-125.png
                +__icon-192.png
                +__icon-512.png
            |__images
            |__node_modules
            |__public
                |__images
                |__js 

Dictée vocale :
- Premier appui : démarrage de la dictée.
- Le bouton devient rouge et affiche « Arrêter ».
- Deuxième appui : arrêt manuel immédiat.
- Arrêt automatique après 5 secondes sans parole reconnue.
- Maintien du bouton rouge lors des interruptions automatiques.
- Nouvelle tentative de reconnaissance si le navigateur coupe une session.
- Arrêt après 5 secondes sans nouvelle parole reconnue.
- Conservation du texte reconnu entre les sessions.
*/

let dicteeActive = null;

const DELAI_SILENCE_DICTEE = 5000;
const DELAI_RELANCE_DICTEE = 500;


// Arrêt global : accessible aussi depuis le deuxième appui sur le bouton.
// Arrêt global : accessible aussi depuis le deuxième appui sur le bouton.
function arreterDictee(etatDict, silence) {

    if (!etatDict || etatDict.termine) return;

    etatDict.arretDemande = true;

    if (silence) {
        etatDict.silenceAtteint = true;
    }

    if (etatDict.minuterieSilence !== null) {
        clearTimeout(etatDict.minuterieSilence);
        etatDict.minuterieSilence = null;
    }

    if (etatDict.minuterieRelance !== null) {
        clearTimeout(etatDict.minuterieRelance);
        etatDict.minuterieRelance = null;
    }

    if (etatDict.reconnaissance) {
        try {
            etatDict.reconnaissance.abort();
        } catch (erreur) {
            if (etatDict.terminerDictee) {
                etatDict.terminerDictee();
            }
        }
    } else if (etatDict.terminerDictee) {
        etatDict.terminerDictee();
    }
}


// ---------------------------------------------------------
// DICTÉE D'UN CHAMP
// ---------------------------------------------------------

function dicterTexte(idChamp) {

    const champ = document.getElementById(idChamp);

    if (!champ) {
        return;
    }

    let bouton =
        document.getElementById("btnDictee" +
            idChamp.charAt(0).toUpperCase() +
            idChamp.slice(1));

    if (idChamp === "nouveauCommentairePhoto") {
        bouton = document.getElementById("btnDicteePhoto");
    }


    // Si une dictée est déjà en cours, arrêter.
    if (dicteeActive) {
        arreterDictee(dicteeActive, false);
        return;
    }


    // -----------------------------------------------------
    // DÉMARRAGE DE LA DICTÉE
    // -----------------------------------------------------

    const lancerDictee = function(mode) {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert(
                "La reconnaissance vocale n'est pas disponible sur ce navigateur."
            );
            return;
        }

        const texteInitial = champ.value;

        const etat = {
            champ: champ,
            bouton: bouton,
            reconnaissance: null,

            // Texte déjà présent avant la dictée.
            texteBase: mode === "ajouter"
                ? texteInitial.trim()
                : "",

            // Texte reconnu pendant la session en cours.
            texteSession: "",

            minuterieSilence: null,
            minuterieRelance: null,
            demarrageEnCours: false,
            dernierTexteSession: "",

            arretDemande: false,
            silenceAtteint: false,
            erreurFatale: false,
            termine: false,

            styleBoutonInitial: bouton ? {
                backgroundColor: bouton.style.backgroundColor,
                color: bouton.style.color,
                borderColor: bouton.style.borderColor
            } : null
        };

        // Séparation entre l'ancien texte et le nouveau.
        if (mode === "ajouter" && etat.texteBase !== "") {
            etat.texteBase += " ";
        }

        dicteeActive = etat;


        // -------------------------------------------------
        // AFFICHAGE DU BOUTON ROUGE
        // -------------------------------------------------

        if (bouton) {
            bouton.textContent = "⏹ Arrêter";
            bouton.disabled = false;
            bouton.style.backgroundColor = "#c62828";
            bouton.style.color = "#ffffff";
            bouton.style.borderColor = "#c62828";
            bouton.setAttribute("aria-pressed", "true");
        }


        // -------------------------------------------------
        // AFFICHAGE DU TEXTE DANS LE CHAMP
        // -------------------------------------------------

        function afficherTexte() {

            champ.value =
                etat.texteBase + etat.texteSession;

            champ.dispatchEvent(
                new Event("input", { bubbles: true })
            );

            champ.dispatchEvent(
                new Event("change", { bubbles: true })
            );
        }


        // -------------------------------------------------
        // ANNULATION DES MINUTERIES
        // -------------------------------------------------

        function annulerMinuterieSilence() {

            if (etat.minuterieSilence !== null) {
                clearTimeout(etat.minuterieSilence);
                etat.minuterieSilence = null;
            }
        }

        function annulerMinuterieRelance() {

            if (etat.minuterieRelance !== null) {
                clearTimeout(etat.minuterieRelance);
                etat.minuterieRelance = null;
            }
        }


        // -------------------------------------------------
        // GESTION DU SILENCE
        // -------------------------------------------------

        function relancerMinuterieSilence() {

            annulerMinuterieSilence();

            etat.minuterieSilence = setTimeout(function() {

                console.log(
                    "CDSI69 : 5 secondes sans parole reconnue."
                );

                arreterDictee(etat, true);

            }, DELAI_SILENCE_DICTEE);
        }


        // -------------------------------------------------
        // FIN DÉFINITIVE DE LA DICTÉE
        // -------------------------------------------------

        function terminerDictee() {

            if (etat.termine) {
                return;
            }

            etat.termine = true;

            annulerMinuterieSilence();
            annulerMinuterieRelance();

            if (bouton) {

                bouton.textContent = "🎤 Dicter";
                bouton.disabled = false;

                bouton.style.backgroundColor =
                    etat.styleBoutonInitial.backgroundColor;

                bouton.style.color =
                    etat.styleBoutonInitial.color;

                bouton.style.borderColor =
                    etat.styleBoutonInitial.borderColor;

                bouton.setAttribute("aria-pressed", "false");
            }

            if (dicteeActive === etat) {
                dicteeActive = null;
            }

            afficherTexte();
        }

        etat.terminerDictee = terminerDictee;


        // L’arrêt est assuré par la fonction globale arreterDictee().


        // -------------------------------------------------
        // CRÉATION ET DÉMARRAGE D'UNE SESSION
        // -------------------------------------------------

        function programmerRelance() {

            if (etat.termine ||
                etat.arretDemande ||
                etat.silenceAtteint ||
                etat.erreurFatale) {
                return;
            }

            if (etat.minuterieRelance !== null) {
                clearTimeout(etat.minuterieRelance);
            }

            etat.minuterieRelance = setTimeout(function() {
                etat.minuterieRelance = null;
                demarrerReconnaissance();
            }, DELAI_RELANCE_DICTEE);
        }


        function demarrerReconnaissance() {

            if (etat.termine ||
                etat.arretDemande ||
                etat.silenceAtteint ||
                etat.erreurFatale) return;

            if (etat.demarrageEnCours || etat.reconnaissance) return;

            const reconnaissance = new SpeechRecognition();

            etat.reconnaissance = reconnaissance;
            etat.demarrageEnCours = true;

            reconnaissance.lang = "fr-FR";
            reconnaissance.interimResults = true;
            reconnaissance.continuous = true;

            reconnaissance.onstart = function() {
                etat.demarrageEnCours = false;
            };

            reconnaissance.onresult = function(event) {

                let texte = "";

                for (let i = 0; i < event.results.length; i++) {
                    texte += event.results[i][0].transcript;
                }

                etat.texteSession = texte;

                afficherTexte();

                // Le délai repart seulement lorsque la transcription évolue.
                if (texte.trim() !== "" &&
                    texte !== etat.dernierTexteSession) {

                    etat.dernierTexteSession = texte;
                    relancerMinuterieSilence();
                }
            };

            reconnaissance.onend = function() {

                if (etat.reconnaissance !== reconnaissance) return;

                etat.reconnaissance = null;
                etat.demarrageEnCours = false;

                // Sauvegarder le texte de cette session avant la relance.
                if (etat.texteSession.trim() !== "") {

                    if (etat.texteBase !== "" &&
                        !/\s$/.test(etat.texteBase)) {

                        etat.texteBase += " ";
                    }

                    etat.texteBase += etat.texteSession;
                }

                etat.texteSession = "";
                etat.dernierTexteSession = "";

                afficherTexte();

                if (etat.arretDemande ||
                    etat.silenceAtteint ||
                    etat.erreurFatale) {

                    terminerDictee();
                    return;
                }

                // Le navigateur a coupé une session,
                // mais la dictée continue.
                console.log(
                    "CDSI69 : interruption automatique, nouvelle tentative."
                );

                programmerRelance();
            };

            reconnaissance.onerror = function(event) {

                console.log(
                    "CDSI69 - Erreur reconnaissance vocale :",
                    event.error
                );

                const erreursFatales = [
                    "not-allowed",
                    "service-not-allowed",
                    "audio-capture",
                    "language-not-supported"
                ];

                if (erreursFatales.includes(event.error)) {

                    etat.erreurFatale = true;

                    if (etat.minuterieSilence !== null) {
                        clearTimeout(etat.minuterieSilence);
                        etat.minuterieSilence = null;
                    }
                }

                // Les erreurs temporaires seront traitées par onend.
            };

            try {

                reconnaissance.start();

            } catch (erreur) {

                console.log(
                    "CDSI69 - Démarrage impossible, nouvelle tentative :",
                    erreur
                );

                if (etat.reconnaissance === reconnaissance) {
                    etat.reconnaissance = null;
                }

                etat.demarrageEnCours = false;

                programmerRelance();
            }
        }


        // -------------------------------------------------
        // LANCEMENT INITIAL
        // -------------------------------------------------

        // Le délai démarre dès le lancement de la dictée.
        relancerMinuterieSilence();

        demarrerReconnaissance();
    };


    // -----------------------------------------------------
    // SI LE CHAMP EST VIDE : DICTÉE DIRECTE
    // -----------------------------------------------------

    if (champ.value.trim() === "") {
        lancerDictee("remplacer");
        return;
    }


    // -----------------------------------------------------
    // LE CHAMP CONTIENT DÉJÀ DU TEXTE
    // -----------------------------------------------------

    const fond = document.createElement("div");

    fond.style.position = "fixed";
    fond.style.top = "0";
    fond.style.left = "0";
    fond.style.width = "100%";
    fond.style.height = "100%";
    fond.style.background = "rgba(0,0,0,0.45)";
    fond.style.zIndex = "5000";
    fond.style.display = "flex";
    fond.style.alignItems = "center";
    fond.style.justifyContent = "center";

    const boite = document.createElement("div");

    boite.style.background = "white";
    boite.style.padding = "20px";
    boite.style.borderRadius = "12px";
    boite.style.width = "85%";
    boite.style.maxWidth = "400px";
    boite.style.boxSizing = "border-box";
    boite.style.textAlign = "center";
    boite.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";

    const titre = document.createElement("h3");

    titre.textContent =
        "📝 Ce champ contient déjà du texte";

    titre.style.marginTop = "0";

    const message = document.createElement("p");

    message.textContent =
        "Que souhaitez-vous faire avec le nouveau texte dicté ?";

    const boutonAjouter = document.createElement("button");

    boutonAjouter.type = "button";
    boutonAjouter.textContent = "➕ Ajouter à la suite";

    const boutonRemplacer = document.createElement("button");

    boutonRemplacer.type = "button";
    boutonRemplacer.textContent = "🗑 Remplacer";

    const boutonAnnuler = document.createElement("button");

    boutonAnnuler.type = "button";
    boutonAnnuler.textContent = "❌ Annuler";

    [
        boutonAjouter,
        boutonRemplacer,
        boutonAnnuler
    ].forEach(function(boutonDialogue) {

        boutonDialogue.style.width = "100%";
        boutonDialogue.style.padding = "12px";
        boutonDialogue.style.marginTop = "10px";
        boutonDialogue.style.boxSizing = "border-box";
    });


    // -----------------------------------------------------
    // CHOIX : AJOUTER À LA SUITE
    // -----------------------------------------------------

    boutonAjouter.addEventListener("click", function() {

        document.body.removeChild(fond);
        lancerDictee("ajouter");
    });


    // -----------------------------------------------------
    // CHOIX : REMPLACER
    // -----------------------------------------------------

    boutonRemplacer.addEventListener("click", function() {

        document.body.removeChild(fond);
        lancerDictee("remplacer");
    });


    // -----------------------------------------------------
    // CHOIX : ANNULER
    // -----------------------------------------------------

    boutonAnnuler.addEventListener("click", function() {

        document.body.removeChild(fond);
    });


    boite.appendChild(titre);
    boite.appendChild(message);
    boite.appendChild(boutonAjouter);
    boite.appendChild(boutonRemplacer);
    boite.appendChild(boutonAnnuler);

    fond.appendChild(boite);

    document.body.appendChild(fond);
}


// ---------------------------------------------------------
// BOUTONS DE DICTÉE
// ---------------------------------------------------------

document.getElementById("btnDicteePoiPov").addEventListener(
    "click",
    function() {
        dicterTexte("poiPov");
    }
);

document.getElementById("btnDicteeObsNuisance").addEventListener(
    "click",
    function() {
        dicterTexte("obsNuisance");
    }
);

document.getElementById("btnDicteeAutreSignaletique").addEventListener(
    "click",
    function() {
        dicterTexte("signaletiqueAutre");
    }
);

document.getElementById("btnDicteeAutreSecurite").addEventListener(
    "click",
    function() {
        dicterTexte("securiteAutre");
    }
);

document.getElementById("btnDicteeAutreNuisance").addEventListener(
    "click",
    function() {
        dicterTexte("autreNuisance");
    }
);

document.getElementById("btnDicteePasAPas").addEventListener(
    "click",
    function() {
        dicterTexte("pasAPas");
    }
);

document.getElementById("btnDicteeNomTrace").addEventListener(
    "click",
    function() {
        dicterTexte("nomTrace");
    }
);

document.getElementById("btnDicteeCommuneDepart").addEventListener(
    "click",
    function() {
        dicterTexte("communeDepart");
    }
);

document.getElementById("btnDicteeLieuDepart").addEventListener(
    "click",
    function() {
        dicterTexte("lieuDepart");
    }
);

document.getElementById("btnDicteeAccesDepart").addEventListener(
    "click",
    function() {
        dicterTexte("accesDepart");
    }
);

document.getElementById("btnDicteePhoto").addEventListener(
    "click",
    function() {
        dicterTexte("nouveauCommentairePhoto");
    }
);

document.getElementById("btnDicteeCommentairePhoto").addEventListener(
    "click",
    function() {
        dicterTexte("commentairePhoto");
    }
);