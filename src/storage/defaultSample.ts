export const defaultSampleSource = `title OrderProject
version v1

component WebApp web-app
component api as OrderAPI api
component OrderService service
component odb as OrderDB database
component EventPublisher event

north CustomerApp webapp
north PartnerPortal webapp
west ap as AdminPortal webapp
east InventoryAPI api
east CustomerCell service
south Stripe payment
south SendGrid email

CustomerApp -> WebApp : HTTPS
PartnerPortal -> api : REST
ap -> api : backoffice

WebApp -> api
api -> OrderService
OrderService -> odb
OrderService -> EventPublisher : order.created

OrderService -> InventoryAPI : reserve stock
OrderService -> CustomerCell : customer profile
OrderService -> Stripe : payment
OrderService -> SendGrid : email

north -> api`;
