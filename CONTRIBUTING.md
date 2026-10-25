# Contributing to Pao

Thanks for helping. Bug reports, fixes, translations and features are all welcome.

**Support is best-effort.** Pao is a hobby project with one maintainer. Issues and pull requests get answered when there is time, and there is no guaranteed response time. Security reports go first: see [SECURITY.md](SECURITY.md).

## Before you start

- Read [GLOSSARY.md](GLOSSARY.md) and use its words: **Household**, **Member**, **Pocket**. Not "family", "user" (in product copy) or "wallet".
- Read the decisions in [docs/adr/](docs/adr/). For example, Pao never converts between currencies ([ADR 0001](docs/adr/0001-currency-per-pocket.md)).
- For UI changes, read [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).
- For anything bigger than a small fix, open an issue first, so we can agree on the approach before you write the code.

## Set up

You need [Bun](https://bun.sh) 1.3 or newer and Docker. CI uses the Bun version pinned in the `Dockerfile`.

```sh
git clone https://github.com/nonpawite/pao.git
cd pao
bun install
docker compose up -d db        # Postgres from the compose file, on 127.0.0.1:5432
```

Create a `.env` for development:

```sh
cat > .env <<EOF
DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ALLOW_SIGNUP=true
EOF
```

Apply the migrations and start the dev server:

```sh
bun run db:migrate
bun run dev                    # http://localhost:3000
```

Open http://localhost:3000 and create an account. The first account is the admin. `ALLOW_SIGNUP=true` lets more accounts sign up without an invite while you develop; leave it out to try sign-up by invite.

### Demo data

`scripts/seed-demo.ts` fills a development database with synthetic entries, for example for screenshots. Create `demo@example.com` and `mint@example.com` in the app first (Setup can be left unfinished: the script makes any missing personal pocket), then run:

```sh
bun scripts/seed-demo.ts
```

It deletes and rewrites those two accounts' entries. Never run it against a real household's data.

### Schema changes

After you change `src/db/schema.ts`, generate a migration and commit the new file in `drizzle/`:

```sh
bun run db:generate
```

Apply it to your database with `bun run db:migrate`. The Docker image applies migrations by itself on start.

## Tests and checks

CI runs these on every pull request. Run them before you push:

```sh
bun run typecheck
bun test
bun run build
```

Tests live next to the code in `src/lib/*.test.ts`.

### Build the Docker image from source

To run your checkout the way self-hosters run the published image, build it with `docker-compose.build.yml`:

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

This builds the image as `pao:dev` and serves it on port 3000, using the same `db` service as development. Stop `bun run dev` first, because both use port 3000. Read the app's output with `docker compose logs app`, and stop it with `docker compose stop app`.

## Add a language

A language is one messages file plus one entry in the locale registry.

1. Copy `src/lib/messages/th.ts` to `src/lib/messages/<code>.ts`. `<code>` is the language's two-letter lowercase code, for example `fr`.
2. In the new file, rename the export (`export const fr: Messages = {`) and translate every string. Keep each `{placeholder}` as it is.
3. In `src/lib/i18n.ts`, import the file and add an entry to `locales`:

   ```ts
   fr: { name: 'Français', tag: 'fr-FR', messages: fr },
   ```

   - `name` is the language's name in that language. The Settings language picker shows it.
   - `tag` is the locale tag for the platform's number, date and currency formatting. Month and weekday names come from it, so you don't translate them. The `date*` keys in your file set their word order.

4. Run `bun run typecheck`. It reports every message key your file is missing or misspells.
5. Run `bun test`.
6. Start the dev server and pick the language in Settings.

The registry matches a browser's language by its first part only, so one entry covers every region: `fr` serves both `fr-FR` and `fr-CA`. The bundled fonts cover Latin and Thai. Other scripts use the device's system font.

The names Pao gives a new member's first pocket, categories and bank accounts are the `starter*` keys.

The `glyph*` keys list words, split by `|`, that give a category its pictogram. A category name matches the words of every language, so add your language's words. New bills file under the category that gets the receipt pictogram, so your `starterBills` name needs a `glyphBill` word. `bun test` checks it.

## Pull requests

A pull request needs:

- **CI green.** The `check` job runs the typecheck, the tests and a production build. `main` requires it.
- **Tests for lib logic.** New or changed logic in `src/lib` gets a test in `src/lib/*.test.ts`. UI, server functions and schema are checked by the typecheck and the build.
- **The glossary's words**, in code, UI copy and docs.
- **Every new UI string in every messages file.** If you can't translate a string, use the English text and say so in the pull request.
- **A note when a migration rewrites data.** If a migration changes or deletes existing rows (a backfill, a dropped column, a type change), say so in the pull request. The release notes list these.

Keep each pull request to one change, and link its issue (`Closes #123`).

## Releasing (maintainer)

Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which publishes the multi-arch image to `ghcr.io/nonpawite/pao`. Then draft the GitHub Release for that tag: paste [.github/RELEASE_TEMPLATE.md](.github/RELEASE_TEMPLATE.md) into its description and fill it in. Every release keeps the "Migrations that rewrite data" section.
