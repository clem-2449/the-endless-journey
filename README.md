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
Non implémentés : ressources réelles, sauvegarde, IA de travail, exploration planétaire, navigation, expéditions.

## Architecture
`src/core` contient la logique du monde et le pathfinding.
`src/render` contient le rendu Phaser.
`src/main.tsx` contient les panneaux React.

La simulation de déplacement est pour le moment cadencée dans Phaser ; elle sera extraite dans un moteur indépendant avant d'ajouter les systèmes persistants.
