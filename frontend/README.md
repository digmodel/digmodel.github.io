# Frontend

Den här mappen innehåller en statisk testsida för projektets frontend.

## Testa direkt i webbläsaren via GitHub

Den publika GitHub Pages-länken för det här repot är:

<https://digmodel.github.io/>

GitHub Pages kan bara aktiveras för det här repot när repot är publikt, eller om kontot/organisationen har en plan som stödjer Pages för privata repositories. Om GitHub visar meddelandet **"Upgrade or make this repository public to enable Pages"** behöver du göra repot publikt eller uppgradera innan länken ovan börjar fungera.

Workflowt **Deploy frontend to GitHub Pages** försöker nu även aktivera GitHub Pages automatiskt med GitHub Actions som källa. Om GitHub fortfarande stoppar deployen behöver repot göras publikt eller kontot/organisationen använda en plan som stödjer Pages för privata repositories.

### Aktivera Pages när repot är publikt

1. Gör repot publikt om GitHub Pages fortfarande är blockerat.
2. Kör workflowt **Deploy frontend to GitHub Pages** manuellt, eller merga en ändring till `main`.
3. Om workflowt lyckas, öppna <https://digmodel.github.io/> när deployen är klar.
4. Om workflowt fortfarande misslyckas i steget **Configure GitHub Pages**, kontrollera **Settings → Pages** och repo-/planbegränsningen i GitHub.

## Testa lokalt vid behov

Om du ändå vill testa utan GitHub Pages kan du starta en enkel statisk server från projektroten:

```bash
python3 -m http.server 8000
```

Öppna sedan sidan i webbläsaren:

<http://localhost:8000/frontend/index.html>
