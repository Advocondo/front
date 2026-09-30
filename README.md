# Advocondo

Front-end do **Advocondo**, sistema para advogados gerenciarem contratos. Construído com [Next.js](https://nextjs.org).

## Getting Started

Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador para ver o resultado.

Você pode começar a editar a página modificando `app/page.tsx`. A página é atualizada automaticamente conforme o arquivo é editado.

## Docker

O projeto é hospedado na Vercel, mas também é possível rodar em containers Docker (para desenvolvimento local padronizado, CI ou outros ambientes).

### Desenvolvimento

O `Dockerfile.dev` sobe o servidor de desenvolvimento do Next.js (`next dev`) dentro do container.

```bash
docker build -f Dockerfile.dev -t advocondo-front:dev .
docker run --rm -it -p 3000:3000 -v "$(pwd)":/app -v /app/node_modules -v /app/.next advocondo-front:dev
```

Os volumes montam o código local no container para habilitar hot reload, mantendo `node_modules` e `.next` isolados no container.

### Produção

O `Dockerfile` faz um build multi-stage usando o [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) do Next.js, gerando uma imagem final mínima com apenas os arquivos necessários para rodar o servidor.

```bash
docker build -t advocondo-front:latest .
docker run --rm -p 3000:3000 advocondo-front:latest
```

O container expõe a porta `3000` (configurável via `PORT`).

## Learn More

Para aprender mais sobre Next.js, veja os seguintes recursos:

- [Next.js Documentation](https://nextjs.org/docs) - conheça os recursos e a API do Next.js.
- [Learn Next.js](https://nextjs.org/learn) - um tutorial interativo de Next.js.

## CI

Todo PR para `main` roda o workflow `.github/workflows/ci.yml`: lint (eslint), checagem de tipos (tsc) e `next build`. O deploy (CD) é feito pela Vercel quando o código chega na `main`.

## Deploy

O front-end é publicado na [Vercel](https://vercel.com), com build automático a cada push na branch `main`. O back-end fica na Oracle Cloud, gerenciado pelo Coolify (veja o [README do back-end](https://github.com/Advocondo/back)).

O `next.config.ts` só usa `output: "standalone"` fora da Vercel (`process.env.VERCEL` não definido). O standalone é necessário para o `Dockerfile`, mas quebra o build da Vercel (`ENOENT: ... .next/next-server.js.nft.json`).
