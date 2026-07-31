export const defaultSampleSource = `title Storefront
version v3

component web as "Storefront Web" webapp
component support as "Support Dashboard" webapp
component checkout as "Checkout API" api
component payments as "Payments Service" service
component odb as "Order Store" database
component ep as "Event Publisher" event

east profiles as "User Profile API" api
south Stripe payment
south SendGrid email

# anonymous shoppers, over the internet
north -> web
# support staff, on the corporate network
west -> support

web -> checkout : HTTPS
support -> checkout : refunds

checkout -> odb
checkout -> profiles : fetch customer profile
checkout -> payments : authorize
checkout -> ep : order.created

payments -> Stripe : capture payment
ep -> SendGrid : order confirmation`;
