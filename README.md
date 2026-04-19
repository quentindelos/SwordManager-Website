# 🗡️ SwordManager-Website

> Repo officiel du site web SwordManager.

## 🛠️ Configuration du Backend

### 1. Prérequis
* **Node.js** (v16+) installé
* Une instance **PostgreSQL** active

### 2. Installation des dépendances
Lancez la commande suivante à la racine du projet pour installer les modules nécessaires :

```bash
npm install
```

### 3. Variables d'environnement

Le backend utilise un fichier ``.env`` pour gérer la connexion à la base de données et la sécurité.

Créez un fichier **.env** à la racine et collez-y ceci :

```
# --- Configuration PostgreSQL ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bitwarden_db
DB_USER=admin
DB_PASS=admin

# --- Sécurité & Serveur ---
JWT_SECRET=une_cle_tres_longue_et_aleatoire
PORT=8080
```

> **Note** : Le serveur écoutera sur le port défini par la variable PORT (par défaut 3000).

## 🚀 Lancement

Pour démarrer le serveur en mode production :
```bash
npm start
```

## 📝 Fonctionnalités
- 🔐 Authentification : Sécurisée via JSON Web Tokens (JWT).
- 🗄️ Base de données : Gestion complète sous PostgreSQL.
- 🌐 API REST : Architecture propre pour l'interface SwordManager.
