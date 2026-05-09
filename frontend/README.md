# Frontend

Den här mappen innehåller en statisk testsida för projektets frontend.

## Testa direkt i webbläsaren via GitHub

Den publika GitHub Pages-länken för det här repot är:

<https://digmodel.github.io/main/>

GitHub Pages kan bara aktiveras för det här repot när repot är publikt, eller om kontot/organisationen har en plan som stödjer Pages för privata repositories. Om GitHub visar meddelandet **"Upgrade or make this repository public to enable Pages"** behöver du göra repot publikt eller uppgradera innan länken ovan börjar fungera.

När Pages är tillgängligt publiceras innehållet i `frontend/` automatiskt av workflowt **Deploy frontend to GitHub Pages** efter merge till `main`.

### Aktivera Pages när repot är publikt

1. Gå till repositoryts **Settings → Pages**.
2. Välj **GitHub Actions** som källa om det inte redan är aktiverat.
3. Kör workflowt **Deploy frontend to GitHub Pages** manuellt, eller merga en ändring till `main`.
4. Öppna <https://digmodel.github.io/main/> när deployen är klar.

## Testa lokalt vid behov

Om du ändå vill testa utan GitHub Pages kan du starta en enkel statisk server från projektroten:

```bash
python3 -m http.server 8000
```

Öppna sedan sidan i webbläsaren:

<http://localhost:8000/frontend/index.html>
