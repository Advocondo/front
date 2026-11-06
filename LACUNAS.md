# Lacunas

Tudo o que falta, está pendente ou não foi verificado no sistema. Cada PR que encontra uma lacuna a registra aqui, e o PR que a resolve a remove.

Última revisão: 04/11/2026.

## Antes de usar em produção

| Lacuna | O que acontece hoje | O que fazer |
| --- | --- | --- |
| Suíte de produção nunca executada no ambiente real | `npm run test:e2e:prod` passou contra um ambiente local, mas não contra a produção. A suíte comum passou inteira em banco vazio em 05/11/2026 | Rodar conforme `e2e/README.md`, com o login de um Administrador |
| Chaves do Turnstile não configuradas | O site funciona, mas o envio do formulário de contato responde com erro | Criar o site na Cloudflare, definir `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na Vercel e `TURNSTILE_SECRET_KEY` no Coolify |
| Turnstile nunca testado com chave real | A chamada à Cloudflare é simulada nos testes | Enviar o formulário uma vez depois de configurar as chaves |
| E-mail real nunca testado | Em ambiente local, os e-mails (convite, contato) só vão para o log | Conferir um convite e um contato com o SMTP de produção |
| `NEXT_PUBLIC_API_URL` e CORS em produção não conferidos | Sem a variável, o site chama `localhost:8000` na máquina do visitante, e as telas mostram erro | Definir a variável na Vercel, conferir `CORS_ALLOW_ORIGINS` no Coolify e rodar `npm run test:e2e:prod` (ver `e2e/README.md`) |
| Comando diário das notificações não conferido | Sem a *Scheduled Task* no Coolify, nenhuma notificação de atraso é criada, e o sino fica sempre vazio | Conferir a tarefa `python -m advocondo.notificacoes.overdue`, frequência `5 3 * * *`, conforme `back/docs/notificacoes.md` |
| Onde os arquivos ficam em produção | Sem as variáveis `S3_`, documentos e PDFs ficam no PostgreSQL, com até 10 MB por documento. Funciona, mas o banco cresce | Decidir se usa um bucket, conforme `back/docs/documentos.md`. Ligar depois não quebra os arquivos antigos |
| Limite de envio no proxy de produção não conferido | O back aceita até 10 MB, mas um proxy na frente pode ter um limite menor | Enviar um arquivo perto de 10 MB depois do deploy |
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
| Outros tipos de notificação | O protótipo também avisa de baixa estornada e de contrato próximo da renovação. O back só cria o aviso de parcela em atraso | Sem issue |
| Trilha de auditoria global | O protótipo tem uma tela única, com indicadores, filtros por autor e período, e exportação. O back só responde por acordo e por usuário, então o histórico fica em cada acordo e em cada usuário | [#72](https://github.com/Advocondo/front/issues/72) |
| Cancelamento e reativação no histórico financeiro | A rota traz baixas, estornos e edições, mas não os cancelamentos. A data e o motivo aparecem no aviso do acordo, sem o autor | Sem issue |
| Histórico das renovações | Registrar uma renovação sobrescreve as datas do contrato, e a anterior se perde. A observação do protótipo não tem campo no back | Sem issue |
| Comissão de Administrador responsável | Quando o responsável por um acordo é um Administrador, os honorários entram no faturamento, mas a comissão não aparece para ninguém, porque a rota lista só a Equipe Operacional | Sem issue |
| Situação em inglês na planilha exportada | A coluna Status de `acompanhamento_AAAA_MM.xlsx` traz `open`, `overdue` e `paid`, enquanto o resto da planilha está em português. O PDF do acordo já traduz. Os testes do back conferem o valor em inglês | Sem issue |
| Observações do devedor | Estão no protótipo, mas não existem no back | Sem issue |

## Telas e fluxos que ainda não existem

| Lacuna | O que acontece hoje | Issue |
| --- | --- | --- |
| Relatório de condomínio sem acordos | O botão fica no card do condomínio, e o card só existe quando há acordo. Sem acordo, não há o que baixar pela tela, embora a rota responda | Sem issue |
| Painel da Equipe Operacional | Depois do login, a pessoa cai em Condomínios. O protótipo mobile tem uma visão própria, com totais do mês, meta, vencimentos da semana e últimas baixas | Sem issue |
| Edição da landing pelo Administrador | Textos, avaliações e fotos só mudam pela API | [#4](https://github.com/Advocondo/front/issues/4) |
| Anexar um link como documento | O back aceita um link no lugar de um arquivo, e a tela mostra os que existirem, mas só envia arquivos | Sem issue |
| PDFs no Painel do Cliente | O Cliente abre o PDF pelo link, mas o painel não lista os PDFs do acordo. O back já permite | Sem issue |
| Voltar ao link do PDF depois do login | Sem sessão, o link leva ao login, e depois do login a pessoa cai na tela inicial, não no PDF | Sem issue |
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
| Painel | Seletor de mês por setas, como em Faturas e Metas, e não uma lista. "Comissões pagas" soma os honorários das parcelas pagas no mês, e o mesmo valor aparece como "Faturamento do mês" em Metas | Consistência entre as telas. O nome depende da decisão sobre o percentual de comissão |
| Detalhe da fatura e parcelas do Cliente | A [#47](https://github.com/Advocondo/front/issues/47) não tem história de usuário nem protótipo, e os critérios são propostos. A construção foi aprovada pelo responsável em 04/11/2026 | Falta validar com o time |
| Painel do Cliente e histórico do morador | Não há protótipo: as telas foram montadas com o design system | O perfil Cliente ainda não foi prototipado |
| Meu perfil | A senha pede 8 caracteres, como no back, e o protótipo pede 10. Sem foto nem iniciais, e o botão de mostrar a senha não existe | A regra é a mesma da redefinição; os outros dois são acabamento |
| Meu perfil | Sessões antigas aparecem como "Aparelho não identificado" até o próximo login | O back só guarda o aparelho desde a [#127](https://github.com/Advocondo/back/pull/127) |
| Editar acordo | Unidade e advogado não estão no diálogo: a unidade pertence ao devedor, e o responsável tem o próprio botão. O dia de vencimento é editado em cada parcela | É como o back separa esses dados |
| Cancelar acordo | O motivo é obrigatório na tela, como no protótipo, mas opcional na API | Um acordo cancelado pela API pode aparecer como "Sem motivo registrado" |
| Notificações | O sino abre uma página, como no protótipo mobile, e não uma lista suspensa. O número só atualiza ao abrir uma tela, sem aviso em tempo real | O back não envia atualizações, e as notificações são criadas uma vez por dia |
| Condomínios | A renovação é registrada na lista, porque não há tela de detalhe do condomínio. A janela do aviso é de 60 dias, fixa no back | O detalhe do condomínio ainda não existe |
| Detalhes do acordo | Parcelas, documentos e históricos ficam em blocos na mesma página, não em abas. O PDF usa o nome e o tamanho do back, sem o código do acordo nem o número de páginas | As abas ficam para quando a tela for revista. O código do acordo não existe no back |
| Importar inadimplentes | Fica em Devedores, não em Acordos, e aceita só `.xlsx`, não `.csv`. A prévia reenvia o arquivo para confirmar, sem guardar nada entre os passos | Devedores tem tela própria neste sistema, e o back só lê `.xlsx` |
| Faturas do mês | Sem calendário. A exportação leva o mês, o condomínio, o responsável e a aba, mas não o recorte "sem nota", que a rota não filtra. A nota informada na baixa fica com a data de hoje; para outra data, registra-se depois | O calendário é herança de Prazos. O protótipo só pede o número, e o back exige a data |
| Metas e comissões | Indicadores do Administrador: faturamento, acordos ativos e inadimplência, em vez de recuperado e acordos fechados; a meta é definida no mês da tela, sem seletor de mês no diálogo | O back não devolve recuperado nem acordos fechados; o seletor do diálogo seria redundante com o da tela |

## Limitações técnicas

| Lacuna | Efeito |
| --- | --- |
| Listagens sem paginação na tela | Acordos, devedores, condomínios e usuários trazem no máximo 200 registros |
| Prévia do parcelamento repete regras do back | `acordos/plan.ts` copia `parcelas/plan.py` e `acordos/fees.py`: se o back mudar a regra, a prévia precisa mudar junto |
| Scanner de segredos olha todas as branches | Um falso positivo em qualquer branch derruba o CI de todos os PRs até ela ser apagada |
| Aviso do `Button` do `ui-kit` | Em desenvolvimento, o React avisa sobre `border` e `borderColor` misturados. Não afeta o uso |
| Telas do escritório não se adaptam ao celular | A barra lateral tem largura fixa de 248px e não recolhe, então em 390px o conteúdo fica cortado. Os protótipos mobile têm navegação inferior, que não foi construída. As telas do Cliente não têm esse problema, porque não têm barra lateral |
| Aviso de sucesso cobre o que está embaixo | O aviso fica de 4 a 5 segundos no canto inferior direito, e um botão embaixo dele, como Editar ou Baixar, não recebe o clique até ele sair ou ser fechado. Decisão do responsável: mantido como está |
| Avisos de segurança em ferramentas de desenvolvimento | `npm audit` aponta 13 avisos, 5 altos, em ESLint, Vite e outras ferramentas que não vão para o site. As dependências de produção estão sem nenhum aviso | Resolver em uma atualização dessas ferramentas. Conferir com `npm audit --omit=dev` |
| Guard de rotas roda no navegador | O back usa o cabeçalho `Authorization`, não cookie, então a checagem de sessão só acontece depois de a página carregar. Quem protege os dados é o back |

## Documentação desatualizada

| Onde | O que está errado |
| --- | --- |
| [`docs/prototipos/cobertura-historias.md`](https://advocondo.github.io/docs/prototipos/cobertura-historias/) | Diz que US13 não tem tela, mas o protótipo mobile a traz |

## Ambiente local

| Lacuna | O que fazer |
| --- | --- |
| `back/.env` da máquina de desenvolvimento está mais antigo que o `.env.example`, e a API não sobe com ele | Copiar as variáveis que faltam |
| Os remotes `origin` locais guardam um token em texto puro | Decisão do responsável: mantido como está |
