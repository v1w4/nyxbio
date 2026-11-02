# nyxbio

Site de perfil pessoal (estilo bio-link) com:
- status do Discord ao vivo (Lanyard)
- temas prontos + cores personalizadas + GIF de fundo + música
- painel admin com editor JSON e histórico de alterações
- assistente de IA (Nyx) que pode editar o perfil, com limite mensal de tokens
- banco SQLite, contador de visitas

## Rodar local

    cp .env.example .env        # preencha ADMIN_PASSWORD
    npm install
    npm run prepare             # gera corpus.txt se não existir
    node server.js              # http://localhost:3000

Abra http://localhost:3000 (site) e http://localhost:3000/admin.html (painel).

## Deploy

### Render / Railway / Fly.io (Node)

1. Crie um repositório e envie os arquivos.
2. No painel, configure: `Build Command: npm ci`, `Start Command: node server.js`.
3. Adicione as variáveis de ambiente:
   - `ADMIN_PASSWORD=sua-senha`
   - `SESSION_SECRET=texto-aleatório` (opcional; gera um aleatório se vazio)
   - `TOKEN_BUDGET=500000` (opcional; padrão)
   - `CORPUS_FILE=src/corpus.txt` (opcional; se vazio, usa o corpus padrão)
4. O banco SQLite ficará em `data.sqlite`. Use um disco persistente se o host
   exigir (Render/Railway garantem isso).

### Docker

    docker build -t nyxbio .
    docker run -d -p 3000:3000 -e ADMIN_PASSWORD=sua-senha nyxbio

## Configuração de variáveis de ambiente

| variável            | padrão              | uso                                                        |
| ------------------- | ------------------- | ---------------------------------------------------------- |
| `ADMIN_PASSWORD`    | (obrigatório)      | senha do painel (`/admin.html`)                           |
| `SESSION_SECRET`    | `randomBytes(32)`  | assina os cookies de sessão                               |
| `TOKEN_BUDGET`      | `500000`           | orçamento mensal de tokens de entrada + saída             |
| `DB_PATH`           | `./data.sqlite`    | caminho do banco                                          |
| `PORT`              | `3000`             | porta de escuta                                           |
| `CORPUS_FILE`       | `src/corpus.txt`   | corpus de treino do modelo local (opcional)               |

## Orçamento de tokens

`TOKEN_BUDGET` soma entrada + saída de todas as chamadas da IA no mês. Ao
estourar, o chat retorna erro `402` até o mês girar. Os números vêm da própria
API (aqui, do modelo), então a contagem é exata.

## Discord

Entra em `discord.gg/lanyard` e use seu ID em `discordId` (modo desenvolvedor →
clique direito no perfil → copiar ID). O círculo de presença muda junto com
`online`, `ausente`, `não perturbe` e `offline`.

## Lint / teste

    npm test          # testes unitários

## O que mudou na v2.0

- **IA do zero**: modelo transformer autocorretivo em puro JS (`src/model.js`)
  — sem dependência de API, sem chave, 100 % local e escalável para hospedagem.
- **Assistência na internet**: Nyx aparece no site público, com digitação,
  sugestões de comandos, voz (Web Speech) e memória de conversa. Antes só
  existia no painel admin.
- **Transmissão (SSE)**: resposta do chat vem em blocos, não em um retângulo
  grudado.
- **Temas e estética aprimorados**: sugestões, indicador de digitação,
  fallback `color-mix` para navegadores antigos, PWA (manifest + favicon) e
  SEO (meta OG, sitemap, robots).
- **Host-ready**: `Dockerfile`, `Procfile` (Render/Railway), scripts de build e
  testes.

## Arquitetura

```
public/          HTML, CSS, JS do site
src/db.js        Camada SQLite (perfil, histórico, tokens, chat, views)
src/model.js     Transformer "do zero" (embedding, attn, FFN, softmax)
src/language.js  Tokenizador + corpus
src/chat.js      Orquestração do chat (+ streaming, uso de tokens)
server.js        Express (roteamento, sessão, middleware)
```

## Discord

Entra em `discord.gg/lanyard` e use seu ID em `discordId` (modo desenvolvedor →
clique direito no perfil → copiar ID). O círculo de presença muda junto com
`online`, `ausente`, `não perturbe` e `offline`.

## Deploy

GitHub Pages só serve HTML estático, então este projeto precisa de um host que rode Node
com disco persistente pro SQLite: Render, Railway, Fly.io ou uma VPS.
Configure as variáveis do .env no painel do host (não suba o .env pro repositório).

## Orçamento de tokens

TOKEN_BUDGET (padrão 500000) soma entrada + saída de todas as chamadas da IA no mês.
Ao estourar, o chat responde com erro 402 até o mês virar. Os números vêm da própria API,
então a contagem é exata.

## Discord

Entre em discord.gg/lanyard e use seu ID em discordId (modo desenvolvedor → clique direito no perfil → copiar ID).
