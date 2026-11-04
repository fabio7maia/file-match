# Elyvan FileMatch

Renomeia vários ficheiros de uma só vez com base numa lista Excel (.xlsx) ou CSV.
Funciona localmente no navegador: os ficheiros não são enviados para nenhum servidor.

## Utilização

1. `npm start` e abra http://localhost:3000 (ou `PORT=... npm start`).
2. Escolha os ficheiros a renomear.
3. Escolha a lista: a primeira coluna é a referência (nome do ficheiro sem extensão) e a segunda o novo nome.
   Cabeçalhos "Referência" / "Novo nome" são reconhecidos automaticamente.
4. Confirme a pré-visualização. Os ficheiros são associados automaticamente; pode corrigir a associação em cada linha.
   Erros (nomes inválidos) e conflitos (dois ficheiros com o mesmo novo nome) são assinalados.
5. Descarregue o ZIP com as cópias renomeadas. A extensão original é mantida e os originais não são alterados.

## Desenvolvimento

- `npm test` — testes unitários (`node:test`, sem dependências).
- `src/` — lógica (CSV, leitura de .xlsx, ZIP, planeamento das renomeações).
- `public/` — interface web.

Limitações: ficheiros .xls antigos não são suportados (guarde como .xlsx ou CSV); ZIP64 não é suportado.

Compra única de referência: 5 €, sem subscrição.
