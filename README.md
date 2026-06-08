# Skepsi — A Minimalist Blog

A black-and-white, read-only blog hosted on GitHub Pages. Articles are written in Markdown and rendered client-side.

## Structure

```
skepsi/
├── index.html          # Main page (article list + reader)
├── style.css           # Custom styles & markdown prose
├── app.js              # Blog engine (routing, rendering, theme)
├── articles/
│   ├── posts.json      # Article index (metadata)
│   ├── on-simplicity.md
│   ├── the-weight-of-words.md
│   └── digital-minimalism.md
└── README.md
```

## Adding a New Article

1. Write your article in Markdown and save it in the `articles/` folder (e.g., `my-new-post.md`)
2. Add an entry to `articles/posts.json`:

```json
{
  "slug": "my-new-post",
  "title": "My New Post",
  "date": "2026-06-10",
  "excerpt": "A short description of the article."
}
```

3. Commit and push. That's it.

> **Note:** The `slug` must match the `.md` filename (without the extension).

## Day / Night Mode

Click the moon/sun icon in the top-right corner. Your preference is saved in `localStorage` and persists across sessions. If no preference is set, it follows your system theme.

## Deploying to GitHub Pages

1. Create a repository on GitHub (e.g., `skepsi`)
2. Push this folder to the `main` branch
3. Go to **Settings → Pages**
4. Set **Source** to "Deploy from a branch" and select `main` / `/ (root)`
5. Your blog will be live at `https://<username>.github.io/skepsi/`

## Tech Stack

- **HTML / CSS / JavaScript** — No frameworks, no build step
- **Tailwind CSS** — Via CDN for utility classes
- **marked.js** — Client-side Markdown rendering
- **Google Fonts** — Inter, Newsreader, JetBrains Mono

## Design Principles

- Only black and white — no colors
- No sign-ups, no comments, no analytics
- Articles are read-only
- Typography-first design
- Smooth transitions and micro-animations
