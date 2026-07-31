Model our Billing system as a cell architecture diagram.

Inside it we run a Billing API, an Invoice Service, a nightly Reconciliation
Worker, and our own MySQL database that holds invoices.

Who talks to it:

- Customers hit the Billing API from the public internet through our
  customer portal.
- Our internal finance team uses an Ops Console that is only reachable on the
  corporate network.

What it talks to:

- The company-wide Customer Profile API and the company-wide Notification
  service, both run by other teams on our internal platform.
- Auth0 for token introspection.
- SendGrid for emailing invoices.
