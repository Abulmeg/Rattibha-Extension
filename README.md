# Rattibha Learn

A lightweight, open-source browser extension that improves the student experience on JUST eLearning (Moodle).

**Status:** early preview 0.3. This project is independent and is not affiliated with Jordan University of Science and Technology.

## Install

1. Open `chrome://extensions`, `opera://extensions`, or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.
4. Sign in normally and open <https://elearn.just.edu.jo/current/my/courses.php>.

## Features

- Compact subjects with direct links to your section and shared materials.
- Weekly Moodle materials with search and quick type filters.
- Pinned courses, bookmarked and recently opened resources.
- Personal local tasks and a focus timer.
- Light and dark appearances, with six accent choices.
- Reduced-motion support, keyboard navigation, and a one-click switch to the original Moodle page.

## Privacy and reliability

The extension uses your active Moodle login. It does not request passwords, scrape cookies, transmit user data to any external server, or make changes to official submissions/grades. Personal preferences and tasks stay in `chrome.storage.local`. It runs only on the JUST eLearning host.

The enhanced interface currently covers the My courses page and individual course pages. Quizzes, grades, submissions, and messaging remain on the official Moodle pages; use **Original site** to access all official controls.

## Contributing

- Please open an issue with a screenshot (hide personal information), page URL **without sensitive query values**, browser, and expected/actual result.
- Keep text concise and features simple. No external scripts, trackers, CDN assets, or copied Moodle login forms.
- Test changes in Chrome, Opera GX, and Edge, including keyboard controls and `prefers-reduced-motion`.

Files: `manifest.json`, `content.js`, `styles.css`, `popup.html`, `popup.css`, `icons/`. No build step.

MIT licensed. See [LICENSE](LICENSE).