# SpotFinder translations

Each language has one `translations_<code>.js` file. The small
`translations.js` file registers those files and defines the language choices
shown in Settings. English (`translations_en.js`) is the source catalog.

`LanguageContext` uses an English value only when the selected locale has no
translation for a key. A locale marked **Partial** in Settings still contains
English UI text. Do not remove that label until its app screens have been
reviewed in that language.

The FAQ, About/feedback content, and the Terms, Privacy, Cookie and Refund
policy bodies have Czech and Polish draft translations. Other languages still
fall back to English for these longer pages. Policy notices identify which
text is untranslated and which draft translation still needs legal review.
Do not treat draft translations as approved policy text or publish new legal
promises by copying another locale.

On a first visit the app reads the browser's language preference list. A
saved manual selection wins on later visits. Region choices for Belgium,
Moldova, Kosovo and Cyprus use their actual languages rather than assuming a
country has one language. No GPS or IP lookup is used for this selection.

When adding copy, put the English key in `translations_en.js`, translate it in
the relevant locale files, and run `node --test tests/translations.test.js`.

Run `npm run i18n:check` to regenerate `reports/i18n-coverage.md` and the full
key inventory in `reports/i18n-issues.json`. The report
lists missing keys, placeholder mismatches, duplicate keys, identical values,
namespace coverage, and likely hardcoded UI text. `npm run i18n:check -- --strict`
exits unsuccessfully while issues remain. Catalog coverage is not screen
coverage; review the hardcoded candidates before claiming a locale is complete.

`npm run i18n:generate -- --locale=cs` is a network-free dry run. To request
Azure suggestions, set `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION` in
your local environment and add `--execute`. Suggestions go to a review JSON
file under `reports/`; adding `--write` also inserts missing suggestions into
the catalog. Review every suggestion and the source diff before committing.
The optional `AZURE_TRANSLATOR_ENDPOINT` must use HTTPS. Never use `VITE_`
credentials. Generation excludes legal drafts and existing translations and
is never part of build or deployment. Character counts are printed before
requests; actual quota and price depend on the Azure subscription.
