# Plano de lançamento do NexoCasa como SaaS

Data de referência: 16 de setembro de 2026.

## Resultado pretendido

Colocar o NexoCasa à venda como um serviço web de organização financeira
familiar, começando por Portugal, com autenticação própria, dados isolados por
família, assinatura recorrente, privacidade, suporte e recuperação de falhas.

Prazo indicativo para uma pessoa:

- 10 a 12 semanas em dedicação integral;
- 3 a 5 meses em tempo parcial;
- integrações bancárias, investimentos e aplicativo nativo ficam fora do
  primeiro lançamento.

O produto atual é um protótipo funcional forte, mas não deve receber dados reais
de clientes pagantes até os bloqueadores P0 deste documento serem concluídos.

## Estratégia recomendada

1. Lançar primeiro em Portugal e cobrar apenas em EUR.
2. Manter o produto como organizador financeiro, sem recomendações de
   investimento, crédito ou instituição financeira.
3. Oferecer um único plano, evitando planos e permissões excessivamente
   complexos.
4. Realizar uma beta fechada antes de abrir o cadastro ao público.
5. Expandir para o restante da União Europeia somente após validar IVA/OSS.
6. Abrir o Brasil em uma terceira etapa, após adaptação à LGPD, CDC, BRL,
   tributação e atendimento local.

## Oferta inicial para validação

Hipótese de preço, a ser validada com clientes reais:

- teste completo de 30 dias, sem cartão;
- NexoCasa Premium: EUR 6,90/mês ou EUR 69/ano;
- primeiros 100 clientes: EUR 4,90/mês por 12 meses;
- sem plano vitalício;
- futura oferta brasileira: BRL 29,90/mês ou BRL 299/ano;
- os preços devem ser apresentados com impostos e renovação claramente
  informados no checkout.

Promessa inicial:

> Organize as finanças da casa em poucos minutos, importe a sua planilha e
> acompanhe mês, cartões, orçamento e metas num único lugar, sem vender os seus
> dados.

Público inicial:

- casais e famílias que hoje controlam as finanças em Excel ou planilhas;
- pessoas que querem controle manual, mas não desejam conectar a conta bancária;
- maiores de 18 anos.

## Arquitetura de produção

### O que pode ser preservado

- interface e regras financeiras atuais;
- Cloudflare Workers para aplicação e APIs;
- R2 para anexos privados;
- importação CSV/XLSX;
- modelo de valores em centavos;
- rotinas de recorrência, cartões, orçamento, metas e relatórios.

### Decisão obrigatória na primeira semana

Escolher uma destas opções e não manter dois bancos em produção:

**Opção recomendada para venda pública:** PostgreSQL gerenciado com Row-Level
Security, autenticação gerenciada e uma região europeia. Isso adiciona uma
segunda barreira contra vazamento de dados entre famílias.

**Opção mais rápida para beta limitada:** manter D1, mas criar uma camada única
de autorização por família, constraints no banco e testes negativos de
isolamento em todas as rotas. D1 não possui RLS; a segurança dependerá da
aplicação.

Modelo mínimo de produção:

```text
users
households
memberships (household_id, user_id, role)
invites
accounts / transactions / categories / budgets / goals (household_id)
attachments
subscriptions
entitlements
audit_events
migration_batches
idempotency_keys
```

Papéis iniciais: `owner`, `admin` e `member`. Adicionar `viewer` somente se
houver necessidade comprovada.

## Roteiro de 12 semanas

### Semana 1 — decisões empresariais e arquitetura

- escolher atividade em nome individual ou sociedade;
- contratar contabilista certificado com experiência em serviços digitais;
- consultar advogado português de SaaS, RGPD e consumo;
- verificar disponibilidade e registo da marca NexoCasa;
- definir Portugal como único mercado inicial;
- escolher banco de produção, autenticação e provedor de cobrança;
- definir disponibilidade, RPO e RTO iniciais;
- criar inventário dos dados e fornecedores.

Critério de conclusão:

- entidade vendedora, forma de faturação, país, moeda, arquitetura e orçamento
  mensal documentados.

