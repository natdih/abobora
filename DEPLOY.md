# Deploy no Vercel

O projeto ja inclui `vercel.json` e uma entrada serverless em `api/index.js`.

Configuracoes esperadas no Vercel:

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: 22.x ou superior

Deploy pela CLI:

```bash
npm install
npx vercel
```

Para publicar em producao:

```bash
npx vercel --prod
```

Observacao: no Vercel, o SQLite roda em `/tmp`, que e um armazenamento temporario de Serverless Function. Isso deixa o deploy funcionando para demonstracao/testes, mas nao deve ser usado como banco permanente em producao. Para dados persistentes, use um banco externo, como Vercel Postgres, Neon, Supabase ou Turso.
