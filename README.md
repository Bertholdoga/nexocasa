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
- importação CSV com prévia, validação e deduplicação;
- exportação CSV;
- layout responsivo, rótulos acessíveis e atalhos WebMCP;
- banco D1 para dados estruturados e R2 reservado para comprovantes privados.

Valores monetários são armazenados em centavos inteiros. Transferências não entram nos totais de receita ou despesa. Navegar entre meses nunca cria dados automaticamente.

## Desenvolvimento local

```bash
pnpm install
pnpm run dev
```

Verificações:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

## Próximas evoluções previstas

- importação direta de `.xlsx` com mapeamento guiado de colunas;
- recorrências com prévia e prevenção de duplicatas;
- conciliação por conta e fechamento de cartão;
- anexos de comprovantes no R2;
- captura por foto/áudio com consentimento e revisão antes de gravar;
- membros da família e permissões compartilhadas.
