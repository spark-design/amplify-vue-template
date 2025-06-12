import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'tripStorage',
  access: (allow) => ({
    'trip-photos/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read'])
    ],
  })
});