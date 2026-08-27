export default {
  providers: [
    {
      // Clerk Frontend API URL. Dev: https://<slug>.clerk.accounts.dev
      // Prod: https://clerk.xuntas.org
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
}
