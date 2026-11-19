# Afazeres

Lista de tarefas que roda inteira no navegador, feita com React 19, TypeScript e CSS puro. O visual imita um caderno pautado com marca-texto: concluir uma tarefa risca o texto como uma caneta faria, e uma tarefa nova entra destacada em amarelo.

Não há backend nem conta de usuário. As tarefas ficam salvas no `localStorage` do navegador.

## Funcionalidades

- Criar, editar, concluir e excluir tarefas
- Prioridade (baixa, média ou alta) e data de vencimento opcionais, com aviso de tarefa atrasada
- Filtros: todas, ativas e concluídas
- Contador de pendentes e botão "Limpar concluídas"
- Reordenar arrastando, pelo teclado ou pelo menu "Mover", sem precisar arrastar
- Tema claro e escuro: segue o sistema até você escolher, sem piscar ao carregar
- Funciona no celular, a partir de 360px de largura
- Acessibilidade com meta WCAG 2.2 AA: navegação completa por teclado, anúncios para leitores de tela, suporte a movimento reduzido e ao Alto Contraste do Windows

## Como rodar

É preciso ter o Node.js e o [pnpm](https://pnpm.io) instalados.

```bash
pnpm install
pnpm dev
```

Depois, abra o endereço que o Vite mostrar no terminal (por padrão, http://localhost:5173).

### Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento com recarga automática |
| `pnpm build` | Checa os tipos e gera a build de produção em `dist/` |
| `pnpm preview` | Serve a build de produção localmente |
| `pnpm lint` | Roda o ESLint |
| `pnpm test` | Roda os testes uma vez |
| `pnpm test:watch` | Roda os testes em modo observação |
| `pnpm test:coverage` | Roda os testes com relatório de cobertura (mínimo de 80%) |

## Atalhos de teclado

| Onde | Tecla | Ação |
|---|---|---|
| Qualquer lugar | `Alt+N` | Vai para o campo "Nova tarefa" |
| Campo nova tarefa | `Enter` | Adiciona a tarefa |
| Tarefa focada | `Enter` | Edita |
| Tarefa focada | `Espaço` | Conclui ou reabre |
| Tarefa focada | `Delete` | Exclui |
| Tarefa focada | `↑` / `↓` | Vai para a tarefa anterior ou seguinte |
| Tarefa focada | `Home` / `End` | Vai para a primeira ou a última tarefa |
| Tarefa focada | `Alt+↑` / `Alt+↓` | Move a tarefa uma posição (no filtro "Todas") |
| Editando | `Enter` / `Esc` | Salva / cancela |
| Arrastando | `Esc` | Cancela o arraste |

## Estrutura

```
src/
├── App.tsx            # composição da página
├── types.ts           # tipos Todo, Priority, Filter
├── state/
│   ├── todosReducer.ts  # reducer puro com todas as ações da lista
│   └── storage.ts       # leitura e gravação validadas no localStorage
├── hooks/
│   ├── useTodos.ts          # estado da lista + persistência
│   ├── useTheme.ts          # tema claro/escuro
│   ├── usePointerReorder.ts # arraste com Pointer Events nativos
│   └── announcer.ts         # anúncios para leitores de tela
├── components/        # componentes da interface (TodoItem, FilterBar, ItemMenu…)
├── lib/               # datas, textos, ids, sanitização, seletores, animação
├── styles/            # tokens.css (cores e medidas) e CSS por área
└── test/setup.ts      # configuração do Vitest
public/theme-init.js   # aplica o tema antes do CSS, para não piscar
docs/
├── design-spec.md     # especificação de design (fonte da verdade visual)
└── deploy-security.md # CSP e headers para produção
```

### Decisões principais

- **Estado:** todo o estado da lista passa por um reducer puro, testável sem React.
- **Dados salvos:** são validados campo a campo ao carregar. Dados corrompidos ou de outra versão não apagam o que está salvo: o conteúdo original é copiado para a chave `afazeres:todos:backup`.
- **Dependências:** em runtime, só React e as fontes, que são hospedadas localmente. Não há bibliotecas de UI, de estado ou de drag-and-drop.
- **Design:** cores e medidas vêm de CSS custom properties em [src/styles/tokens.css](src/styles/tokens.css), definidas em [docs/design-spec.md](docs/design-spec.md).

## Testes

Os testes usam Vitest e Testing Library em jsdom. Eles cobrem o reducer, a validação do storage (incluindo dados maliciosos), os hooks, os fluxos de interface, as animações e as regressões corrigidas.

```bash
pnpm test:coverage
```

## Publicação

O app é estático: basta publicar a pasta `dist/` gerada por `pnpm build`. Antes de publicar:

- configure no servidor a CSP e os headers descritos em [docs/deploy-security.md](docs/deploy-security.md);
- rode `pnpm audit` para checar as dependências;
- publique numa origem própria, porque o `localStorage` é compartilhado entre os apps da mesma origem.

## Limitações conhecidas

- Os dados ficam só no navegador em que foram criados, sem sincronização entre dispositivos.
- Com duas abas abertas, a última que salvar sobrescreve a outra.
- O limite é de 1000 tarefas.
