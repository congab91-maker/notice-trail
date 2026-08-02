# NoticeTrail Verification

This document binds the public release to the verified Studionet deployment, production web deployment and reproducible checks.

## Revision

- Exact deployed contract source commit: `6ca2d221c05693f541832574200b2f321c968344`
- Contract source: `contracts/notice_trail.py`
- Contract source SHA-256: `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`
- Deterministic reviewed pre-Git project root: `ffcd9a8fdf6e7cfbcc013978b3a31f793ec162bc53dd5dd6fe581d7f0b726509`
- Revision manifest: `docs/POST_DEPLOY_REVISION_MANIFEST.json`
- Live web: [https://notice-trail.vercel.app](https://notice-trail.vercel.app)

## Production web deployment

- Vercel team/project: `brunogg/notice-trail`
- Deployment ID: `dpl_FaQK6rk6qmHpEEGpwU5CyRqUSmbq`
- Immutable deployment: [https://notice-trail-3g9mhdnze-brunogg.vercel.app](https://notice-trail-3g9mhdnze-brunogg.vercel.app)
- Production alias: [https://notice-trail.vercel.app](https://notice-trail.vercel.app)
- Status: `Ready`
- HTTP smoke test: `200`, `text/html; charset=utf-8`
- Production bundle: `assets/index-C_ZbaHRM.js`, 743,488 bytes
- Bundle configuration readback: exact contract `0xB6031E1b9F464E9D7982769A38010EE474554caA` and RPC `https://studio.genlayer.com/api`

## Studionet deployment

- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract: [`0xB6031E1b9F464E9D7982769A38010EE474554caA`](https://explorer-studio.genlayer.com/address/0xB6031E1b9F464E9D7982769A38010EE474554caA)
- Deployment: [`0x2ffc1dcc44c4cd18611479d902bd8a4ff021411b18326d09343bd014bfd93ecb`](https://explorer-studio.genlayer.com/tx/0x2ffc1dcc44c4cd18611479d902bd8a4ff021411b18326d09343bd014bfd93ecb)
- Current-code upgrade: [`0x13a459feecb5767cad16e235b691e49dafdffe4b09ddef70da47bce9bf3b217e`](https://explorer-studio.genlayer.com/tx/0x13a459feecb5767cad16e235b691e49dafdffe4b09ddef70da47bce9bf3b217e)
- Upgrade result: `FINALIZED`, `MAJORITY_AGREE`, execution `SUCCESS`, 5/5 agree
- Current on-chain code: 39,279 bytes, exact byte match, SHA-256 `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`
- Policy readback: `NOTICE_TRAIL_V1`
- Upgrader readback: `0x0d4B860B08b9fba6cf1D928c4A19863176eaD563`

## Live proof matrix

| Actor/action | Method | Transaction | Final result | Authoritative readback |
| --- | --- | --- | --- | --- |
| Register public-record claim | `register_record` | [`0xbd02c2e2…923e4`](https://explorer-studio.genlayer.com/tx/0xbd02c2e28c809ab10ecbd4e267f09f5e60c51800548a9419cab44986053923e4) | `FINALIZED`, execution `SUCCESS` | Record #1 created |
| Evaluate claim | `evaluate_record` | [`0xe92a6fce…242e0`](https://explorer-studio.genlayer.com/tx/0xe92a6fceb6921725236f1b245419af5b0374afbd7b15adfb110b742080b242e0) | `FINALIZED`, `MAJORITY_AGREE`, `SUCCESS` | Record #1 `MATCHES_NOTICE` |
| Reassess claim | `reassess_record` | [`0x7d657056…8bf4c`](https://explorer-studio.genlayer.com/tx/0x7d6570568098c48d80b3cbef4bd92b12f39a57f9745f199a544679d610f8bf4c) | `FINALIZED`, `MAJORITY_AGREE`, `SUCCESS` | Record #1 counters `2/2`, history length `1` |
| Duplicate registration | `register_record` | [`0xe09f814f…bed81`](https://explorer-studio.genlayer.com/tx/0xe09f814f02a275d0ce8ba5f7061b73e0e9b1f4156ed873b1e719e952f96bed81) | `FINALIZED`, execution `ERROR` | State unchanged as expected |
| Distinct-wallet evaluation after remediation | `evaluate_record` | [`0x66440603…988b9`](https://explorer-studio.genlayer.com/tx/0x664406033f517cc88976d100baf35dd8af57cc0d3b32d19d5e7d72dd744988b9) | `FINALIZED`, `MAJORITY_AGREE`, `SUCCESS` | Record #2 `MATERIAL_CHANGE` |
| Distinct-wallet reassessment | `reassess_record` | [`0xa9704897…824f8`](https://explorer-studio.genlayer.com/tx/0xa970489799512173caae714f212ed79c0169870689ba5866c6e63c9f00c824f8) | `FINALIZED`, `MAJORITY_AGREE`, `SUCCESS` | Record #2 counters `2/2`, history length `1` |

The earlier Record #2 transaction `0x48b391bae2adb92a2c68f178b8f962c8e749da50aaec9a4a4e4e9cb2b0435ae7` finalized with `MAJORITY_DISAGREE`; it is retained only as failure and remediation evidence and is not counted as a successful evaluation.

## Separate upgrade rehearsal

- Rehearsal contract: [`0x92323F9ecb61DD499A96A5485c7d305FCD1E3b26`](https://explorer-studio.genlayer.com/address/0x92323F9ecb61DD499A96A5485c7d305FCD1E3b26)
- Deployment: [`0xe64031c3aabbc7de970da839ee9a479e215fca384c36a8cb867baef81a8debfc`](https://explorer-studio.genlayer.com/tx/0xe64031c3aabbc7de970da839ee9a479e215fca384c36a8cb867baef81a8debfc)
- State seed: [`0xb7e90a2c3462078bc2baf65f9b14c32c0fd6c9effe4fb9a5903f83e7fb5b9645`](https://explorer-studio.genlayer.com/tx/0xb7e90a2c3462078bc2baf65f9b14c32c0fd6c9effe4fb9a5903f83e7fb5b9645)
- Upgrade: [`0xab58ff50adcc30384d059b190ad853dc8b758ce1e86824d7332aca25e6d5459f`](https://explorer-studio.genlayer.com/tx/0xab58ff50adcc30384d059b190ad853dc8b758ce1e86824d7332aca25e6d5459f)
- Initial source: 37,224 bytes, SHA-256 `5c0dbe7658bbe7c64064efb1adcf1f3414861490d3bea46d0c95c173589cd33f`
- Upgraded source: 39,279 bytes, exact byte match, SHA-256 `72f6864155e2c226cfc4d05233a45f3f3d0a7457942da69739c4fcc17f52ad2d`
- Pre/post canonical Record #1 digest: `f9436002dd8f9a6f5791039f1a7f75ca891241dc2107effc846625fd20603255`
- Preserved: record count, canonical-key mapping, policy, counters, history and upgrader

## Reproducible checks

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
py -3.13 -m pytest tests/direct -W error
py -3.13 -m pip check
```

Verified results: 155 DirectVM tests, 105 frontend tests, GenVM lint/validation with 10 public methods, ESLint, TypeScript and production build all pass; `pip check` reports no broken requirements. The build emits one non-blocking approximately 743.49 kB chunk warning.

## Known limitations

- Production V1 supports only bounded direct Utah PMN HTML notice pages.
- URL hosting is treated as a claimed public-record source, not institutional-authenticity proof.
- Source availability or HTML structure may drift after registration.
- Stored public fingerprints bind complete accepted reasons and may differ when only the optional prompt-injection annotation differs; consensus recomputes its stricter stable comparison fingerprint.
- Upgrade control currently depends on one external wallet.
