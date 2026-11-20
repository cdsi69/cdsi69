/*    CDSI69
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
*/
//-------------------------------------------------
// INITIALISATION DE LA CARTE
//-------------------------------------------------
'use strict';

//-------------------------------------------------
// VARIABLES DE LA CARTE
//-------------------------------------------------

let carteInitialisee = false;
let fondPlanIGN = null;
let fondOSM = null;
let recentrageSuspendu = false;
let timerRecentrage = null;
//-------------------------------------------------
// ETAT DE LA CARTE
//-------------------------------------------------



//-------------------------------------------------
// BOUSSOLE : ROSE DES VENTS ET CAP
// Correction initiale : +5° pour compenser le décalage constaté.
//-------------------------------------------------

let ecouteOrientationActive = false;
let controleBoussole = null;
let roseBoussole = null;
let texteCapBoussole = null;

// Utiliser la ligne ci-dessous pour corriger l'alignement de la boussole
// Valeur positive = correction vers l'est ; valeur négative = correction vers l'ouest
const CORRECTION_BOUSSOLE = 1;

function traiterOrientationBoussole(evenement) {

    if (!evenement) return;

    let cap = null;

    // Safari iOS fournit directement le cap magnétique.
    if (typeof evenement.webkitCompassHeading === "number") {
        cap = evenement.webkitCompassHeading;
    } else if (typeof evenement.alpha === "number") {
        // Déduction utilisée par les navigateurs fournissant alpha.
        cap = (360 - evenement.alpha) % 360;
    }

    if (cap === null || !Number.isFinite(cap)) return;

    // Correction du décalage constaté : le cap affiché est corrigé de 5°.
    cap = (cap - CORRECTION_BOUSSOLE + 360) % 360;

    // La rose tourne sous le repère fixe situé en haut de la boussole.
    if (roseBoussole) {
        roseBoussole.style.transform = "rotate(" + (-cap) + "deg)";
    }

    if (texteCapBoussole) {
        texteCapBoussole.textContent = String(Math.round(cap)).padStart(3, "0") + "°";
    }
}

function demarrerBoussole() {

    if (ecouteOrientationActive) return;

    function ecouter() {
        if (ecouteOrientationActive) return;

        window.addEventListener("deviceorientation", traiterOrientationBoussole, true);
        ecouteOrientationActive = true;
    }

    // iOS exige une autorisation explicite déclenchée par un geste de l'utilisateur.
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {

        DeviceOrientationEvent.requestPermission()
            .then(function (autorisation) {
                if (autorisation === "granted") {
                    ecouter();
                }
            })
            .catch(function () {
                if (texteCapBoussole) texteCapBoussole.title = "Boussole indisponible ou autorisation refusée";
            });

    } else if ("DeviceOrientationEvent" in window) {
        ecouter();
    } else if (texteCapBoussole) {
        texteCapBoussole.title = "Ce navigateur ne fournit pas de capteur de boussole";
    }
}

function ajouterBoussole(carteCible) {

    const controle = L.control({ position: "topright" });

    controle.onAdd = function () {

        const conteneur = L.DomUtil.create("div", "controle-boussole");

        conteneur.innerHTML =
            '<button type="button" class="bouton-boussole" ' +
            'aria-label="Activer la boussole" title="Boussole – nord en haut lorsque le téléphone pointe au nord">' +
                '<span class="boussole-repere" aria-hidden="true"></span>' +
                '<svg class="boussole-svg" viewBox="0 0 100 100" role="img" aria-label="Rose des vents">' +
                    '<g class="boussole-rose">' +
                        '<circle cx="50" cy="50" r="43" class="boussole-cercle" />' +
                        '<g class="boussole-graduations">' +
                            '<path d="M50 7 V17 M93 50 H83 M50 93 V83 M7 50 H17 M80.4 19.6 L73.3 26.7 M80.4 80.4 L73.3 73.3 M19.6 80.4 L26.7 73.3 M19.6 19.6 L26.7 26.7" />' +
                        '</g>' +
                        '<path d="M50 12 L44 50 L50 45 L56 50 Z" class="boussole-nord-rouge" />' +
                        '<path d="M50 88 L44 50 L50 55 L56 50 Z" class="boussole-sud" />' +
                        '<text x="50" y="28" class="boussole-lettre boussole-lettre-nord">N</text>' +
                        '<text x="73" y="54" class="boussole-lettre">E</text>' +
                        '<text x="50" y="80" class="boussole-lettre">S</text>' +
                        '<text x="27" y="54" class="boussole-lettre">O</text>' +
                        '<circle cx="50" cy="50" r="3" class="boussole-centre" />' +
                    '</g>' +
                '</svg>' +
                '<span class="boussole-cap">---°</span>' +
            '</button>';

        roseBoussole = conteneur.querySelector(".boussole-rose");
        texteCapBoussole = conteneur.querySelector(".boussole-cap");

        L.DomEvent.disableClickPropagation(conteneur);
        L.DomEvent.disableScrollPropagation(conteneur);

        L.DomEvent.on(conteneur.querySelector("button"), "click", function () {
            demarrerBoussole();
        });

        return conteneur;
    };

    controle.addTo(carteCible);
    controleBoussole = controle;

    // Sur les appareils ne demandant pas d'autorisation, démarrage automatique.
    if (!(typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function")) {
        demarrerBoussole();
    }
}

function initialiserCarte() {

    if (carteInitialisee) return;

    carte = L.map('carte').setView(
       //[45.896, 4.433],
          [45.7652, 4.8675],
        15 //passer à 16 ou 17 pour zoomer//
    );

    carte.on("movestart", function() {

        recentrageSuspendu = true;

        clearTimeout(timerRecentrage);

        timerRecentrage = setTimeout(function() {

            recentrageSuspendu = false;

        }, 20000);

    });

    groupeWaypoints = L.layerGroup().addTo(carte);

   

// -------------------------------------------------
// FONDS DE CARTE
// -------------------------------------------------

fondPlanIGN = L.tileLayer(
    'https://data.geopf.fr/wmts?' +
    'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
    '&STYLE=normal' +
    '&FORMAT=image/png' +
    '&TILEMATRIXSET=PM' +
    '&TILEMATRIX={z}' +
    '&TILEROW={y}' +
    '&TILECOL={x}',
    {
        maxZoom: 19,
        attribution: '© IGN – Géoplateforme'
    }
);

fondOSM = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 22,
        attribution: '© OpenStreetMap'
    }
);

