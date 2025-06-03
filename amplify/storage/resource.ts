import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'myAppStorage',
  access: (allow) => ({
    // Public access for viewing files
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    // Private files per user
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete'])
    ]
  })
});