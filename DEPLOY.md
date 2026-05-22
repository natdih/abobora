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

## Backup durante a festa

De tempos em tempos, feche o sistema por alguns segundos ou pare de cadastrar novas apostas e copie estes arquivos para um pendrive ou pasta de backup:

```text
server/data/app.db
server/data/app.db-shm
server/data/app.db-wal
```

O arquivo principal e `app.db`, mas copiar os tres arquivos e mais seguro quando o SQLite esta usando WAL.

## Usar em outros celulares/computadores na mesma rede

Se quiser abrir de outros dispositivos no mesmo Wi-Fi, descubra o IP do notebook e acesse:

```text
http://IP_DO_NOTEBOOK:3333
```

Exemplo:

```text
http://192.168.0.25:3333
```
