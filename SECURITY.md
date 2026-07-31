# Security Policy

## Supported versions

Cell Architect is a small project with a single active line of development. Security fixes
land on `main` and are published in the next release of
[`@kanushka/cell-diagram-react`](https://www.npmjs.com/package/@kanushka/cell-diagram-react).
Older published versions are not patched.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Anything older | No — please upgrade |

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.**

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/kanushka/cell-architect/security/advisories/new)
for this repository. If that is unavailable to you, email **hello@kanushka.com** with
`SECURITY` in the subject line.

Please include:

- What the problem is and why you believe it is a security issue
- Steps to reproduce it, ideally with a minimal `.cell` source or share link
- The affected version, commit, or the hosted app at <https://cell-architect.web.app/>
- Any suggested fix, if you have one

You can expect an acknowledgement within **7 days** and an assessment within **30 days**.
This is a spare-time project, so please treat those as good-faith targets rather than a
contractual SLA. Once a fix is released, you will be credited in the advisory unless you
ask not to be.

## Threat model

Understanding what this project does and does not do will help you judge whether something
is a real issue.

Cell Architect is a **fully client-side** application. It has no backend, no database, no
accounts, and no telemetry:

- Diagrams are stored only in the visitor's browser `localStorage`.
- Share links compress the DSL into the URL fragment (`#s=…`). Fragments are never sent to
  a server, so shared diagram content is not transmitted to us or anyone else.
- The hosted app makes no outbound network requests at runtime and loads no third-party
  scripts, fonts, or analytics.

Because of that, the interesting attack surface is **untrusted diagram input** — a share
link, a pasted DSL snippet, or an imported `.cell` file — reaching another person's browser.
Findings we consider in scope include:

- Script execution or DOM injection from DSL content, labels, or layout metadata
- Escaping the local-storage document model, or corrupting another saved diagram
- Denial of service against a visitor from a crafted share link or `.cell` file
- Bypasses of the Content Security Policy or other response headers set in `firebase.json`
- Supply-chain problems in the release workflow or published package contents

Out of scope:

- Vulnerabilities that require the victim to paste attacker-supplied code into a devtools
  console
- Missing headers or hardening on endpoints that serve only static, public assets, where no
  concrete attack follows
- Reports produced solely by an automated scanner with no demonstrated impact
- Advisories against development-only dependencies with no path into the published package
  or the deployed site
- Social engineering, physical access, or attacks on Firebase Hosting or npm themselves

## Disclosure

Please give us a reasonable chance to ship a fix before publishing details. We aim to
release a patch and a GitHub Security Advisory within 90 days of a confirmed report, and
we are happy to coordinate timing with you.
