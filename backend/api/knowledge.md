# API Endpoints

This directory contains the implementation of various API endpoints for the Manifold platform.

## Key Concepts

- Each endpoint is typically implemented in its own file.
- The `routes.ts` file serves as the main router, connecting endpoint handlers to their respective routes.
- We use Supabase for database operations.
- Authentication is handled using the `APIHandler` type, which automatically manages user authentication based on the schema definition.
- The API VM is run on GCP as a single instance with 4 cores. One core is a write instance that handles all routes that write to the DB. The other cores are read-only instances and handle routes specified in `backend/api/url-map-config.yaml`.

## Mana/Sweepstakes Market Relationships

- Mana markets can have sweepstakes counterpart markets (siblingContractId)
- The mana market is the source of truth - changes to mana markets should propagate to their sweepstakes counterparts
- Changes that need to propagate include:
  - Adding new answers to multiple choice markets
  - Market metadata updates
  - Market resolution

## Adding a New API Endpoint

To add a new API endpoint, follow these steps:

1. Create a new file for the endpoint in the `backend/api/src` directory. Each endpoint should be in a new file.
2. Implement the endpoint logic in the new file.
3. Add the endpoint schema to `common/src/api/schema.ts`, including props, return type, and other information. Note that we only use POST and GET methods.
4. Update `backend/api/src/routes.ts`:
   - Import the handler function from the new file.
   - Add the handler to the `handlers` object.

Example:

```typescript
// 1. Create a new file: backend/api/src/my-new-endpoint.ts
import { APIHandler } from 'api/helpers/endpoint'

export const myNewEndpoint: APIHandler<'my-new-endpoint'> = async (props, auth, req) => {
  // Implement endpoint logic here
}

// 2. Add to common/src/api/schema.ts
'my-new-endpoint': {
  method: 'POST',
  visibility: 'public',
  authed: true,
  props: z.object({
    // Define props here using Zod schema
  }),
  returns: z.object({
    // Define return type here using Zod schema
  }),
},

// 3. Update backend/api/src/routes.ts
import { myNewEndpoint } from './my-new-endpoint'

const handlers: { [k in APIPath]: APIHandler<k> } = {
  // ... existing handlers
  'my-new-endpoint': myNewEndpoint,
}
```

## Authentication

Authentication is managed automatically by the `APIHandler` type. The `authed` property in the schema determines the authentication behavior:

- `false`: The endpoint can be called without authentication.
- `true`: The endpoint requires authentication. The `auth` object will be provided to the handler function.

Example of an authenticated endpoint:

```typescript
export const myAuthenticatedEndpoint: APIHandler<
  'my-authenticated-endpoint'
> = async (props, auth, req) => {
  const { uid } = auth // auth object is automatically provided for authenticated endpoints
  // Implement endpoint logic here
}
```

## Best Practices

- Use the `createSupabaseDirectClient` function from `shared/supabase/init` for database operations.
- For environment-specific IDs and constants, check common/antes.ts first as it contains important platform-wide constants like HOUSE_LIQUIDITY_PROVIDER_ID.

## Sports Markets

- Each sports event can have at most one MANA market and one CASH market
- If creation of the MANA market fails (e.g., due to duplicate sportsEventId), do not attempt to create the CASH market
- The MANA market is considered the "source of truth" - the CASH market should only exist if there is a corresponding MANA market
- Prefer lightweight check endpoints over complex validation in create/update endpoints when the check might be useful in other contexts

## Boosts

- The `contract_boosts` table supports boosting both contracts and posts
- Either `contract_id` or `post_id` must be specified, but not both
- The `purchase-boost` endpoint accepts either `contractId` or `postId` parameter
- Boosted content gets higher importance scores and appears more prominently on the homepage
- Boosts last for 24 hours and can be paid for with mana or cash

  This uses the pg promise library, where you pass raw sql strings like so:

```ts
import { createSupabaseClient } from 'shared/supabase/init'

const pg = createSupabaseDirectConnection()
const contractIds = await pg.manyOrNone(
  `select id from contracts`,
  [],
  (r) => r.id as string
)
```

- Keep endpoint logic modular and reusable when possible.
- Use TypeScript types consistently to ensure type safety across the API.
- Use Zod schemas in `common/src/api/schema.ts` to define prop and return types for strong type checking.
- Use the `APIError` class from `api/helpers/endpoint` to throw standardized API errors.
- Use lowercase SQL keywords in queries. Don't capitalize SQL keywords.
- Avoid editing the SQL via `${}`, and instead when using pgpromise, use the argument following the query to pass parameters to the query.

### Schema Definition

We use Zod for defining our API schemas. This provides runtime type checking and automatic documentation generation.

#### Setting Defaults

When defining schemas, prefer setting defaults in the Zod schema rather than in the handler function. This ensures that the default values are documented and type-checked.

Example:

```typescript
props: z.object({
  limit: z.number().default(50),
  offset: z.number().default(0),
  // other properties...
}).strict(),
```

### Data schema

Tables like contract_comments, contract_bets, contract_follows, etc, use two primary ids: contract_id, and an id specific to the table: comment_id, bet_id, or follow_id. Thus they have no primary 'id' column.

Thus to get a comment you would do:

```sql
select * from contract_comments where comment_id = $1
```

### Query Construction

For constructing SQL queries, we use custom SQL builder helper functions. These functions provide a more type-safe and maintainable way to build complex queries.

#### SQL Builder Functions

Use the sqlBuilder from `shared/supabase/sql-builder.ts` for constructing SQL queries with re-useable components. It has several helper functions for building SQL queries, including:

- `select`: Specifies the columns to select
- `from`: Specifies the table to query
- `where`: Adds WHERE clauses
- `orderBy`: Specifies the order of results
- `limit`: Limits the number of results
- `renderSql`: Combines all parts into a final SQL string

Example usage:

```typescript
const query = renderSql(
  select('*'),
  from('txns'),
  where('token = ${token}', { token }),
  orderBy('created_time desc'),
  limit(limitValue)
)
```

Using these functions instead of string concatenation helps prevent SQL injection and makes queries easier to read and maintain.
