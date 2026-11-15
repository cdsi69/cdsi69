// CDSI69 - Service Worker
// Version 1.0

const CACHE_NAME = "cdsi69-v2-4";
const CACHE_CARTES_NAME = "cdsi69-cartes-v1";

const FICHIERS_A_METTRE_EN_CACHE = [

    "./",
    "./index.html",
    "./aide.html",
    "./manifest.json",

    // CSS
    "./css/style.css",
    "./css/leaflet.css",
    "./lib/leaflet.draw-src.css",

    // JavaScript CDSI69
    "./lib/leaflet.draw.js",
    "./js/app.js",
    "./js/carte.js",
    "./js/debug.js",
    "./js/dictee.js",
    "./js/export_GPX.js",
    "./js/export.js",
    "./js/gps.js",
    "./js/gpx.js",
    "./js/jszip.min.js",
    "./js/leaflet.js",
    "./js/leaflet-omnivore.min.js",
    "./js/photos.js",
    "./js/sauvegarde.js",
    "./js/waypoints.js",
    "./js/xlsx.bundle.js",
    "./js/xlsx.full.min.js",

   // Icônes CDSI69
"./icones/icon-192.png",
"./icones/icon-512.png",

// Images Leaflet.draw
"./lib/images/layers.png",
"./lib/images/layers-2x.png",
"./lib/images/marker-icon.png",
"./lib/images/marker-icon-2x.png",
"./lib/images/marker-shadow.png",
"./lib/images/spritesheet.png",
"./lib/images/spritesheet.svg",
"./lib/images/spritesheet-2x.png"

];


// -------------------------------------------------
// INSTALLATION
// -------------------------------------------------

self.addEventListener("install", function(event) {

    self.skipWaiting();

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(function(cache) {

                return cache.addAll(
                    FICHIERS_A_METTRE_EN_CACHE
                );

            })

    );

});


// -------------------------------------------------
// ACTIVATION
// -------------------------------------------------

// -------------------------------------------------
// ACTIVATION
// -------------------------------------------------

self.addEventListener("activate", function(event) {

    event.waitUntil(

        caches.keys().then(function(nomsCaches) {

            return Promise.all(

                nomsCaches.map(function(nomCache) {

                    // Supprimer uniquement les anciennes
                    // versions du cache principal CDSI69

                    if (
                        nomCache.startsWith("cdsi69-v2-") &&
                        nomCache !== CACHE_NAME
                    ) {

                        return caches.delete(nomCache);

                    }

                })

            );

        }).then(function() {

            // Prendre immédiatement le contrôle
            // des pages ouvertes

            return self.clients.claim();

        })

    );

});


// -------------------------------------------------
// INTERCEPTION DES REQUÊTES
// -------------------------------------------------


self.addEventListener("fetch", function(event) {
    

    if (event.request.method !== "GET") {
        return;
    }

    // Identifier les tuiles cartographiques IGN
    const estTuileIGN =
        event.request.url.startsWith("https://data.geopf.fr/wmts");

    // CAS 1 : TUILES CARTOGRAPHIQUES IGN
    if (estTuileIGN) {
        console.log("SERVICE WORKER : demande de tuile IGN", event.request.url);

        event.respondWith(

            caches.open(CACHE_CARTES_NAME)
                .then(function(cache) {

                    // On cherche d'abord la tuile dans le cache IGN
                    return cache.match(event.request)
                        .then(function(reponseCache) {

                            if (reponseCache) {
                                return reponseCache;
                            }

                            // Tuile absente : demande au réseau
                            return fetch(event.request)
                                .then(function(reponseReseau) {

                                    if (reponseReseau && reponseReseau.ok) {

                                        cache.put(
                                            event.request,
                                            reponseReseau.clone()
                                        );
                                    }

                                    return reponseReseau;
                                });
                        });
                })
        );

        return;
    }

    // CAS 2 : FICHIERS DE L'APPLICATION CDSI69
    event.respondWith(

        // On essaie d'abord le réseau
        fetch(event.request)

            .then(function(reponseReseau) {

                // Si la réponse est correcte,
                // on met à jour le cache de l'application
                if (reponseReseau && reponseReseau.ok) {

                    const copieReponse =
                        reponseReseau.clone();

                    caches.open(CACHE_NAME)
                        .then(function(cache) {

                            cache.put(
                                event.request,
                                copieReponse
                            );

                        });
                }

                return reponseReseau;
            })

            .catch(function() {

                // Pas de réseau :
                // on utilise la version en cache
                return caches.match(event.request)

                    .then(function(reponseCache) {

                        if (reponseCache) {
                            return reponseCache;
                        }

                        // Pour la navigation hors connexion,
                        // retour à la page principale
                        if (event.request.mode === "navigate") {

                            return caches.match("./index.html");
                        }
                    });
            })
    );
});
