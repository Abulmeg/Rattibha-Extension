# Rattibha Learn

A browser extension that makes JUST eLearning easier to use.

I started working on this because I was tired of opening the same course pages, scrolling through weeks, and hunting for a file I knew was there. The university system already has the content; I just wanted a cleaner way to get to it.

Rattibha Learn runs on top of [JUST eLearning](https://elearn.just.edu.jo/current/my/courses.php). It uses your existing university session, so there's no separate account to make.

## What it does

- Puts your courses in one list. If a subject has separate **My Section** and **All Sections** pages, you can switch between them.
- Makes weekly materials easier to browse and search.
- Opens supported PDFs in the page, with download and original-link options. Other course files download normally.
- Gives you quicker access to announcements and eLearning messages.
- Adds a task list, focus timer, and saved/recently opened materials.
- Includes a local file converter for common document formats.
- Has light and dark themes with selectable accent colors.

The idea isn't to recreate the university's backend. Anything official, such as grades, quizzes and assignment submissions, stays on the original eLearning pages.

## Install it

Until the store listings are approved, you can install it manually:

1. Download the source ZIP from a release and extract it.
2. Open `chrome://extensions`, `edge://extensions`, or `opera://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the folder that contains `manifest.json`.
5. Open [JUST eLearning](https://elearn.just.edu.jo/current/my/courses.php).

If you installed an older copy, disable it first so both versions don't run together.

## A few things to know

This is still a work in progress. JUST's eLearning site is based on Moodle, and some course pages are built differently from others. If a file or activity can't be opened in the extension, use **Original website** to open it through JUST.

The PDF converter is for quick study copies, not perfect Office formatting. PowerPoint effects and complex layouts may change, and PDFs it creates currently contain rendered pages rather than selectable text. Files selected in **Convert** are processed in your browser.

### Privacy

Rattibha Learn reads course information and, when you use chat, messages from the eLearning session you're already signed into. Tasks, bookmarks, appearance settings and recent items are saved locally in the browser. It doesn't ask for your university password or use a separate analytics service.

[Extension privacy policy](PRIVACY.md)

## Development

It's plain JavaScript, HTML and CSS, so there is no build step. The main code is in `content.js` and `styles.css`; the background script handles user-requested downloads, and `file-tools.js` / `pdf-generator.js` handle local conversion.

The extension includes [JSZip](https://stuk.github.io/jszip/) as a third-party dependency. Its license notices are in `vendor/JSZip-LICENSE.md`.

To test changes locally, reload the unpacked extension from your browser's Extensions page. For the automated checks, use the scripts in `tests/` (Python + Playwright for browser tests, Node.js for the download-worker test).

## Contributing

If you find a bug or have an idea, open an issue. Pull requests are welcome too. There's a short [contributing guide](CONTRIBUTING.md) with the basics.

If you're sharing screenshots or logs, please hide student names, messages, IDs, marks and other personal information.

## License

MIT — see [LICENSE](LICENSE).

Made by [Abulmeg](https://github.com/Abulmeg). Independent student project; not affiliated with or endorsed by JUST.
