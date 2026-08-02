# NoticeTrail Studionet Deployment and Recovery Manifest

Status: **POST-DEPLOY EVIDENCE REFRESH — POST_DEPLOY_TEST RE-REVIEW PENDING**

This document contains public deployment and recovery metadata only. It must never contain a private key, seed phrase, credential, token, or other secret.

## Contract classification

- Contract: `NoticeTrail`
- Policy version: `NOTICE_TRAIL_V1`
- Classification: `UPGRADABLE`
- Network: `Studionet`
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com/`
- Source: `contracts/notice_trail.py`
- Current on-chain contract source SHA-256: `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`
- Exact Git commit: not available at this checkpoint because repository packaging belongs to the later GitHub release stage.
- Whole-project revision binding: `docs/POST_DEPLOY_REVISION_MANIFEST.json`.
- Binding method: SHA-256 per included file plus a deterministic root over path-sorted manifest lines. The manifest itself is excluded from its root to avoid a circular hash; its own SHA-256 is pinned in the checkpoint review package.

Official references:

- https://docs.genlayer.com/developers/networks
- https://docs.genlayer.com/developers/intelligent-contracts/features/upgradability

## Selected wallet and roles

- Deployment wallet: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`
- Root Slot upgrader: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`
- Role arrangement: one user-controlled external wallet performs both deployment and upgrade authorization.
- User confirmation: the wallet is external to Studio, user-controlled, and the user accepts the single-key concentration risk.
- Deployment authorization was separately confirmed before transaction submission. This manifest records the resulting deployment and does not authorize any future deployment or upgrade.
- Constructor arguments: none. The constructor registers `gl.message.sender_address` in `root.upgraders`.

### Single-key risk

Using one wallet for both roles is operationally simple but creates a single point of control and recovery failure. Loss or compromise of this key may make safe recovery impossible or allow unauthorized code replacement. Keep the wallet outside Studio, protect it with the user's chosen secure custody method, and never store its secret material in this repository.

## Upgrade implementation

- `NoticeTrail.__init__` registers the deployment sender in `root.upgraders`.
- `get_upgraders()` provides public readback of the configured Root Slot upgrader.
- `upgrade(new_code: bytes)` rejects empty payloads and explicitly rejects callers absent from `root.upgraders` before replacing Root Slot code.
- GenVM Root Slot locking remains the runtime authorization boundary in addition to the explicit contract guard.

Direct-mode regression coverage proves:

1. the deployment sender fixture is registered as an upgrader;
2. the authorized upgrader can replace code;
3. an unauthorized wallet is rejected without mutating the existing canonical record, policy version, record count, or upgrader list; and
4. empty upgrade bytecode is rejected.

The exact deployed-source revision and current frontend correction revision also prove:

1. all three identity fields use the same closed lowercase ASCII slug grammar in contract and frontend, with delimiter-collision and JSON-quoted prompt binding tests;
2. every verdict uses a closed reason-code matrix and rejects contradictory extras even when required codes are present;
3. all 49 possible prior assessment snapshots remain visible and immutable through the 50-assessment lifetime bound;
4. frontend success requires exact `+1` counters and exact reassessment-history correspondence, rejecting concurrent counter/history jumps;
5. unmatched `<`, stray `>`, malformed nested tag boundaries, and empty tags fail closed without state mutation; and
6. hidden/active elements and unsupported or attributed markup fail closed before LLM execution while selected visible markup remains parseable;
7. each `SOURCES_NOT_COMPARABLE` reason has exact bidirectional correspondence with stored match/record-role fields, and the frontend verifies those exact fields in readback/history; and
8. raw identity whitespace and an absent, malformed, or all-zero contract address are rejected.

Fresh gates for this source revision: GenVM lint/validation PASS with 10 methods (6 view, 4 write); DirectVM `155 passed` with Python warnings promoted to errors and zero skips; Vitest `105 passed` across 5 files with zero skips; ESLint PASS; TypeScript PASS; production build PASS; and `pip check` reports no broken requirements. The build retains a non-blocking main-chunk warning of approximately 743.49 kB.

Direct-mode coverage complements, but does not replace, the live Studionet deployment receipt, deployed-source parity, upgrader readback, transaction lifecycle checks, and authoritative contract-state readback recorded below.

## Storage compatibility plan

The current persistent storage field order is:

1. `record_count: u256`
2. `records: TreeMap[u256, str]`
3. `key_to_id: TreeMap[str, u256]`

Every future upgrade must preserve this order and these types. Existing fields must not be reordered, removed, or assigned a different type. Any new persistent field must be appended only after a separately reviewed migration/compatibility plan. An upgrade must preserve existing record readback, canonical-key mapping, all 49 possible prior assessment snapshots, policy version, and retry counters.

## Linked contracts and configuration

- Linked contracts: `NOT APPLICABLE — NoticeTrail is currently a single-contract architecture.`
- Post-deployment configuration transactions: `NOT APPLICABLE — no writer/registry/child-contract configuration is currently defined.`
- Frontend contract address: `0xB6031E1b9F464E9D7982769A38010EE474554caA`

## Deployment evidence

- Contract address: `0xB6031E1b9F464E9D7982769A38010EE474554caA`
- Deployment transaction: `0x2ffc1dcc44c4cd18611479d902bd8a4ff021411b18326d09343bd014bfd93ecb`
- Receipt: `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`, validator result `5/5 agree`.
- Sender/origin/upgrader: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`.
- Initial deployed-source SHA-256: `5c0dbe7658bbe7c64064efb1adcf1f3414861490d3bea46d0c95c173589cd33f`.
- Authorized code upgrade: `0x13a459feecb5767cad16e235b691e49dafdffe4b09ddef70da47bce9bf3b217e` — sender `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`, `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`, validator result `5/5 agree`.
- Current on-chain source readback/parity: 39,279 bytes, verified byte-for-byte against `contracts/notice_trail.py`; SHA-256 `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`.
- Policy readback: `NOTICE_TRAIL_V1`.
- Explorer URL: `https://explorer-studio.genlayer.com/address/0xB6031E1b9F464E9D7982769A38010EE474554caA`
- Verified public agenda/outcome fixture: Panguitch City Council, June 23, 2026, item 8 `FRAUD RISK ASSESSMENT`; exact values are recorded below.
- Live register transaction: `0xbd02c2e28c809ab10ecbd4e267f09f5e60c51800548a9419cab44986053923e4` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`.
- Live evaluate transaction: `0xe92a6fceb6921725236f1b245419af5b0374afbd7b15adfb110b742080b242e0` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`.
- Live reassessment transaction: `0x7d6570568098c48d80b3cbef4bd92b12f39a57f9745f199a544679d610f8bf4c` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`.
- Duplicate registration rejection: `0xe09f814f02a275d0ce8ba5f7061b73e0e9b1f4156ed873b1e719e952f96bed81` — `FINALIZED`, execution `ERROR`, with authoritative state unchanged as expected.
- EIP-1193 wallet reassessment: `0xb00515e930bd26c97e780e5a2c51db6ff7793bee7028ff58607a7fc9d4f92aac` — `FINALIZED`, `MAJORITY_DISAGREE`; authoritative state remained `MATCHES_NOTICE`, assessment count `2`, retry count `2`, history length `1`.
- Record `1` accepted verdict readback: `MATCHES_NOTICE`, assessment count `2`, retry count `2`, history length `1`.
- Pre-remediation distinct-wallet evaluation: `0x48b391bae2adb92a2c68f178b8f962c8e749da50aaec9a4a4e4e9cb2b0435ae7` — sender `0x7885536194BbD6E1D0A6Ab991aB215CFa9542339`, `FINALIZED`, `MAJORITY_DISAGREE`; authoritative Record `2` state remained `REGISTERED` with zero counters and empty history. This transaction is retained as failure evidence and is not counted as success.
- Post-upgrade distinct-wallet evaluation: `0x664406033f517cc88976d100baf35dd8af57cc0d3b32d19d5e7d72dd744988b9` — `FINALIZED`, `MAJORITY_AGREE`, leader execution `SUCCESS`; Record `2` advanced to `MATERIAL_CHANGE`.
- Post-upgrade distinct-wallet reassessment: `0xa970489799512173caae714f212ed79c0169870689ba5866c6e63c9f00c824f8` — `FINALIZED`, `MAJORITY_AGREE`, leader execution `SUCCESS`.
- Authoritative Record `2` readback after reassessment: `MATERIAL_CHANGE`; meeting and item `EXACT`; outcome `MATERIAL_CHANGE`; assessment count `2`; retry count `2`; history length `1`; ledger count `2`.

### Separate safe upgrade rehearsal

The required upgrade rehearsal used a disposable, separate Studionet deployment rather than the principal application contract:

- Rehearsal contract: `0x92323F9ecb61DD499A96A5485c7d305FCD1E3b26`.
- Rehearsal deployment: `0xe64031c3aabbc7de970da839ee9a479e215fca384c36a8cb867baef81a8debfc` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`; sender/origin `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`.
- Initial rehearsal source: 37,224 bytes; SHA-256 `5c0dbe7658bbe7c64064efb1adcf1f3414861490d3bea46d0c95c173589cd33f`; exact on-chain byte parity confirmed.
- Initial upgrader readback: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`; initial policy `NOTICE_TRAIL_V1`; initial record count `0`.
- Pre-upgrade state seed: `0xb7e90a2c3462078bc2baf65f9b14c32c0fd6c9effe4fb9a5903f83e7fb5b9645` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`, validator result `5/5 agree`.
- Pre-upgrade state: record count `1`; Record `1` is `REGISTERED`, assessment count `0`, retry count `0`, history length `0`; canonical record SHA-256 `f9436002dd8f9a6f5791039f1a7f75ca891241dc2107effc846625fd20603255`.
- Rehearsal upgrade: `0xab58ff50adcc30384d059b190ad853dc8b758ce1e86824d7332aca25e6d5459f` — `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`, validator result `5/5 agree`; sender `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`.
- Post-upgrade source: 39,279 bytes; SHA-256 `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`; exact on-chain byte parity confirmed.
- Post-upgrade readback: upgrader and policy unchanged; record count remains `1`; direct-ID and canonical-key reads are identical; canonical Record `1` SHA-256 remains exactly `f9436002dd8f9a6f5791039f1a7f75ca891241dc2107effc846625fd20603255`.

