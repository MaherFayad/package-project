# Elba (علبة)

You design a custom printed box in 3D for free, get an instant price, and order it from a vetted Egyptian print vendor.

- Product research and plan: [`docs/research-report.md`](docs/research-report.md)
- Orientation (commands, rules, gotchas): [`CLAUDE.md`](CLAUDE.md)
- Architecture and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Docs index and reading order per role: [`docs/README.md`](docs/README.md)

```bash
npm install
cp .env.example .env
npm run db:push && npm run db:seed
npm run dev   # http://localhost:3000 -> /ar
```