// Détection des tuiles IGN impossibles à charger
fondPlanIGN.on("tileerror", function (evenement) {

    if (evenement.coords && evenement.coords.z < 14) {
        afficherAlerteZoomHorsLigne();
    }

});

// Vérification après un changement de zoom
carte.on("zoomend", verifierZoomHorsLigne);

// Plan IGN affiché par défaut
fondPlanIGN.addTo(carte);

ajouterControleEchelle(carte);

// Rose des vents : la carte reste orientée nord en haut.
ajouterBoussole(carte);

carteInitialisee = true;

mettreAJourBatterie();
}

//-------------------------------------------------
// AVERTISSEMENT : ZOOM HORS LIGNE
//-------------------------------------------------

//-------------------------------------------------
// VERIFICATION DES CARTES IGN HORS CONNEXION
//-------------------------------------------------

function afficherAlerteZoomHorsLigne() {

    const message = document.getElementById("messageZoomHorsLigne");

    if (!message || !carte) return;

    message.textContent =
        "Attention : les cartes IGN de ce niveau ne sont pas disponibles. " +
        "Les cartes téléchargées commencent au zoom 14. " +
        "En mode hors connexion, revenez au zoom 14 ou supérieur.";

    message.style.display = "block";
}


function masquerAlerteZoomHorsLigne() {

    const message = document.getElementById("messageZoomHorsLigne");

    if (!message) return;

    message.style.display = "none";
}


function verifierZoomHorsLigne() {

    if (!carte) return;

    if (carte.getZoom() >= 14) {
        masquerAlerteZoomHorsLigne();
    }
}

//-------------------------------------------------
// ACCES A LA CARTE
//-------------------------------------------------

function getCarte() {

    return carte;

}


//-------------------------------------------------
// GROUPE DES WAYPOINTS
//-------------------------------------------------

function getGroupeWaypoints() {

    return groupeWaypoints;

}


//-------------------------------------------------
// CENTRAGE SUR UNE COUCHE
//-------------------------------------------------

function centrerSurCouche(couche) {

    if (!carte) return;

    if (!couche) return;

    if (!couche.getBounds) return;

    carte.fitBounds(couche.getBounds());

}


//-------------------------------------------------
// RAFRAICHISSEMENT
//-------------------------------------------------

function rafraichirCarte() {

    if (!carte) return;

    setTimeout(function () {

        carte.invalidateSize();

    }, 100);

}
//-------------------------------------------------
// CARTE DE PREPARATION HORS CONNEXION
//-------------------------------------------------

let carteHorsLigne = null;
// Gestion du téléchargement des cartes
let pauseTelechargementCartes = false;
let telechargementCartesEnCours = false;
const CLE_SAUVEGARDE_CARTES = "CDSI69_TelechargementCartes";
let carteHorsLigneCentreeGPS = false;
let fondIGNHorsLigne = null;

// Fenêtre de confirmation personnalisée pour la suppression des cartes
// (permet d'afficher les boutons « Oui » et « Non », contrairement à confirm()).
function demanderConfirmationSuppressionCartes() {

    return new Promise(function (resolve) {

        const fond = document.createElement("div");
        fond.id = "modalConfirmationSuppressionCartes";
        fond.className = "modal";
        fond.style.zIndex = "10000";

        const contenu = document.createElement("div");
        contenu.className = "modal-contenu";
        contenu.style.maxWidth = "450px";

        const titre = document.createElement("h2");
        titre.textContent = "ATTENTION !";

        const message = document.createElement("div");
        message.textContent =
            "Vous allez supprimer toutes les tuiles IGN mémorisées sur cet appareil.\n\n" +
            "Elles ne seront plus disponibles hors connexion et devront être téléchargées à nouveau.\n\n" +
            "Les collectes, les fichiers GPX, les waypoints et les paramètres de préparation ne seront pas supprimés.\n\n" +
            "Voulez-vous continuer ?";
        message.style.whiteSpace = "pre-line";
        message.style.textAlign = "left";
        message.style.lineHeight = "1.45";

        const boutons = document.createElement("div");
        boutons.className = "modal-boutons";
        boutons.style.flexDirection = "row";
        boutons.style.justifyContent = "center";
        boutons.style.gap = "12px";

        const boutonNon = document.createElement("button");
        boutonNon.type = "button";
        boutonNon.textContent = "Non";

        const boutonOui = document.createElement("button");
        boutonOui.type = "button";
        boutonOui.textContent = "Oui";

        [boutonNon, boutonOui].forEach(function (bouton) {
            bouton.style.minWidth = "90px";
            bouton.style.padding = "9px 18px";
            bouton.style.border = "none";
            bouton.style.borderRadius = "8px";
            bouton.style.color = "white";
            bouton.style.fontWeight = "bold";
            bouton.style.fontSize = "1em";
            bouton.style.cursor = "pointer";
        });

        boutonNon.style.background = "#5DADE2";
        boutonOui.style.background = "#8B0000";

        let reponseDonnee = false;

        function terminer(reponse) {
            if (reponseDonnee) return;
            reponseDonnee = true;
            fond.remove();
            resolve(reponse);
        }

        boutonNon.addEventListener("click", function () {
            terminer(false);
        });

        boutonOui.addEventListener("click", function () {
            terminer(true);
        });

        boutons.appendChild(boutonNon);
        boutons.appendChild(boutonOui);
        contenu.appendChild(titre);
        contenu.appendChild(message);
        contenu.appendChild(boutons);
        fond.appendChild(contenu);
        document.body.appendChild(fond);

    });
}