### Semanas 2 e 3 — identidade, famílias e isolamento

- substituir os cabeçalhos de autenticação da hospedagem por login público;
- implementar e-mail verificado, recuperação de conta e sessões revogáveis;
- exigir MFA para administradores da operação;
- criar famílias, membros, convites e papéis;
- substituir `owner_id` por `household_id` onde for apropriado;
- adicionar chaves estrangeiras, constraints e índices;
- centralizar toda autorização num único módulo de backend;
- separar desenvolvimento, homologação e produção;
- testar tentativas de acesso cruzado a dados e anexos.

Critério de conclusão:

- um utilizador nunca consegue consultar, alterar, excluir ou baixar qualquer
  recurso de outra família, mesmo manipulando IDs e pedidos HTTP.

### Semana 4 — dados em nuvem, importação e migração

- remover `localStorage` e `IndexedDB` do caminho de produção;
- manter armazenamento local apenas como modo de demonstração;
- criar exportação completa versionada de dados e anexos;
- criar importação para a nuvem com prévia, moeda, totais e deduplicação;
- registrar cada migração como lote reversível;
- adicionar paginação para não carregar toda a vida financeira de uma vez;
- validar contagens, saldos e checksums depois da migração.

Observação: o domínio de produção não consegue ler automaticamente dados do
`localhost`. A transferência precisa ocorrer por exportação e importação de um
arquivo.

Critério de conclusão:

- repetir uma importação não duplica dados e interrompê-la não deixa um estado
  parcial.

### Semana 5 — assinatura e controle de acesso

Recomendação inicial: avaliar Paddle como Merchant of Record. A tarifa padrão
publicada é 5% + USD 0,50 por checkout e inclui cobrança, impostos indiretos,
fraude e operação de assinaturas. A Stripe custa menos por transação em
Portugal, mas deixa mais responsabilidades fiscais e operacionais com a empresa.

- criar produto e preço no ambiente sandbox;
- checkout hospedado, sem guardar dados de cartão;
- implementar webhooks assinados e idempotentes;
- criar assinatura, período de teste, cancelamento, reembolso e tolerância por
  falha de pagamento;
- manter `subscription` separado de `entitlements`;
- bloquear recursos pagos no backend, não apenas na interface;
- criar portal de cobrança e cancelamento dentro da conta;
- testar webhooks duplicados, atrasados e fora de ordem.

Critério de conclusão:

- cadastro, teste, pagamento, falha, recuperação, cancelamento e reembolso
  funcionam de ponta a ponta no sandbox.

### Semana 6 — privacidade e direitos do cliente

- elaborar Registo de Atividades de Tratamento;
- realizar AIPD/DPIA com base no desenho final;
- definir base legal e retenção para cada conjunto de dados;
- implementar exportação, correção e eliminação da conta;
- impedir reutilização de dados financeiros para publicidade ou treino de IA;
- publicar lista de subprocessadores;
- assinar DPA com fornecedores e documentar transferências internacionais;
- bloquear analytics e cookies não essenciais até consentimento quando
  aplicável;
- manter prova de aceite da versão dos Termos e da Política de Privacidade.

Critério de conclusão:

- o cliente consegue baixar os dados e pedir exclusão sem abrir chamado; pedidos
  de direitos possuem processo e responsável definidos.

### Semana 7 — segurança para internet pública

- rate limiting para login, API, importação e upload;
- limites por plano para anexos, armazenamento e importações;
- validação da assinatura real de arquivos, não apenas do MIME do navegador;
- varredura de malware e URLs temporárias para anexos;
- CSP, HSTS, `frame-ancestors`, `Referrer-Policy` e `Permissions-Policy`;
- proteção de origem/CSRF e CORS restrito;
- gestão de segredos e menor privilégio;
- idempotência e atomicidade nas operações financeiras;
- auditoria sem registrar saldos, descrições ou anexos nos logs;
- análise de dependências e segredos no repositório.

Critério de conclusão:

- não existem achados críticos ou altos na revisão de segurança e nenhum log
  contém informação financeira do cliente.

