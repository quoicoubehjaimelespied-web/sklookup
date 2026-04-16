const express = require('express');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Configurer les sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'un-secret-par-defaut-pour-le-dev',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Mettre à true si tu utilises HTTPS plus tard
}));

app.use(express.json());
app.use(express.static(__dirname));

// FORCER L'AFFICHAGE DE L'ACCUEIL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html', (err) => {
        if (err) {
            console.log("❌ ERREUR : index.html introuvable !");
            res.status(404).send("Erreur : Fichier index.html introuvable.");
        }
    });
});

// 1. CONNEXION DISCORD
app.get('/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Erreur de connexion Discord.');

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
                scope: 'identify',
            }).toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokenData = await tokenResponse.json();
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` }
        });

        const userData = await userResponse.json();
        req.session.user = userData;
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.send('Erreur lors de la communication avec Discord.');
    }
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// 2. LA RECHERCHE API
app.post('/api/search', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Non autorisé. Connectez-vous avec Discord." });
    }

    const { query } = req.body;
    try {
        const dbResponse = await fetch(`${process.env.API_DB_URL}?q=${encodeURIComponent(query)}`);
        const data = await dbResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Erreur API:", error);
        res.status(500).json({ error: "Erreur lors de la recherche." });
    }
});

// LANCEMENT DU SERVEUR (Une seule déclaration de PORT)
const PORT = process.env.PORT || 3000;
app.get('/auth/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Serveur S&K lancé sur : http://localhost:${PORT}`);
    console.log(`🚀 Prêt pour le déploiement !`);
});