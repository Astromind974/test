# 🤝 Guide de contribution

Merci de l'intérêt que vous portez à ce projet ! Toutes les contributions sont les bienvenues, qu'il s'agisse de corrections de bugs, de nouvelles fonctionnalités, ou d'améliorations de la documentation.

---

## 📋 Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Signaler un bug](#signaler-un-bug)
- [Proposer une fonctionnalité](#proposer-une-fonctionnalité)
- [Soumettre une Pull Request](#soumettre-une-pull-request)
- [Convention de commits](#convention-de-commits)

---

## Code de conduite

En participant à ce projet, vous vous engagez à respecter le [Code de conduite](CODE_OF_CONDUCT.md).

---

## Comment contribuer

1. **Fork** ce dépôt
2. **Clonez** votre fork localement :
   ```bash
   git clone https://github.com/VOTRE-PSEUDO/test.git
   cd test
   ```
3. **Créez une branche** descriptive :
   ```bash
   git checkout -b fix/correction-du-bug
   # ou
   git checkout -b feature/nouvelle-fonctionnalite
   ```
4. **Faites vos modifications** en suivant les conventions du projet
5. **Testez** vos changements
6. **Committez** avec un message clair (voir [Convention de commits](#convention-de-commits))
7. **Poussez** votre branche :
   ```bash
   git push origin feature/nouvelle-fonctionnalite
   ```
8. **Ouvrez une Pull Request** sur ce dépôt

---

## Signaler un bug

Avant de signaler un bug, vérifiez qu'il n'existe pas déjà dans les [issues ouvertes](https://github.com/Astromind974/test/issues).

Si le bug n'est pas encore signalé, [créez une issue](https://github.com/Astromind974/test/issues/new?template=bug_report.md) en utilisant le modèle **Bug Report** et en fournissant :
- Une description claire du problème
- Les étapes pour reproduire
- Le comportement attendu vs observé
- Votre environnement (OS, version, etc.)

---

## Proposer une fonctionnalité

[Créez une issue](https://github.com/Astromind974/test/issues/new?template=feature_request.md) en utilisant le modèle **Feature Request** et en décrivant :
- Le problème que la fonctionnalité résoudrait
- La solution proposée
- Les alternatives envisagées

---

## Soumettre une Pull Request

- Une PR = un sujet (bug ou fonctionnalité)
- Référencez l'issue associée dans la description (`Closes #42`)
- Assurez-vous que les tests passent
- Mettez à jour la documentation si nécessaire
- Soyez prêt à répondre aux retours des reviewers

---

## Convention de commits

Ce projet suit la convention [Conventional Commits](https://www.conventionalcommits.org/fr/) :

| Préfixe     | Usage                                          |
|-------------|------------------------------------------------|
| `feat:`     | Nouvelle fonctionnalité                        |
| `fix:`      | Correction de bug                              |
| `docs:`     | Modification de documentation                  |
| `style:`    | Formatage, pas de changement de logique        |
| `refactor:` | Refactorisation sans correction ni fonctionnalité |
| `test:`     | Ajout ou modification de tests                 |
| `chore:`    | Tâches de maintenance (CI, dépendances, etc.)  |

**Exemples :**
```
feat: ajouter la page de connexion
fix: corriger le calcul du total du panier
docs: mettre à jour le guide d'installation
```
