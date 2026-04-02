---
description: 'Use when writing any UI, styling, or Svelte component for the CDN app. Defines the exact design language: colors, fonts, spacing, and component patterns.'
applyTo: 'src/**'
---

# Design Theme

## Fonts

Load both fonts from Google Fonts in `src/app.html` inside `<head>`:

```html
<link
	href="https://fonts.googleapis.com/css2?family=Anta&family=DM+Mono:wght@300;400;500&display=swap"
	rel="stylesheet"
/>
```

| Role               | Font                 | Usage                                                   |
| ------------------ | -------------------- | ------------------------------------------------------- |
| Display / Headings | `Anta`, sans-serif   | Page titles, section headers, the app logo/name         |
| Body / UI          | `DM Mono`, monospace | All other text: labels, inputs, buttons, body copy, nav |

## Color Palette

Define these as CSS custom properties in `src/routes/layout.css`:

```css
:root {
	--bg: #0e0e0e;
	--surface: #161616;
	--border: #2a2a2a;
	--accent: #c8f56a;
	--text: #f0ede6;
	--muted: #666666;
	--input-bg: #111111;
}
```

| Variable     | Hex       | Role                                                       |
| ------------ | --------- | ---------------------------------------------------------- |
| `--bg`       | `#0e0e0e` | Page background                                            |
| `--surface`  | `#161616` | Cards, panels, sidebars                                    |
| `--border`   | `#2a2a2a` | All borders and dividers                                   |
| `--accent`   | `#c8f56a` | Lime green — primary action color, focus rings, highlights |
| `--text`     | `#f0ede6` | Primary text (warm off-white)                              |
| `--muted`    | `#666666` | Secondary labels, placeholder text                         |
| `--input-bg` | `#111111` | Form input backgrounds                                     |

In Tailwind, reference these as `bg-[var(--bg)]`, `text-[var(--accent)]`, etc.

## Global Background

Apply a subtle grid texture to the page body in `layout.css`:

```css
body {
	background: var(--bg);
	color: var(--text);
	font-family: 'DM Mono', monospace;
}

body::before {
	content: '';
	position: fixed;
	inset: 0;
	background-image:
		linear-gradient(rgba(200, 245, 106, 0.03) 1px, transparent 1px),
		linear-gradient(90deg, rgba(200, 245, 106, 0.03) 1px, transparent 1px);
	background-size: 40px 40px;
	pointer-events: none;
	z-index: 0;
}
```

All page content must have `position: relative; z-index: 1` to sit above the grid.

## Shape Language

- **No border-radius anywhere.** All corners are sharp (0px radius).
- Borders use `1px solid var(--border)`.
- Cards and panels use `background: var(--surface)` with a `1px solid var(--border)` border.

### Accent Corner

Cards and key UI panels use a top-right corner accent in the lime color:

```css
.card::before {
	content: '';
	position: absolute;
	top: -1px;
	right: -1px;
	width: 32px;
	height: 32px;
	border-top: 2px solid var(--accent);
	border-right: 2px solid var(--accent);
}
```

The parent element must be `position: relative`.

## Typography Scale

| Role                 | Size   | Font    | Treatment                                       |
| -------------------- | ------ | ------- | ----------------------------------------------- |
| Page title / h1      | `36px` | Anta    | Normal weight                                   |
| Section heading / h2 | `20px` | Anta    | Normal weight                                   |
| Label / tag          | `10px` | DM Mono | Uppercase, `letter-spacing: 0.16em`             |
| Body / UI text       | `14px` | DM Mono | Regular                                         |
| Small / secondary    | `12px` | DM Mono | Regular                                         |
| Button text          | `12px` | DM Mono | Uppercase, `letter-spacing: 0.12em`, weight 500 |

## Component Patterns

### Labels

All form labels and section tags:

- `font-size: 10px`
- `text-transform: uppercase`
- `letter-spacing: 0.14em–0.18em`
- `color: var(--muted)` for form labels
- `color: var(--accent)` for accent tags/eyebrow text

### Inputs

```css
input,
select,
textarea {
	background: var(--input-bg);
	border: 1px solid var(--border);
	color: var(--text);
	font-family: 'DM Mono', monospace;
	font-size: 14px;
	padding: 12px 14px;
	outline: none;
	transition: border-color 0.2s;
	border-radius: 0;
}
input:focus {
	border-color: var(--accent);
}
input::placeholder {
	color: #333;
}
```

### Primary Button

```css
button.primary {
	background: var(--accent);
	color: #0e0e0e;
	border: none;
	font-family: 'DM Mono', monospace;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	padding: 14px 20px;
	cursor: pointer;
	transition:
		opacity 0.2s,
		transform 0.1s;
	border-radius: 0;
}
button.primary:hover {
	opacity: 0.88;
}
button.primary:active {
	transform: scale(0.99);
}
```

### Ghost / Secondary Button

```css
button.ghost {
	background: transparent;
	color: var(--text);
	border: 1px solid var(--border);
	font-family: 'DM Mono', monospace;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	padding: 12px 18px;
	cursor: pointer;
	transition:
		border-color 0.2s,
		color 0.2s;
	border-radius: 0;
}
button.ghost:hover {
	border-color: var(--accent);
	color: var(--accent);
}
```

### Dividers

```html
<div class="divider">or</div>
```

```css
.divider {
	display: flex;
	align-items: center;
	gap: 12px;
	color: var(--border);
	font-size: 11px;
}
.divider::before,
.divider::after {
	content: '';
	flex: 1;
	height: 1px;
	background: var(--border);
}
```

## Animation

### Page / Card Entry

Panels and cards fade up on mount:

```css
@keyframes fadeUp {
	from {
		opacity: 0;
		transform: translateY(16px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.card {
	animation: fadeUp 0.5s ease both;
}
```

### Staggered List Items

For lists of files, keys, or links:

```css
.list-item {
	animation: fadeUp 0.3s ease both;
}
.list-item:nth-child(1) {
	animation-delay: 0ms;
}
.list-item:nth-child(2) {
	animation-delay: 40ms;
}
/* etc. — cap delay at ~200ms */
```

### Interactive States

- All interactive transitions: `0.2s ease`
- Active press: `transform: scale(0.99)` for buttons
- Focus: `border-color: var(--accent)` (no box-shadow outline)

## Tailwind Usage

Use Tailwind utility classes wherever possible. For design tokens, use the CSS variable approach with arbitrary values:

- `bg-[var(--bg)]`, `bg-[var(--surface)]`
- `border-[var(--border)]`
- `text-[var(--accent)]`, `text-[var(--muted)]`
- `font-mono` for DM Mono
- `tracking-widest` / `uppercase` for labels and buttons

For the grid texture body background and pseudo-element corner accents, write plain CSS in `layout.css` or a component `<style>` block since Tailwind cannot target `::before`/`::after` with arbitrary backgrounds easily.