// Fenêtre de résultat après la suppression des cartes
// Présentation identique à la fenêtre de confirmation Oui / Non.
function afficherResultatSuppressionCartes(texte) {

    const fond = document.createElement("div");
    fond.className = "modal";
    fond.style.zIndex = "10000";

    const contenu = document.createElement("div");
    contenu.className = "modal-contenu";
    contenu.style.maxWidth = "450px";

    const titre = document.createElement("h2");
    titre.textContent = "Suppression terminée";

    const message = document.createElement("div");
    message.textContent = texte;
    message.style.whiteSpace = "pre-line";
    message.style.textAlign = "left";
    message.style.lineHeight = "1.45";

    const boutons = document.createElement("div");
    boutons.className = "modal-boutons";
    boutons.style.justifyContent = "center";

    const boutonOK = document.createElement("button");
    boutonOK.type = "button";
    boutonOK.textContent = "OK";
    boutonOK.style.minWidth = "90px";
    boutonOK.style.padding = "9px 18px";
    boutonOK.style.border = "none";
    boutonOK.style.borderRadius = "8px";
    boutonOK.style.color = "white";
    boutonOK.style.fontWeight = "bold";
    boutonOK.style.fontSize = "1em";
    boutonOK.style.cursor = "pointer";
    boutonOK.style.background = "#5DADE2";

    boutonOK.addEventListener("click", function () {
        fond.remove();
    });

    boutons.appendChild(boutonOK);
    contenu.appendChild(titre);
    contenu.appendChild(message);
    contenu.appendChild(boutons);
    fond.appendChild(contenu);
    document.body.appendChild(fond);
}

// Fenêtre de résultat après la suppression des cartes
// Présentation identique à la fenêtre de confirmation Oui / Non.
function afficherResultatSuppressionCartes(texte) {
    const fond = document.createElement("div");
    fond.className = "modal";
    fond.style.zIndex = "10000";

    const contenu = document.createElement("div");
    contenu.className = "modal-contenu";
    contenu.style.maxWidth = "450px";

    const titre = document.createElement("h2");
    titre.textContent = "Suppression terminée";

    const message = document.createElement("div");
    message.textContent = texte;
    message.style.whiteSpace = "pre-line";
    message.style.textAlign = "left";
    message.style.lineHeight = "1.45";

    const boutons = document.createElement("div");
    boutons.className = "modal-boutons";
    boutons.style.justifyContent = "center";

    const boutonOK = document.createElement("button");
    boutonOK.type = "button";
    boutonOK.textContent = "OK";
    boutonOK.style.minWidth = "90px";
    boutonOK.style.padding = "9px 18px";
    boutonOK.style.border = "none";
    boutonOK.style.borderRadius = "8px";
    boutonOK.style.color = "white";
    boutonOK.style.fontWeight = "bold";
    boutonOK.style.fontSize = "1em";
    boutonOK.style.cursor = "pointer";
    boutonOK.style.background = "#5DADE2";

    boutonOK.addEventListener("click", function () {
        fond.remove();
    });

    boutons.appendChild(boutonOK);
    contenu.appendChild(titre);
    contenu.appendChild(message);
    contenu.appendChild(boutons);
    fond.appendChild(contenu);
    document.body.appendChild(fond);
}

