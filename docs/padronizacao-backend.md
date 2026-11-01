# Guia de padronização do backend (banco e entities)

Aplica-se a quem for criar ou alterar entities do TypeORM neste repositório.

## 1. Subir o ambiente

1. `cp .env.example .env` (o `.env` nunca vai para o Git)
2. `npm install`
3. `npm run db:start` (Postgres 15 no Docker)
4. `npm run start:dev` (com `DB_SYNCHRONIZE=true`, o TypeORM cria/atualiza as tabelas a partir das entities)
5. `npm run seed` (popula catálogo fictício e a admin; pode rodar várias vezes)

**Banco desatualizado ou com erro de enum/tipo?** Em desenvolvimento, recrie:
`npm run db:stop && docker-compose down -v && npm run db:start`, suba a API e rode o seed de novo.

## 2. Quem manda no esquema

O esquema vem das **entities**, não de scripts SQL. Não crie tabelas à mão no banco. Mudou uma coluna? Altere a entity e o `synchronize` aplica.

## 3. Convenções de nomes

- Tabelas e colunas em `snake_case`, minúsculas, sem acento: `id_pedido`, `data_entrega_prevista`.
- Propriedades das classes em `camelCase` com `name:` explícito na coluna: `@Column({ name: 'preco_metro' }) precoMetro`.
- FKs: `id_<entidade>` via `@JoinColumn({ name: 'id_...' })`.
- Um arquivo por entity: `nome-da-entity.entity.ts`. Cada pasta de funcionalidade tem seu `*.module.ts` com `TypeOrmModule.forFeature([...])`.
- Todo módulo novo entra no `imports` do `@Module` do `AppModule` (não no `forRootAsync`).

## 4. Imports (ESM)

Imports relativos **precisam da extensão `.js`**, mesmo o arquivo sendo `.ts`:
`import { Pedido } from './pedido.entity.js';`

## 5. Relações entre arquivos (evita erro de inicialização)

Quando duas entities se referenciam (Pedido ↔ Conjunto, por exemplo), use `Relation<>` no tipo da propriedade:

    @ManyToOne(() => Pedido, (p) => p.conjuntos, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_pedido' })
    pedido!: Relation<Pedido>;

Sem isso: `ReferenceError: Cannot access 'X' before initialization`.

## 6. Enums em arquivo próprio

Defina enums em um arquivo sem imports de entities (ex.: `pedidos/entities/enums.ts`) e importe de lá. Enum definido dentro de um arquivo de entity que participa de um ciclo chega como `undefined` e derruba o sync com
`Cannot read properties of undefined (reading 'map')`.

Obs.: o log "Unable to connect to the database" do Nest aparece para **qualquer** falha no sync. Leia o erro que vem logo abaixo, não só a primeira linha.

## 7. Dinheiro, metros e quantidades

- Dinheiro e metros: `numeric(10,2)` com o `decimalTransformer` (`src/database/decimal.transformer.ts`), para chegar como `number` e não como string. Nunca `float`.
- Quantidades inteiras (adereços): `int`.
- Estoque: toda baixa deve ser **atômica e dentro de transação**:
  `UPDATE ... SET quantidade = quantidade - :n WHERE id = :id AND quantidade >= :n` (0 linhas afetadas = estoque insuficiente → `ROLLBACK`).
- O `CHECK` do banco é a última barreira, não a validação principal.

## 8. Soft delete

Nada é apagado de verdade. Catálogo (`modelo`, `tecido`, `adereco`) tem `desabilitado` (reversível, RF-22) e `excluido` (some para o cliente, RF-20), ambos `default false`. Consultas do cliente filtram os dois; pedidos antigos continuam apontando para o item.
Todas as FKs usam `onDelete: 'RESTRICT'`.

## 9. Regras de domínio já decididas

- Tecido em **metros lineares do rolo** (`quantidade_m`, `preco_metro`); `metragem_media_m` do modelo na mesma unidade.
- Adereço tem `tipo` como **string livre** (sem enum e sem tabela de categoria), digitado pela gestora. Normalizar com trim e minúsculas no back, para "Pedraria" e "pedraria" não virarem tipos diferentes.
- Adereço aplicado: **uma linha em `adereco_peca` por unidade**, com coordenadas em **proporção da imagem (0 a 1)**. A quantidade é a contagem de linhas.
- `num_pedido` é sequencial e único (o que a cliente cita no WhatsApp); o `id` é UUID.
- Mudança de status grava uma linha em `historico_status`; mudança de estoque grava em `movimentacao_estoque` (exatamente um entre tecido e adereço).
- `preco_final` e parcelas são nulos até o aceite (RF-06).
- E-mail da admin vem de `ADMIN_EMAIL` (variável de ambiente), nunca no repositório. O `npm run seed` cria a admin com esse e-mail.
- Prazo de confecção é fixo (3 dias), vindo de `PRAZO_CONFECCAO_DIAS` (variável de ambiente). Frete e demais prazos são separados. A data mínima de entrega no RF-08 = hoje + `PRAZO_CONFECCAO_DIAS` + `prazo_frete_dias`, respeitando as datas bloqueadas na agenda.

## 10. Git

- Branch por US: `feat/usN-descricao`. PR como rascunho cedo; sem push direto na `main`.
- Antes do commit: `git status --short`. `.env` não entra.