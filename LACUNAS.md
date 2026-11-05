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
| Marcar advogado só no convite | Quem foi convidado sem a marcação não pode virar responsável por acordos | Sem issue |
| Editar nome ou e-mail de outra pessoa | O protótipo mostra esses campos, mas o diálogo traz só o nível de acesso | Sem issue |
| Busca não ignora acentos | Procurar `jose` não encontra "José", em acordos, devedores e condomínios | Sem issue |
| Fatura do mês sem responsável e sem total de parcelas | O filtro por responsável funciona, mas não há coluna, e a parcela aparece como `3`, não `3/10` | Sem issue |
| Acordo não tem status "concluído" nem "em atraso" | O protótipo tem esses filtros; o back só tem ativo e cancelado | Sem issue |
| Código do acordo (`ACD-2026-…`) | Está nos protótipos, mas não existe no back | Sem issue |
| Meio de pagamento da baixa | Está no protótipo, mas não existe no back | Sem issue |
| Comissão por parcela paga | O protótipo lista cada parcela, mas o back só devolve o total do mês | Sem issue |
| Comissão e faturamento de meses anteriores | `/operator-panel/financial` e `/admin-panel/financial` só respondem o mês atual, então em outros meses a tela só mostra a meta | Sem issue |
| "Acordos fechados" no mês | Está no protótipo, mas o back não devolve esse número | Sem issue |
| Inadimplência em reais e por condomínio | O Painel mostra o percentual e a contagem de parcelas. O protótipo mostra o valor em reais e a lista "Maior inadimplência", que o back não devolve | Sem issue |
| Honorários recebidos e acordos novos no mês | Estão no Painel do protótipo. A rota do Painel só devolve as comissões pagas e o total de acordos ativos de hoje | Sem issue |
| Local e última atividade da sessão | O protótipo mostra a cidade e "há 2 horas". A tela mostra o aparelho e a hora do login: o local exigiria geolocalizar o IP, uma decisão de privacidade, e a atividade exigiria gravar a cada requisição | Sem issue |
| OAB no cabeçalho do perfil | Está no protótipo, mas a sessão guardada não traz esse dado | Sem issue |
| Motivo da alteração do acordo | O protótipo pede o motivo ao editar, mas a rota não recebe esse campo | Sem issue |
| Quem cancelou e quem reativou o acordo | O back guarda quando e por quê, mas ainda não registra quem | Sem issue |
| Observações do devedor | Estão no protótipo, mas não existem no back | Sem issue |

## Telas e fluxos que ainda não existem