function initialiserCarteHorsLigne() {

        // Choix de la méthode de préparation des cartes

    const btnChoixGPX =
        document.getElementById("btnChoixGPX");

    const btnChoixManuel =
        document.getElementById("btnChoixManuel");

    const importGPX =
        document.getElementById("importGPXHorsLigne");

    // Suppression des seules tuiles cartographiques IGN mémorisées
    const btnSupprimerCartes =
        document.getElementById("btnSupprimerCartes");

    if (btnSupprimerCartes) {
        btnSupprimerCartes.addEventListener("click", async function () {

            if (telechargementCartesEnCours) {
                alert(
                    "Impossible de supprimer les tuiles pendant un téléchargement. " +
                    "Veuillez d'abord terminer ou mettre en pause le téléchargement."
                );
                return;
            }

            const confirmation = await demanderConfirmationSuppressionCartes();

            if (!confirmation) {
                return;
            }

            const affichage = document.getElementById("progressionCartes");

            try {

                const cacheExistant = await caches.open("cdsi69-cartes-v1");
                const cles = await cacheExistant.keys();
                const nombreTuiles = cles.length;

                await caches.delete("cdsi69-cartes-v1");

                if (affichage) {
                    affichage.innerHTML =
                        "<strong>Suppression terminée.</strong><br>" +
                        nombreTuiles + " tuile(s) cartographique(s) supprimée(s).";
                }

                afficherResultatSuppressionCartes(
                    nombreTuiles + " tuile(s) cartographique(s) supprimée(s)."
                );

            } catch (erreur) {

                console.error("Erreur lors de la suppression des cartes :", erreur);

                alert(
                    "La suppression des cartes a échoué.\n\n" +
                    "Détail : " + erreur.message
                );

            }

        });
    }

    btnChoixGPX.addEventListener("click", function () {

    methodePreparationCartes = "GPX";

    // Effacer la sélection manuelle
    groupeRectangleHorsLigne.clearLayers();

    document.getElementById("dimensionsZone").innerHTML =
        "Aucune zone sélectionnée";

    // Effacer les anciennes données GPX
    groupeTraceGPXHorsLigne.clearLayers();
    groupeCorridorGPXHorsLigne.clearLayers();

    lignesGPXHorsLigne = [];

    document.getElementById("infosGPXHorsLigne").innerHTML = "";

    importGPX.style.display = "block";

});

    btnChoixManuel.addEventListener("click", function () {

    methodePreparationCartes = "MANUEL";

    // Effacer les anciennes données GPX
    groupeTraceGPXHorsLigne.clearLayers();
    groupeCorridorGPXHorsLigne.clearLayers();

    lignesGPXHorsLigne = [];

    document.getElementById("infosGPXHorsLigne").innerHTML = "";

    // Réinitialiser le sélecteur de fichier
    document.getElementById("gpxHorsLigne").value = "";

    // Masquer le bloc GPX
    importGPX.style.display = "none";

});

    if (carteHorsLigne) return;

   // Position GPS disponible ou position de secours
const positionInitiale =
    (latitudeGPS !== null && longitudeGPS !== null)
    ? [latitudeGPS, longitudeGPS]
    : [45.896, 4.433];
    carteHorsLigneCentreeGPS =
    (latitudeGPS !== null && longitudeGPS !== null);

carteHorsLigne = L.map('carteHorsLigne').setView(
    positionInitiale,
    15
);

    fondIGNHorsLigne = L.tileLayer(
        'https://data.geopf.fr/wmts?' +
        'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
        '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
        '&STYLE=normal' +
        '&FORMAT=image/png' +
        '&TILEMATRIXSET=PM' +
        '&TILEMATRIX={z}' +
        '&TILEROW={y}' +
        '&TILECOL={x}',
        {
            maxZoom: 19,
            attribution: '© IGN – Géoplateforme'
        }
    );

    fondIGNHorsLigne.addTo(carteHorsLigne);
    ajouterControleEchelle(carteHorsLigne);

    // Groupes d'affichage du parcours GPX et de son corridor

    let groupeTraceGPXHorsLigne = new L.FeatureGroup();
    let groupeCorridorGPXHorsLigne = new L.FeatureGroup();

    carteHorsLigne.addLayer(groupeTraceGPXHorsLigne);
    carteHorsLigne.addLayer(groupeCorridorGPXHorsLigne);

        // Données du parcours GPX hors connexion

        // Méthode de préparation actuellement utilisée
    let methodePreparationCartes = null;

    let lignesGPXHorsLigne = [];
    let corridorGPXHorsLigne = null;

    // Lecture du fichier GPX sélectionné

    document.getElementById("gpxHorsLigne")
        .addEventListener("change", function(event) {

        const fichier = event.target.files[0];

        if (!fichier) return;

        const lecteur = new FileReader();

        lecteur.onload = function(e) {

            const texteGPX = e.target.result;

            const documentGPX = new DOMParser()
                .parseFromString(texteGPX, "application/xml");

            if (documentGPX.querySelector("parsererror")) {
                alert("Le fichier GPX ne peut pas être lu.");
                return;
            }

            lignesGPXHorsLigne = [];

            let distanceTotale = 0;
            let nombrePoints = 0;

            // Lecture des segments de trace

            documentGPX.querySelectorAll("trkseg").forEach(function(segment) {

                const points = [];

                segment.querySelectorAll("trkpt").forEach(function(point) {

                    const latitude = Number(point.getAttribute("lat"));
                    const longitude = Number(point.getAttribute("lon"));

                    if (!Number.isFinite(latitude) ||
                        !Number.isFinite(longitude)) return;

                    points.push([longitude, latitude]);
                });

                if (points.length > 0) {
                    lignesGPXHorsLigne.push(points);
                }
            });

            // Lecture des itinéraires GPX éventuels

            documentGPX.querySelectorAll("rte").forEach(function(route) {

                const points = [];

                route.querySelectorAll("rtept").forEach(function(point) {

                    const latitude = Number(point.getAttribute("lat"));
                    const longitude = Number(point.getAttribute("lon"));

                    if (!Number.isFinite(latitude) ||
                        !Number.isFinite(longitude)) return;

                    points.push([longitude, latitude]);
                });

                if (points.length > 0) {
                    lignesGPXHorsLigne.push(points);
                }
            });

            // Calcul de la distance et du nombre de points

            lignesGPXHorsLigne.forEach(function(ligne) {

                nombrePoints += ligne.length;

                for (let i = 1; i < ligne.length; i++) {

                    const pointPrecedent = L.latLng(
                        ligne[i - 1][1],
                        ligne[i - 1][0]
                    );

                    const pointActuel = L.latLng(
                        ligne[i][1],
                        ligne[i][0]
                    );

                    distanceTotale +=
                        pointPrecedent.distanceTo(pointActuel);
                }
            });

            if (nombrePoints < 2) {
                alert("Le fichier GPX ne contient pas de parcours exploitable.");
                lignesGPXHorsLigne = [];
                return;
            }

           // Affichage des informations du fichier

document.getElementById("infosGPXHorsLigne").innerHTML =
    "<strong>Fichier :</strong> " + fichier.name + "<br>" +
    "<strong>Distance :</strong> " +
    (distanceTotale / 1000).toFixed(1) + " km<br>" +
    "<strong>Nombre de points :</strong> " + nombrePoints;

// Affichage de la trace GPX sur la carte

groupeTraceGPXHorsLigne.clearLayers();

const geoJSONTrace = {
    type: "Feature",
    properties: {},
    geometry: {
        type: lignesGPXHorsLigne.length === 1
            ? "LineString"
            : "MultiLineString",
        coordinates: lignesGPXHorsLigne.length === 1
            ? lignesGPXHorsLigne[0]
            : lignesGPXHorsLigne
    }
};

const coucheTrace = L.geoJSON(geoJSONTrace, {
    style: {
        color: "#0066ff",
        weight: 4,
        opacity: 1
    }
});

groupeTraceGPXHorsLigne.addLayer(coucheTrace);

// Construction du corridor de 300 mètres

groupeCorridorGPXHorsLigne.clearLayers();

corridorGPXHorsLigne = turf.buffer(
    geoJSONTrace,
    300,
    { units: "meters" }
);

// Affichage du corridor sur la carte

const coucheCorridor = L.geoJSON(corridorGPXHorsLigne, {
    style: {
        color: "#3388ff",
        weight: 2,
        opacity: 0.8,
        fillColor: "#66aaff",
        fillOpacity: 0.20
    }
});

groupeCorridorGPXHorsLigne.addLayer(coucheCorridor);

// Cadrage automatique sur le parcours

carteHorsLigne.fitBounds(coucheTrace.getBounds(), {
    padding: [20, 20]
});

        };

        lecteur.readAsText(fichier);

    });

    // Outils de dessin du rectangle de téléchargement

let groupeRectangleHorsLigne = new L.FeatureGroup();

carteHorsLigne.addLayer(groupeRectangleHorsLigne);

let outilsDessin = new L.Control.Draw({

    draw: {
        polygon: false,
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,

        rectangle: {
            shapeOptions: {
                color: '#e53935',
                weight: 2,
                fillOpacity: 0.15
            }
        }
    },

    edit: {
        featureGroup: groupeRectangleHorsLigne
    }

});
carteHorsLigne.addControl(outilsDessin);

// Affichage des dimensions du rectangle

function afficherDimensionsZone(rectangle) {

    const limites = rectangle.getBounds();

    const nordOuest = limites.getNorthWest();
    const nordEst = limites.getNorthEast();
    const sudOuest = limites.getSouthWest();

    const largeur = nordOuest.distanceTo(nordEst) / 1000;
    const hauteur = nordOuest.distanceTo(sudOuest) / 1000;
    const surface = largeur * hauteur;

    document.getElementById("dimensionsZone").innerHTML =
        "Largeur : " + largeur.toFixed(2) + " km<br>" +
        "Hauteur : " + hauteur.toFixed(2) + " km<br>" +
        "Surface : " + surface.toFixed(2) + " km²";
}


// Rectangle créé

carteHorsLigne.on(L.Draw.Event.CREATED, function (e) {

    groupeRectangleHorsLigne.clearLayers();

    groupeRectangleHorsLigne.addLayer(e.layer);

    afficherDimensionsZone(e.layer);
    sauvegarderParametresCartes();

});


// Rectangle modifié ou déplacé

carteHorsLigne.on(L.Draw.Event.EDITED, function (event) {

    event.layers.eachLayer(function (layer) {

        afficherDimensionsZone(layer);
        sauvegarderParametresCartes();

    });

});



// Calcul du nombre de tuiles nécessaires
document.getElementById("btnEstimerCartes")
    .addEventListener("click", function () {

        // Utiliser exactement la même liste que pour le téléchargement
        const listeTuiles = construireListeTuiles();

        if (listeTuiles === null) {
            return;
        }

        const casesZoom = document.querySelectorAll(
            "#choixZoom input[type='checkbox']:checked"
        );

        const totalTuiles = listeTuiles.length;

        let detail =
            "<strong>Estimation du téléchargement :</strong><br>";

        // Détail par niveau de zoom
        casesZoom.forEach(function (caseZoom) {

            const zoom = Number(caseZoom.value);

            const nombreTuiles = listeTuiles.filter(
                function (tuile) {
                    return tuile.zoom === zoom;
                }
            ).length;

            detail +=
                "Zoom " + zoom + " : " +
                nombreTuiles + " tuiles<br>";
        });

        // Estimation du volume
        const volumeKo = totalTuiles * 30;

        let volumeAffiche;

        if (volumeKo >= 1024) {
            volumeAffiche =
                (volumeKo / 1024).toFixed(2) + " Mo";
        } else {
            volumeAffiche = volumeKo + " Ko";
        }

        detail +=
            "<strong>Total : " +
            totalTuiles + " tuiles</strong><br>";

        detail +=
            "Volume estimé : environ " +
            volumeAffiche +
            " (30 Ko par tuile)<br>";

        if (methodePreparationCartes === "GPX") {
            detail +=
                "<small>Calcul effectué sur les tuiles " +
                "intersectant le corridor de 300 mètres " +
                "autour du parcours GPX.</small>";
        } else {
            detail +=
                "<small>Calcul effectué sur la zone manuelle, " +
                "avec la marge de couverture prévue.</small>";
        }

        document.getElementById("resultatEstimation").innerHTML =
            detail;

    });


// Sauvegarder les paramètres de la zone de téléchargement
function sauvegarderParametresCartes() {


    console.log("SAUVEGARDE DES CARTES APPELÉE");

    const rectangles = groupeRectangleHorsLigne.getLayers();

console.log("Nombre de rectangles :", rectangles.length);
console.log("Groupe de rectangles :", groupeRectangleHorsLigne);

    console.log("Nombre de rectangles :", rectangles.length);

   if (rectangles.length === 0) {

    localStorage.removeItem(CLE_SAUVEGARDE_CARTES);

    console.log("Ancienne zone de téléchargement effacée.");

    return;
}

    const limites = rectangles[0].getBounds();

    const casesZoom = document.querySelectorAll(
        "#choixZoom input[type='checkbox']:checked"
    );

    const zooms = Array.from(casesZoom).map(function (caseZoom) {
        return Number(caseZoom.value);
    });

    const sauvegarde = {
        nord: limites.getNorth(),
        sud: limites.getSouth(),
        est: limites.getEast(),
        ouest: limites.getWest(),
        zooms: zooms,
        etat: "en_cours"
    };

    localStorage.setItem(
        CLE_SAUVEGARDE_CARTES,
        JSON.stringify(sauvegarde)
    );
    console.log("Sauvegarde enregistrée :", localStorage.getItem(CLE_SAUVEGARDE_CARTES));
}
    // Construire la liste des tuiles nécessaires
    
function construireListeTuiles() {

    const rectangles = groupeRectangleHorsLigne.getLayers();

let limites = null;

// Préparation en mode GPX
if (methodePreparationCartes === "GPX") {

    if (!corridorGPXHorsLigne) {
        alert("Veuillez d'abord importer un parcours GPX.");
        return null;
    }

    const boiteGPX = turf.bbox(corridorGPXHorsLigne);

    limites = L.latLngBounds(
        [boiteGPX[1], boiteGPX[0]],
        [boiteGPX[3], boiteGPX[2]]
    );

}

// Préparation en mode manuel
else {

    if (rectangles.length === 0) {
        alert("Veuillez d'abord dessiner une zone sur la carte.");
        return null;
    }

    limites = rectangles[0].getBounds();

}


    // Dimensions réelles de la carte
    const dimensions = carteHorsLigne.getSize();

    // Marge de 25 % autour de la zone dessinée
    const margeX = methodePreparationCartes === "MANUEL"
    ? dimensions.x * 0.25
    : 0;

const margeY = methodePreparationCartes === "MANUEL"
    ? dimensions.y * 0.25
    : 0;

    const nordOuest = L.CRS.EPSG3857.latLngToPoint(
        limites.getNorthWest(), 0
    );

    const sudEst = L.CRS.EPSG3857.latLngToPoint(
        limites.getSouthEast(), 0
    );

    const casesZoom = document.querySelectorAll(
        "#choixZoom input[type='checkbox']:checked"
    );

    const listeTuiles = [];

    casesZoom.forEach(function (caseZoom) {

        const zoom = Number(caseZoom.value);
        const facteur = Math.pow(2, zoom);

        const pointNO = {
            x: nordOuest.x * facteur - margeX,
            y: nordOuest.y * facteur - margeY
        };

        const pointSE = {
            x: sudEst.x * facteur + margeX,
            y: sudEst.y * facteur + margeY
        };

        const tuileOuest = Math.floor(pointNO.x / 256);
        const tuileEst = Math.floor(pointSE.x / 256);

        const tuileNord = Math.floor(pointNO.y / 256);
        const tuileSud = Math.floor(pointSE.y / 256);

     for (let x = tuileOuest; x <= tuileEst; x++) {

    for (let y = tuileNord; y <= tuileSud; y++) {

        // En mode GPX, vérifier l'intersection avec le corridor
        if (methodePreparationCartes === "GPX") {

            // Coordonnées géographiques des coins de la tuile
            const coinNO = L.CRS.EPSG3857.pointToLatLng(
                L.point(x * 256, y * 256),
                zoom
            );

            const coinSE = L.CRS.EPSG3857.pointToLatLng(
                L.point((x + 1) * 256, (y + 1) * 256),
                zoom
            );

            // Construire le polygone représentant la tuile
            const polygoneTuile = turf.polygon([[
                [coinNO.lng, coinSE.lat],
                [coinSE.lng, coinSE.lat],
                [coinSE.lng, coinNO.lat],
                [coinNO.lng, coinNO.lat],
                [coinNO.lng, coinSE.lat]
            ]]);

            // Ignorer les tuiles qui ne croisent pas le corridor
            if (!turf.booleanIntersects(
                polygoneTuile,
                corridorGPXHorsLigne
            )) {
                continue;
            }
        }

        const url =
            "https://data.geopf.fr/wmts?" +
            "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2" +
            "&STYLE=normal&FORMAT=image/png" +
            "&TILEMATRIXSET=PM" +
            "&TILEMATRIX=" + zoom +
            "&TILEROW=" + y +
            "&TILECOL=" + x;

        listeTuiles.push({
            zoom: zoom,
            ligne: y,
            colonne: x,
            url: url
        });
    }
}   
    });

    return listeTuiles;
}


// Préparer le téléchargement et vérifier les tuiles existantes

// Demande de mise en pause du téléchargement
document.getElementById("btnPauseCartes")
    .addEventListener("click", function () {

        if (telechargementCartesEnCours) {
            pauseTelechargementCartes = true;

            document.getElementById("progressionCartes").innerHTML +=
                "<br>Pause demandée...";
        }

    });


// Téléchargement des cartes IGN
document.getElementById("btnTelechargerCartes")
    .addEventListener("click", async function () {

        const bouton = this;
        const affichage = document.getElementById("progressionCartes");
        const boutonPause = document.getElementById("btnPauseCartes");

        if (telechargementCartesEnCours) {
            return;
        }

        const liste = construireListeTuiles();

        if (liste === null) {
            return;
        }

        // Sécurité provisoire : limiter le premier essai
        if (liste.length > 1200) {
            affichage.innerHTML =
                "Test limité à 1200 tuiles. Réduisez la zone sélectionnée.";
            return;
        }

        // Avertir si des échelles intermédiaires sont décochées
        const niveauxChoisis = Array.from(
            document.querySelectorAll(
                "#choixZoom input[type='checkbox']:checked"
            )
        ).map(function (caseZoom) {
            return Number(caseZoom.value);
        });

        const niveauxIntermediaires = [15, 16, 17];

        const niveauxManquants = niveauxIntermediaires.filter(
            zoom => !niveauxChoisis.includes(zoom)
        );

        if (niveauxManquants.length > 0) {

            const continuer = confirm(
                "Attention : certaines échelles intermédiaires " +
                "ne sont pas sélectionnées.\n\n" +
                "La carte pourra manquer de détails hors connexion.\n\n" +
                "Voulez-vous continuer malgré tout ?"
            );

            if (!continuer) {
                return;
            }
        }

        // Démarrage du téléchargement
        sauvegarderParametresCartes();
        pauseTelechargementCartes = false;
        telechargementCartesEnCours = true;

        bouton.disabled = true;
        boutonPause.disabled = false;

        let miseEnPause = false;

        try {

            const cache = await caches.open("cdsi69-cartes-v1");

            let dejaPresentes = 0;
            let telechargees = 0;
            let erreurs = 0;
            let detailsErreurs = [];

            // Première vérification : tuiles déjà enregistrées
            for (const tuile of liste) {

                const reponse = await cache.match(tuile.url);

                if (reponse) {
                    dejaPresentes++;
                }
            }

            const aTelecharger = liste.length - dejaPresentes;

            affichage.innerHTML =
                "Tuiles à examiner : " + liste.length + "<br>" +
                "Déjà présentes : " + dejaPresentes + "<br>" +
                "À télécharger : " + aTelecharger;

            // Télécharger uniquement les tuiles manquantes
            for (const tuile of liste) {

                // Vérifier si une pause a été demandée
                if (pauseTelechargementCartes) {

                    miseEnPause = true;

                    affichage.innerHTML +=
                        "<br><strong>Téléchargement mis en pause.</strong>";

                    break;
                }

                const existante = await cache.match(tuile.url);

                if (existante) {
                    continue;
                }

                try {

                    const reponse = await fetch(tuile.url);

                    if (!reponse.ok) {
                        throw new Error("Réponse HTTP " + reponse.status);
                    }

                    await cache.put(tuile.url, reponse.clone());

                    telechargees++;

                } catch (erreur) {

                    erreurs++;

                    detailsErreurs.push(
    "Zoom " + tuile.zoom +
    " : ligne " + tuile.ligne +
    ", colonne " + tuile.colonne
);

                    console.error(
                        "Erreur tuile :",
                        tuile.zoom,
                        tuile.ligne,
                        tuile.colonne,
                        erreur
                    );
                }

                const traitees = dejaPresentes + telechargees + erreurs;

                const pourcentage = Math.round(
                    traitees / liste.length * 100
                );

                affichage.innerHTML =
                    "Progression : " + pourcentage + " %<br>" +
                    "Déjà présentes : " + dejaPresentes + "<br>" +
                    "Téléchargées : " + telechargees + "<br>" +
                    "Erreurs : " + erreurs + "<br>" +
                    "Total traité : " + traitees + " / " + liste.length;

                // Petite pause pour ménager le serveur IGN
                await new Promise(resolve => setTimeout(resolve, 100));
            }


if (erreurs > 0) {
    affichage.innerHTML +=
        "<br><strong>Détail des erreurs :</strong><br>" +
        detailsErreurs.join("<br>");

    if (!miseEnPause) {
        alert(
            erreurs + " tuile(s) n'ont pas pu être téléchargées.\n\n" +
            "Vous pouvez relancer le téléchargement en cliquant à nouveau sur " +
            "\"Télécharger les cartes\".\n\n" +
            "Les tuiles déjà téléchargées seront conservées. " +
            "L'application tentera de récupérer celles qui manquent."
        );
    }
}

if (!miseEnPause) {
    affichage.innerHTML +=
        "<br><strong>Téléchargement terminé.</strong>";
}


        } catch (erreur) {

            affichage.innerHTML =
                "Erreur pendant le téléchargement : " + erreur.message;

            console.error(erreur);

        } finally {

            // Réinitialiser les boutons et les variables
            telechargementCartesEnCours = false;
            pauseTelechargementCartes = false;

            bouton.disabled = false;
            boutonPause.disabled = true;
        }
    });

// Restaurer une précédente préparation de cartes
function restaurerParametresCartes() {

    const donnees = localStorage.getItem(CLE_SAUVEGARDE_CARTES);

    if (!donnees) {
        return;
    }

    let sauvegarde;

    try {
        sauvegarde = JSON.parse(donnees);
    } catch (erreur) {
        console.error("Sauvegarde des cartes illisible :", erreur);
        return;
    }

// Une sauvegarde sans rectangle ne peut pas être restaurée
if (
    sauvegarde.nord === undefined ||
    sauvegarde.sud === undefined ||
    sauvegarde.est === undefined ||
    sauvegarde.ouest === undefined
) {
    localStorage.removeItem(CLE_SAUVEGARDE_CARTES);
    return;
}

    const reprendre = confirm(
        "Une précédente préparation de cartes a été interrompue.\n\n" +
        "Voulez-vous retrouver la zone et les niveaux de zoom sélectionnés ?"
    );

    if (!reprendre) {
        return;
    }

    // Restaurer les niveaux de zoom
    const casesZoom = document.querySelectorAll(
        "#choixZoom input[type='checkbox']"
    );

    casesZoom.forEach(function (caseZoom) {
        caseZoom.checked = sauvegarde.zooms.includes(
            Number(caseZoom.value)
        );
    });

    // Restaurer le rectangle
    const rectangle = L.rectangle(
        [
            [sauvegarde.sud, sauvegarde.ouest],
            [sauvegarde.nord, sauvegarde.est]
        ],
        {
            color: "#e53935",
            weight: 2,
            fillOpacity: 0.15
        }
    );

    groupeRectangleHorsLigne.clearLayers();
    sauvegarderParametresCartes();
    groupeRectangleHorsLigne.addLayer(rectangle);

    // Réafficher les dimensions et la zone
    afficherDimensionsZone(rectangle);
    carteHorsLigne.fitBounds(rectangle.getBounds());
}

// Rechercher une précédente préparation
restaurerParametresCartes();
}

