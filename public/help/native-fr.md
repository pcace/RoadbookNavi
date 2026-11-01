# Aide et documentation

## Données locales

Lors du calcul d’un itinéraire, RoadbookNavi télécharge automatiquement les
segments de routage BRouter et les tuiles OpenFreeMap manquants pour dessiner
les intersections. Ces données sont stockées sur l’appareil et réutilisées pour
les prochains roadbooks. Les roadbooks enregistrés et les données de routage
déjà téléchargées restent disponibles sans connexion. Un itinéraire dans une
nouvelle zone et la carte en ligne nécessitent une connexion.

## Planification des roadbooks

Ajoutez, déplacez ou supprimez des points de passage sur la carte. Les profils de
routage déterminent le tracé. Vous pouvez compléter les profils Enduro fournis
avec vos propres fichiers `.brf` dans les paramètres.

Ces vidéos ont été enregistrées dans la version web ; certains menus et styles
de carte diffèrent dans l’application installée.

### Profils de routage

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/routeprofiles.mp4" type="video/mp4"></video>

### Modification des points de passage

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/movecreatedelete.mp4" type="video/mp4"></video>

### Recherche d’adresses

Lancez une recherche avec la touche Entrée ou le bouton de recherche. La recherche
d’adresses nécessite un fournisseur en ligne ; vous pouvez toujours placer des
points de passage directement sur la carte.

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/adresssearch.mp4" type="video/mp4"></video>

### Revêtements

Les segments colorés utilisent les attributs BRouter/OSM. Si `surface` est absent,
le revêtement est déduit de `tracktype` et de la catégorie de voie, comme dans
la version web. Un revêtement inconnu ne signifie pas un parcours hors route.

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/analysis.mp4" type="video/mp4"></video>

### Roadbooks existants

Sélectionnez un roadbook enregistré dans le planificateur pour le modifier.
Filtrez la liste par nom et triez-la par date, nom ou distance. La date est celle
de la dernière modification ; les distances inconnues sont placées en dernier.

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/loadRoadbook.mp4" type="video/mp4"></video>

## Navigation et exportation

La navigation utilise un PDF en rouleau continu. Configurez le suivi automatique,
le défilement case par case ou continu et les touches dans les paramètres.

**Enregistrer** dans la liste des roadbooks propose RN2, GPX, GeoJSON, PDF A5 et
PDF en rouleau. Le RN2 conserve les dessins et permet de partager les roadbooks
sous forme de fichiers. GPX et GeoJSON contiennent le tracé. Utilisez
**Ouvrir (.rn2)** pour importer un fichier reçu.