### Semana 8 — backup, monitorização e operação

- backup automático do banco e retenção separada;
- versionamento ou estratégia de recuperação de anexos;
- executar restauração real em homologação;
- criar logs estruturados com `request_id` e tenant pseudonimizado;
- monitorizar erros, latência, login, uploads, cobrança, jobs e armazenamento;
- configurar alertas e verificação de disponibilidade;
- criar CI com tipos, lint, testes, build, migrations e análise de segurança;
- escrever runbooks de incidente, restauração, rollback e falha de pagamento;
- configurar e-mail transacional sem incluir valores financeiros.

Sugestão inicial: RPO de até 1 hora e RTO de até 4 horas.

Critério de conclusão:

- uma restauração completa foi demonstrada e um alerta de teste chegou à pessoa
  responsável.

### Semana 9 — qualidade, acessibilidade e testes

- testes de API, autenticação, autorização e isolamento;
- testes de integração com banco, anexos, e-mail e pagamentos;
- E2E para cadastro, lançamento, importação, assinatura, cancelamento, exportação
  e exclusão;
- testes de concorrência e idempotência;
- teste de carga no volume previsto;
- WCAG 2.2 AA: teclado, foco, contraste, rótulos, erros e alternativa textual
  para gráficos;
- revisão em telemóvel real e navegadores principais;
- teste de intrusão focado em autenticação, IDOR, uploads e cobrança.

Critério de conclusão:

- nenhum P0/P1 aberto, fluxos críticos automatizados e rollback ensaiado.

### Semanas 10 e 11 — beta fechada

- convidar 10 a 30 famílias;
- começar com dados não críticos;
- acompanhar pessoalmente o primeiro uso e a importação;
- medir ativação, retorno, falhas e pedidos de suporte;
- corrigir apenas problemas que bloqueiam adoção ou segurança;
- congelar funcionalidades antes da beta paga.

Critério de conclusão:

- duas semanas sem perda ou exposição de dados;
- backup, restauração, alertas e suporte exercitados;
- pelo menos cinco participantes demonstram disposição real de pagar.

### Semana 12 — beta paga em Portugal

- domínio próprio, TLS e e-mails do domínio;
- página pública, demonstração com dados fictícios e onboarding;
- checkout restrito ao mercado autorizado;
- faturação validada pelo contabilista;
- documentos jurídicos aprovados;
- suporte, cancelamento e reembolso testados;
- lançamento pequeno, sem anúncios pagos relevantes.

Abrir o lançamento público somente depois de duas semanas de beta paga estável.

## Documentos obrigatórios antes de cobrar

- Termos de Serviço;
- Aviso/Política de Privacidade;
- Política de Cookies;
- cancelamento, reembolso e livre resolução;
- lista de subprocessadores;
- página de segurança;
- contacto de suporte e reclamações;
- aviso de que o serviço organiza informações e não presta aconselhamento
  financeiro;
- informação legal da empresa, preço total, periodicidade e renovação;
- acesso ao Livro de Reclamações Eletrónico, se confirmado aplicável;
- informação sobre resolução alternativa de litígios aplicável.

Antes da primeira cobrança, validar tudo com advogado e contabilista. Um
processador ou Merchant of Record não elimina automaticamente as obrigações da
empresa perante privacidade, consumidor, contabilidade e suporte.

## Gate de lançamento: não vender enquanto faltar qualquer item

- [ ] entidade legal e faturação confirmadas;
- [ ] autenticação própria e recuperação de conta;
- [ ] isolamento por família testado negativamente;
- [ ] homologação separada de produção;
- [ ] migrations e rollback ensaiados;
- [ ] backup restaurado com sucesso;
- [ ] anexos privados, quotas e proteção contra arquivo malicioso;
- [ ] rate limiting, headers de segurança e segredos protegidos;
- [ ] cobrança e webhooks idempotentes;
- [ ] cancelamento, reembolso e falha de pagamento testados;
- [ ] exportação e eliminação de conta;
- [ ] logs sem dados financeiros e alertas funcionando;
- [ ] Termos, Privacidade, Cookies e retenção aprovados;
- [ ] suporte e resposta a incidentes definidos;
- [ ] teste de intrusão sem achado crítico ou alto;
- [ ] nenhuma pendência P0 ou P1.

