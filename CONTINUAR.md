# NexoCasa — resumo para continuidade

## Estado entregue

O NexoCasa está pronto como protótipo local funcional para avaliação das jornadas
financeiras. A versão publicada anteriormente não foi modificada e nenhuma nova
publicação foi realizada nesta etapa.

Implementado nesta fase:

- persistência local para testes sem depender de login ou conexão externa;
- importação direta de CSV e Excel `.xlsx`, inclusive seleção de aba;
- recorrências explícitas, sem criação automática ao trocar o mês;
- área de Planejamento para gerar, pausar e reativar recorrências;
- cartões, ciclos, fechamento e pagamento de fatura por transferência;
- anexos por arquivo, foto e áudio, com revisão antes de salvar;
- persistência de anexos local via IndexedDB e hospedada via R2;
- evolução do esquema D1 por migração aditiva `0001_legal_plazm.sql`;
- correções de responsividade, inclusive largura de 360 px;
- testes unitários das regras financeiras centrais;
- inicializador Windows e documentação de teste.
- Euro (EUR) e Real brasileiro (BRL) como moedas-base selecionáveis, com Euro
  como padrão para novos testes e sem conversão cambial silenciosa.

## Decisões importantes preservadas

- valores monetários são armazenados em centavos inteiros;
- a moeda-base pode ser EUR ou BRL; mudar a opção não converte valores antigos;
- transferências não compõem totais de receita ou despesa;
- navegar entre meses nunca cria lançamentos automaticamente;
- o vencimento recorrente ancorado no dia 31 volta ao dia 31 quando o mês permite;
- pagamento de fatura é transferência, evitando contar a despesa duas vezes;
- os anexos são privados e vinculados ao proprietário no ambiente hospedado;
- a migração inicial `0000` não foi reescrita.

## Validação final — 16 de setembro de 2026

- verificação de tipos aprovada;
- análise estática aprovada;
- 9 testes automatizados aprovados;
- build de produção aprovado para todas as rotas e APIs;
- dashboard, lançamentos, planejamento, orçamentos, metas, relatórios e
  configurações responderam com HTTP 200 no localhost;
- seletor de Euro e Real confirmado na página de configurações;
- a planilha Capivara original foi rejeitada de forma controlada antes da
  leitura pesada porque contém formatação vazia até colunas muito distantes;
- `git diff --check` não encontrou erros de espaços ou marcadores de conflito.

O build ainda informa apenas um aviso não bloqueador de pacote JavaScript acima
de 500 kB. Uma futura otimização pode dividir o carregamento por rota, mas isso
não impede os testes desta versão.

## Arquivos principais desta evolução

- `components/finance-workspace.tsx`: interface financeira principal.
- `components/planning-view.tsx`: gestão de recorrências e planejamento.
- `components/attachment-composer.tsx`: captura e revisão de anexos.
- `lib/finance-rules.ts`: regras puras de datas, ciclos e recorrências.
- `lib/import-transactions.ts`: leitura e validação de CSV e Excel.
- `lib/local-preview.ts`: persistência local e anexos em IndexedDB.
- `app/api/finance/route.ts`: operações financeiras hospedadas.
- `app/api/attachments/route.ts`: armazenamento privado de anexos.
- `db/schema.ts`: esquema atual do banco.
- `drizzle/0001_legal_plazm.sql`: migração aditiva desta versão.
- `tests/finance-rules.test.ts`: testes automatizados das regras centrais.

## Próxima fase recomendada — transformar em SaaS

Antes de vender ou guardar dados reais de clientes, implementar nesta ordem:

1. autenticação própria, famílias/organizações e convites;
2. autorização por família em todas as rotas e testes de isolamento;
3. aplicação da migração em ambiente de homologação e validação de rollback;
4. backup automático, restauração e trilha de auditoria;
5. termos de uso, política de privacidade, consentimento e adequação à LGPD;
6. planos, assinatura, cobrança, cancelamento e controle de acesso;
7. monitoramento, logs sem dados sensíveis, alertas e suporte;
8. parcelamento de compras e pagamento parcial de faturas;
9. mapeamento guiado de colunas para planilhas fora do formato esperado;
10. OCR/transcrição opcional para comprovantes, com consentimento explícito.

## Como retomar em outro dia

Peça para continuar o projeto na pasta `nexocasa` e forneça este arquivo como
contexto. A primeira ação deve ser executar:

```powershell
git status --short
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Para identificar o checkpoint local entregue, execute `git log -1 --oneline`.

Depois, revisar os itens da seção **Próxima fase recomendada** e escolher apenas
uma etapa por vez. Não publicar nem aplicar migrações em produção sem confirmação
explícita.