// ============================================
// CONTROLES D'ECHELLE DES CARTES
// ============================================

function ajouterControleEchelle(carteCible) {

    const controleEchelle = L.control({ position: "bottomleft" });

    controleEchelle.onAdd = function () {

        const conteneur = L.DomUtil.create(
            "div",
            "controle-echelle-cdsi69"
        );

        conteneur.style.background = "rgba(255,255,255,0.9)";
        conteneur.style.padding = "5px 8px";
        conteneur.style.borderRadius = "4px";
        conteneur.style.fontSize = "12px";
        conteneur.style.lineHeight = "1.4";

        conteneur.innerHTML = `
            <div class="texte-echelle-cdsi69"></div>
            <div class="barre-echelle-cdsi69"></div>
        `;

        L.DomEvent.disableClickPropagation(conteneur);

        return conteneur;
    };

    controleEchelle.addTo(carteCible);

    function actualiserEchelle() {

        const conteneur = controleEchelle.getContainer();
        if (!conteneur) return;

        const zoom = carteCible.getZoom();

        // Masquer l'échelle aux zooms inférieurs à 10
if (zoom < 10) {
    conteneur.style.display = "none";
    return;
}

conteneur.style.display = "block";

        // Distance réelle représentée par 100 pixels
        const point1 = carteCible.containerPointToLatLng([0, 0]);
        const point2 = carteCible.containerPointToLatLng([100, 0]);

        const distance100px = carteCible.distance(point1, point2);
        const metresParPixel = distance100px / 100;

        // Échelle numérique indicative (écran à 96 dpi)
        const denominateur = metresParPixel * 96 / 0.0254;
        const valeurEchelle = Math.round(denominateur / 1000) * 1000;

        const texte = conteneur.querySelector(".texte-echelle-cdsi69");

        texte.textContent =
            "Niveau zoom " + zoom +
            " - 1/" + valeurEchelle.toLocaleString("fr-FR");

        // Barre graphique proportionnelle
        const barre = conteneur.querySelector(".barre-echelle-cdsi69");

        const distanceBarre = metresParPixel * 100;

        const puissance = Math.pow(
            10,
            Math.floor(Math.log10(distanceBarre))
        );

        const valeurs = [5, 2, 1];
        let distanceChoisie = puissance;

        for (const valeur of valeurs) {
            if (valeur * puissance <= distanceBarre) {
                distanceChoisie = valeur * puissance;
                break;
            }
        }

        const largeurBarre = distanceChoisie / metresParPixel;

        let distanceAffichee;

        if (distanceChoisie >= 1000) {
            distanceAffichee =
                (distanceChoisie / 1000) + " km";
        } else {
            distanceAffichee =
                distanceChoisie + " m";
        }

        barre.style.width = largeurBarre + "px";
        barre.style.height = "auto";
        barre.style.marginTop = "4px";
        barre.style.borderTop = "3px solid #333";
        barre.style.background = "none";
        barre.style.paddingTop = "2px";
        barre.style.fontSize = "11px";
        barre.style.whiteSpace = "nowrap";

        barre.textContent = distanceAffichee;
        barre.title = distanceAffichee;
    }

    carteCible.on("zoomend moveend", actualiserEchelle);

    actualiserEchelle();
}
