# Gift Card Manager

## Private deployment with Tailscale

The production deployment is a Docker Compose stack with a Tailscale sidecar.
The application shares the sidecar's network namespace and does not publish any
host ports. The application binds only to loopback; Tailscale Serve terminates
HTTPS for the tailnet DNS name and proxies to `127.0.0.1:3000`. Tailscale
Funnel is explicitly disabled.

This means the application is reachable only by a device that is connected to
your tailnet and allowed by its Tailscale access policy. Do not add a `ports:`
entry to either service: that would create a public-host-network bypass.

### Prerequisites

- A Linux host with Docker Engine and Docker Compose.
- MagicDNS and HTTPS enabled in the Tailscale admin console.
- A reusable, tagged Tailscale auth key. The tag should be limited to this
  service (for example, `tag:giftcard-mgr`) and permitted by your tailnet ACL.

### Deploy

1. Copy `.env.example` to `.env` and set `TS_AUTHKEY` to the generated auth
   key. Set `TAILSCALE_HOSTNAME` if `giftcard-mgr` is not the desired device
   name. Keep `.env` private; it is ignored by Git and Docker builds.
2. Start the stack:

   ```sh
   docker compose up -d --build
   ```

3. Open `https://<TAILSCALE_HOSTNAME>.<your-tailnet>.ts.net` from a device on
   the tailnet. The exact domain is shown by `docker compose logs tailscale`.

The `giftcard-data` Docker volume persists the SQLite database, and
`tailscale-state` preserves the proxy's Tailscale identity across restarts. The
first app start initializes the database schema.

### Access policy

Tailscale access controls are the authorization layer. Keep the default policy
only if every tailnet member should use the app. To limit access, create an ACL
or grant permitting only the intended users or groups to connect to
`tag:giftcard-mgr:443`; ensure that the auth key used above is tagged with
`tag:giftcard-mgr`.

For example, merge this policy fragment with your existing tailnet policy to
permit only members of an `app-users` group:

```json
{
  "tagOwners": {
    "tag:giftcard-mgr": ["autogroup:admin"]
  },
  "groups": {
    "group:app-users": ["you@example.com"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:app-users"],
      "dst": ["tag:giftcard-mgr:443"]
    }
  ]
}
```

No Funnel configuration is included. Keep `AllowFunnel` set to `false` in
`tailscale/serve.json` to prevent public internet exposure.

### Update

```sh
docker compose up -d --build
```
