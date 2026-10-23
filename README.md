# Hard-Ship — prototype 0.1

Premier prototype jouable dans un navigateur : carte compartimentée, équipage, sélection RTS, ordres de déplacement, pathfinding A*, caméra et horloge avec pause et accélération.

## Installation
Node.js 20+ requis.

```bash
npm install
npm run dev
```

Ouvrir l'adresse locale indiquée par Vite (habituellement http://localhost:5173).

## Contrôles
- Clic gauche : sélectionner un personnage
- Glisser avec clic gauche : sélectionner plusieurs personnages
- Maj + clic : ajouter à la sélection
- Clic droit : ordonner un déplacement
- ZQSD ou flèches : déplacer la caméra
- Molette : zoomer
- Espace : pause/reprise
- Boutons en haut : pause, x1, x2, x4

## État actuel
Implémentés : rendu 2D, salles et portes, collisions sur grille, sélection multiple, déplacement A*, temps simulé.
Gestion disponible : stock de nourriture, consommation de l’équipage et production d’une serre avec affectation manuelle.
Non implémentés : autres ressources réelles, IA de travail, besoins individuels, exploration planétaire, navigation, expéditions.

## Architecture
`src/core` contient la logique du monde et le pathfinding.
`src/render` contient le rendu Phaser.
`src/main.tsx` contient les panneaux React.

`src/core/simulation.ts` fait avancer l'horloge et les déplacements sans dépendre de Phaser, React ou du navigateur. L'application pilote ce moteur avec un minuteur unique ; Phaser affiche les positions et traite les interactions. Les notifications du monde utilisent des abonnements indépendants du DOM.

Le moteur reçoit une durée en millisecondes et applique la vitesse globale (pause, ×1, ×2, ×4). Un déplacement reste cadencé à une case toutes les 250 ms de jeu. Le pilote navigateur limite chaque mise à jour à 100 ms pour éviter un rattrapage brutal après une longue suspension ; ce jalon n'ajoute pas de progression hors ligne.

## Validation du moteur

Avec les dépendances installées et Node.js 20+ :

```bash
node --test tests/*.test.mjs
npm run build
```

Les tests vérifient les vitesses, la pause avec conservation du temps partiel, les changements de vitesse, l'indépendance du découpage temporel et l'arrivée à destination. Ils exécutent le moteur sans navigateur.

Pour un essai manuel : sélectionner l'équipage, donner un ordre par clic droit, mettre en pause pendant le déplacement puis reprendre aux différentes vitesses. L'horloge et les personnages doivent s'arrêter et repartir ensemble ; le statut « Disponible » doit revenir dès l'arrivée. Vérifier aussi le zoom, le centrage et le déplacement de caméra.

## Première boucle de gestion : nourriture

- Le stock commence à 30 rations, avec une capacité de 100.
- Chaque membre consomme 3 rations par minute de jeu, soit 9 pour l’équipage initial.
- Dans le panneau **SERRE**, affecter un membre : il rejoint automatiquement son poste. La production commence uniquement une fois arrivé et immobile à l’intérieur de la serre.
- La serre dispose d’un poste et produit 18 rations par minute de jeu, soit un bilan de +9 avec les trois membres initiaux. Changer l’affectation remplace le travailleur précédent.
- Choisir « Aucun » libère le poste et arrête le trajet de son travailleur. Un ordre manuel de déplacement à ce membre annule également son affectation.
- La pause et les vitesses s’appliquent aux ressources comme aux déplacements. Les seuils de 5 et 0 rations déclenchent des alertes ; le stock reste entre 0 et 100. Il n’y a pas encore de conséquence de la famine. La partie est sauvegardée localement.

Essai conseillé : observer le stock diminuer sans affectation ; sélectionner Maya dans le panneau SERRE ; passer en ×4 et attendre son arrivée pour voir le stock augmenter. Mettre en pause pour vérifier que le stock se fige, puis donner un ordre manuel à Maya pour interrompre son travail. Les taux sont provisoires et affichés par minute de jeu.


## Persistance de la partie solo

La partie est enregistrée dans **IndexedDB**, base `hard-ship`, schéma de stockage version 1. Les collections `crew`, `rooms`, `installations` et `resources` contiennent les entités avec leurs identifiants stables ; `world` contient l’horloge, la vitesse, le journal, l’ordre des entités et les fractions de temps du moteur. Les positions, chemins restants et affectations sont conservés. La géométrie des salles est persistée ; les collisions et objets visuels Phaser sont reconstruits au chargement.

- Le chargement termine avant de créer la scène ou démarrer la simulation.
- Sauvegarde automatique toutes les deux secondes lorsque l’état a changé, plus un bouton **Sauvegarder**.
- À la fermeture ou au masquage, un point de reprise synchrone dans `localStorage` complète IndexedDB : le navigateur ne garantit pas de terminer une écriture asynchrone en quittant. Au prochain lancement, ce point est restauré s’il est plus récent. Un arrêt brutal du navigateur ou de la machine peut perdre les changements depuis la dernière sauvegarde terminée.
- **Aucune progression hors du jeu** : le temps civil n’est jamais utilisé pour simuler l’absence. Le jeu est également figé quand l’onglet est masqué ; il reprend à sa vitesse sauvegardée quand il redevient visible.
- Un verrou navigateur protège la partie contre les écritures concurrentes d’un second onglet. Un navigateur récent sur `localhost` ou HTTPS est requis.
- **Exporter** télécharge un JSON complet ; **Importer** restaure ce fichier et remplace la partie courante. Exporter avant un import pour garder une copie.
- Les données restent dans le navigateur, pour la même origine (protocole, adresse et port). Elles ne sont envoyées ni à GitHub ni à un serveur et peuvent être effacées avec les données du site. L’export permet de déplacer la partie entre navigateurs ou ordinateurs.

`src/persistence/format.ts` définit et valide le format de sauvegarde version 1. C’est le point d’entrée des futures migrations : une nouvelle version devra convertir les anciennes données avant validation. Une version inconnue ou un contenu incohérent est refusé sans effacer la sauvegarde. En cas d’échec au démarrage, une copie exportée valide peut être importée depuis l’écran d’erreur. Toutes les collections sont écrites dans une même transaction IndexedDB ; une erreur annule l’ensemble.

### Vérification dans un vrai navigateur

Les tests Node couvrent le format, les références entre entités, les données invalides et la reprise exacte du moteur, y compris les fractions de temps. Des tests d’intégration utilisent le vrai IndexedDB de Chromium :

```bash
# Dans un terminal, démarrer Vite :
npm run dev
# Dans un autre terminal, avec Python et Playwright installés :
python tests/browser_persistence.py
```

Le script attend Chromium à `/usr/bin/chromium` ; utiliser `CHROMIUM_PATH` pour un autre chemin et `HARD_SHIP_TEST_URL` pour un autre serveur Vite. Il utilise des profils de test isolés et vérifie l’enregistrement automatique, les rechargements, la fermeture, le gel hors du jeu, l’export/import, le second onglet, l’annulation d’une transaction en échec et la restauration d’une sauvegarde valide après détection de corruption.

Essai manuel : mettre en pause, affecter Maya à la serre, sauvegarder puis recharger. Son trajet, son affectation, le stock et l’horloge doivent rester identiques. Reprendre en ×4, fermer le jeu, attendre, puis rouvrir à la même adresse : seule la période pendant laquelle le jeu est ouvert et visible fait avancer la simulation.
