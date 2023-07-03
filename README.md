# 🔮🍿 world-id-debug-tools

Collection of internal scripts that help debugging proof verification, signal hashing, etc. for semaphore.

## Running locally

1. Install dependencies
   ```
   pnpm i
   ```
2. Set your env vars.
   ```
   cp .env.example .env
   ```

### Generate and insert a random identity commitment

```
pnpm run identity --seed {optionalSeed} --no-insert
```

- `no-insert`: will only generate the identity without inserting it with the sequencer
- `seed`: will generate the identity with a specific seed to generate deterministic identities

### Generate a proof and verify it

```
pnpm run proof --id {outputFromIdentity} --no-verify
```

### Check your proof (`check_proof.js`)

Copy your proof and params into the file and run `node check_proof.js`.
It tries to automatically detect encoding issues or other common errors.