The rehearsal therefore proves authorized code replacement and exact preservation of the populated storage layout, canonical-key mapping, policy, counters, history and upgrader configuration.

### Evidence-fingerprint semantics

The stored public `evidence_fingerprint` binds the complete accepted result, including its complete `reason_codes` list. It can therefore change across reassessments when the bounded auxiliary annotation `PROMPT_INJECTION_IGNORED` appears or disappears, even when source fingerprints and every decision-bearing semantic field remain unchanged. Consensus equivalence does not compare this variable stored fingerprint directly: it validates each complete result, removes only that one optional annotation for equivalence, and recomputes a canonical comparison fingerprint from both source fingerprints, record roles, stable decision fields, and all retained decision-bearing reasons. Every other reason-code difference remains consensus-significant.

## Public fixture requirements for live verification

The selected V1 adapter is the Utah Public Notice Website HTML notice adapter. It accepts a bounded raw response and extracts the complete official `Description/Agenda` field from `<dd class="agenda">`; it does not follow attachment links or silently truncate the field. Raw responses are capped by `MAX_RAW_SOURCE_BYTES = 32000`, and normalized semantic text is capped by `MAX_SOURCE_BYTES = 11000`. Missing adapter fields, oversized raw responses, oversized semantic fields, malformed UTF-8, or non-200 responses fail closed.

