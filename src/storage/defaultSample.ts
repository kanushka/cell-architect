export const defaultSampleSource = `title OrderCell
version v1

component WebApp web-app
component OrderAPI api
component OrderService service
component OrderDB database
component EventPublisher event

north CustomerApp -> WebApp : HTTPS
north PartnerPortal -> OrderAPI : REST
west AdminPortal -> OrderAPI : backoffice

WebApp -> OrderAPI
OrderAPI -> OrderService
OrderService -> OrderDB
OrderService -> EventPublisher : order.created

OrderService -> east InventoryCell : reserve stock
OrderService -> east CustomerCell : customer profile
OrderService -> south Stripe : payment
OrderService -> south SendGrid : email`;
