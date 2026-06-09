# Tehtävälista ✦

Premium-luokan tehtävälistasovellus — suomeksi, PWA-valmis, ei frameworkkeja.

## Käynnistys

Koska sovellus käyttää ES-moduuleja (`type="module"`), se **ei toimi suoraan avaamalla `index.html`** tiedostojärjestelmästä. Tarvitset pienen paikallisen web-palvelimen.

### Vaihtoehto 1 — VS Code Live Server
1. Asenna **Live Server** -laajennus VS Codeen
2. Avaa projekti VS Codessa
3. Klikkaa "Go Live" oikeassa alakulmassa

### Vaihtoehto 2 — Node.js http-server
```bash
npx http-server . -p 8080 -c-1
# Avaa: http://localhost:8080
```

### Vaihtoehto 3 — Python
```bash
python -m http.server 8080
# Avaa: http://localhost:8080
```

## GitHub Pages -julkaisu

1. Luo GitHub-repositorio (esim. nimellä `to-do-lista`)
2. Siirrä **kaikki tämän kansion tiedostot** repositorion juureen
3. Mene Settings → Pages → Branch: `main` / `root` → Save
4. Sovellus on käytettävissä osoitteessa `https://<käyttäjänimi>.github.io/<repo>/`

**Kaikki polut ovat suhteellisia**, joten sovellus toimii sellaisenaan myös alikansiosta (esim. `/to-do-lista/`) — mitään ei tarvitse muokata. Mukana on myös `.nojekyll`-tiedosto, joka estää GitHubin Jekyll-käsittelyn.

> Huom: jos päivität sovellusta myöhemmin etkä näe muutoksia, kyse on service workerin välimuistista. Nosta `sw.js`:n `CACHE_NAME`-versiota (esim. `tehtavalista-v2` → `-v3`), niin selain hakee uudet tiedostot.

## Ikonien luonti

Ikonit (`icons/icon-192.png` ja `icons/icon-512.png`) on luotu automaattisesti. Jos haluat tehdä ne uudelleen tyylikkäämpinä:

1. Avaa `generate-icons.html` selaimessa
2. Klikkaa tallennusnappit → tallenna tiedostot `icons/`-kansioon

## Tiedostorakenne

```
index.html          — Sovelluksen HTML-runko
styles.css          — Kaikki tyylit (dark mode, animaatiot)
app.js              — Päälogiikka (UI, state, renderöinti)
icons.js            — Inline-SVG-ikonijärjestelmä
storage.js          — Tallennuskerros (localStorage → Supabase-valmis)
notifications.js    — Selaimen ilmoitukset
suggestions.js      — Älykkäät ehdotukset (offline, sääntöpohjainen)
sw.js               — Service Worker (PWA, offline)
manifest.json       — PWA-manifesti
.nojekyll           — Estää GitHubin Jekyll-käsittelyn
icons/              — PWA-ikonit (icon-192.png, icon-512.png, icon-192.svg)
generate-icons.html — Apusivu ikonien generointiin (valinnainen)
```

## Supabase-integraatio (myöhemmin)

Tietovarastokerros (`storage.js`) on rakennettu niin, että Supabase lisätään minimaalisten muutosten avulla:

1. Lisää Supabase-kirjasto `index.html`-tiedostoon
2. Korvaa `storage.js`:n `// SUPABASE:`-merkinnät Supabase-kutsuilla
3. Lisää autentikointi (esim. Magic Link tai OAuth)
4. Päivitä `settings.cloudStatus` vastaamaan todellista synkronointitilaa

## Ominaisuudet

- ✅ Tehtävien lisäys, muokkaus, poisto (kumoa-toiminto)
- 🔁 Toistuvat tehtävät (päivittäin / viikoittain / kuukausittain)
- 📁 Projektit ja kategoriat (värikoodatut, muokattavat)
- ⭐ Prioriteetit (korkea / keski / matala)
- 📅 Eräpäivät ja kellonajat
- ⏰ Selaimen ilmoitukset (Notification API)
- 🔍 Haku ja suodatus
- 📎 Liitteet (base64, localStorage)
- 📊 Tilastot ja edistymiskaaviot
- 🔥 Päivittäinen putki (streak)
- 🌙 Tumma tila (system/manual)
- ☁️ Pilvisynkronointi-UI (valmis backendille)
- 💡 Älykkäät kategoriaehdotukset
- 📱 PWA (asennettavissa, offline-tuki)
- 🇫🇮 Täysin suomenkielinen