The caller passes only the frozen identity fields and two URLs; no expected verdict, digest, reason code, wallet role, or third source is a contract input. The source is labeled a **claimed public source**; NoticeTrail does not independently certify institutional authenticity.

### Selected Panguitch fixture

Exact registration values:

```text
jurisdiction_key = panguitch-city-council
meeting_key      = 2026-06-23-1730-panguitch-city-council
item_key         = item-8-fraud-risk-assessment
source_host      = www.utah.gov
agenda_url       = https://www.utah.gov/pmn/sitemap/notice/1090433.html
outcome_url      = https://www.utah.gov/pmn/sitemap/notice/1095595.html
```

Source-role and timing evidence observed before deployment and rechecked through the live assessment:

- Agenda notice title: `Panguitch City Council Agenda, June 23, 2026`.
- Agenda event: June 23, 2026 at 5:30 PM; posted June 18, 2026.
- Agenda item 8: `FRAUD RISK ASSESSMENT`.
- Outcome notice title: `Panguitch City Council Minutes, June 23, 2026`.
- Outcome event: the same June 23, 2026 meeting at 5:30 PM; posted July 15, 2026.
- Outcome for the target item: a motion to approve the Fraud Risk Assessment carried unanimously.

Observed adapter bounds and drift snapshots from fixture verification:

