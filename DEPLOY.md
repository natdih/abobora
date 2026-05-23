# Rodar Localmente

Para a festa, o caminho mais confiavel e rodar em um notebook local.

## Preparar

```bash
npm install
npm run build
```

## Abrir o sistema

```bash
npm start
```

Depois acesse:

```text
http://localhost:3333
```

## Onde as apostas ficam salvas

O banco SQLite local fica em:

```text
server/data/app.db
```

Enquanto o servidor estiver rodando nesse notebook, as apostas sao salvas nesse arquivo.

## Google Planilhas em tempo real

Se quiser manter uma copia no Google Planilhas, siga o passo a passo em:

```text
GOOGLE_SHEETS.md
```

Depois de publicar o Apps Script, inicie o servidor com:

```powershell
$env:GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/SEU_ID/exec"
$env:GOOGLE_SHEETS_WEBHOOK_SECRET="o-mesmo-segredo-do-script"
npm start
```

## Backup durante a festa

De tempos em tempos, feche o sistema por alguns segundos ou pare de cadastrar novas apostas e copie estes arquivos para um pendrive ou pasta de backup:

```text
server/data/app.db
server/data/app.db-shm
server/data/app.db-wal
```

O arquivo principal e `app.db`, mas copiar os tres arquivos e mais seguro quando o SQLite esta usando WAL.

## Hospedar na Vercel com Google Planilhas

Para deixar o sistema online sem depender do notebook ligado, use a Vercel junto com o Google Planilhas.

1. Atualize o Apps Script com o codigo de `GOOGLE_SHEETS.md`.
2. Publique o Apps Script como `App da Web`.
3. Copie a URL terminada em `/exec`.
4. Na Vercel, cadastre as variaveis:

```text
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/SEU_ID/exec
GOOGLE_SHEETS_WEBHOOK_SECRET=abobora-2026
```

5. Faca um novo deploy.

Na Vercel, a API usa o Google Planilhas como banco central. O SQLite local continua servindo apenas para uso no notebook com `npm start`.

## Usar em outros celulares/computadores na mesma rede

Se quiser abrir de outros dispositivos no mesmo Wi-Fi, descubra o IP do notebook e acesse:

```text
http://IP_DO_NOTEBOOK:3333
```

Exemplo:

```text
http://192.168.0.25:3333
```
