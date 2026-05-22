# Deploy no Vercel

O projeto ja inclui `vercel.json` e uma entrada serverless em `api/index.js`.

Configuracoes esperadas no Vercel:

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: 22.x ou superior

Variaveis de ambiente obrigatorias:

- `DATABASE_URL`: string de conexao do PostgreSQL.

Deploy pela CLI:

```bash
npm install
npx vercel
```

Para publicar em producao:

```bash
npx vercel --prod
```

O banco pode ser Vercel Postgres, Neon, Supabase, Railway, Render ou qualquer outro PostgreSQL compativel. A aplicacao cria automaticamente as tabelas `competitions` e `bets` na primeira chamada da API.
