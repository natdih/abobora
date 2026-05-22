# Sementes da Abóbora

Aplicação web para gerenciar apostas da brincadeira "Quantas sementes tem na abóbora?" em festa junina de igreja.

## Tecnologias

- React + Vite + TypeScript
- TailwindCSS
- Componentes no estilo shadcn/ui
- Node.js + Express
- SQLite nativo do Node (`node:sqlite`)
- Recharts
- Importação/exportação CSV e Excel

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Abra:

```text
http://localhost:5173
```

O frontend roda no Vite e conversa com a API Express em `http://localhost:3333`.

## Build

```bash
npm run build
```

## Rodar build em produção local

```bash
npm start
```

Depois acesse:

```text
http://localhost:3333
```

## Banco de dados

O SQLite é criado automaticamente em:

```text
server/data/app.db
```

Na primeira execução, o sistema cria a competição "Abóbora 2026" e alguns dados mock para teste.

## Atalhos de atendimento

- `Enter`: salva a aposta quando estiver no campo de palpite e limpa o cadastro
- `Esc`: limpa apenas o campo de palpites
- `Ctrl + N`: nova pessoa

Digite vários palpites da mesma pessoa separados por vírgula ou ponto e vírgula, por exemplo:

```text
523, 610; 777
```

Cada número gera uma aposta separada. Após salvar, o cadastro é limpo para começar um novo participante.

## Regras de duplicidade

Uma mesma pessoa pode registrar vários palpites diferentes. O sistema bloqueia apenas a repetição do mesmo palpite para o mesmo nome e telefone.

## Exportação e importação

Exportação disponível em:

- CSV
- Excel `.xlsx`

Importação aceita planilha com colunas:

- `Nome`
- `Telefone`
- `Palpite`

Registros inválidos ou duplicados são informados ao final da importação.
