# Ingredient Part Scaler

A lightweight web app to scale a recipe based on ingredient “parts” and optionally available amounts you actually have on hand.

## Features

- Add / edit / delete ingredients
- Two scaling modes:
  - **Single Ingredient:** Pick one ingredient; its “Available” amount sets the scale.
  - **Limit Mode:** Enter availability for any number of ingredients; the smallest feasible scale is used (limiting reagent concept).
- Rounding options (none, 0–3 decimals)
- Auto-recalculate (toggle) or manual recalc button
- LocalStorage persistence (auto-saves after edits)
- Export / Import JSON (shareable / portable)
- Clear saved state & reset to example
- Responsive, no external dependencies

## Math

For original recipe parts \( P_i \):

- If scaling from a single ingredient \( k \):
  \[
    s = \frac{A_k}{P_k}, \quad \text{Needed amount for } i: N_i = s \cdot P_i
  \]

- In limit mode with availability for a subset \( S \):
  \[
    s = \min_{j \in S} \frac{A_j}{P_j}
  \]
  Then \( N_i = s \cdot P_i \) for all i.

Leftover for ingredient \( j \) (if availability specified):
\[
  L_j = A_j - N_j
\]

If \( L_j \approx 0 \) (within a tiny tolerance), that ingredient is *limiting*.

## Quick Start

1. Clone or copy files into your repository (e.g. `c16gxy0/Ingredient-checker`).
2. Open `index.html` in a browser.
3. Edit ingredients, enter an **Available** amount, choose mode.
4. Optionally export JSON to save your setup.

## File Structure

```
index.html
css/
  styles.css
js/
  app.js
  utils.js
  storage.js
README.md
LICENSE
```

## Import / Export Format

Example export:

```json
{
  "version": 1,
  "mode": "limit",
  "rounding": "2",
  "baseIngredientId": "b7e0...",
  "autoCalc": true,
  "ingredients": [
    { "id": "b7e0...", "name": "Chicken", "parts": 50, "available": 300 },
    { "id": "c11a...", "name": "Cream Cheese", "parts": 23, "available": 100 },
    { "id": "d51b...", "name": "Oat Flour", "parts": 17, "available": 120 }
  ]
}
```

## Possible Enhancements

- Percentage column (% of total)
- Density conversions (ml ↔ g)
- Nutrition API integration
- Batch history
- Progressive Web App (offline manifest)
- Drag-and-drop reordering
- Unit groups / categories

## License

MIT – see [LICENSE](LICENSE).

## Contributing

Submit issues or PRs for improvements. If you’d like me (Copilot) to open a PR automatically, just ask:
> Open a PR adding the scaler to c16gxy0/Ingredient-checker

Enjoy building!
