# 0001: Contract-first API with OpenAPI 3.1
Status: accepted
`contracts/openapi.yaml` is authored before any code. FE mocks it (MSW), BE/Integrations implement it,
and CI regenerates `@sgm/contracts` and validates responses against it. Only humans change it (AGENTS.md §5).
