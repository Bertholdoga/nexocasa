# NexoCasa — índice e guia de teste local

Esta pasta contém uma versão funcional do NexoCasa preparada para testes na sua
própria máquina. Ela não altera nem substitui a versão que já foi publicada.

Pré-requisitos: Windows, Node.js 22.13 ou mais recente e pnpm. Nesta máquina, as
versões instaladas já atendem aos requisitos.

## Início rápido

1. Dê dois cliques em `INICIAR_NEXOCASA.cmd`.
2. Mantenha a janela preta do servidor aberta.
3. Aguarde o navegador abrir em <http://localhost:4173/dashboard>.
4. Para encerrar, volte à janela do servidor e pressione `Ctrl+C`.

Se o navegador abrir antes de o servidor terminar de iniciar, espere alguns
segundos e atualize a página com `F5`.

Também é possível iniciar manualmente pelo terminal, dentro desta pasta:

```powershell
pnpm install
pnpm run dev:local
```

O arquivo `index.html` desta pasta é uma página simples de entrada com o link e
as mesmas orientações. O aplicativo propriamente dito precisa do servidor local;
por isso não funciona apenas abrindo um HTML estático.

## O que está pronto para testar

- Dashboard mensal com receitas, despesas, investimentos, saldo e previsões.
- Lançamentos com criação, edição, filtros, status e exclusão confirmada.
- Transferências sem duplicar receita ou despesa nos totais.
- Orçamentos por categoria e alertas de limite.
- Metas financeiras e acompanhamento de progresso.
- Planejamento de recorrências semanais, mensais e anuais.
- Cartões de crédito, ciclo, fechamento e pagamento de fatura.
- Importação de arquivos CSV e Excel `.xlsx`, com prévia e validação.
- Exportação de lançamentos em CSV.
- Euro (EUR) como moeda inicial, com opção de Real brasileiro (BRL) em
  **Configurações**.
- Comprovantes por arquivo, foto ou áudio.
- Relatório anual, gráfico mensal e DRE por categoria.
- Layout responsivo para computador e celular.

## Rotas principais

| Área          | Endereço                             |
| ------------- | ------------------------------------ |
| Visão geral   | <http://localhost:4173/dashboard>    |
| Lançamentos   | <http://localhost:4173/transactions> |
| Planejamento  | <http://localhost:4173/planning>     |
| Orçamentos    | <http://localhost:4173/budgets>      |
| Metas         | <http://localhost:4173/goals>        |
| Relatórios    | <http://localhost:4173/reports>      |
| Configurações | <http://localhost:4173/settings>     |

## Roteiro de validação sugerido

Use dados fictícios durante esta fase.

1. Crie uma conta corrente, uma carteira e um cartão de crédito.
2. Cadastre uma receita e uma despesa e confirme os totais do dashboard.
3. Faça uma transferência e confirme que ela não altera receita/despesa.
4. Crie um orçamento e verifique o aviso de consumo do limite.
5. Cadastre uma recorrência mensal, abra **Planejamento** e gere os próximos itens.
6. Lance uma compra no cartão, feche a fatura e registre o pagamento.
7. Importe um pequeno CSV ou `.xlsx` e confira a prévia antes de confirmar.
8. Anexe um arquivo, uma foto ou um áudio a um lançamento.
9. Recarregue a página com `F5` e confirme que os dados continuam presentes.
10. Reduza a janela para conferir a navegação no formato de celular.
11. Em **Configurações**, alterne entre EUR e BRL e confirme a exibição. Essa
    troca não converte os números já cadastrados.

Planilhas Excel com milhares de linhas ou colunas vazias formatadas são
bloqueadas antes da leitura para proteger a memória do navegador. Nesse caso,
exporte apenas a aba de lançamentos como CSV ou use uma cópia otimizada.

## Onde os dados ficam nesta versão

No localhost, os dados financeiros ficam no `localStorage` e os arquivos anexos
no `IndexedDB` do perfil de navegador usado no teste. Isso significa:

- os dados permanecem após atualizar ou fechar a página;
- os dados pertencem ao mesmo navegador, perfil e endereço com porta `4173`;
- aba anônima, outro navegador, outro perfil ou outro computador não os verá;
- limpar os dados do navegador pode apagar todo o teste;
- esta etapa ainda não oferece backup, sincronização ou recuperação de conta.

O endereço `localhost` só pode ser aberto neste mesmo computador. Acesso por
celular ou outra máquina será configurado apenas em uma futura etapa de rede ou
publicação.

Não use esta versão local como único local de armazenamento de dados financeiros
reais. A infraestrutura de banco D1 e arquivos R2 está preparada no código para a
fase hospedada, mas a publicação comercial exige autenticação, isolamento entre
famílias, backups e políticas de privacidade revisadas.

## Verificações técnicas

Dentro desta pasta, os comandos de controle de qualidade são:

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

O estado e os próximos passos estão documentados em `CONTINUAR.md`.
