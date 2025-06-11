import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Trip database table with fields for tracking
vacation plans. The authorization rule specifies that any user authenticated
via an API key can "create", "read", "update", and "delete" any "Trip" records.
=========================================================================*/
const schema = a.schema({
  Trip: a
    .model({
      destination: a.string(),
      startDate: a.string(),
      endDate: a.string(),
      budget: a.float(),
      notes: a.string(),
      status: a.enum(['PLANNED', 'BOOKED', 'COMPLETED', 'CANCELLED']).required().default('PLANNED'),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: trips } = await client.models.Trip.list()

// return <ul>{trips.map(trip => <li key={trip.id}>{trip.destination}</li>)}</ul>
