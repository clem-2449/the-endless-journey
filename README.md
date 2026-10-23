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
Non implémentés : autres ressources réelles, sauvegarde, IA de travail, besoins individuels, exploration planétaire, navigation, expéditions.

## Architecture
`src/core` contient la logique du monde et le pathfinding.
`src/render` contient le rendu Phaser.
`src/main.tsx` contient les panneaux React.

`src/core/simulation.ts` fait avancer l'horloge et les déplacements sans dépendre de Phaser, React ou du navigateur. L'application pilote ce moteur avec un minuteur unique ; Phaser affiche les positions et traite les interactions. Les notifications du monde utilisent des abonnements indépendants du DOM.

Le moteur reçoit une durée en millisecondes et applique la vitesse globale (pause, ×1, ×2, ×4). Un déplacement reste cadencé à une case toutes les 250 ms de jeu. Le pilote navigateur limite chaque mise à jour à 100 ms pour éviter un rattrapage brutal après une longue suspension ; ce jalon n'ajoute pas de progression hors ligne.

## Validation du moteur

Avec les dépendances installées et Node.js 20+ :

```bash
node --test tests/simulation.test.mjs
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
- La pause et les vitesses s’appliquent aux ressources comme aux déplacements. Les seuils de 5 et 0 rations déclenchent des alertes ; le stock reste entre 0 et 100. Il n’y a pas encore de conséquence de la famine ni de sauvegarde : recharger réinitialise la partie.

Essai conseillé : observer le stock diminuer sans affectation ; sélectionner Maya dans le panneau SERRE ; passer en ×4 et attendre son arrivée pour voir le stock augmenter. Mettre en pause pour vérifier que le stock se fige, puis donner un ordre manuel à Maya pour interrompre son travail. Les taux sont provisoires et affichés par minute de jeu.