## Métricas da validação

Estas são metas internas iniciais, não garantias de mercado:

- ativação: 60% criam/importam 20 lançamentos e um orçamento em 24 horas;
- retorno: 50% voltam no mês seguinte;
- conversão: 10% a 15% dos testes tornam-se pagantes;
- churn: abaixo de 5% ao mês depois de três ciclos;
- suporte: primeira resposta em até um dia útil;
- qualidade: menos de 1% de erro nos fluxos principais;
- marco antes de ampliar escopo: 10 clientes pagantes e três indicações
  espontâneas.

Nunca enviar para analytics nomes, e-mails, saldos, valores, descrições,
categorias personalizadas, anexos ou dados bancários.

## Custos iniciais indicativos

Uma operação enxuta pode começar aproximadamente com:

- Cloudflare Workers Paid: a partir de USD 5/mês;
- analytics respeitando privacidade: cerca de USD 9/mês ou medição interna;
- e-mail transacional: gratuito no volume inicial ou cerca de USD 9/mês;
- autenticação, monitorização e suporte: planos gratuitos no início, conforme os
  limites de cada fornecedor;
- total técnico indicativo: USD 14 a USD 23/mês, além do domínio, taxas de
  pagamento, impostos, contabilidade, jurídico e segurança.

Reservar EUR 50 a EUR 100 por mês para ferramentas e variações no começo. O
orçamento profissional para advogado, contabilista e teste de segurança deve ser
cotado separadamente.

## Itens que não devem atrasar a primeira venda

- Open Banking;
- recomendações de investimento;
- câmbio automático;
- IA lendo transações;
- OCR e transcrição de comprovantes;
- aplicativo móvel nativo;
- relatórios avançados;
- muitos planos e add-ons;
- colaboração familiar avançada além do necessário para isolamento seguro.

## Expansão posterior para a União Europeia e Brasil

### União Europeia

- validar regras de IVA por país e OSS;
- confirmar traduções e direitos do consumidor;
- rever cookies, acessibilidade e transferências internacionais;
- manter preços e condições sem discriminação indevida por residência na UE.

### Brasil

- Termos e Privacidade em PT-BR;
- enquadramento LGPD e canal de direitos;
- CDC, direito de arrependimento e cancelamento eletrônico;
- tributação, nota fiscal, câmbio e estrutura de venda;
- incidentes conforme regras da ANPD;
- Pix/assinatura em BRL quando o provedor escolhido suportar;
- advogado brasileiro e contabilista tributário internacional antes de abrir o
  checkout.

## Fontes oficiais e comerciais consultadas

- [Comissão Europeia — obrigações RGPD](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en)
- [EDPB — guia para pequenas empresas](https://www.edpb.europa.eu/sme-data-protection-guide/home_en)
- [Your Europe — comércio eletrónico B2C](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm)
- [Your Europe — IVA e OSS](https://europa.eu/youreurope/business/finance-and-tax/vat/one-stop-shop/index_en.htm)
- [Autoridade Tributária — fatura e recibo](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Atividade_profissional/Fatura_e_recibo/Paginas/default.aspx)
- [ASAE — Livro de Reclamações](https://www.asae.gov.pt/reclamacoes-e-denuncias/livro-de-reclamacoes.aspx)
- [CMVM — informação ao investidor](https://investidor.cmvm.pt/)
- [Paddle — preços](https://www.paddle.com/pricing)
- [Stripe Portugal — preços](https://stripe.com/pt-pt/pricing)
- [Cloudflare Workers — preços](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 — Time Travel e backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare R2 — preços](https://developers.cloudflare.com/r2/pricing/)
- [ANPD — segurança para agentes de pequeno porte](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte)

Este documento é um roteiro de produto, tecnologia e operação. Não substitui
parecer jurídico ou fiscal individualizado.
