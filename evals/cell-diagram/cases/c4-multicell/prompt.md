We have two teams and two cells in the Storefront project.

The Orders cell (label it "Order Cell", version v2) has an API and its own
order database. Customers reach the Orders API from a customer app.

The Products cell has an API and a catalog database.

The Orders API calls the Products API to get stock levels.

Both cells archive data to the same AWS S3 bucket.

Give me the diagram.