| Lacuna | O que acontece hoje | Issue |
| --- | --- | --- |
| Destino da notificação de atraso | O sino ainda não existe. Quando existir, a notificação deve levar a `/faturas/{id}`, a tela do detalhe | [#29](https://github.com/Advocondo/front/issues/29) |
| Relatório de condomínio sem acordos | O botão fica no card do condomínio, e o card só existe quando há acordo. Sem acordo, não há o que baixar pela tela, embora a rota responda | Sem issue |
| Painel da Equipe Operacional | Depois do login, a pessoa cai em Condomínios. O protótipo mobile tem uma visão própria, com totais do mês, meta, vencimentos da semana e últimas baixas | Sem issue |
| Histórico de ações do usuário | O back registra, mas não há tela | [#11](https://github.com/Advocondo/front/issues/11) |
| Edição da landing pelo Administrador | Textos, avaliações e fotos só mudam pela API | [#4](https://github.com/Advocondo/front/issues/4) |
| Nota fiscal da parcela | O protótipo tem o campo no diálogo de baixa | [#28](https://github.com/Advocondo/front/issues/28) |
| Documentos e PDF do acordo | Não há tela para anexar documentos nem gerar o PDF | [#21](https://github.com/Advocondo/front/issues/21), [#24](https://github.com/Advocondo/front/issues/24) |
| Ver quem editou o acordo | O back registra quem alterou e quando (US19-CA02), mas ainda não há tela para consultar | [#30](https://github.com/Advocondo/front/issues/30) |
| Importar inadimplentes em lote | O back aceita a planilha, mas não há tela | [#14](https://github.com/Advocondo/front/issues/14) |
| Sinalizar renovação de contrato | A API devolve `near_renewal`, mas a lista não mostra | [#23](https://github.com/Advocondo/front/issues/23) |
| Página de política de privacidade e de cookies | No rodapé, são só texto | Sem issue |

## Regras de negócio a decidir

| Lacuna | Situação | Decisão necessária |
| --- | --- | --- |
| Meta e comissão usam bases diferentes | O atingimento da meta soma os honorários dos acordos que a pessoa **cadastrou**. A comissão soma os dos acordos em que ela é a **advogada responsável**. Quem cadastra para outro advogado atinge a meta sem ganhar comissão, e o contrário também acontece. A tela identifica as duas bases | Qual base vale para as duas |
| `remaining_to_goal` mistura as bases | `/operator-panel/financial` calcula quanto falta comparando a meta com a comissão, enquanto `/goals/me` compara com os honorários dos acordos cadastrados. A tela usa só a segunda conta | Depende da decisão acima |
| Percentual de comissão | Hoje a comissão é 100% dos honorários. Os protótipos mostram 8% e 30% | Definir o percentual e onde ele é configurado |
| Pagamento parcial na comissão | Só conta quando quita a parcela; o protótipo não define | Confirmar |

## Diferenças em relação aos protótipos

| Tela | Diferença | Motivo |
| --- | --- | --- |
| Novo acordo | Advogado responsável é opcional, e o protótipo o trata como obrigatório | O back cadastra sem responsável, e pode ainda não haver advogado |
| Acordos | "Meus acordos" é um atalho, não uma restrição: o advogado continua vendo todos | É assim que o back trata o perfil dele |
| Devedores | Item próprio no menu, e o formulário é um diálogo | O protótipo é só mobile e trata o devedor dentro de Acordos |
| Login | Texto do painel navy vem do mobile ("acordos extrajudiciais") | O desktop ainda fala em "processos" |
| Redefinir senha | Mínimo de 8 caracteres, sem exigir letras e números, e a tela não cita a validade em minutos. O protótipo pede 10 caracteres com letras e números, e link de 30 minutos | O back aceita 8 caracteres e usa 60 minutos por padrão. Mudar a regra é decisão de segurança |
| Redefinir senha | A tela não mostra o e-mail da conta | A rota de confirmação recebe só o token e não devolve o e-mail |
| Landing | Sem WhatsApp, redes sociais, avaliações e fotos, os blocos ficam escondidos | O conteúdo inicial não os traz, e as avaliações do protótipo são parafraseadas |
| Gestão de usuários | Os condomínios do Cliente ficam em um diálogo próprio, não em uma tela única de edição com histórico | Editar nome e e-mail não existe no back, e o histórico é a [#11](https://github.com/Advocondo/front/issues/11) |
| Painel | Seletor de mês por setas, como em Faturas e Metas, e não uma lista. Sem o aviso de renovação de contrato. "Comissões pagas" soma os honorários das parcelas pagas no mês, e o mesmo valor aparece como "Faturamento do mês" em Metas | Consistência entre as telas. O aviso é a [#23](https://github.com/Advocondo/front/issues/23). O nome depende da decisão sobre o percentual de comissão |
| Detalhe da fatura e parcelas do Cliente | A [#47](https://github.com/Advocondo/front/issues/47) não tem história de usuário nem protótipo, e os critérios são propostos. A construção foi aprovada pelo responsável em 04/11/2026 | Falta validar com o time |
| Painel do Cliente e histórico do morador | Não há protótipo: as telas foram montadas com o design system | O perfil Cliente ainda não foi prototipado |
| Meu perfil | A senha pede 8 caracteres, como no back, e o protótipo pede 10. Sem foto nem iniciais, e o botão de mostrar a senha não existe | A regra é a mesma da redefinição; os outros dois são acabamento |
| Meu perfil | Sessões antigas aparecem como "Aparelho não identificado" até o próximo login | O back só guarda o aparelho desde a [#127](https://github.com/Advocondo/back/pull/127) |
| Editar acordo | Unidade e advogado não estão no diálogo: a unidade pertence ao devedor, e o responsável tem o próprio botão. O dia de vencimento é editado em cada parcela | É como o back separa esses dados |
| Cancelar acordo | O motivo é obrigatório na tela, como no protótipo, mas opcional na API | Um acordo cancelado pela API pode aparecer como "Sem motivo registrado" |
| Faturas do mês | Sem calendário e sem exportar | O calendário é herança de Prazos; exportar é a [#34](https://github.com/Advocondo/front/issues/34) |
| Metas e comissões | Indicadores do Administrador: faturamento, acordos ativos e inadimplência, em vez de recuperado e acordos fechados; a meta é definida no mês da tela, sem seletor de mês no diálogo | O back não devolve recuperado nem acordos fechados; o seletor do diálogo seria redundante com o da tela |

## Limitações técnicas

| Lacuna | Efeito |
| --- | --- |
| Listagens sem paginação na tela | Acordos, devedores, condomínios e usuários trazem no máximo 200 registros |
| Prévia do parcelamento repete regras do back | `acordos/plan.ts` copia `parcelas/plan.py` e `acordos/fees.py`: se o back mudar a regra, a prévia precisa mudar junto |
| Scanner de segredos olha todas as branches | Um falso positivo em qualquer branch derruba o CI de todos os PRs até ela ser apagada |
| Aviso do `Button` do `ui-kit` | Em desenvolvimento, o React avisa sobre `border` e `borderColor` misturados. Não afeta o uso |
| Telas do escritório não se adaptam ao celular | A barra lateral tem largura fixa de 248px e não recolhe, então em 390px o conteúdo fica cortado. Os protótipos mobile têm navegação inferior, que não foi construída. As telas do Cliente não têm esse problema, porque não têm barra lateral |
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
