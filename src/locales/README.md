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
