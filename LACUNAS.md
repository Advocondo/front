# Lacunas

Tudo o que falta, está pendente ou não foi verificado no sistema. Cada PR que encontra uma lacuna a registra aqui, e o PR que a resolve a remove.

Última revisão: 04/11/2026.

## Antes de usar em produção

| Lacuna | O que acontece hoje | O que fazer |
| --- | --- | --- |
| Testes E2E com Selenium nunca foram executados ([#42](https://github.com/Advocondo/front/issues/42)) | Estão escritos e compilam, mas podem falhar na primeira execução | Rodar a suíte com todas as issues prontas, conforme `e2e/README.md`, e fechar a #42 |
| Chaves do Turnstile não configuradas | O site funciona, mas o envio do formulário de contato responde com erro | Criar o site na Cloudflare, definir `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na Vercel e `TURNSTILE_SECRET_KEY` no Coolify |
| Turnstile nunca testado com chave real | A chamada à Cloudflare é simulada nos testes | Enviar o formulário uma vez depois de configurar as chaves |
| E-mail real nunca testado | Em ambiente local, os e-mails (convite, contato) só vão para o log | Conferir um convite e um contato com o SMTP de produção |
| `NEXT_PUBLIC_API_URL` e CORS em produção não conferidos | Sem a variável, o site chama `localhost:8000` na máquina do visitante, e as telas mostram erro | Definir a variável na Vercel e conferir `CORS_ALLOW_ORIGINS` no Coolify |
| Destinatário do formulário de contato | O conteúdo inicial usa o e-mail real do cliente | Trocar na seção de contato durante demonstrações |

## Faltam rotas ou dados no back

| Lacuna | Efeito na tela | Referência |
| --- | --- | --- |
| Não há como reenviar um convite | O link vale 24 horas. Vencido, a pessoa fica pendente para sempre, e o mesmo e-mail não pode ser convidado de novo | Issue a abrir no `back` |
| Falha no envio do convite parece sucesso | O back registra no log e responde `201`, e a tela diz "Convite enviado" | Issue a abrir no `back` |
| Marcar advogado só no convite | Quem foi convidado sem a marcação não pode virar responsável por acordos | Sem issue |
| Editar nome ou e-mail de outra pessoa | O protótipo mostra esses campos, mas o diálogo traz só o nível de acesso | Sem issue |
| Busca não ignora acentos | Procurar `jose` não encontra "José", em acordos, devedores e condomínios | Sem issue |
| Fatura do mês sem responsável e sem total de parcelas | O filtro por responsável funciona, mas não há coluna, e a parcela aparece como `3`, não `3/10` | Sem issue |
| Acordo não tem status "concluído" nem "em atraso" | O protótipo tem esses filtros; o back só tem ativo e cancelado | Sem issue |
| Código do acordo (`ACD-2026-…`) | Está nos protótipos, mas não existe no back | Sem issue |
| Meio de pagamento da baixa | Está no protótipo, mas não existe no back | Sem issue |
| Observações do devedor | Estão no protótipo, mas não existem no back | Sem issue |

## Telas e fluxos que ainda não existem

| Lacuna | O que acontece hoje | Issue |
| --- | --- | --- |
| Recuperação de senha | "Esqueci minha senha" leva a uma página 404 | [#3](https://github.com/Advocondo/front/issues/3) |
| Painel do Cliente | O Cliente entra e vê uma página provisória | [#36](https://github.com/Advocondo/front/issues/36) |
| Vincular condomínios ao Cliente | Um Cliente convidado não tem nenhum dado | [#10](https://github.com/Advocondo/front/issues/10) |
| Metas e comissões | A comissão é calculada no back, mas não aparece em nenhuma tela | [#31](https://github.com/Advocondo/front/issues/31), [#35](https://github.com/Advocondo/front/issues/35) |
| Painel de indicadores | Depois do login, a equipe cai em Condomínios | [#33](https://github.com/Advocondo/front/issues/33) |
| Editar perfil e encerrar sessões | O usuário não troca os próprios dados nem a própria senha pela tela | [#5](https://github.com/Advocondo/front/issues/5), [#6](https://github.com/Advocondo/front/issues/6) |
| Histórico de ações do usuário | O back registra, mas não há tela | [#11](https://github.com/Advocondo/front/issues/11) |
| Edição da landing pelo Administrador | Textos, avaliações e fotos só mudam pela API | [#4](https://github.com/Advocondo/front/issues/4) |
| Nota fiscal da parcela | O protótipo tem o campo no diálogo de baixa | [#28](https://github.com/Advocondo/front/issues/28) |
| Editar e cancelar acordo, documentos e PDF | Só há cadastro e consulta | [#19](https://github.com/Advocondo/front/issues/19), [#20](https://github.com/Advocondo/front/issues/20), [#21](https://github.com/Advocondo/front/issues/21), [#24](https://github.com/Advocondo/front/issues/24) |
| Importar inadimplentes em lote | O back aceita a planilha, mas não há tela | [#14](https://github.com/Advocondo/front/issues/14) |
| Sinalizar renovação de contrato | A API devolve `near_renewal`, mas a lista não mostra | [#23](https://github.com/Advocondo/front/issues/23) |
| Página de política de privacidade e de cookies | No rodapé, são só texto | Sem issue |

## Diferenças em relação aos protótipos

| Tela | Diferença | Motivo |
| --- | --- | --- |
| Novo acordo | Advogado responsável é opcional, e o protótipo o trata como obrigatório | O back cadastra sem responsável, e pode ainda não haver advogado |
| Acordos | "Meus acordos" é um atalho, não uma restrição: o advogado continua vendo todos | É assim que o back trata o perfil dele |
| Devedores | Item próprio no menu, e o formulário é um diálogo | O protótipo é só mobile e trata o devedor dentro de Acordos |
| Login | Texto do painel navy vem do mobile ("acordos extrajudiciais") | O desktop ainda fala em "processos" |
| Landing | Sem WhatsApp, redes sociais, avaliações e fotos, os blocos ficam escondidos | O conteúdo inicial não os traz, e as avaliações do protótipo são parafraseadas |
| Faturas do mês | Sem calendário e sem exportar | O calendário é herança de Prazos; exportar é a [#34](https://github.com/Advocondo/front/issues/34) |

## Limitações técnicas

| Lacuna | Efeito |
| --- | --- |
| Listagens sem paginação na tela | Acordos, devedores, condomínios e usuários trazem no máximo 200 registros |
| Prévia do parcelamento repete regras do back | `acordos/plan.ts` copia `parcelas/plan.py` e `acordos/fees.py`: se o back mudar a regra, a prévia precisa mudar junto |
| Scanner de segredos olha todas as branches | Um falso positivo em qualquer branch derruba o CI de todos os PRs até ela ser apagada |
| Aviso do `Button` do `ui-kit` | Em desenvolvimento, o React avisa sobre `border` e `borderColor` misturados. Não afeta o uso |
| Guard de rotas roda no navegador | O back usa o cabeçalho `Authorization`, não cookie, então a checagem de sessão só acontece depois de a página carregar. Quem protege os dados é o back |

## Documentação desatualizada

| Onde | O que está errado |
| --- | --- |
| [`docs/prototipos/cobertura-historias.md`](https://advocondo.github.io/docs/prototipos/cobertura-historias/) | Diz que US13 não tem tela, mas o protótipo mobile a traz |
| Issue [#42](https://github.com/Advocondo/front/issues/42) | O corpo ainda pede os testes no CI, decisão revertida em comentário na própria issue |

## Ambiente local

| Lacuna | O que fazer |
| --- | --- |
| `back/.env` da máquina de desenvolvimento está mais antigo que o `.env.example`, e a API não sobe com ele | Copiar as variáveis que faltam |
| Os remotes `origin` locais guardam um token em texto puro | Decisão do responsável: mantido como está |
