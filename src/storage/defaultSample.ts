export const defaultSampleSource = `component WebApp web-app
component orders as Orders api
component odb as OrderDB database
component ep as "Event Publisher" event

north ca as "Customer App" webapp
north pp as "Partner Portal" webapp
west ap as "Admin Portal" webapp
east inventories api
east customers api
south Stripe payment
south SendGrid email

ca -> WebApp : HTTPS
pp -> orders : REST
ap -> orders : backoffice

WebApp -> orders
orders -> odb
orders -> ep : order.created

orders -> inventories : reserve stock
orders -> customers : customer profile
orders -> Stripe : payment
orders -> SendGrid : email

north -> orders`;
