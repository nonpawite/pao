# Pao

A self-hosted expense tracker for one family. Each person has private pockets and limits; shared pockets let several people log against one budget. Budget months run from each person's payday, and each category limit is either per day (strict, resets every day) or per cycle.

Stack: TanStack Start, Drizzle ORM + PostgreSQL, Better Auth, shadcn/ui (restyled). Thai and English.

## Run it at home (Docker)

The server needs Docker and git.

1. Get the code:

   ```
   git clone https://github.com/nonpawite/pao.git
   cd pao
   ```

2. Start it (the first build takes a few minutes):

   ```
   docker compose up -d --build
   ```

   No `.env` needed. On first start the app creates its auth secret, then runs migrations.

3. Find the server's address with `hostname -I` (Linux) or `ipconfig getifaddr en0` (macOS).

4. Each family member opens `http://<server address>:3000` and creates an account. Everyone gets a personal pocket with starter categories and accounts.

5. When everyone has an account, set `ALLOW_SIGNUP: "false"` in `docker-compose.yml` and run `docker compose up -d`.

Settings live in `docker-compose.yml`: `ALLOW_SIGNUP`, `APP_TZ`, and the host port (the left number in `"3000:3000"`).

To update to a newer version:

```
git pull
docker compose up -d --build
```

If `git pull` refuses because you edited `docker-compose.yml`, run `git stash`, `git pull`, `git stash pop`.

Put the app behind HTTPS (for example a reverse proxy) before using it outside your home network. Behind a proxy, add `BETTER_AUTH_URL: https://<your domain>` to the app's `environment`, or sign-in is refused.

### Backups

All data lives in the `db-data` volume:

```
docker compose exec db pg_dump -U tracker tracker > backup.sql
```

The auth secret lives in the `app-data` volume. Losing it only signs everyone out.

## Develop

```
npm install
docker compose up -d db        # Postgres on 127.0.0.1:5432
npm run db:migrate
npm run dev                    # http://localhost:3000
npm test                       # cycle and limit math
```

`.env` for development needs `DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker`, `BETTER_AUTH_URL=http://localhost:3000` and a `BETTER_AUTH_SECRET`.

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.

### Demo data

`scripts/seed-demo.ts` fills a development database with synthetic entries for screenshots. Create `demo@example.com` and `mint@example.com` in the app first, then:

```
node --env-file=.env scripts/seed-demo.ts
```

It deletes and rewrites those demo users' entries. Never run it against real data.

## Time zone

"Today" uses `APP_TZ` (default `Asia/Bangkok`).

## License

MIT. See [LICENSE](LICENSE).
