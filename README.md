# Scraping proof of concept

do `npm install` first to install the libraries.
run w/ `node scrape.js`.

Output files:

- `OUTPUT.json` (has all the extracted text content)
- `FETCHED_HTML/` (directory w/ fetched HTML for debugging)

i included the `output/` directory w/ `git add -f output/` so if you just wanna see results
just look there. Normally that shouldn't be committed tho.

### stuff used :p

- jsdom: convert html fetched w/ a regular ol' `fetch(url)` into a DOM object.

> WHY? the @mozilla/readability library parses text content from a DOM object.

- @mozilla/readability: convert DOM of the website into a Readability object (which has
  other properties, but what we care about is textContent)
