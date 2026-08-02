# NoticeTrail

NoticeTrail is a public-record comparison ledger that uses GenLayer validator consensus to compare a frozen pre-meeting notice with later minutes or a resolution and store the resulting factual-alignment verdict on-chain.

## Verified links

- Studionet contract: [`0xB6031E1b9F464E9D7982769A38010EE474554caA`](https://explorer-studio.genlayer.com/address/0xB6031E1b9F464E9D7982769A38010EE474554caA)
- Deployment transaction: [`0x2ffc1dcc…93ecb`](https://explorer-studio.genlayer.com/tx/0x2ffc1dcc44c4cd18611479d902bd8a4ff021411b18326d09343bd014bfd93ecb)
- Current-code upgrade: [`0x13a459fe…b217e`](https://explorer-studio.genlayer.com/tx/0x13a459feecb5767cad16e235b691e49dafdffe4b09ddef70da47bce9bf3b217e)
- Live app: added after the separately authorized Vercel deployment stage.

## Trust problem

A notice publisher and a later record publisher may describe the same meeting item differently, while a submitter may selectively characterize either document. Readers should not have to trust the submitter's summary or a centralized backend's verdict. NoticeTrail binds one claim to two role-specific public URLs, freezes its meeting and item identity, and lets GenLayer validators independently inspect the sources.

NoticeTrail is a non-legal factual-comparison attestation. It does not determine legal validity, open-meeting compliance, political correctness, misconduct, intent, or vote merits. URL hosts are claimed public-record sources, not independently verified institutional authority.

## Why GenLayer is essential

The hard step is nondeterministic: interpreting whether two public documents refer to the same meeting and item and whether the recorded action matches, materially changes, omits, or cannot safely be compared with the notice. The contract performs that comparison through independent validator executions, validates a closed result schema, and accepts equivalence only across stable source and decision fields. Consensus writes one of five bounded verdicts to contract state:

- `MATCHES_NOTICE`
- `MATERIAL_CHANGE`
- `NO_FINAL_ACTION`
- `SOURCES_NOT_COMPARABLE`
- `UNRESOLVED`

The caller cannot submit the verdict, reason codes, fingerprints, or normalized action.

## How it works

1. A user connects and signs with an EIP-1193 wallet on Studionet.
2. The user registers one meeting item with a jurisdiction key, meeting key, item key, fixed Utah PMN host, agenda URL, and outcome URL.
3. Any wallet may trigger evaluation. Validators fetch and normalize both bounded public documents and independently compare meeting identity, item alignment, and action outcome.
4. After `FINALIZED`, successful execution, and authoritative readback, the UI displays the contract verdict and evidence fields.
5. Reassessment repeats the live comparison and preserves the prior accepted assessment in contract history.

## Architecture

- `contracts/notice_trail.py`: source of truth for registration, source constraints, validator consensus, verdicts, counters, history, and upgrades.
- `src/`: React/Vite interface for wallet selection, signing, transaction reconciliation, registration, evaluation, reassessment, and ledger readback.
- Studionet: authoritative transaction lifecycle and contract state.
- Browser state: presentation and pending-transaction coordination only; it never determines a verdict.

NoticeTrail has no backend, relayer, cron job, custody, escrow, payout, or off-chain verdict database.

## Intelligent Contract

The persistent layout is `record_count`, `records`, then `key_to_id`. The contract exposes four write methods:

- `register_record`: validates and freezes the two role-bound source URLs and canonical identity.
- `evaluate_record`: runs the comparison and stores the first accepted assessment.
- `reassess_record`: re-evaluates and preserves the previous accepted assessment in history.
- `upgrade`: replaces Root Slot code only for a registered upgrader and rejects empty code.

The equivalence validator requires exact agreement on the verdict, match fields, record roles, source fingerprints, and all decision-bearing reason codes. Only the bounded auxiliary annotation `PROMPT_INJECTION_IGNORED` may be excluded from equivalence after each full result independently passes schema validation. The public stored evidence fingerprint still binds the complete accepted result and can therefore change when that auxiliary annotation changes.

There is no economic value model. Studionet GEN is used only for network transaction fees and is not presented as real-money settlement.

## Transaction lifecycle

The frontend requires a fresh wallet signature after reload and after disconnect/reconnect. It treats a submitted hash as pending evidence, polls the existing transaction without blind resubmission, and reports success only after:

1. transaction status reaches `FINALIZED`;
2. consensus and execution indicate success; and
3. contract readback shows the exact expected counter, verdict, and history transition.

`MAJORITY_DISAGREE`, execution errors, timeouts, rejected signatures, unchanged state, and malformed readback remain recoverable error states. A retained hash is reconciled before any retry.

## Run locally

Prerequisites: Node.js 20+ and npm.

```bash
npm ci
cp .env.example .env.local
```

Set `VITE_CONTRACT_ADDRESS` to the verified Studionet contract. The default RPC is `https://studio.genlayer.com/api`.

```bash
npm run dev
```

The local app is served by Vite, normally at `http://localhost:3000`.

## Tests and verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
py -3.13 -m pytest tests/direct -W error
py -3.13 -m pip check
```

Current verified results:

- GenVM lint/validation: PASS, 10 public methods
- DirectVM: 155 tests passed with warnings promoted to errors
- Frontend: 105 tests passed across five files
- ESLint: PASS
- TypeScript: PASS
- Production build: PASS
- `pip check`: no broken requirements

See [verification evidence](docs/VERIFICATION.md) for live transactions and source parity.

## Deployment

- Network: GenLayer Studionet
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract: `0xB6031E1b9F464E9D7982769A38010EE474554caA`
- Policy: `NOTICE_TRAIL_V1`
- Current on-chain source SHA-256: `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`
- Classification: `UPGRADABLE`
- External upgrader: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`

The recovery manifest documents the principal deployment, current-code upgrade, populated separate-deployment upgrade rehearsal, exact source parity, and state-preservation readback: [Studionet deployment and recovery](docs/STUDIONET_DEPLOYMENT_RECOVERY.md).

## Security and trust boundaries

- Only exact HTTPS URLs on `www.utah.gov` matching the bounded Utah PMN notice grammar are accepted.
- Raw and normalized source sizes are capped; missing, malformed, conflicting, unavailable, or oversized evidence fails closed.
- Identity keys use a closed lowercase ASCII slug grammar.
- Verdicts and reasons use closed allowlists and a decision/reason consistency matrix.
- The frontend never advances state ahead of authoritative contract readback.
- Contract upgrade authority is concentrated in one external wallet. Loss or compromise of that key is a material recovery risk.
- The contract compares claimed public records but does not authenticate institutional ownership of the host.

## Known limitations

- Production V1 supports only direct Utah PMN HTML notice pages on `www.utah.gov`.
- Source structure or availability can change after registration and affect later reassessments.
- The adapter does not follow attachments or certify that a URL is institutionally authoritative.
- Public `evidence_fingerprint` values may vary across semantically equivalent reassessments when only the optional prompt-injection annotation varies; stable consensus fields remain exact.
- The production bundle currently emits a non-blocking approximately 743.49 kB chunk-size warning.
- Upgrader authority currently has single-key concentration risk.
