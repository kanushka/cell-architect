We're building the order management side of our storefront.

There's a React web app that customers use. It talks to an Orders API, which
hands work to an Order Service. The Order Service owns a Postgres database for
order records, and publishes an `order.created` event through an event
publisher component.

Customers reach the web app over HTTPS from the public internet.

The Order Service charges cards through Stripe.

Draw this as a cell architecture diagram.
