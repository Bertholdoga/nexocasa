# NexoCasa

Aplicativo privado de finanças familiares criado como produto original. A referência da Planilha da Capivarinha foi usada apenas para mapear jornadas e lacunas; marca, textos, ilustrações e código não foram copiados.

## O que já funciona

- autenticação com ChatGPT e isolamento por usuário no servidor;
- dashboard mensal com realizado, previsto, a pagar e a receber;
- lançamentos de entrada, despesa, investimento e transferência;
- edição, mudança de status e exclusão com confirmação;
- filtros combinados por texto, grupo e status;
- orçamentos por categoria com alertas de limite;
- metas financeiras e registro rápido de progresso;
- relatório anual, gráfico mensal e DRE categorias × meses;
- importação CSV e `.xlsx` com seleção de aba, prévia, validação e deduplicação;
- exportação CSV;
- recorrências semanais, mensais ou anuais, geradas somente por confirmação;
- cartões com limite, ciclo, fechamento e pagamento de fatura como transferência;
- comprovantes por arquivo, foto ou áudio, com revisão antes do salvamento;
- moeda-base selecionável entre Euro (EUR) e Real brasileiro (BRL), com Euro
  como padrão para novos testes;
- layout responsivo, rótulos acessíveis e atalhos WebMCP;
- banco D1 para dados estruturados e R2 para comprovantes privados no ambiente
  hospedado.

Valores monetários são armazenados em centavos inteiros. Trocar a moeda-base
altera a exibição e os novos cadastros, mas não aplica conversão cambial aos
valores existentes. Transferências não entram nos totais de receita ou despesa.
Navegar entre meses nunca cria dados automaticamente.

## Desenvolvimento local

```bash
pnpm install
pnpm run dev:local
```

Depois, abra `http://localhost:4173/dashboard` no navegador da mesma máquina.

Verificações:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

No `localhost`, os dados de teste ficam no `localStorage` do navegador e os
comprovantes no `IndexedDB` do mesmo perfil. Isso permite recarregar a página sem
perder o teste, mas não substitui backup nem sincronização entre dispositivos.

## Próximas evoluções previstas

- mapeamento guiado de colunas para planilhas com cabeçalhos diferentes;
- parcelamento de compras e pagamentos parciais de fatura;
- OCR/transcrição opcional para sugerir dados de foto e áudio;
- membros da família, convites e permissões compartilhadas;
- autenticação própria do SaaS, planos, assinaturas e cobrança;
- backups, trilha de auditoria, observabilidade e políticas de privacidade.
