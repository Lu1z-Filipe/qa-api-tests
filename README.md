# Automação de testes de API

[![CI](https://github.com/Lu1z-Filipe/qa-api-tests/actions/workflows/ci.yml/badge.svg)](https://github.com/Lu1z-Filipe/qa-api-tests/actions/workflows/ci.yml)

> Estudo técnico pessoal, parte do [portfólio de QA](https://lu1z-filipe.github.io/luiz-filipe-portfolio/). API e dados sintéticos criados para este repositório.

## Objetivo
Demonstrar uma suíte de testes de API organizada e reutilizável: sucesso e falha, contrato de resposta, validação de
campos, valores-limite, regras de negócio e autenticação.

## Arquitetura
- `src/server.js` — "Loja Demo", API local em memória (`node:http`, sem dependências).
- `tests/helpers.js` — *fixture* `authHeaders` (login reutilizável) e `expectApiError` (valida o contrato `{ error: { code, message, details? } }`).
- `tests/*.spec.js` — `auth`, `products`, `orders`.
- `playwright.config.js` — sobe a API automaticamente (`webServer`) e gera relatórios HTML e JUnit.

## Endpoints sob teste
`POST /auth/login` · `GET /products` · `GET /products/:id` · `POST /orders` (autenticado) · `GET /orders/:id` · `GET /health`

Credencial **fictícia** da demo: `qa@example.com` / `Passw0rd!`.

## Regras de negócio cobertas
- Quantidade por item: inteiro de 1 a 10.
- Desconto de 10% quando o subtotal é **≥ R$ 500** (teste na fronteira exata, R$ 500).
- Pedido baixa estoque; estoque insuficiente → `409` sem alterar o estoque.
- Sem token/token inválido → `401`; produto inexistente → `404`; dados inválidos → `422` com o campo apontado.

## Executar
```bash
npm install
npm test               # sobe a API na porta 3100 e roda os testes
npm start              # opcional: só a API
```
Relatórios em `reports/` (`html/index.html`, `junit.xml`).

## Resultado esperado
29 testes passando. Em 16/10/2026 a execução local passou 29/29.

## Observação de projeto
`workers: 1` e ordem fixa: a API tem estado compartilhado (estoque). Em um serviço real, o ideal seria resetar dados por teste.