```text
agenda raw bytes:       16454 / 32000
agenda semantic bytes:   1414 / 11000
agenda semantic SHA-256: 84b25fb9cfcfe73d9a6208ccd517ab90a396ec566ba90ce45743a85b4c137352

outcome raw bytes:       26306 / 32000
outcome semantic bytes:  10580 / 11000
outcome semantic SHA-256: c0f64b40eb9bb970ffb44a2092666a35707c7e511e7b332f58b2a9ef8ffcf917
```

These SHA-256 values are off-chain drift snapshots only. The contract independently fetches, normalizes, and computes its own Keccak evidence fingerprints at assessment time. The expected semantic branch for this fixture is `MATCHES_NOTICE`, but that value is not passed to the contract and must not be displayed unless Studionet consensus finalizes successfully and canonical readback returns it. Any source drift or validator disagreement must fail closed or produce the supported conservative result.

## Post-deployment acceptance matrix

Verified:

1. deployment transaction is `FINALIZED` with execution `SUCCESS`;
2. `from_address` and `origin_address` equal the selected deployment wallet;
3. `get_upgraders()` returns the expected external wallet;
4. deployed source bytes and policy version match the recorded contract source;
5. frontend uses the real Studionet address and fails closed when configuration is absent;
6. registration, evaluation, successful reassessment, duplicate rejection, majority-disagree reconciliation, canonical-key readback, counters, and history were exercised live;
7. a genuinely distinct wallet successfully triggered both evaluation and reassessment; and
8. the alternate `MATERIAL_CHANGE` branch finalized and was confirmed through exact verdict, reason-field, counter, fingerprint, and history readback; and
9. a separate populated Studionet deployment completed an authorized upgrade with exact source parity and exact pre/post storage digest preservation.

No further live application-flow proof remains outstanding for the `POST_DEPLOY_TEST` re-review package.

## Recovery runbook

### Studio or local UI data resets while Studionet chain state remains

1. Reconnect the selected external wallet.
2. Import the contract using the recorded Studionet address.
3. Load the exact source from the recorded Git commit.
4. Verify its SHA-256 and compare deployed code through the current supported RPC/Explorer method.
5. Call `get_upgraders()` and confirm the selected wallet.
6. Resume interaction only after contract readback and smoke tests pass.
7. If an upgrade is required, review storage compatibility, test the candidate on a separate deployment, obtain explicit authorization, and only then submit the upgrade transaction.

### Studionet or chain state resets

The old address and state cannot be assumed recoverable.

1. Retrieve the exact source from the recorded Git commit and verify its SHA-256.
2. Redeploy from the selected external wallet using the recorded constructor manifest.
3. Verify FINALIZED/SUCCESS, sender/origin, upgrader readback, deployed source, and live smoke tests.
4. Record the new address, transaction and Explorer URL.
5. Replace frontend configuration only after the new contract passes verification.
6. Preserve the prior manifest as historical evidence and clearly mark the superseding deployment.

## Authorization boundary

This manifest records the verified deployment and current live evidence only. It does not authorize any future deployment, upgrade, GitHub push, or Vercel deployment. Each such action remains separately user-controlled.
